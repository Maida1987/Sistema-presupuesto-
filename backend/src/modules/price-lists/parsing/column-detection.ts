import { CellValue } from './workbook-parser';
import { ColumnMapping, classifyRow } from './row-classification';
import { parsePrice } from './price-parsing';

export type MappingField = 'code' | 'description' | 'price';

const SYNONYMS: Record<MappingField, string[]> = {
  code: ['codigo', 'cod', 'sku', 'codigo producto', 'cod producto', 'id producto', 'codigo alternativo'],
  description: ['descripcion', 'detalle', 'producto', 'denominacion', 'articulo'],
  price: [
    'precio',
    'precio neto',
    'costo',
    'costo neto',
    'precio lista',
    'importe',
    'precio publico',
    'importe final',
    'precio final',
  ],
};

function normalizeHeader(value: CellValue): string {
  if (value === null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (marcas diacríticas tras NFD)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/** Distancia de Levenshtein simple, usada solo para similitud aproximada de encabezados. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function matchField(header: string): { field: MappingField; confidence: 'high' | 'medium' } | null {
  if (!header) return null;

  for (const [field, synonyms] of Object.entries(SYNONYMS) as [MappingField, string[]][]) {
    if (synonyms.includes(header)) {
      return { field, confidence: 'high' };
    }
  }

  for (const [field, synonyms] of Object.entries(SYNONYMS) as [MappingField, string[]][]) {
    for (const synonym of synonyms) {
      const maxLen = Math.max(header.length, synonym.length);
      const distance = levenshtein(header, synonym);
      if (maxLen > 0 && distance / maxLen <= 0.25) {
        return { field, confidence: 'medium' };
      }
    }
  }

  return null;
}

/**
 * Verifica que una columna candidata a "precio" realmente contenga precios
 * en los datos, no solo que su encabezado se parezca a un sinónimo. Bug
 * real con el archivo PreciosBULON: la columna "U. Precio" (unidad de
 * referencia del precio, ej. "Unidad"/"Kg") matcheaba por distancia de
 * Levenshtein contra "precio" antes que la columna real "Importe final",
 * y como nunca se validaba contra los datos, la hoja entera quedaba con 0
 * filas válidas.
 */
function columnLooksLikePrices(rows: CellValue[][], headerRowIndex: number, column: number, sampleSize = 10): boolean {
  const samples: CellValue[] = [];
  for (let r = headerRowIndex + 1; r < rows.length && samples.length < sampleSize; r += 1) {
    const value = rows[r]?.[column] ?? null;
    if (value !== null) samples.push(value);
  }
  if (samples.length === 0) return false;

  const validCount = samples.filter((value) => parsePrice(value) !== null).length;
  return validCount / samples.length >= 0.6;
}

export interface HeaderDetectionResult {
  mode: 'header';
  headerRow: number;
  dataStartRow: number;
  mapping: ColumnMapping;
  confidence: Record<MappingField, 'high' | 'medium'>;
}

export interface PositionalDetectionResult {
  mode: 'positional';
  dataStartRow: number;
  mapping: ColumnMapping;
}

export type DetectionResult = HeaderDetectionResult | PositionalDetectionResult | null;

/**
 * Busca una fila de encabezados reconocible por sinónimos (docs/04 §2):
 * resuelve los layouts "Código|Descripción|Precio", "Código Producto|
 * Detalle|Precio Neto", "SKU|Producto|Costo", etc. Requiere encontrar al
 * menos code+description+price en la misma fila para considerarla válida.
 */
function detectHeaderRow(rows: CellValue[][], maxRowsToScan = 60): HeaderDetectionResult | null {
  const limit = Math.min(rows.length, maxRowsToScan);

  for (let r = 0; r < limit; r += 1) {
    const row = rows[r] ?? [];
    const found: Partial<Record<MappingField, { column: number; confidence: 'high' | 'medium' }>> = {};
    const priceCandidates: { column: number; confidence: 'high' | 'medium' }[] = [];

    row.forEach((cell, columnIndex) => {
      const match = matchField(normalizeHeader(cell));
      if (!match) return;

      if (match.field === 'price') {
        priceCandidates.push({ column: columnIndex, confidence: match.confidence });
        return;
      }

      if (!found[match.field]) {
        found[match.field] = { column: columnIndex, confidence: match.confidence };
      }
    });

    // Entre las columnas cuyo encabezado matchea "precio", nos quedamos con
    // la primera que además contenga precios reales en los datos (alta
    // confianza antes que media, y a igual confianza, orden de aparición).
    const validatedPrice = [...priceCandidates]
      .sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1))
      .find((candidate) => columnLooksLikePrices(rows, r, candidate.column));
    if (validatedPrice) {
      found.price = validatedPrice;
    }

    if (found.code && found.description && found.price) {
      return {
        mode: 'header',
        headerRow: r,
        dataStartRow: r + 1,
        mapping: { code: found.code.column, description: found.description.column, price: found.price.column },
        confidence: {
          code: found.code.confidence,
          description: found.description.confidence,
          price: found.price.confidence,
        },
      };
    }
  }

  return null;
}

/**
 * Fallback cuando no hay fila de encabezados reconocible (caso real
 * MERCOSIL, docs/04 §9): asume columna 1/2/3 = código/descripción/precio
 * y busca la primera fila a partir de la cual se sostiene un patrón de
 * filas-ítem por un tramo razonable, para no confundir el bloque de
 * metadata (vigencia, condiciones, contacto) con la tabla real.
 */
export function detectPositionalStart(
  rows: CellValue[][],
  mapping: ColumnMapping,
  windowSize = 10,
  minItemRatio = 0.5,
): PositionalDetectionResult | null {
  for (let r = 0; r < rows.length; r += 1) {
    const window = rows.slice(r, r + windowSize).filter((row) => row && row.some((cell) => cell !== null));
    if (window.length < Math.min(windowSize, 3)) continue;

    const itemCount = window.filter((row) => classifyRow(row, mapping).kind === 'ITEM').length;
    if (itemCount / window.length >= minItemRatio) {
      return { mode: 'positional', dataStartRow: r, mapping };
    }
  }

  return null;
}

export function detectColumns(rows: CellValue[][]): DetectionResult {
  const headerResult = detectHeaderRow(rows);
  if (headerResult) return headerResult;

  return detectPositionalStart(rows, { code: 0, description: 1, price: 2 });
}
