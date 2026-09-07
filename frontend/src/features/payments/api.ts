import { apiFetch } from '../../api/client';
import type { CreatePaymentInput, Payment, PaymentMethod } from './types';

export function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  return apiFetch<PaymentMethod[]>('/payment-methods');
}

export function createPayment(input: CreatePaymentInput): Promise<Payment> {
  return apiFetch<Payment>('/payments', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchPayment(id: string): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${id}`);
}

export function voidPayment(id: string, reason: string): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
}
