import { Product } from '@prisma/client';

/** Fila cruda devuelta por $queryRaw (columnas snake_case de Postgres). */
export interface RawProductRow {
  id: string;
  internal_code: string;
  description: string;
  brand: string | null;
  category_id: string | null;
  unit: string | null;
  truck_application: string | null;
  status: Product['status'];
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Normaliza una fila cruda al mismo shape camelCase que devuelve el
 * Prisma Client en el resto de la API (evita que el contrato de
 * /products cambie según si la búsqueda usó $queryRaw o findMany).
 */
export function mapRawProductRow(row: RawProductRow): Product {
  return {
    id: row.id,
    internalCode: row.internal_code,
    description: row.description,
    brand: row.brand,
    categoryId: row.category_id,
    unit: row.unit,
    truckApplication: row.truck_application,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
