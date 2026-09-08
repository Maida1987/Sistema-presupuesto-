import { normalizeCellValue, parseWorkbook, UnsupportedLegacyXlsError } from './workbook-parser';

describe('normalizeCellValue', () => {
  it('devuelve strings y números tal cual', () => {
    expect(normalizeCellValue('ARANDELA')).toBe('ARANDELA');
    expect(normalizeCellValue(332.4)).toBe(332.4);
    expect(normalizeCellValue(null)).toBeNull();
  });

  it('concatena texto enriquecido (richText)', () => {
    expect(normalizeCellValue({ richText: [{ text: 'BOMBA ' }, { text: 'DE AGUA' }] } as never)).toBe(
      'BOMBA DE AGUA',
    );
  });

  it('usa el resultado cacheado de una fórmula', () => {
    expect(normalizeCellValue({ formula: 'A1*1.05', result: 332.4 } as never)).toBe(332.4);
  });

  it('devuelve null para una celda con error de fórmula', () => {
    expect(normalizeCellValue({ error: '#DIV/0!' } as never)).toBeNull();
  });

  it('usa el texto de un hipervínculo simple', () => {
    expect(normalizeCellValue({ text: 'MPFR0002', hyperlink: 'https://example.com' } as never)).toBe('MPFR0002');
  });

  it('resuelve un hipervínculo cuyo texto es, a su vez, texto enriquecido (bug real con el archivo MERCOSIL)', () => {
    const value = {
      text: { richText: [{ text: 'BOMBA DE AGUA' }] },
      hyperlink: 'https://example.com',
    };
    expect(normalizeCellValue(value as never)).toBe('BOMBA DE AGUA');
  });

  it('nunca devuelve la basura "[object Object]" para una forma de objeto desconocida', () => {
    const result = normalizeCellValue({ algoQueNoReconocemos: true } as never);
    expect(result).not.toBe('[object Object]');
    expect(result).toBeNull();
  });
});

describe('parseWorkbook con un .xls binario (Excel 97-2003)', () => {
  it('rechaza con un error claro en vez de dejar que exceljs falle con un mensaje interno de jszip (bug real con el archivo FGP)', async () => {
    // Firma de Compound File Binary (OLE2), el contenedor real de un .xls
    // legado — no hace falta un archivo real completo para probar la
    // detección, que solo mira los primeros 8 bytes.
    const oleBuffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);

    await expect(parseWorkbook(oleBuffer)).rejects.toThrow(UnsupportedLegacyXlsError);
    await expect(parseWorkbook(oleBuffer)).rejects.toThrow(/\.xlsx/);
  });
});
