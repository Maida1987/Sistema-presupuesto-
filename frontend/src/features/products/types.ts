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

export interface PriceComparisonEntry {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  price: number;
  currency: string;
  effectiveDate: string;
  previousPrice: number | null;
  percentChange: number | null;
}

export interface PriceComparison {
  productId: string;
  bestSupplierId: string | null;
  comparisons: PriceComparisonEntry[];
}
