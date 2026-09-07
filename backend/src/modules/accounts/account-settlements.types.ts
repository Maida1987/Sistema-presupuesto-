import { PriceCandidate } from './price-resolution';

export interface PendingItemPreview {
  deliveryNoteItemId: string;
  deliveryNoteId: string;
  deliveryNoteNumber: string;
  issuedAt: string;
  code: string;
  description: string;
  quantity: number;
  hasPricing: boolean;
  chosenPrice: PriceCandidate | null;
  candidates: PriceCandidate[];
}
