export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  user: { id: string; email: string; fullName: string } | null;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  module?: string;
}
