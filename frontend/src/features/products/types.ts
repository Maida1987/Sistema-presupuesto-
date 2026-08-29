export interface Product {
  id: string;
  internalCode: string;
  description: string;
  brand: string | null;
  unit: string | null;
  truckApplication: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CreateProductInput {
  internalCode: string;
  description: string;
  brand?: string;
  unit?: string;
  truckApplication?: string;
}
