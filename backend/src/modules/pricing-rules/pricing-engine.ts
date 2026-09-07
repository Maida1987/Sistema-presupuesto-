export type MarginBase = 'COST' | 'SALE_PRICE';

export type RoundingRule = 'NONE' | 'NEAREST_1' | 'NEAREST_10' | 'NEAREST_100' | 'CEIL_10' | 'CEIL_100';

export interface PricingRuleValues {
  marginPct: number;
  marginBase: MarginBase;
  expensesPct: number;
  expensesFixed: number;
  ivaPct: number;
  roundingRule: string;
}

export interface PriceBreakdown {
  cost: number;
  marginPct: number;
  marginBase: MarginBase;
  expensesPct: number;
  expensesFixed: number;
  ivaPct: number;
  roundingRule: string;
  afterMargin: number;
  afterExpenses: number;
  beforeRounding: number;
  finalPrice: number;
}

function applyRounding(value: number, rule: string): number {
  switch (rule as RoundingRule) {
    case 'NEAREST_1':
      return Math.round(value);
    case 'NEAREST_10':
      return Math.round(value / 10) * 10;
    case 'NEAREST_100':
      return Math.round(value / 100) * 100;
    case 'CEIL_10':
      return Math.ceil(value / 10) * 10;
    case 'CEIL_100':
      return Math.ceil(value / 100) * 100;
    case 'NONE':
    default:
      return Math.round(value * 100) / 100;
  }
}

/**
 * Fórmula documentada en docs/04-importacion-y-precios.md §6.2 (⚠️ marcada
 * ahí como pendiente de confirmación con el negocio; se implementa
 * configurable, nunca hardcodeada, para poder ajustarla sin tocar código
 * una vez confirmada):
 *
 *   con_margen   = margin_base COST   -> costo * (1 + margen)
 *                  margin_base SALE_PRICE -> costo / (1 - margen)
 *   con_gastos   = con_margen * (1 + gastos%) + gastos_fijos
 *   precio_final = con_gastos * (1 + iva%), redondeado según rounding_rule
 */
export function calculatePrice(cost: number, rule: PricingRuleValues): PriceBreakdown {
  const afterMargin =
    rule.marginBase === 'COST' ? cost * (1 + rule.marginPct) : cost / (1 - rule.marginPct);

  const afterExpenses = afterMargin * (1 + rule.expensesPct) + rule.expensesFixed;
  const beforeRounding = afterExpenses * (1 + rule.ivaPct);
  const finalPrice = applyRounding(beforeRounding, rule.roundingRule);

  return {
    cost,
    marginPct: rule.marginPct,
    marginBase: rule.marginBase,
    expensesPct: rule.expensesPct,
    expensesFixed: rule.expensesFixed,
    ivaPct: rule.ivaPct,
    roundingRule: rule.roundingRule,
    afterMargin,
    afterExpenses,
    beforeRounding,
    finalPrice,
  };
}
