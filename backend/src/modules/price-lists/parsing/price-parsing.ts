import { CellValue } from './workbook-parser';

/**
 * Normaliza los formatos de precio heterogéneos encontrados en listas
 * reales (docs/04-importacion-y-precios.md §9.1 punto 4): número directo,
 * número con ruido de coma flotante, o string con símbolo de moneda y
 * separador de miles ("$ 121,271.26"). Devuelve null si el valor no se
 * puede interpretar como precio (nunca inventa un número).
 */
export function parsePrice(value: CellValue): number | null {
  if (value === null) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? roundToCents(value) : null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Una fecha ("24/08/2026") no es un precio: si se dejara pasar, al
  // limpiar los separadores quedaría como un número gigante ("24082026").
  if (trimmed.includes('/')) return null;

  // "$ 121,271.26" / "$121.271,26" / "1234.5" / "1.234,50"
  const cleaned = trimmed.replace(/[^0-9,.\-]/g, '');
  if (cleaned.length === 0) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;

  if (lastComma > lastDot) {
    // La coma es el separador decimal (formato es-AR: "121.271,26")
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // El punto es el separador decimal (formato en-US: "121,271.26")
    normalized = cleaned.replace(/,/g, '');
  } else {
    normalized = cleaned;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundToCents(parsed) : null;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
