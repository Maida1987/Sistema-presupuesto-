import { detectColumns } from './column-detection';
import { runQualityChecks } from './quality-checks';

describe('detectColumns', () => {
  it('detecta encabezados "Código | Descripción | Precio" (ejemplo 1 del brief)', () => {
    const rows = [
      ['Código', 'Descripción', 'Precio'],
      ['A-1', 'Filtro de aceite', 20000],
    ];
    const result = detectColumns(rows);
    expect(result).toMatchObject({
      mode: 'header',
      headerRow: 0,
      dataStartRow: 1,
      mapping: { code: 0, description: 1, price: 2 },
    });
  });

  it('detecta encabezados "Código Producto | Detalle | Precio Neto" (ejemplo 2 del brief)', () => {
    const rows = [
      ['Código Producto', 'Detalle', 'Precio Neto'],
      ['A-1', 'Bomba de agua', 80000],
    ];
    const result = detectColumns(rows);
    expect(result?.mode).toBe('header');
    expect(result?.mapping).toEqual({ code: 0, description: 1, price: 2 });
  });

  it('detecta encabezados "SKU | Producto | Costo" con las columnas en otro orden (ejemplo 3 del brief)', () => {
    const rows = [
      ['Costo', 'SKU', 'Producto'],
      [110000, 'A-1', 'Bomba de agua'],
    ];
    const result = detectColumns(rows);
    expect(result?.mode).toBe('header');
    expect(result?.mapping).toEqual({ price: 0, code: 1, description: 2 });
  });

  it('cae a modo posicional cuando no hay fila de encabezados reconocible (caso real MERCOSIL)', () => {
    // Recorte real de la hoja LPG: bloque de metadata sin encabezados,
    // seguido de la tabla (código/descripción/precio por posición).
    const rows: (string | number | null)[][] = [
      ['LISTA DE PRECIOS'],
      [null, '(MERCOSIL DOCUMENTO LPG)'],
      ['VIGENCIA'],
      ['DESDE EL 24/08/2026'],
      [null, 'CONDICIONES DE VENTA:'],
      [null, 'Los precios de esta lista no incluyen I.V.A. u otro impuesto.'],
      [null, 'FRENOS', 'LPG'],
      [null, 'ARANDELAS DE LEVA DE FRENO'],
      ['MPFR0002', 'ARANDELA PARA LEVA DE FRENO CHICA (48mm. exterior)', 332.4],
      ['MPFR0003', 'ARANDELA PARA LEVA DE FRENO MEDIANA (62mm. exterior)', 446.55],
      ['MPFR0126', 'ARANDELA PARA LEVA DE FRENO GRANDE c/chanfle', 1200.66],
      [null, 'BUJES VARIOS DE CRUCETA Y LEVA DE FRENO'],
      ['MPFR0313', 'BUJE DE BRONCE CILINDRICO', 12453.75],
      ['MPFR0090', 'BUJE DE CHAPA P/PERNO DE ANCLAJE MASTER', 2014.88],
      ['MPFR0005', 'BUJE DE NYLON CILINDRICO', 2041.2],
    ];

    const result = detectColumns(rows);
    expect(result).toMatchObject({ mode: 'positional', mapping: { code: 0, description: 1, price: 2 } });
    // No exigimos un índice exacto: el punto de arranque puede caer en
    // alguna fila de metadata/categoría anterior al primer ítem, lo cual
    // es inofensivo (runQualityChecks las clasifica como CATEGORY y las
    // ignora, ver aserciones de abajo). Lo único que importa es que nunca
    // arranque después del primer ítem real.
    expect(result?.dataStartRow).toBeLessThanOrEqual(8);

    if (result?.mode === 'positional') {
      const quality = runQualityChecks(rows, result.dataStartRow, result.mapping, new Map());
      expect(quality.validItems).toHaveLength(6);
      expect(quality.errors).toHaveLength(0);
      expect(quality.validItems.map((item) => item.code)).toEqual([
        'MPFR0002',
        'MPFR0003',
        'MPFR0126',
        'MPFR0313',
        'MPFR0090',
        'MPFR0005',
      ]);
    }
  });

  it('no detecta nada sobre una hoja sin datos', () => {
    expect(detectColumns([[null, null], [null, null]])).toBeNull();
  });

  it('elige "Importe final" y no "U. Precio" como columna de precio (bug real con el archivo PreciosBULON)', () => {
    // "U. Precio" (unidad de referencia del precio, ej. "Unidad") matchea
    // por distancia de Levenshtein contra el sinónimo "precio" antes que
    // llegar a "Importe final" — pero sus datos son texto ("Unidad"), no
    // precios. Sin la validación contra los datos, la hoja entera quedaba
    // con 0 filas válidas.
    const rows: (string | number | null)[][] = [
      ['Codigo', 'Descripcion', 'Importe inicial', 'Moneda', 'Descuento %', 'Importe final', 'U. Precio', 'IVA'],
      ['1.11.22', 'BULON PULIDO USS 7/16x 7/8', 221.35, 'Pesos', -50, 110.67, 'Unidad', 21],
      ['1.11.70', 'BULON PULIDO USS 7/16x 2.3/4', 4225.76, 'Pesos', -50, 2112.88, 'Unidad', 21],
      ['1.13.125', 'BULON PULIDO USS 1/2x 5', 869.3, 'Pesos', 0, 869.3, 'Unidad', 21],
    ];

    const result = detectColumns(rows);
    expect(result).toMatchObject({ mode: 'header', mapping: { code: 0, description: 1, price: 5 } });

    if (result?.mode === 'header') {
      const quality = runQualityChecks(rows, result.dataStartRow, result.mapping, new Map());
      expect(quality.validItems).toHaveLength(3);
      expect(quality.validItems.map((item) => item.price)).toEqual([110.67, 2112.88, 869.3]);
    }
  });
});
