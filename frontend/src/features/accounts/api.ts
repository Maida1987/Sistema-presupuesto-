import { apiFetch } from '../../api/client';
import type { CustomerAccount, PendingItemPreview, SettlementDetail } from './types';

export function fetchCustomerAccount(customerId: string): Promise<CustomerAccount> {
  return apiFetch<CustomerAccount>(`/customers/${customerId}/account`);
}

export function fetchPendingItems(customerId: string): Promise<PendingItemPreview[]> {
  return apiFetch<PendingItemPreview[]>(`/account-settlements/pending?customerId=${customerId}`);
}

export function createSettlement(customerId: string, deliveryNoteItemIds: string[]): Promise<SettlementDetail> {
  return apiFetch<SettlementDetail>('/account-settlements', {
    method: 'POST',
    body: JSON.stringify({ customerId, deliveryNoteItemIds }),
  });
}

export function fetchSettlement(id: string): Promise<SettlementDetail> {
  return apiFetch<SettlementDetail>(`/account-settlements/${id}`);
}

export function confirmSettlement(id: string): Promise<SettlementDetail> {
  return apiFetch<SettlementDetail>(`/account-settlements/${id}/confirm`, { method: 'POST' });
}

export function voidSettlement(id: string, reason: string): Promise<SettlementDetail> {
  return apiFetch<SettlementDetail>(`/account-settlements/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
