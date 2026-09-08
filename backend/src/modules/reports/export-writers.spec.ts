import * as ExcelJS from 'exceljs';
import { buildSpreadsheet } from './export-writers';

describe('buildSpreadsheet', () => {
  const columns = [
    { header: 'Código', key: 'code' },
    { header: 'Descripción', key: 'description' },
  ];
  const rows = [
    { code: 'A-1', description: 'Filtro de aceite' },
    { code: 'A-2', description: 'Bomba de agua' },
  ];

  it('genera un .xlsx legible con los encabezados y filas correctos', async () => {
    const buffer = await buildSpreadsheet('Hoja', columns, rows, 'xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.getRow(1).getCell(1).value).toBe('Código');
    expect(sheet.getRow(2).getCell(1).value).toBe('A-1');
    expect(sheet.getRow(3).getCell(2).value).toBe('Bomba de agua');
  });

  it('genera un .csv con encabezado y filas separadas por coma', async () => {
    const buffer = await buildSpreadsheet('Hoja', columns, rows, 'csv');
    const text = buffer.toString('utf-8');

    expect(text.split('\n')[0].trim()).toBe('Código,Descripción');
    expect(text).toContain('A-1,Filtro de aceite');
  });
});
