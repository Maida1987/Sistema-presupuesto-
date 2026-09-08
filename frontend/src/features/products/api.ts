import { apiFetch } from '../../api/client';
import type {
  BulkMatchItem,
  CreateProductFromReferenceInput,
  CreateProductInput,
  MatchStatus,
  MatchSuggestion,
  PriceComparison,
  Product,
  SupplierReferencesPage,
} from './types';

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

export function fetchSupplierReferences(filters: {
  supplierId?: string;
  matchStatus?: MatchStatus;
  limit?: number;
  offset?: number;
}): Promise<SupplierReferencesPage> {
  const params = new URLSearchParams();
  if (filters.supplierId) params.set('supplierId', filters.supplierId);
  if (filters.matchStatus) params.set('matchStatus', filters.matchStatus);
  params.set('limit', String(filters.limit ?? 50));
  params.set('offset', String(filters.offset ?? 0));
  return apiFetch<SupplierReferencesPage>(`/product-supplier-references?${params.toString()}`);
}

export function fetchBulkSuggestions(referenceIds: string[]): Promise<MatchSuggestion[]> {
  return apiFetch<MatchSuggestion[]>('/product-supplier-references/suggestions', {
    method: 'POST',
    body: JSON.stringify({ referenceIds }),
  });
}

export function bulkMatchReferences(items: BulkMatchItem[]): Promise<{ matched: number }> {
  return apiFetch<{ matched: number }>('/product-supplier-references/bulk-match', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export function bulkIgnoreReferences(referenceIds: string[]): Promise<{ ignored: number }> {
  return apiFetch<{ ignored: number }>('/product-supplier-references/bulk-ignore', {
    method: 'POST',
    body: JSON.stringify({ referenceIds }),
  });
}

export function createProductAndMatch(
  referenceId: string,
  input: CreateProductFromReferenceInput,
): Promise<{ product: Product }> {
  return apiFetch(`/product-supplier-references/${referenceId}/create-product-and-match`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
