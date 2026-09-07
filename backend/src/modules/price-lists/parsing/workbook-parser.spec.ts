import { normalizeCellValue } from './workbook-parser';

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
