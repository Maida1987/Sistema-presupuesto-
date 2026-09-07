import { apiFetch, apiUpload } from '../../api/client';
import type { ConfirmSheetInput, ImportReport, ImportRowError, PreviewResult } from './types';

export function previewImport(supplierId: string, file: File): Promise<PreviewResult> {
  const formData = new FormData();
  formData.append('supplierId', supplierId);
  formData.append('file', file);
  return apiUpload<PreviewResult>('/price-lists/preview', formData);
}

export function confirmImport(supplierId: string, file: File, sheets: ConfirmSheetInput[]): Promise<ImportReport> {
  const formData = new FormData();
  formData.append('supplierId', supplierId);
  formData.append('sheetsJson', JSON.stringify(sheets));
  formData.append('file', file);
  return apiUpload<ImportReport>('/price-lists/confirm', formData);
}

export function fetchImportErrors(priceListId: string): Promise<ImportRowError[]> {
  return apiFetch<ImportRowError[]>(`/price-lists/${priceListId}/errors`);
}
