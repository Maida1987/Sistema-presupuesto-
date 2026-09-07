import { apiFetch, apiUpload, getAccessToken } from '../../api/client';
import type { CreateDeliveryNoteInput, DeliveryNoteDetail, DeliveryNoteListEntry, DeliveryNoteStatus } from './types';

export function fetchDeliveryNotes(filters: { customerId?: string; status?: DeliveryNoteStatus }): Promise<DeliveryNoteListEntry[]> {
  const params = new URLSearchParams();
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.status) params.set('status', filters.status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<DeliveryNoteListEntry[]>(`/delivery-notes${query}`);
}

export function fetchDeliveryNote(id: string): Promise<DeliveryNoteDetail> {
  return apiFetch<DeliveryNoteDetail>(`/delivery-notes/${id}`);
}

export function createDeliveryNote(input: CreateDeliveryNoteInput): Promise<DeliveryNoteDetail> {
  return apiFetch<DeliveryNoteDetail>('/delivery-notes', { method: 'POST', body: JSON.stringify(input) });
}

export function markDelivered(id: string): Promise<DeliveryNoteDetail> {
  return apiFetch<DeliveryNoteDetail>(`/delivery-notes/${id}/deliver`, { method: 'POST' });
}

export function attachSignedDocument(id: string, file: File): Promise<DeliveryNoteDetail> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<DeliveryNoteDetail>(`/delivery-notes/${id}/documents`, formData);
}

export function voidDeliveryNote(id: string, reason: string): Promise<DeliveryNoteDetail> {
  return apiFetch<DeliveryNoteDetail>(`/delivery-notes/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
}

/** Abre el PDF en una pestaña nueva (requiere el header Authorization, por eso no es un <a href> directo). */
export async function openDeliveryNotePdf(id: string, type: 'original' | 'duplicado'): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`/api/delivery-notes/${id}/pdf?type=${type}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('No se pudo generar el PDF');
  const blob = await response.blob();
  window.open(URL.createObjectURL(blob), '_blank');
}
