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

export type MatchStatus = 'UNMATCHED' | 'MATCHED' | 'IGNORED';

export interface ProductSupplierReference {
  id: string;
  productId: string | null;
  supplierId: string;
  supplierCode: string;
  supplierDescription: string;
  matchStatus: MatchStatus;
  matchedById: string | null;
  matchedAt: string | null;
  createdAt: string;
  supplier: { id: string; code: string; name: string };
  product: Product | null;
}

export interface SupplierReferencesPage {
  items: ProductSupplierReference[];
  total: number;
}

export interface MatchSuggestion {
  referenceId: string;
  candidate: Product | null;
  score: number | null;
}

export interface BulkMatchItem {
  referenceId: string;
  productId: string;
}

export interface CreateProductFromReferenceInput {
  internalCode: string;
  description: string;
  brand?: string;
  unit?: string;
  truckApplication?: string;
}
