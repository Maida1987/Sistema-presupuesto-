export type DeliveryNoteStatus = 'BORRADOR' | 'EMITIDO' | 'ENTREGADO' | 'FIRMADO' | 'LIQUIDADO' | 'ANULADO';

export interface DeliveryNoteListEntry {
  id: string;
  number: number;
  series: string;
  issuedAt: string;
  status: DeliveryNoteStatus;
  customer: { id: string; businessName: string; internalCode: string };
}

export interface DeliveryNoteItem {
  id: string;
  productId: string;
  quantity: string;
  unit: string | null;
  codeSnapshot: string;
  descriptionSnapshot: string;
}

export interface DeliveryNoteDocument {
  id: string;
  type: 'ORIGINAL_PDF' | 'DUPLICADO_PDF' | 'FIRMADO_SCAN';
  uploadedAt: string;
}

export interface DeliveryNoteStatusHistoryEntry {
  id: string;
  fromStatus: DeliveryNoteStatus | null;
  toStatus: DeliveryNoteStatus;
  changedAt: string;
  reason: string | null;
}

export interface DeliveryNoteDetail extends DeliveryNoteListEntry {
  voidReason: string | null;
  items: DeliveryNoteItem[];
  documents: DeliveryNoteDocument[];
  statusLog: DeliveryNoteStatusHistoryEntry[];
}

export interface CreateDeliveryNoteInput {
  customerId: string;
  items: { productId: string; quantity: number }[];
}
