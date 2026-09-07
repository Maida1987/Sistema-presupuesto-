import { runQualityChecks } from './quality-checks';
import { ColumnMapping } from './row-classification';

const mapping: ColumnMapping = { code: 0, description: 1, price: 2 };

describe('runQualityChecks', () => {
  it('separa ítems válidos de filas con problemas sin descartar el resto del archivo', () => {
    const rows = [
      ['header row, ignorada porque dataStartRow=1'],
      ['A-1', 'Producto A', 100],
      [null, 'CATEGORIA SIN CODIGO NI PRECIO', null],
      ['A-2', null, 50], // sin descripción -> error
      ['A-3', 'Producto C', 'CONSULTAR'], // precio inválido -> error
      ['A-1', 'Producto A duplicado', 120], // código duplicado -> error
      ['', 'Producto sin código', 80], // código vacío -> error
      ['A-4', 'Producto D', -5], // precio negativo -> error
    ];

    const result = runQualityChecks(rows, 1, mapping, new Map());

    expect(result.validItems).toEqual([{ rowNumber: 2, code: 'A-1', description: 'Producto A', price: 100 }]);
    expect(result.categoryRows).toBe(1);
    expect(result.errors.map((e) => e.errorType)).toEqual([
      'MISSING_DESCRIPTION',
      'INVALID_PRICE',
      'DUPLICATE_CODE',
      'MISSING_CODE',
      'INVALID_PRICE',
    ]);
  });

  it('marca advertencia de variación extrema de precio sin bloquear el ítem', () => {
    const rows = [['A-1', 'Producto A', 200]];
    const previousPrices = new Map([['A-1', 100]]); // +100%, supera el umbral del 40%

    const result = runQualityChecks(rows, 0, mapping, previousPrices);

    expect(result.validItems).toHaveLength(1);
    expect(result.warnings).toEqual([
      { rowNumber: 1, code: 'A-1', previousPrice: 100, newPrice: 200, percentChange: 1 },
    ]);
  });

  it('no advierte por variaciones dentro del umbral', () => {
    const rows = [['A-1', 'Producto A', 110]];
    const previousPrices = new Map([['A-1', 100]]); // +10%

    const result = runQualityChecks(rows, 0, mapping, previousPrices);
    expect(result.warnings).toHaveLength(0);
  });

  it('detecta filas completamente duplicadas', () => {
    const rows = [
      ['A-1', 'Producto A', 100],
      ['A-1', 'Producto A', 100],
    ];

    const result = runQualityChecks(rows, 0, mapping, new Map());
    expect(result.validItems).toHaveLength(1);
    expect(result.errors[0].errorType).toBe('DUPLICATE_ROW');
  });
});
