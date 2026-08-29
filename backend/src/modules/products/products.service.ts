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
