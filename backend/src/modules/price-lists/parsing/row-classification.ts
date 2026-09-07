import { CellValue } from './workbook-parser';
import { parsePrice } from './price-parsing';

export interface ColumnMapping {
  code: number;
  description: number;
  price: number;
}

export type RowKind = 'ITEM' | 'CATEGORY' | 'EMPTY' | 'INVALID';

export interface ClassifiedRow {
  kind: RowKind;
  code: string | null;
  description: string | null;
  price: number | null;
  reason?: string;
}

function cellText(value: CellValue): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * Clasifica una fila de datos ya ubicada la tabla (docs/04 §9.1 punto 3):
 * una fila sin código ni precio pero con texto es un encabezado de
 * categoría/subcategoría, no un error. Una fila totalmente vacía se
 * ignora. El resto de combinaciones incompletas se marca INVALID para
 * reportarse en import_errors sin bloquear el resto de la importación.
 */
export function classifyRow(row: CellValue[], mapping: ColumnMapping): ClassifiedRow {
  const code = cellText(row[mapping.code] ?? null);
  const description = cellText(row[mapping.description] ?? null);
  const price = parsePrice(row[mapping.price] ?? null);

  if (!code && !description && price === null) {
    return { kind: 'EMPTY', code, description, price };
  }

  if (description && price !== null) {
    return { kind: 'ITEM', code, description, price };
  }

  if (description && price === null && !code) {
    return { kind: 'CATEGORY', code, description, price };
  }

  if (!description && price === null) {
    // Solo código suelto o ruido (p. ej. una celda con "." como en el
    // caso real, ver docs/04 §9): no alcanza para clasificarla como ítem.
    return { kind: 'CATEGORY', code, description, price };
  }

  if (!description) {
    return { kind: 'INVALID', code, description, price, reason: 'Falta descripción' };
  }

  return { kind: 'INVALID', code, description, price, reason: 'Falta precio válido' };
}
