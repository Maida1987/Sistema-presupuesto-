export type AccountMovementType = 'REMITO_PENDIENTE' | 'LIQUIDACION' | 'PAGO' | 'AJUSTE';

export interface AccountMovement {
  id: string;
  movementDate: string;
  type: AccountMovementType;
  referenceType: string;
  referenceId: string;
  debit: string;
  credit: string;
  balanceAfter: string;
  createdAt: string;
}

export interface CustomerAccount {
  balance: number;
  movements: AccountMovement[];
}

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
  sourceType: string;
}

export interface PendingItemPreview {
  deliveryNoteItemId: string;
  deliveryNoteId: string;
  deliveryNoteNumber: string;
  issuedAt: string;
  code: string;
  description: string;
  quantity: number;
  hasPricing: boolean;
  chosenPrice: PriceCandidate | null;
  candidates: PriceCandidate[];
}

export type SettlementStatus = 'BORRADOR' | 'CONFIRMADA' | 'ANULADA';

export interface SettlementItemBreakdown {
  product: string;
  code: string;
  deliveryNoteId: string;
  deliveryNoteNumber: string;
  deliveryDate: string;
  supplier: string | null;
  priceListEffectiveDate: string | null;
  netPrice: number;
  marginPct: number;
  expensesPct: number;
  ivaPct: number;
  roundingRule: string;
  finalPrice: number;
  alternativeCandidates: PriceCandidate[];
}

export interface SettlementItem {
  id: string;
  unitPrice: string;
  quantity: string;
  subtotal: string;
  priceBreakdown: SettlementItemBreakdown;
}

export interface SettlementDetail {
  id: string;
  customerId: string;
  customer: { businessName: string; internalCode: string };
  periodFrom: string;
  periodTo: string;
  totalAmount: string;
  status: SettlementStatus;
  voidReason: string | null;
  items: SettlementItem[];
}
