import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductsService } from '../products/products.service';

const RESULT_LIMIT = 5;

export interface GlobalSearchResult {
  customers: { id: string; businessName: string; internalCode: string }[];
  suppliers: { id: string; name: string; code: string }[];
  products: { id: string; internalCode: string; description: string }[];
  deliveryNotes: { id: string; number: number; series: string; customerName: string; status: string }[];
}

/**
 * Buscador global (docs/01 §26): una sola caja de búsqueda que encuentra
 * cliente/remito/producto/proveedor a la vez. Reutiliza ProductsService.search
 * (misma búsqueda tolerante por similitud que ya usa el catálogo) en vez
 * de duplicar esa lógica.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async globalSearch(term: string): Promise<GlobalSearchResult> {
    const trimmed = term.trim();
    if (trimmed.length === 0) {
      return { customers: [], suppliers: [], products: [], deliveryNotes: [] };
    }

    const [customers, suppliers, products, deliveryNotes] = await Promise.all([
      this.prisma.customer.findMany({
        where: {
          OR: [
            { businessName: { contains: trimmed, mode: 'insensitive' } },
            { internalCode: { contains: trimmed, mode: 'insensitive' } },
            { cuit: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        take: RESULT_LIMIT,
        select: { id: true, businessName: true, internalCode: true },
      }),
      this.prisma.supplier.findMany({
        where: {
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { code: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        take: RESULT_LIMIT,
        select: { id: true, name: true, code: true },
      }),
      this.productsService.search(trimmed).then((rows) => rows.slice(0, RESULT_LIMIT)),
      this.searchDeliveryNotes(trimmed),
    ]);

    return {
      customers,
      suppliers,
      products: products.map((p) => ({ id: p.id, internalCode: p.internalCode, description: p.description })),
      deliveryNotes,
    };
  }

  private async searchDeliveryNotes(term: string): Promise<GlobalSearchResult['deliveryNotes']> {
    const numericTerm = Number(term.replace(/^0+/, '') || '0');
    const notes = await this.prisma.deliveryNote.findMany({
      where: {
        OR: [
          ...(Number.isFinite(numericTerm) && numericTerm > 0 ? [{ number: numericTerm }] : []),
          { customer: { businessName: { contains: term, mode: 'insensitive' as const } } },
          { items: { some: { codeSnapshot: { contains: term, mode: 'insensitive' as const } } } },
        ],
      },
      take: RESULT_LIMIT,
      orderBy: { issuedAt: 'desc' },
      include: { customer: true },
    });

    return notes.map((n) => ({
      id: n.id,
      number: n.number,
      series: n.series,
      customerName: n.customer.businessName,
      status: n.status,
    }));
  }
}
