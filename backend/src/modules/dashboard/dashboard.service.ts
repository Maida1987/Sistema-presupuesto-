import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DashboardSummary } from './dashboard.types';

const STALE_LIST_THRESHOLD_DAYS = 30;
const EXTREME_VARIATION_THRESHOLD = 0.4;
const RECENT_LIMIT = 5;

interface RawPriceChange {
  product_id: string;
  description: string;
  new_price: string | number;
  old_price: string | number;
}

/**
 * Dashboard con indicadores y alertas reales (docs/01 §25), calculados
 * contra los datos existentes — nada hardcodeado ni simulado. Cada
 * consulta se mantiene independiente y acotada (take/limit) para que el
 * dashboard siga siendo rápido a medida que crece el catálogo.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummary> {
    const [
      indicators,
      recentDeliveryNotes,
      recentPayments,
      significantPriceChanges,
      alerts,
    ] = await Promise.all([
      this.getIndicators(),
      this.getRecentDeliveryNotes(),
      this.getRecentPayments(),
      this.getSignificantPriceChanges(),
      this.getAlerts(),
    ]);

    return { indicators, recentDeliveryNotes, recentPayments, significantPriceChanges, alerts };
  }

  private async getIndicators(): Promise<DashboardSummary['indicators']> {
    const [latestBalances, pendingSettlementDeliveryNotes, productsCount, suppliersCount, priceListsCount] =
      await Promise.all([
        this.getLatestBalancePerCustomer(),
        this.prisma.deliveryNote.count({ where: { status: 'FIRMADO' } }),
        this.prisma.product.count({ where: { status: 'ACTIVE' } }),
        this.prisma.supplier.count({ where: { status: 'ACTIVE' } }),
        this.prisma.priceList.count(),
      ]);

    return {
      activeAccounts: latestBalances.length,
      totalReceivable: latestBalances.filter((b) => b.balance > 0).reduce((sum, b) => sum + b.balance, 0),
      pendingSettlementDeliveryNotes,
      productsCount,
      suppliersCount,
      priceListsCount,
    };
  }

  /** Última fila de account_movements por cliente (docs/03 "saldo siempre reconstruible"). */
  private async getLatestBalancePerCustomer(): Promise<{ customerId: string; balance: number }[]> {
    const rows = await this.prisma.accountMovement.findMany({
      distinct: ['customerId'],
      orderBy: [{ customerId: 'asc' }, { createdAt: 'desc' }],
      select: { customerId: true, balanceAfter: true },
    });
    return rows.map((r) => ({ customerId: r.customerId, balance: Number(r.balanceAfter) }));
  }

  private async getRecentDeliveryNotes(): Promise<DashboardSummary['recentDeliveryNotes']> {
    const notes = await this.prisma.deliveryNote.findMany({
      orderBy: { issuedAt: 'desc' },
      take: RECENT_LIMIT,
      include: { customer: true },
    });
    return notes.map((n) => ({
      id: n.id,
      number: n.number,
      series: n.series,
      issuedAt: n.issuedAt.toISOString(),
      status: n.status,
      customerName: n.customer.businessName,
    }));
  }

  private async getRecentPayments(): Promise<DashboardSummary['recentPayments']> {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'REGISTRADO' },
      orderBy: { paymentDate: 'desc' },
      take: RECENT_LIMIT,
      include: { customer: true },
    });
    return payments.map((p) => ({
      id: p.id,
      paymentDate: p.paymentDate.toISOString(),
      amount: Number(p.amount),
      customerName: p.customer.businessName,
    }));
  }

  /**
   * Compara cada price_history vigente con la fila que cerró (misma
   * cadena producto+referencia, effective_to de la anterior = effective_from
   * de la actual — así se versiona el precio, ver docs/04 §6.1).
   */
  private async getSignificantPriceChanges(): Promise<DashboardSummary['significantPriceChanges']> {
    const rows = await this.prisma.$queryRaw<RawPriceChange[]>`
      SELECT ph.product_id, p.description, ph.net_price AS new_price, prev.net_price AS old_price
      FROM price_history ph
      JOIN price_history prev
        ON prev.product_id = ph.product_id
        AND prev.supplier_reference_id IS NOT DISTINCT FROM ph.supplier_reference_id
        AND prev.effective_to = ph.effective_from
      JOIN products p ON p.id = ph.product_id
      WHERE ph.effective_to IS NULL
      ORDER BY ph.effective_from DESC
      LIMIT 50
    `;

    return rows
      .map((row) => {
        const newPrice = Number(row.new_price);
        const oldPrice = Number(row.old_price);
        const percentChange = oldPrice !== 0 ? (newPrice - oldPrice) / oldPrice : 0;
        return { productId: row.product_id, productDescription: row.description, previousPrice: oldPrice, newPrice, percentChange };
      })
      .filter((change) => Math.abs(change.percentChange) > EXTREME_VARIATION_THRESHOLD)
      .slice(0, RECENT_LIMIT);
  }

  private async getAlerts(): Promise<DashboardSummary['alerts']> {
    const [staleSupplierLists, productsWithoutPrice, unmatchedSupplierReferences, unsignedDeliveryNotes, highBalanceCustomers] =
      await Promise.all([
        this.getStaleSupplierLists(),
        this.getProductsWithoutPriceCount(),
        this.prisma.productSupplierReference.count({ where: { matchStatus: 'UNMATCHED' } }),
        this.prisma.deliveryNote.count({ where: { status: { in: ['EMITIDO', 'ENTREGADO'] } } }),
        this.getHighBalanceCustomers(),
      ]);

    return { staleSupplierLists, productsWithoutPrice, unmatchedSupplierReferences, unsignedDeliveryNotes, highBalanceCustomers };
  }

  private async getStaleSupplierLists(): Promise<DashboardSummary['alerts']['staleSupplierLists']> {
    const suppliers = await this.prisma.supplier.findMany({
      where: { status: 'ACTIVE' },
      include: { priceLists: { orderBy: { importedAt: 'desc' }, take: 1 } },
    });

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - STALE_LIST_THRESHOLD_DAYS);

    return suppliers
      .filter((s) => s.priceLists.length === 0 || s.priceLists[0].importedAt < threshold)
      .map((s) => ({
        supplierId: s.id,
        supplierName: s.name,
        lastImportedAt: s.priceLists[0]?.importedAt.toISOString() ?? null,
      }));
  }

  /** Productos vinculados a un proveedor pero sin ningún price_history vigente (docs/01 §46). */
  private async getProductsWithoutPriceCount(): Promise<number> {
    const matchedProductIds = await this.prisma.productSupplierReference.findMany({
      where: { matchStatus: 'MATCHED', productId: { not: null } },
      distinct: ['productId'],
      select: { productId: true },
    });
    if (matchedProductIds.length === 0) return 0;

    const withPrice = await this.prisma.priceHistory.findMany({
      where: { effectiveTo: null, productId: { in: matchedProductIds.map((r) => r.productId as string) } },
      distinct: ['productId'],
      select: { productId: true },
    });

    return matchedProductIds.length - withPrice.length;
  }

  private async getHighBalanceCustomers(): Promise<DashboardSummary['alerts']['highBalanceCustomers']> {
    const balances = await this.getLatestBalancePerCustomer();
    const positiveBalances = balances.filter((b) => b.balance > 0);
    if (positiveBalances.length === 0) return [];

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: positiveBalances.map((b) => b.customerId) }, creditLimit: { not: null } },
    });

    const balanceByCustomer = new Map(positiveBalances.map((b) => [b.customerId, b.balance]));
    return customers
      .filter((c) => balanceByCustomer.get(c.id)! > Number(c.creditLimit))
      .map((c) => ({
        customerId: c.id,
        customerName: c.businessName,
        balance: balanceByCustomer.get(c.id)!,
        creditLimit: Number(c.creditLimit),
      }));
  }
}
