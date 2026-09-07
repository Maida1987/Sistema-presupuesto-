export interface PaymentMethod {
  id: string;
  name: string;
  requiresReference: boolean;
  active: boolean;
}

export type PaymentStatus = 'REGISTRADO' | 'ANULADO';

export interface Payment {
  id: string;
  customerId: string;
  customer: { businessName: string; internalCode: string };
  paymentDate: string;
  amount: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  status: PaymentStatus;
  voidReason: string | null;
}

export interface CreatePaymentInput {
  customerId: string;
  amount: number;
  paymentMethodId: string;
  referenceNumber?: string;
  notes?: string;
}
