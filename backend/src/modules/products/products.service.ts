import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { mapRawProductRow, RawProductRow } from './product-raw-row';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateProductDto, actingUserId: string): Promise<Product> {
    const product = await this.prisma.product.create({ data: dto });

    await this.auditService.record({
      userId: actingUserId,
      module: 'products',
      entityType: 'Product',
      entityId: product.id,
      action: 'CREATE',
      newValue: product,
    });

    return product;
  }

  /**
   * Búsqueda tolerante a variaciones de escritura (docs/03 §4, docs/04 §5):
   * "bomba agua" debe encontrar "BOMBA DE AGUA", "BBA AGUA", etc. Se usa
   * pg_trgm (similarity + unaccent) en vez de un simple `contains`, que solo
   * resolvería substrings exactos.
   */
  async search(term?: string): Promise<Product[]> {
    if (!term || term.trim().length === 0) {
      return this.prisma.product.findMany({ orderBy: { description: 'asc' }, take: 100 });
    }

    const rows = await this.prisma.$queryRaw<RawProductRow[]>`
      SELECT * FROM products
      WHERE status = 'ACTIVE'
        AND (
          unaccent(description) ILIKE '%' || unaccent(${term}) || '%'
          OR unaccent(internal_code) ILIKE '%' || unaccent(${term}) || '%'
          OR similarity(unaccent(description), unaccent(${term})) > 0.2
        )
      ORDER BY similarity(unaccent(description), unaccent(${term})) DESC
      LIMIT 50
    `;

    return rows.map(mapRawProductRow);
  }

  /**
   * Comparador de precios entre proveedores para un producto (docs/04
   * §6.3): último precio de cada referencia de proveedor vinculada, con
   * la variación % respecto de la lista anterior del mismo proveedor y el
   * "mejor costo" resaltado. Nota: no convierte moneda (ver pregunta
   * abierta de tipo de cambio en docs/01 §8) — el precio y su moneda se
   * muestran siempre juntos para no comparar ARS contra USD como si
   * fueran lo mismo.
   */
  async comparePrices(productId: string): Promise<{
    productId: string;
    bestSupplierId: string | null;
    comparisons: Array<{
      supplierId: string;
      supplierName: string;
      supplierCode: string;
      price: number;
      currency: string;
      effectiveDate: Date;
      previousPrice: number | null;
      percentChange: number | null;
    }>;
  }> {
    await this.findOne(productId);

    const references = await this.prisma.productSupplierReference.findMany({
      where: { productId, matchStatus: 'MATCHED' },
      include: {
        supplier: true,
        priceListItems: { orderBy: { createdAt: 'desc' }, take: 2, include: { priceList: true } },
      },
    });

    const comparisons = references
      .filter((reference) => reference.priceListItems.length > 0)
      .map((reference) => {
        const [latest, previous] = reference.priceListItems;
        const price = Number(latest.price);
        const previousPrice = previous ? Number(previous.price) : null;
        return {
          supplierId: reference.supplierId,
          supplierName: reference.supplier.name,
          supplierCode: reference.supplierCode,
          price,
          currency: latest.currency,
          effectiveDate: latest.priceList.effectiveDate,
          previousPrice,
          percentChange: previousPrice ? (price - previousPrice) / previousPrice : null,
        };
      })
      .sort((a, b) => a.price - b.price);

    return { productId, bestSupplierId: comparisons[0]?.supplierId ?? null, comparisons };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto, actingUserId: string): Promise<Product> {
    const existing = await this.findOne(id);

    const updated = await this.prisma.product.update({ where: { id }, data: dto });

    await this.auditService.record({
      userId: actingUserId,
      module: 'products',
      entityType: 'Product',
      entityId: id,
      action: 'UPDATE',
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actingUserId: string): Promise<Product> {
    const existing = await this.findOne(id);

    const updated = await this.prisma.product.update({ where: { id }, data: { status } });

    await this.auditService.record({
      userId: actingUserId,
      module: 'products',
      entityType: 'Product',
      entityId: id,
      action: status === 'ACTIVE' ? 'REACTIVATE' : 'DEACTIVATE',
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });

    return updated;
  }
}
