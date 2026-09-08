import { apiFetch } from '../../api/client';
import type { AuditLogEntry, AuditLogFilters } from './types';

export function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.module) params.set('module', filters.module);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<AuditLogEntry[]>(`/audit-logs${query}`);
}
