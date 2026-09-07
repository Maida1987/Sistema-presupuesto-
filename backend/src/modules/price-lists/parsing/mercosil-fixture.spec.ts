import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseWorkbook } from './workbook-parser';
import { detectColumns } from './column-detection';
import { extractMetadata } from './metadata-extraction';
import { runQualityChecks } from './quality-checks';

const FIXTURE_PATH = join(__dirname, '../../../../test/fixtures/mercosil-listas-precios.xlsx');

/**
 * Prueba de integración de todo el pipeline de importación contra un
 * archivo real de proveedor (MERCOSIL, 4 hojas — LPG/IMPORTADOS/FEY/
 * AMORTIGUADORES — ver docs/04-importacion-y-precios.md §9). Ninguna de
 * estas hojas tiene fila de encabezados ni columnas iguales entre sí; es
 * el caso que exige el modo posicional y la extracción de metadata.
 */
describe('pipeline de importación sobre el archivo real MERCOSIL', () => {
  it('detecta las 4 hojas y procesa cada una en modo posicional', async () => {
    const buffer = await readFile(FIXTURE_PATH);
    const sheets = await parseWorkbook(buffer);

    expect(sheets.map((s) => s.sheetName)).toEqual(['LPG', 'IMPORTADOS', 'FEY', 'AMORTIGUADORES']);

    for (const sheet of sheets) {
      const detection = detectColumns(sheet.rows);
      expect(detection).not.toBeNull();
      expect(detection?.mode).toBe('positional');
    }
  });

  it('nunca produce la basura "[object Object]" en ninguna celda del archivo real', async () => {
    const buffer = await readFile(FIXTURE_PATH);
    const sheets = await parseWorkbook(buffer);

    for (const sheet of sheets) {
      for (const row of sheet.rows) {
        for (const cell of row ?? []) {
          expect(cell).not.toBe('[object Object]');
        }
      }
    }
  });

  it('extrae fecha de vigencia 24/08/2026 en las 4 hojas', async () => {
    const buffer = await readFile(FIXTURE_PATH);
    const sheets = await parseWorkbook(buffer);

    for (const sheet of sheets) {
      const metadata = extractMetadata(sheet.rows);
      expect(metadata.effectiveDate?.toISOString().slice(0, 10)).toBe('2026-08-24');
    }
  });

  it('detecta moneda pesos en LPG/AMORTIGUADORES y dólares en IMPORTADOS/FEY', async () => {
    const buffer = await readFile(FIXTURE_PATH);
    const sheets = await parseWorkbook(buffer);
    const currencyBySheet = Object.fromEntries(
      sheets.map((sheet) => [sheet.sheetName, extractMetadata(sheet.rows).currency]),
    );

    expect(currencyBySheet.IMPORTADOS).toBe('USD');
    expect(currencyBySheet.FEY).toBe('USD');
    expect(currencyBySheet.AMORTIGUADORES).toBe('ARS');
    // LPG no declara moneda explícitamente en el texto (default ARS a
    // nivel de aplicación, ver docs/04 §9).
    expect(currencyBySheet.LPG).toBeNull();
  });

  it('procesa la hoja LPG completa: cientos de ítems válidos, sin errores espurios del bloque de metadata', async () => {
    const buffer = await readFile(FIXTURE_PATH);
    const sheets = await parseWorkbook(buffer);
    const lpg = sheets.find((s) => s.sheetName === 'LPG')!;

    const detection = detectColumns(lpg.rows);
    expect(detection?.mode).toBe('positional');
    if (detection?.mode !== 'positional') return;

    const quality = runQualityChecks(lpg.rows, detection.dataStartRow, detection.mapping, new Map());

    // La hoja real tiene ~830 ítems con precio; exigimos un piso generoso
    // para no acoplar el test a un conteo exacto que cambiaría si
    // MERCOSIL actualiza la lista.
    expect(quality.validItems.length).toBeGreaterThan(700);
    expect(quality.categoryRows).toBeGreaterThan(50);

    // Ningún ítem debería haberse colado con el texto del bloque de
    // metadata ("LISTA DE PRECIOS", "CONTACTENOS:", el teléfono, etc.)
    const suspiciousCodes = quality.validItems.filter((item) =>
      ['LISTA', 'VIGENCIA', 'CONTACTENOS', 'WWW'].some((noise) => item.code.toUpperCase().includes(noise)),
    );
    expect(suspiciousCodes).toHaveLength(0);

    // Ítem puntual conocido del archivo real, para anclar el test a datos concretos.
    const arandela = quality.validItems.find((item) => item.code === 'MPFR0002');
    expect(arandela).toMatchObject({ price: 332.4 });
    expect(arandela?.description).toContain('ARANDELA PARA LEVA DE FRENO CHICA');
  });

  it('procesa AMORTIGUADORES, cuyo precio viene como string con formato moneda ("$ 121,271.26")', async () => {
    const buffer = await readFile(FIXTURE_PATH);
    const sheets = await parseWorkbook(buffer);
    const amortiguadores = sheets.find((s) => s.sheetName === 'AMORTIGUADORES')!;

    const detection = detectColumns(amortiguadores.rows);
    if (detection?.mode !== 'positional') throw new Error('se esperaba modo posicional');

    const quality = runQualityChecks(amortiguadores.rows, detection.dataStartRow, detection.mapping, new Map());
    const item = quality.validItems.find((i) => String(i.code) === '72096');

    expect(item).toBeDefined();
    expect(item?.price).toBeCloseTo(121271.26, 2);
  });
});
