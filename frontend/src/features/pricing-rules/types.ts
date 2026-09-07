export interface PricingRule {
  id: string;
  scope: 'GLOBAL' | 'CATEGORY' | 'SUPPLIER' | 'PRODUCT';
  scopeRefId: string | null;
  marginPct: string;
  marginBase: 'COST' | 'SALE_PRICE';
  expensesPct: string;
  expensesFixed: string;
  ivaPct: string;
  roundingRule: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CreatePricingRuleInput {
  scope: 'GLOBAL' | 'CATEGORY' | 'SUPPLIER' | 'PRODUCT';
  scopeRefId?: string;
  marginPct: number;
  marginBase: 'COST' | 'SALE_PRICE';
  expensesPct: number;
  expensesFixed: number;
  ivaPct: number;
  roundingRule: string;
}
