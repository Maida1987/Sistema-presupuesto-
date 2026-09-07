import * as ExcelJS from 'exceljs';

export type CellValue = string | number | null;

export interface ParsedSheet {
  sheetName: string;
  /** Filas 0-indexadas, cada una con sus celdas 0-indexadas (columna A = índice 0). */
  rows: CellValue[][];
}

/**
 * Normaliza cualquier valor de celda de exceljs (fórmula, texto enriquecido,
 * hipervínculo, error, fecha, etc.) a un primitivo simple. Usamos el
 * resultado cacheado de las fórmulas (mismo criterio que "data_only=True"
 * al leer con otras librerías): no evaluamos fórmulas, solo leemos su
 * último valor calculado, que es lo que trae el Excel que envía el
 * proveedor.
 */
export function normalizeCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' || typeof value === 'number') return value;

  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray((value as ExcelJS.CellRichTextValue).richText)) {
      return (value as ExcelJS.CellRichTextValue).richText.map((run) => run.text).join('');
    }
    if ('error' in value) return null;
    if ('result' in value) {
      return normalizeCellValue((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    }
    if ('text' in value) {
      // El texto de un hipervínculo puede venir como string simple o,
      // menos frecuente, como texto enriquecido anidado — nunca asumimos
      // que es un string plano (ver bug real encontrado con el archivo
      // MERCOSIL: una celda así se estaba guardando literalmente como
      // "[object Object]").
      return normalizeCellValue((value as ExcelJS.CellHyperlinkValue).text as ExcelJS.CellValue);
    }

    // Forma de objeto desconocida: mejor perder el dato (null) que
    // guardar basura como "[object Object]" en una descripción/código.
    return null;
  }

  return String(value);
}

/**
 * Parsea un Excel a una estructura simple por hoja (sin asumir dónde
 * empieza la tabla ni si hay fila de encabezados — eso lo resuelve
 * column-detection.ts). Ver docs/04-importacion-y-precios.md §9: un
 * archivo real puede traer varias hojas, cada una con su propio bloque de
 * metadata antes de la tabla de ítems.
 */
export async function parseWorkbook(buffer: Buffer): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  return workbook.worksheets.map((worksheet) => {
    const rows: CellValue[][] = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: CellValue[] = [];
      const columnCount = Math.max(row.cellCount, worksheet.columnCount);
      for (let col = 1; col <= columnCount; col += 1) {
        cells.push(normalizeCellValue(row.getCell(col).value));
      }
      rows[rowNumber - 1] = cells;
    });

    return { sheetName: worksheet.name, rows };
  });
}
