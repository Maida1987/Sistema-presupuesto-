import { CellValue } from './workbook-parser';
import { ColumnMapping, classifyRow } from './row-classification';

export interface ImportRowError {
  rowNumber: number;
  rawData: CellValue[];
  errorType:
    | 'MISSING_CODE'
    | 'MISSING_DESCRIPTION'
    | 'INVALID_PRICE'
    | 'DUPLICATE_CODE'
    | 'DUPLICATE_ROW';
  errorMessage: string;
}

export interface ImportRowWarning {
  rowNumber: number;
  code: string;
  previousPrice: number;
  newPrice: number;
  percentChange: number;
}

export interface ValidImportRow {
  rowNumber: number;
  code: string;
  description: string;
  price: number;
}

export interface QualityCheckResult {
  validItems: ValidImportRow[];
  categoryRows: number;
  errors: ImportRowError[];
  warnings: ImportRowWarning[];
}

const EXTREME_VARIATION_THRESHOLD = 0.4;

/**
 * Recolecta los códigos candidatos de una hoja sin correr todo el control
 * de calidad, para poder consultar sus precios anteriores en la base ANTES
 * de correr runQualityChecks (que es quien necesita ese mapa para detectar
 * variaciones extremas). Evita clasificar la hoja dos veces.
 */
export function extractCandidateCodes(rows: CellValue[][], dataStartRow: number, mapping: ColumnMapping): string[] {
  const codes = new Set<string>();
  for (let r = dataStartRow; r < rows.length; r += 1) {
    const classified = classifyRow(rows[r] ?? [], mapping);
    if (classified.kind === 'ITEM' && classified.code) {
      codes.add(classified.code);
    }
  }
  return Array.from(codes);
}

/**
 * Control de calidad antes de aplicar la importación (docs/04 §3): separa
 * ítems válidos de filas con problemas (código/descripción vacíos, precio
 * inválido, duplicados) sin descartar el resto del archivo, y marca — sin
 * bloquear — variaciones de precio extremas para que el usuario las
 * confirme explícitamente.
 */
export function runQualityChecks(
  rows: CellValue[][],
  dataStartRow: number,
  mapping: ColumnMapping,
  previousPrices: Map<string, number>,
): QualityCheckResult {
  const errors: ImportRowError[] = [];
  const warnings: ImportRowWarning[] = [];
  const validItems: ValidImportRow[] = [];
  const seenCodes = new Set<string>();
  const seenRowSignatures = new Set<string>();
  let categoryRows = 0;

  for (let r = dataStartRow; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const classified = classifyRow(row, mapping);

    if (classified.kind === 'EMPTY') continue;
    if (classified.kind === 'CATEGORY') {
      categoryRows += 1;
      continue;
    }

    const rowNumber = r + 1; // 1-indexado para mostrarle al usuario

    if (classified.kind === 'INVALID') {
      errors.push({
        rowNumber,
        rawData: row,
        errorType: classified.description ? 'INVALID_PRICE' : 'MISSING_DESCRIPTION',
        errorMessage: classified.reason ?? 'Fila inválida',
      });
      continue;
    }

    // classified.kind === 'ITEM'
    const { code, description, price } = classified;

    if (!code) {
      errors.push({ rowNumber, rawData: row, errorType: 'MISSING_CODE', errorMessage: 'Código vacío' });
      continue;
    }
    if (price === null || price <= 0) {
      errors.push({
        rowNumber,
        rawData: row,
        errorType: 'INVALID_PRICE',
        errorMessage: `Precio inválido: ${price}`,
      });
      continue;
    }

    const rowSignature = `${code}|${description}|${price}`;
    if (seenRowSignatures.has(rowSignature)) {
      errors.push({ rowNumber, rawData: row, errorType: 'DUPLICATE_ROW', errorMessage: 'Fila duplicada' });
      continue;
    }
    seenRowSignatures.add(rowSignature);

    if (seenCodes.has(code)) {
      errors.push({
        rowNumber,
        rawData: row,
        errorType: 'DUPLICATE_CODE',
        errorMessage: `Código duplicado dentro del archivo: ${code}`,
      });
      continue;
    }
    seenCodes.add(code);

    const previousPrice = previousPrices.get(code);
    if (previousPrice !== undefined && previousPrice > 0) {
      const percentChange = (price - previousPrice) / previousPrice;
      if (Math.abs(percentChange) > EXTREME_VARIATION_THRESHOLD) {
        warnings.push({ rowNumber, code, previousPrice, newPrice: price, percentChange });
      }
    }

    validItems.push({ rowNumber, code, description: description as string, price });
  }

  return { validItems, categoryRows, errors, warnings };
}
