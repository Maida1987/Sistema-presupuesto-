import { classifyRow, ColumnMapping } from './row-classification';

const mapping: ColumnMapping = { code: 0, description: 1, price: 2 };

describe('classifyRow', () => {
  it('clasifica una fila con código, descripción y precio como ITEM', () => {
    const result = classifyRow(['MPFR0002', 'ARANDELA PARA LEVA DE FRENO CHICA', 332.4], mapping);
    expect(result).toMatchObject({ kind: 'ITEM', code: 'MPFR0002', price: 332.4 });
  });

  it('clasifica una fila sin código y sin precio como CATEGORY (encabezado de sección)', () => {
    const result = classifyRow([null, 'ARANDELAS DE LEVA DE FRENO', null], mapping);
    expect(result.kind).toBe('CATEGORY');
  });

  it('clasifica una fila totalmente vacía como EMPTY', () => {
    expect(classifyRow([null, null, null], mapping).kind).toBe('EMPTY');
  });

  it('clasifica como INVALID una fila con código y descripción pero sin precio válido', () => {
    const result = classifyRow(['MPFR0002', 'ARANDELA', 'CONSULTAR'], mapping);
    expect(result.kind).toBe('INVALID');
  });

  it('clasifica como INVALID una fila con precio pero sin descripción', () => {
    const result = classifyRow(['MPFR0002', null, 100], mapping);
    expect(result.kind).toBe('INVALID');
  });
});
