import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface DeliveryNotePdfData {
  number: number;
  series: string;
  issuedAt: Date;
  customerName: string;
  customerCode: string;
  items: { codeSnapshot: string; descriptionSnapshot: string; quantity: string; unit: string | null }[];
}

const PAGE_WIDTH = 595.28; // A4 en puntos
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

/**
 * Genera el PDF del remito — SIN precios en ningún campo, ver la regla de
 * negocio fundamental en docs/01-analisis-funcional.md §1: el remito
 * nunca fija el precio. Devuelve el mismo layout para "ORIGINAL" y
 * "DUPLICADO"; solo cambia la etiqueta impresa, para que ambos ejemplares
 * sean idénticos salvo esa marca (docs/01 §15).
 */
@Injectable()
export class DeliveryNotePdfService {
  async generate(data: DeliveryNotePdfData, copyType: 'ORIGINAL' | 'DUPLICADO'): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let y = PAGE_HEIGHT - MARGIN;

    page.drawText('REMITO', { x: MARGIN, y, size: 20, font: bold });
    page.drawText(copyType === 'ORIGINAL' ? 'ORIGINAL — Cliente' : 'DUPLICADO — Comercio', {
      x: PAGE_WIDTH - MARGIN - 180,
      y,
      size: 11,
      font: bold,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 30;

    const series = `${data.series}-${String(data.number).padStart(8, '0')}`;
    page.drawText(`Número: ${series}`, { x: MARGIN, y, size: 11, font });
    y -= 16;
    page.drawText(`Fecha: ${data.issuedAt.toLocaleDateString('es-AR')}`, { x: MARGIN, y, size: 11, font });
    y -= 16;
    page.drawText(`Cliente: ${data.customerName} (${data.customerCode})`, { x: MARGIN, y, size: 11, font });
    y -= 28;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 20;

    const colCode = MARGIN;
    const colDescription = MARGIN + 90;
    const colQuantity = PAGE_WIDTH - MARGIN - 90;

    page.drawText('Código', { x: colCode, y, size: 10, font: bold });
    page.drawText('Descripción', { x: colDescription, y, size: 10, font: bold });
    page.drawText('Cantidad', { x: colQuantity, y, size: 10, font: bold });
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 16;

    for (const item of data.items) {
      if (y < MARGIN + 100) break; // una sola página alcanza para el volumen esperado por remito

      page.drawText(item.codeSnapshot.slice(0, 18), { x: colCode, y, size: 9, font });
      page.drawText(item.descriptionSnapshot.slice(0, 55), { x: colDescription, y, size: 9, font });
      page.drawText(`${item.quantity} ${item.unit ?? ''}`.trim(), { x: colQuantity, y, size: 9, font });
      y -= 16;
    }

    y -= 40;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 200, y }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Firma y aclaración del receptor', { x: MARGIN, y: y - 14, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}
