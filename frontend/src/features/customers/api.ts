import { apiFetch } from '../../api/client';
import type { Customer, CreateCustomerInput } from './types';

export function fetchCustomers(search: string): Promise<Customer[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<Customer[]>(`/customers${query}`);
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(input) });
}
