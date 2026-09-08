import { apiFetch } from '../../api/client';
import type { GlobalSearchResult } from './types';

export function globalSearch(term: string): Promise<GlobalSearchResult> {
  return apiFetch<GlobalSearchResult>(`/search/global?q=${encodeURIComponent(term)}`);
}
