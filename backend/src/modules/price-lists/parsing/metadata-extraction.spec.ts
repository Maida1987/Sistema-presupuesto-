import { extractMetadata } from './metadata-extraction';

describe('extractMetadata', () => {
  it('extrae fecha de vigencia y moneda pesos del bloque de metadata (caso real LPG)', () => {
    const rows = [
      ['LISTA DE PRECIOS'],
      [null, '(MERCOSIL DOCUMENTO LPG)'],
      ['VIGENCIA'],
      ['DESDE EL 24/08/2026'],
      [null, 'Los precios de esta lista no incluyen I.V.A. u otro impuesto.'],
    ];

    const metadata = extractMetadata(rows);
    expect(metadata.effectiveDate?.toISOString().slice(0, 10)).toBe('2026-08-24');
    expect(metadata.currency).toBeNull();
  });

  it('detecta moneda dólares (caso real IMPORTADOS/FEY)', () => {
    const rows = [
      ['VIGENCIA'],
      ['DESDE EL 24/08/2026'],
      [null, 'Precios netos expresados en dólares.'],
      [null, 'Se aplicará tipo de cambio vendedor del Banco Nación al día de la transacción.'],
    ];

    expect(extractMetadata(rows).currency).toBe('USD');
  });

  it('detecta moneda pesos explícita (caso real AMORTIGUADORES)', () => {
    const rows = [[null, 'Precios netos expresados en pesos.']];
    expect(extractMetadata(rows).currency).toBe('ARS');
  });

  it('devuelve null cuando no encuentra nada (nunca inventa un valor)', () => {
    const metadata = extractMetadata([['sin metadata reconocible']]);
    expect(metadata.effectiveDate).toBeNull();
    expect(metadata.currency).toBeNull();
  });
});
