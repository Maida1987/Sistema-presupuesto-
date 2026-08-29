import { mapRawProductRow } from './product-raw-row';

describe('mapRawProductRow', () => {
  it('convierte una fila cruda de Postgres (snake_case) al shape camelCase de Prisma', () => {
    const now = new Date();
    const mapped = mapRawProductRow({
      id: 'p1',
      internal_code: 'BOM-001',
      description: 'Bomba de agua',
      brand: 'Generico',
      category_id: 'cat-1',
      unit: 'UN',
      truck_application: 'Mercedes Benz',
      status: 'ACTIVE',
      notes: null,
      created_at: now,
      updated_at: now,
    });

    expect(mapped).toEqual({
      id: 'p1',
      internalCode: 'BOM-001',
      description: 'Bomba de agua',
      brand: 'Generico',
      categoryId: 'cat-1',
      unit: 'UN',
      truckApplication: 'Mercedes Benz',
      status: 'ACTIVE',
      notes: null,
      createdAt: now,
      updatedAt: now,
    });
  });
});
