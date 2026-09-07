import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryNote, DeliveryNoteStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { DocumentCountersService } from '../document-counters/document-counters.service';
import { CreateDeliveryNoteDto } from './dto/create-delivery-note.dto';
import { DeliveryNotePdfService } from './delivery-note-pdf.service';

const DEFAULT_SERIES = 'A';
const DOC_TYPE = 'DELIVERY_NOTE';

const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export function extensionForMimetype(mimetype: string): string {
  return EXTENSION_BY_MIMETYPE[mimetype] ?? '.bin';
}

export function mimetypeForStorageKey(storageKey: string): string {
  const entry = Object.entries(EXTENSION_BY_MIMETYPE).find(([, ext]) => storageKey.endsWith(ext));
  return entry?.[0] ?? 'application/octet-stream';
}

const DELIVERY_NOTE_DETAIL_INCLUDE = {
  customer: true,
  items: { include: { product: true } },
  documents: true,
  statusLog: { orderBy: { changedAt: 'asc' as const } },
} satisfies Prisma.DeliveryNoteInclude;

type DeliveryNoteDetail = Prisma.DeliveryNoteGetPayload<{ include: typeof DELIVERY_NOTE_DETAIL_INCLUDE }>;

@Injectable()
export class DeliveryNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storage: FileStorageService,
    private readonly documentCounters: DocumentCountersService,
    private readonly pdfService: DeliveryNotePdfService,
  ) {}

  /**
   * Numeración + inserción del remito y sus ítems en una única transacción
   * (docs/02-arquitectura.md §4/§5): nunca queda un número reservado sin
   * remito asociado salvo que la transacción entera falle (en cuyo caso el
   * número se pierde, lo cual es aceptable — nunca se reutiliza).
   * El remito nace en estado EMITIDO: no se modela un paso BORRADOR
   * separado, para mantener el flujo de "pocos pasos" que pide el brief.
   */
  async create(dto: CreateDeliveryNoteDto, actingUserId: string): Promise<DeliveryNoteDetail> {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new BadRequestException('El cliente indicado no existe');
    }
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no existen');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const series = dto.series ?? DEFAULT_SERIES;

    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.documentCounters.getNextNumber(DOC_TYPE, series, undefined, tx);

      const deliveryNote = await tx.deliveryNote.create({
        data: {
          number,
          series,
          customerId: dto.customerId,
          createdById: actingUserId,
          status: 'EMITIDO',
          items: {
            create: dto.items.map((item) => {
              const product = productById.get(item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                unit: item.unit ?? product.unit,
                codeSnapshot: product.internalCode,
                descriptionSnapshot: product.description,
              };
            }),
          },
        },
      });

      await tx.deliveryNoteStatusHistory.create({
        data: { deliveryNoteId: deliveryNote.id, toStatus: 'EMITIDO', changedById: actingUserId },
      });

      return deliveryNote;
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'delivery-notes',
      entityType: 'DeliveryNote',
      entityId: created.id,
      action: 'CREATE',
      newValue: created,
    });

    return this.findOne(created.id);
  }

  async findAll(filters: { customerId?: string; status?: DeliveryNoteStatus }): Promise<DeliveryNote[]> {
    return this.prisma.deliveryNote.findMany({
      where: { customerId: filters.customerId, status: filters.status },
      include: { customer: true },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string): Promise<DeliveryNoteDetail> {
    const deliveryNote = await this.prisma.deliveryNote.findUnique({
      where: { id },
      include: DELIVERY_NOTE_DETAIL_INCLUDE,
    });
    if (!deliveryNote) {
      throw new NotFoundException('Remito no encontrado');
    }
    return deliveryNote;
  }

  async generatePdf(id: string, copyType: 'ORIGINAL' | 'DUPLICADO'): Promise<Buffer> {
    const deliveryNote = await this.findOne(id);
    return this.pdfService.generate(
      {
        number: deliveryNote.number,
        series: deliveryNote.series,
        issuedAt: deliveryNote.issuedAt,
        customerName: deliveryNote.customer.businessName,
        customerCode: deliveryNote.customer.internalCode,
        items: deliveryNote.items.map((item) => ({
          codeSnapshot: item.codeSnapshot,
          descriptionSnapshot: item.descriptionSnapshot,
          quantity: item.quantity.toString(),
          unit: item.unit,
        })),
      },
      copyType,
    );
  }

  async markDelivered(id: string, actingUserId: string): Promise<DeliveryNoteDetail> {
    const deliveryNote = await this.findOne(id);
    this.assertTransition(deliveryNote.status, 'ENTREGADO', ['EMITIDO']);
    await this.transition(id, deliveryNote.status, 'ENTREGADO', actingUserId);
    return this.findOne(id);
  }

  /**
   * Adjunta la evidencia del remito firmado (docs/01 §15/§22). Acepta
   * adjuntar tanto desde EMITIDO como desde ENTREGADO: si todavía no se
   * había marcado la entrega explícitamente, se registra ese paso
   * intermedio en el mismo movimiento (queda igual de auditado, sin
   * exigirle al usuario un clic adicional que en la práctica ya ocurrió
   * al hacer firmar al cliente).
   */
  async attachSignedDocument(id: string, buffer: Buffer, mimetype: string, actingUserId: string): Promise<DeliveryNoteDetail> {
    const deliveryNote = await this.findOne(id);
    if (!['EMITIDO', 'ENTREGADO'].includes(deliveryNote.status)) {
      throw new BadRequestException(`No se puede adjuntar firma en estado ${deliveryNote.status}`);
    }

    const storageKey = await this.storage.save(buffer, 'delivery-note-signatures', extensionForMimetype(mimetype));

    await this.prisma.$transaction(async (tx) => {
      if (deliveryNote.status === 'EMITIDO') {
        await this.transition(id, 'EMITIDO', 'ENTREGADO', actingUserId, tx);
      }

      await tx.deliveryNoteDocument.create({
        data: { deliveryNoteId: id, type: 'FIRMADO_SCAN', storageKey, uploadedById: actingUserId },
      });

      await this.transition(id, 'ENTREGADO', 'FIRMADO', actingUserId, tx);
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'delivery-notes',
      entityType: 'DeliveryNote',
      entityId: id,
      action: 'ATTACH_SIGNED_DOCUMENT',
      newValue: { storageKey },
    });

    return this.findOne(id);
  }

  async readSignedDocument(documentId: string): Promise<{ buffer: Buffer; mimetype: string }> {
    const document = await this.prisma.deliveryNoteDocument.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }
    const buffer = await this.storage.read(document.storageKey);
    return { buffer, mimetype: mimetypeForStorageKey(document.storageKey) };
  }

  async void(id: string, reason: string, actingUserId: string): Promise<DeliveryNoteDetail> {
    const deliveryNote = await this.findOne(id);
    if (deliveryNote.status === 'ANULADO') {
      throw new BadRequestException('El remito ya está anulado');
    }
    if (deliveryNote.status === 'LIQUIDADO') {
      throw new BadRequestException(
        'No se puede anular un remito liquidado directamente: primero hay que anular la liquidación que lo incluye',
      );
    }

    const fromStatus = deliveryNote.status;
    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryNote.update({
        where: { id },
        data: { status: 'ANULADO', voidReason: reason, voidedById: actingUserId, voidedAt: new Date() },
      });
      await tx.deliveryNoteStatusHistory.create({
        data: { deliveryNoteId: id, fromStatus, toStatus: 'ANULADO', changedById: actingUserId, reason },
      });
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'delivery-notes',
      entityType: 'DeliveryNote',
      entityId: id,
      action: 'VOID',
      oldValue: { status: fromStatus },
      newValue: { status: 'ANULADO' },
      reason,
    });

    return this.findOne(id);
  }

  private assertTransition(current: DeliveryNoteStatus, target: DeliveryNoteStatus, allowedFrom: DeliveryNoteStatus[]): void {
    if (!allowedFrom.includes(current)) {
      throw new BadRequestException(`No se puede pasar de ${current} a ${target}`);
    }
  }

  private async transition(
    id: string,
    fromStatus: DeliveryNoteStatus,
    toStatus: DeliveryNoteStatus,
    actingUserId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.deliveryNote.update({ where: { id }, data: { status: toStatus } });
    await client.deliveryNoteStatusHistory.create({
      data: { deliveryNoteId: id, fromStatus, toStatus, changedById: actingUserId },
    });
  }
}
