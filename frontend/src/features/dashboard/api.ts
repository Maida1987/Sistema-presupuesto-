import { apiFetch } from '../../api/client';
import type { DashboardSummary } from './types';

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/dashboard/summary');
}
