import { ColumnMapping } from './parsing/row-classification';
import { ImportRowError, ImportRowWarning } from './parsing/quality-checks';

export interface SheetPreviewItem {
  code: string;
  description: string;
  price: number;
  status: 'NEW' | 'EXISTING_PRICE_CHANGED' | 'EXISTING_PRICE_SAME';
}

export interface SheetPreview {
  sheetName: string;
  detectionMode: 'header' | 'positional' | 'none';
  mapping: ColumnMapping | null;
  dataStartRow: number | null;
  suggestedEffectiveDate: string | null;
  suggestedCurrency: 'ARS' | 'USD' | null;
  validCount: number;
  newCount: number;
  updatedCount: number;
  categoryRowCount: number;
  errors: ImportRowError[];
  warnings: ImportRowWarning[];
  sampleItems: SheetPreviewItem[];
}

export interface PreviewResult {
  sheets: SheetPreview[];
}

export interface ConfirmSheetInput {
  sheetName: string;
  include: boolean;
  mapping: ColumnMapping;
  dataStartRow: number;
  effectiveDate: string;
  currency: 'ARS' | 'USD';
}

export interface SheetImportReport {
  sheetName: string;
  priceListId: string;
  imported: number;
  newReferences: number;
  updatedReferences: number;
  errors: number;
  warnings: number;
}

export interface ImportReport {
  importedFileId: string;
  sheets: SheetImportReport[];
}
