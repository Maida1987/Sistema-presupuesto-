import { apiFetch } from '../../api/client';
import type { CreateSupplierInput, Supplier } from './types';

export function fetchSuppliers(search: string): Promise<Supplier[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<Supplier[]>(`/suppliers${query}`);
}

export function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return apiFetch<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(input) });
}
