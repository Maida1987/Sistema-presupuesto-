import { CellValue } from './workbook-parser';

export interface ExtractedMetadata {
  effectiveDate: Date | null;
  currency: 'ARS' | 'USD' | null;
}

const DATE_PATTERN = /desde\s+el\s+(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i;
const USD_PATTERN = /expresados?\s+en\s+d[oó]lares/i;
const ARS_PATTERN = /expresados?\s+en\s+pesos/i;

/**
 * Extrae la fecha de vigencia y la moneda del bloque de metadata que
 * suelen traer las listas reales antes de la tabla de ítems (docs/04 §9:
 * "VIGENCIA / DESDE EL 24/08/2026", "Precios netos expresados en
 * dólares/pesos"). Son solo una PROPUESTA a confirmar por el usuario antes
 * de importar — nunca se asumen en silencio (ver docs/04 §9.1 punto 5).
 */
export function extractMetadata(rows: CellValue[][], scanRows = 60): ExtractedMetadata {
  let effectiveDate: Date | null = null;
  let currency: ExtractedMetadata['currency'] = null;

  const limit = Math.min(rows.length, scanRows);
  for (let r = 0; r < limit; r += 1) {
    for (const cell of rows[r] ?? []) {
      if (typeof cell !== 'string') continue;

      if (!effectiveDate) {
        const dateMatch = cell.match(DATE_PATTERN);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
          if (!Number.isNaN(parsed.getTime())) effectiveDate = parsed;
        }
      }

      if (!currency) {
        if (USD_PATTERN.test(cell)) currency = 'USD';
        else if (ARS_PATTERN.test(cell)) currency = 'ARS';
      }
    }
  }

  return { effectiveDate, currency };
}
