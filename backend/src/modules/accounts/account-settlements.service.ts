import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountSettlement, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { AccountMovementsService } from './account-movements.service';
import { resolvePriceCandidates } from './price-resolution';
import { PendingItemPreview } from './account-settlements.types';
import { CreateSettlementDto } from './dto/create-settlement.dto';

const SETTLEMENT_DETAIL_INCLUDE = {
  customer: true,
  items: {
    include: {
      priceHistory: { include: { supplierReference: { include: { supplier: true } } } },
      deliveryNoteItem: { include: { deliveryNote: true } },
    },
  },
} satisfies Prisma.AccountSettlementInclude;

type SettlementDetail = Prisma.AccountSettlementGetPayload<{ include: typeof SETTLEMENT_DETAIL_INCLUDE }>;

@Injectable()
export class AccountSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accountMovements: AccountMovementsService,
  ) {}

  /**
   * Remitos pendientes de liquidar para un cliente (docs/01 §18): ítems de
   * remitos FIRMADOS que todavía no están vinculados a ninguna liquidación,
   * con el precio resuelto según la regla vigente — sin persistir nada
   * (preview de solo lectura, igual que el preview de importación).
   */
  async previewPending(customerId: string): Promise<PendingItemPreview[]> {
    await this.assertCustomerExists(customerId);

    const items = await this.prisma.deliveryNoteItem.findMany({
      where: { settlementItemId: null, deliveryNote: { customerId, status: 'FIRMADO' } },
      include: { deliveryNote: true },
      orderBy: { deliveryNote: { issuedAt: 'asc' } },
    });

    const now = new Date();
    return Promise.all(
      items.map(async (item) => {
        const candidates = await resolvePriceCandidates(this.prisma, item.productId, now);
        return {
          deliveryNoteItemId: item.id,
          deliveryNoteId: item.deliveryNoteId,
          deliveryNoteNumber: `${item.deliveryNote.series}-${String(item.deliveryNote.number).padStart(8, '0')}`,
          issuedAt: item.deliveryNote.issuedAt.toISOString(),
          code: item.codeSnapshot,
          description: item.descriptionSnapshot,
          quantity: Number(item.quantity),
          hasPricing: candidates.length > 0,
          chosenPrice: candidates[0] ?? null,
          candidates,
        };
      }),
    );
  }

  /**
   * Genera la liquidación en estado BORRADOR (docs/01 §18, pasos 4-8):
   * reserva los ítems elegidos (settlement_item_id) para que no puedan
   * incluirse en otra liquidación concurrente, calcula el precio de cada
   * uno con su desglose completo, pero todavía no impacta la cuenta
   * corriente — eso ocurre recién al confirmar.
   */
  async create(dto: CreateSettlementDto, actingUserId: string): Promise<SettlementDetail> {
    await this.assertCustomerExists(dto.customerId);

    const itemIds = [...new Set(dto.deliveryNoteItemIds)];
    const items = await this.prisma.deliveryNoteItem.findMany({
      where: {
        id: { in: itemIds },
        settlementItemId: null,
        deliveryNote: { customerId: dto.customerId, status: 'FIRMADO' },
      },
      include: { deliveryNote: true },
    });

    if (items.length !== itemIds.length) {
      throw new BadRequestException(
        'Uno o más remitos ya no están disponibles para liquidar (ya liquidados, anulados, o no pertenecen a este cliente)',
      );
    }

    const now = new Date();
    const resolved = await Promise.all(
      items.map(async (item) => ({ item, candidates: await resolvePriceCandidates(this.prisma, item.productId, now) })),
    );

    const missingPricing = resolved.filter((r) => r.candidates.length === 0);
    if (missingPricing.length > 0) {
      throw new BadRequestException(
        `No hay precio disponible para: ${missingPricing.map((r) => r.item.descriptionSnapshot).join(', ')}. ` +
          'Excluí esos ítems de la liquidación o cargá un precio manual antes de continuar.',
      );
    }

    const periodFrom = items.reduce((min, i) => (i.deliveryNote.issuedAt < min ? i.deliveryNote.issuedAt : min), items[0].deliveryNote.issuedAt);
    const periodTo = items.reduce((max, i) => (i.deliveryNote.issuedAt > max ? i.deliveryNote.issuedAt : max), items[0].deliveryNote.issuedAt);
    const totalAmount = resolved.reduce((sum, r) => sum + r.candidates[0].computedPublicPrice * Number(r.item.quantity), 0);

    const settlement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.accountSettlement.create({
        data: {
          customerId: dto.customerId,
          periodFrom,
          periodTo,
          totalAmount,
          status: 'BORRADOR',
          generatedById: actingUserId,
        },
      });

      for (const { item, candidates } of resolved) {
        const chosen = candidates[0];
        const quantity = Number(item.quantity);
        const settlementItem = await tx.accountSettlementItem.create({
          data: {
            settlementId: created.id,
            priceHistoryId: chosen.priceHistoryId,
            unitPrice: chosen.computedPublicPrice,
            quantity,
            subtotal: chosen.computedPublicPrice * quantity,
            marginPctApplied: chosen.marginPct,
            expensesPctApplied: chosen.expensesPct,
            ivaPctApplied: chosen.ivaPct,
            priceBreakdown: {
              product: item.descriptionSnapshot,
              code: item.codeSnapshot,
              deliveryNoteId: item.deliveryNoteId,
              deliveryNoteNumber: `${item.deliveryNote.series}-${String(item.deliveryNote.number).padStart(8, '0')}`,
              deliveryDate: item.deliveryNote.issuedAt.toISOString(),
              supplier: chosen.supplierName,
              priceListEffectiveDate: chosen.priceListEffectiveDate,
              netPrice: chosen.netPrice,
              marginPct: chosen.marginPct,
              expensesPct: chosen.expensesPct,
              ivaPct: chosen.ivaPct,
              roundingRule: chosen.roundingRule,
              finalPrice: chosen.computedPublicPrice,
              alternativeCandidates: candidates.slice(1),
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.deliveryNoteItem.update({ where: { id: item.id }, data: { settlementItemId: settlementItem.id } });
      }

      return created;
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'account-settlements',
      entityType: 'AccountSettlement',
      entityId: settlement.id,
      action: 'CREATE',
      newValue: { customerId: dto.customerId, totalAmount, itemCount: items.length },
    });

    return this.findOne(settlement.id);
  }

  async confirm(id: string, actingUserId: string): Promise<SettlementDetail> {
    const settlement = await this.findOne(id);
    if (settlement.status !== 'BORRADOR') {
      throw new BadRequestException(`No se puede confirmar una liquidación en estado ${settlement.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.accountSettlement.update({ where: { id }, data: { status: 'CONFIRMADA' } });

      await this.accountMovements.recordMovement(tx, {
        customerId: settlement.customerId,
        type: 'LIQUIDACION',
        referenceType: 'AccountSettlement',
        referenceId: id,
        debit: Number(settlement.totalAmount),
        createdById: actingUserId,
      });

      const deliveryNoteIds = [...new Set(settlement.items.map((i) => i.deliveryNoteItem!.deliveryNoteId))];
      for (const deliveryNoteId of deliveryNoteIds) {
        const stillPending = await tx.deliveryNoteItem.count({ where: { deliveryNoteId, settlementItemId: null } });
        if (stillPending === 0) {
          await tx.deliveryNote.update({ where: { id: deliveryNoteId }, data: { status: 'LIQUIDADO' } });
          await tx.deliveryNoteStatusHistory.create({
            data: { deliveryNoteId, fromStatus: 'FIRMADO', toStatus: 'LIQUIDADO', changedById: actingUserId },
          });
        }
      }
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'account-settlements',
      entityType: 'AccountSettlement',
      entityId: id,
      action: 'CONFIRM',
      oldValue: { status: 'BORRADOR' },
      newValue: { status: 'CONFIRMADA', totalAmount: Number(settlement.totalAmount) },
    });

    return this.findOne(id);
  }

  /**
   * Anula la liquidación (BORRADOR o CONFIRMADA). Nunca se borra: se
   * marca ANULADA, se libera cada remito/ítem para que vuelva a estar
   * disponible para una liquidación futura, y si ya había impactado la
   * cuenta corriente se revierte con un movimiento AJUSTE contrario —
   * nunca se edita ni se borra el movimiento original (docs/03 §5/§6).
   */
  async void(id: string, reason: string, actingUserId: string): Promise<SettlementDetail> {
    const settlement = await this.findOne(id);
    if (settlement.status === 'ANULADA') {
      throw new BadRequestException('La liquidación ya está anulada');
    }

    const wasConfirmed = settlement.status === 'CONFIRMADA';

    await this.prisma.$transaction(async (tx) => {
      await tx.accountSettlement.update({
        where: { id },
        data: { status: 'ANULADA', voidReason: reason, voidedById: actingUserId, voidedAt: new Date() },
      });

      for (const settlementItem of settlement.items) {
        const deliveryNoteItem = settlementItem.deliveryNoteItem;
        if (!deliveryNoteItem) continue;

        await tx.deliveryNoteItem.update({ where: { id: deliveryNoteItem.id }, data: { settlementItemId: null } });

        if (wasConfirmed) {
          const deliveryNote = await tx.deliveryNote.findUniqueOrThrow({ where: { id: deliveryNoteItem.deliveryNoteId } });
          if (deliveryNote.status === 'LIQUIDADO') {
            await tx.deliveryNote.update({ where: { id: deliveryNote.id }, data: { status: 'FIRMADO' } });
            await tx.deliveryNoteStatusHistory.create({
              data: {
                deliveryNoteId: deliveryNote.id,
                fromStatus: 'LIQUIDADO',
                toStatus: 'FIRMADO',
                changedById: actingUserId,
                reason: `Liquidación anulada: ${reason}`,
              },
            });
          }
        }
      }

      if (wasConfirmed) {
        await this.accountMovements.recordMovement(tx, {
          customerId: settlement.customerId,
          type: 'AJUSTE',
          referenceType: 'AccountSettlement',
          referenceId: id,
          credit: Number(settlement.totalAmount),
          createdById: actingUserId,
        });
      }
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'account-settlements',
      entityType: 'AccountSettlement',
      entityId: id,
      action: 'VOID',
      oldValue: { status: settlement.status },
      newValue: { status: 'ANULADA' },
      reason,
    });

    return this.findOne(id);
  }

  async findAll(filters: { customerId?: string; status?: AccountSettlement['status'] }): Promise<AccountSettlement[]> {
    return this.prisma.accountSettlement.findMany({
      where: { customerId: filters.customerId, status: filters.status },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string): Promise<SettlementDetail> {
    const settlement = await this.prisma.accountSettlement.findUnique({ where: { id }, include: SETTLEMENT_DETAIL_INCLUDE });
    if (!settlement) {
      throw new NotFoundException('Liquidación no encontrada');
    }
    return settlement;
  }

  private async assertCustomerExists(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new BadRequestException('El cliente indicado no existe');
    }
  }
}
