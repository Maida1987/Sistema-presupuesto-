import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PriceCandidate {
  priceHistoryId: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  priceListEffectiveDate: string | null;
  netPrice: number;
  computedPublicPrice: number;
  marginPct: number;
  expensesPct: number;
  ivaPct: number;
  roundingRule: string;
  pricingRuleId: string;
  sourceType: string;
}

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/**
 * Resuelve todos los precios candidatos vigentes para un producto en una
 * fecha dada (docs/04 §6.3, docs/01 §20 "comparador dentro de la cuenta
 * corriente"): cada price_history vigente es una fuente distinta (proveedor
 * + lista + regla aplicada), ordenados por costo — el primero es el "mejor
 * costo". Nunca inventa un precio: si no hay ningún candidato, devuelve []
 * y quien liquida debe tratarlo como "producto sin precio" (docs §46).
 */
export async function resolvePriceCandidates(
  client: PrismaOrTx,
  productId: string,
  at: Date,
): Promise<PriceCandidate[]> {
  const rows = await client.priceHistory.findMany({
    where: {
      productId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    include: {
      supplierReference: { include: { supplier: true } },
      pricingRule: true,
      sourcePriceListItem: { include: { priceList: true } },
    },
    orderBy: { computedPublicPrice: 'asc' },
  });

  return rows.map((row) => ({
    priceHistoryId: row.id,
    supplierId: row.supplierReference?.supplierId ?? null,
    supplierName: row.supplierReference?.supplier.name ?? null,
    supplierCode: row.supplierReference?.supplierCode ?? null,
    priceListEffectiveDate: row.sourcePriceListItem?.priceList.effectiveDate.toISOString().slice(0, 10) ?? null,
    netPrice: Number(row.netPrice),
    computedPublicPrice: Number(row.computedPublicPrice),
    marginPct: Number(row.pricingRule.marginPct),
    expensesPct: Number(row.pricingRule.expensesPct),
    ivaPct: Number(row.pricingRule.ivaPct),
    roundingRule: row.pricingRule.roundingRule,
    pricingRuleId: row.pricingRuleId,
    sourceType: row.sourceType,
  }));
}
