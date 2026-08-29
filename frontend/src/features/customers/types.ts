export interface Customer {
  id: string;
  internalCode: string;
  businessName: string;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CreateCustomerInput {
  internalCode: string;
  businessName: string;
  cuit?: string;
  phone?: string;
  email?: string;
  city?: string;
}
