export interface Supplier {
  id: string;
  code: string;
  name: string;
  cuit: string | null;
  contactInfo: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  cuit?: string;
  contactInfo?: string;
}
