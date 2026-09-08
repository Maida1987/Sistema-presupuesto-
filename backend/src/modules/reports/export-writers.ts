import * as ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

export type ExportFormat = 'xlsx' | 'csv';

/**
 * Constructor genérico de exports en Excel/CSV a partir de columnas +
 * filas planas, reutilizado por todos los reportes (docs/01 §3: "PDF/
 * Excel/CSV para clientes, productos, remitos, cuentas"). exceljs ya es
 * dependencia del proyecto para leer listas de precios importadas; acá se
 * usa para escribir, no hace falta otra librería para CSV (workbook.csv.
 * writeBuffer cubre ese caso).
 */
export async function buildSpreadsheet(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  format: ExportFormat,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);

  const buffer = format === 'csv' ? await workbook.csv.writeBuffer() : await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function exportContentType(format: ExportFormat): string {
  return format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export function exportFilename(baseName: string, format: ExportFormat): string {
  return `${baseName}.${format === 'csv' ? 'csv' : 'xlsx'}`;
}
