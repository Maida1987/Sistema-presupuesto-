import { downloadFile } from '../../api/download';

export type ExportFormat = 'xlsx' | 'csv';

export function downloadCustomersReport(format: ExportFormat): Promise<void> {
  return downloadFile(`/reports/customers?format=${format}`, `clientes.${format}`);
}

export function downloadProductsReport(format: ExportFormat): Promise<void> {
  return downloadFile(`/reports/products?format=${format}`, `productos.${format}`);
}

export function downloadDeliveryNotesReport(
  format: ExportFormat,
  filters: { customerId?: string; status?: string; from?: string; to?: string },
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return downloadFile(`/reports/delivery-notes?${params.toString()}`, `remitos.${format}`);
}

export function downloadAccountStatement(
  customerId: string,
  format: ExportFormat | 'pdf',
  filters: { from?: string; to?: string },
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const ext = format === 'pdf' ? 'pdf' : format;
  return downloadFile(`/reports/customers/${customerId}/account-statement?${params.toString()}`, `extracto-cuenta.${ext}`);
}
