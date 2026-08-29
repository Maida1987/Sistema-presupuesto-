import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, Prisma, Product, ProductSupplierReference } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { CreateSupplierReferenceDto } from './dto/create-supplier-reference.dto';
import { MatchSupplierReferenceDto } from './dto/match-supplier-reference.dto';
import { mapRawProductRow, RawProductRow } from './product-raw-row';

@Injectable()
export class ProductSupplierReferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Alta manual de una referencia (uso principal: pruebas y casos puntuales;
   * el alta masiva real llega vía importación de listas en la Fase 2). El
   * código/descripción quedan tal cual los ingresa el usuario — nunca se
   * derivan ni se normalizan (ítem 7 del brief: no tocar el dato original).
   */
  async create(dto: CreateSupplierReferenceDto): Promise<ProductSupplierReference> {
    const existing = await this.prisma.productSupplierReference.findUnique({
      where: { supplierId_supplierCode: { supplierId: dto.supplierId, supplierCode: dto.supplierCode } },
    });
    if (existing) {
      throw new ConflictException('Ya existe una referencia con ese código para este proveedor');
    }

    return this.prisma.productSupplierReference.create({ data: dto });
  }

  async findAll(filters: { supplierId?: string; matchStatus?: MatchStatus }): Promise<ProductSupplierReference[]> {
    const where: Prisma.ProductSupplierReferenceWhereInput = {
      supplierId: filters.supplierId,
      matchStatus: filters.matchStatus,
    };

    return this.prisma.productSupplierReference.findMany({
      where,
      include: { supplier: true, product: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async findOneOrThrow(id: string): Promise<ProductSupplierReference> {
    const reference = await this.prisma.productSupplierReference.findUnique({ where: { id } });
    if (!reference) {
      throw new NotFoundException('Referencia de proveedor no encontrada');
    }
    return reference;
  }

  /**
   * Sugiere productos maestro candidatos por similitud de texto (docs/04
   * §5): nunca vincula solo, el usuario confirma con match().
   */
  async suggestCandidates(id: string): Promise<Product[]> {
    const reference = await this.findOneOrThrow(id);

    const rows = await this.prisma.$queryRaw<RawProductRow[]>`
      SELECT * FROM products
      WHERE status = 'ACTIVE'
        AND similarity(unaccent(description), unaccent(${reference.supplierDescription})) > 0.15
      ORDER BY similarity(unaccent(description), unaccent(${reference.supplierDescription})) DESC
      LIMIT 10
    `;

    return rows.map(mapRawProductRow);
  }

  async match(id: string, dto: MatchSupplierReferenceDto, actingUserId: string): Promise<ProductSupplierReference> {
    const reference = await this.findOneOrThrow(id);
    await this.prisma.product.findUniqueOrThrow({ where: { id: dto.productId } });

    const updated = await this.prisma.productSupplierReference.update({
      where: { id },
      data: {
        productId: dto.productId,
        matchStatus: 'MATCHED',
        matchedById: actingUserId,
        matchedAt: new Date(),
      },
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'products',
      entityType: 'ProductSupplierReference',
      entityId: id,
      action: 'MATCH',
      oldValue: { productId: reference.productId, matchStatus: reference.matchStatus },
      newValue: { productId: updated.productId, matchStatus: updated.matchStatus },
    });

    return updated;
  }

  async ignore(id: string, actingUserId: string): Promise<ProductSupplierReference> {
    const reference = await this.findOneOrThrow(id);

    const updated = await this.prisma.productSupplierReference.update({
      where: { id },
      data: { matchStatus: 'IGNORED' },
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'products',
      entityType: 'ProductSupplierReference',
      entityId: id,
      action: 'IGNORE',
      oldValue: { matchStatus: reference.matchStatus },
      newValue: { matchStatus: updated.matchStatus },
    });

    return updated;
  }
}
