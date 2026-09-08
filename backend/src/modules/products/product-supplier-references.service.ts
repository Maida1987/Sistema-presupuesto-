import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, Prisma, Product, ProductSupplierReference } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { CreateSupplierReferenceDto } from './dto/create-supplier-reference.dto';
import { MatchSupplierReferenceDto } from './dto/match-supplier-reference.dto';
import { BulkMatchItem } from './dto/bulk-match.dto';
import { CreateProductFromReferenceDto } from './dto/create-product-from-reference.dto';
import { mapRawProductRow, RawProductRow } from './product-raw-row';

const CANDIDATE_SIMILARITY_THRESHOLD = 0.15;

export interface MatchSuggestion {
  referenceId: string;
  candidate: Product | null;
  score: number | null;
}

interface RawSuggestionRow {
  reference_id: string;
  id: string | null;
  internal_code: string | null;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  unit: string | null;
  truck_application: string | null;
  status: Product['status'] | null;
  notes: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  score: number | null;
}

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

  async findAll(filters: {
    supplierId?: string;
    matchStatus?: MatchStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ProductSupplierReference[]; total: number }> {
    const where: Prisma.ProductSupplierReferenceWhereInput = {
      supplierId: filters.supplierId,
      matchStatus: filters.matchStatus,
    };
    const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const skip = Math.max(filters.offset ?? 0, 0);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.productSupplierReference.findMany({
        where,
        include: { supplier: true, product: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.productSupplierReference.count({ where }),
    ]);

    return { items, total };
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
        AND similarity(unaccent(description), unaccent(${reference.supplierDescription})) > ${CANDIDATE_SIMILARITY_THRESHOLD}
      ORDER BY similarity(unaccent(description), unaccent(${reference.supplierDescription})) DESC
      LIMIT 10
    `;

    return rows.map(mapRawProductRow);
  }

  async match(id: string, dto: MatchSupplierReferenceDto, actingUserId: string): Promise<ProductSupplierReference> {
    const reference = await this.findOneOrThrow(id);
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) {
      throw new NotFoundException('El producto indicado no existe');
    }

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

  /**
   * Sugerencias en lote: la versión de suggestCandidates() pensada para una
   * pantalla de matching masivo. Una sola consulta con LATERAL JOIN en vez
   * de N consultas (una por referencia) — el mismo tipo de error que se
   * corrigió en la importación (ver price-lists.service.ts) no debía
   * repetirse acá con volúmenes de miles de referencias sin matchear.
   * Devuelve una fila por referencia pedida, con candidate=null cuando
   * ningún producto activo supera el umbral de similitud.
   */
  async suggestBulkCandidates(referenceIds: string[]): Promise<MatchSuggestion[]> {
    const ids = Prisma.join(referenceIds);
    const rows = await this.prisma.$queryRaw<RawSuggestionRow[]>`
      SELECT
        r.id AS reference_id,
        m.id,
        m.internal_code,
        m.description,
        m.brand,
        m.category_id,
        m.unit,
        m.truck_application,
        m.status,
        m.notes,
        m.created_at,
        m.updated_at,
        m.score
      FROM product_supplier_references r
      LEFT JOIN LATERAL (
        SELECT p.*, similarity(unaccent(p.description), unaccent(r.supplier_description)) AS score
        FROM products p
        WHERE p.status = 'ACTIVE'
          AND similarity(unaccent(p.description), unaccent(r.supplier_description)) > ${CANDIDATE_SIMILARITY_THRESHOLD}
        ORDER BY score DESC
        LIMIT 1
      ) m ON true
      WHERE r.id IN (${ids})
    `;

    return rows.map((row) => ({
      referenceId: row.reference_id,
      candidate: row.id ? mapRawProductRow(row as unknown as RawProductRow) : null,
      score: row.score !== null ? Number(row.score) : null,
    }));
  }

  /**
   * Confirma varios matches de una vez (revisados por el usuario en la
   * pantalla de matching masivo — nunca automático sin confirmación, ver
   * docs/04 §5). Se valida todo antes de escribir nada: si un producto o
   * una referencia no existen, no se aplica ningún cambio del lote.
   */
  async bulkMatch(items: BulkMatchItem[], actingUserId: string): Promise<{ matched: number }> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
    const validProductIds = new Set(products.map((p) => p.id));
    const missingProducts = productIds.filter((id) => !validProductIds.has(id));
    if (missingProducts.length > 0) {
      throw new NotFoundException(`Producto(s) inexistente(s): ${missingProducts.join(', ')}`);
    }

    const referenceIds = items.map((item) => item.referenceId);
    const references = await this.prisma.productSupplierReference.findMany({
      where: { id: { in: referenceIds } },
      select: { id: true, productId: true, matchStatus: true },
    });
    const referenceById = new Map(references.map((ref) => [ref.id, ref]));
    const missingReferences = referenceIds.filter((id) => !referenceById.has(id));
    if (missingReferences.length > 0) {
      throw new NotFoundException(`Referencia(s) inexistente(s): ${missingReferences.join(', ')}`);
    }

    const now = new Date();
    await this.prisma.$transaction(
      async (tx) => {
        for (const item of items) {
          await tx.productSupplierReference.update({
            where: { id: item.referenceId },
            data: { productId: item.productId, matchStatus: 'MATCHED', matchedById: actingUserId, matchedAt: now },
          });
        }
      },
      { timeout: 60_000 },
    );

    for (const item of items) {
      const before = referenceById.get(item.referenceId)!;
      await this.auditService.record({
        userId: actingUserId,
        module: 'products',
        entityType: 'ProductSupplierReference',
        entityId: item.referenceId,
        action: 'MATCH',
        oldValue: { productId: before.productId, matchStatus: before.matchStatus },
        newValue: { productId: item.productId, matchStatus: 'MATCHED' },
      });
    }

    return { matched: items.length };
  }

  async bulkIgnore(referenceIds: string[], actingUserId: string): Promise<{ ignored: number }> {
    const references = await this.prisma.productSupplierReference.findMany({
      where: { id: { in: referenceIds } },
      select: { id: true, matchStatus: true },
    });
    const referenceById = new Map(references.map((ref) => [ref.id, ref]));
    const missing = referenceIds.filter((id) => !referenceById.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Referencia(s) inexistente(s): ${missing.join(', ')}`);
    }

    await this.prisma.$transaction(
      async (tx) => {
        for (const id of referenceIds) {
          await tx.productSupplierReference.update({ where: { id }, data: { matchStatus: 'IGNORED' } });
        }
      },
      { timeout: 60_000 },
    );

    for (const id of referenceIds) {
      const before = referenceById.get(id)!;
      await this.auditService.record({
        userId: actingUserId,
        module: 'products',
        entityType: 'ProductSupplierReference',
        entityId: id,
        action: 'IGNORE',
        oldValue: { matchStatus: before.matchStatus },
        newValue: { matchStatus: 'IGNORED' },
      });
    }

    return { ignored: referenceIds.length };
  }

  /**
   * Caso real y frecuente (docs/04 §4 punto 4): la referencia no tiene
   * ningún candidato razonable porque el producto todavía no existe en el
   * catálogo maestro. Crea el producto y vincula la referencia en la misma
   * transacción — nunca un producto huérfano ni una referencia matcheada a
   * un producto que falló al crearse.
   */
  async createProductAndMatch(
    referenceId: string,
    dto: CreateProductFromReferenceDto,
    actingUserId: string,
  ): Promise<{ product: Product; reference: ProductSupplierReference }> {
    const reference = await this.findOneOrThrow(referenceId);

    const existingProduct = await this.prisma.product.findUnique({ where: { internalCode: dto.internalCode } });
    if (existingProduct) {
      throw new ConflictException('Ya existe un producto con ese código interno');
    }

    const [product, updatedReference] = await this.prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({ data: dto });
      const matchedReference = await tx.productSupplierReference.update({
        where: { id: referenceId },
        data: {
          productId: createdProduct.id,
          matchStatus: 'MATCHED',
          matchedById: actingUserId,
          matchedAt: new Date(),
        },
      });
      return [createdProduct, matchedReference] as const;
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'products',
      entityType: 'Product',
      entityId: product.id,
      action: 'CREATE',
      newValue: product,
    });
    await this.auditService.record({
      userId: actingUserId,
      module: 'products',
      entityType: 'ProductSupplierReference',
      entityId: referenceId,
      action: 'MATCH',
      oldValue: { productId: reference.productId, matchStatus: reference.matchStatus },
      newValue: { productId: updatedReference.productId, matchStatus: updatedReference.matchStatus },
    });

    return { product, reference: updatedReference };
  }
}
