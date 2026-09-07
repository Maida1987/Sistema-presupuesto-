import { apiFetch } from '../../api/client';
import type { CreateProductInput, PriceComparison, Product } from './types';

export function searchProducts(search: string): Promise<Product[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<Product[]>(`/products${query}`);
}

export function createProduct(input: CreateProductInput): Promise<Product> {
  return apiFetch<Product>('/products', { method: 'POST', body: JSON.stringify(input) });
}

export function fetchPriceComparison(productId: string): Promise<PriceComparison> {
  return apiFetch<PriceComparison>(`/products/${productId}/prices`);
}
