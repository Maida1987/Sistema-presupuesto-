export interface GlobalSearchResult {
  customers: { id: string; businessName: string; internalCode: string }[];
  suppliers: { id: string; name: string; code: string }[];
  products: { id: string; internalCode: string; description: string }[];
  deliveryNotes: { id: string; number: number; series: string; customerName: string; status: string }[];
}
