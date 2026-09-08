import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

export interface AccountStatementMovementRow {
  movementDate: Date;
  typeLabel: string;
  referenceLabel: string;
  debit: number;
  credit: number;
  balanceAfter: number;
}

export interface AccountStatementPdfData {
  customerName: string;
  customerCode: string;
  customerCuit: string | null;
  from: Date | null;
  to: Date | null;
  movements: AccountStatementMovementRow[];
  finalBalance: number;
}

const PAGE_WIDTH = 595.28; // A4 en puntos
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const ROW_HEIGHT = 16;

function formatMoney(value: number): string {
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Extracto de cuenta corriente en PDF, para entregar a un cliente o
 * pasarle a contaduría. A diferencia del PDF de remito (que asume que un
 * remito siempre entra en una página y corta silenciosamente si no), acá
 * el volumen de movimientos no tiene cota razonable — cortar una fila de
 * un extracto contable sería un bug real, no un detalle estético. Por eso
 * agrega páginas nuevas en vez de truncar.
 */
@Injectable()
export class AccountStatementPdfService {
  async generate(data: AccountStatementPdfData): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = this.drawHeader(page, font, bold, data);
    y = this.drawColumnHeaders(page, bold, y);

    for (const movement of data.movements) {
      if (y < MARGIN + 60) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
        y = this.drawColumnHeaders(page, bold, y);
      }

      page.drawText(movement.movementDate.toLocaleDateString('es-AR'), { x: MARGIN, y, size: 9, font });
      page.drawText(movement.typeLabel, { x: MARGIN + 75, y, size: 9, font });
      page.drawText(movement.referenceLabel.slice(0, 28), { x: MARGIN + 175, y, size: 9, font });
      page.drawText(movement.debit > 0 ? formatMoney(movement.debit) : '', {
        x: MARGIN + 340,
        y,
        size: 9,
        font,
      });
      page.drawText(movement.credit > 0 ? formatMoney(movement.credit) : '', {
        x: MARGIN + 410,
        y,
        size: 9,
        font,
      });
      page.drawText(formatMoney(movement.balanceAfter), { x: MARGIN + 480, y, size: 9, font: bold });
      y -= ROW_HEIGHT;
    }

    if (y < MARGIN + 40) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    y -= 10;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
    y -= 20;
    page.drawText(`Saldo final: $ ${formatMoney(data.finalBalance)}`, { x: MARGIN, y, size: 12, font: bold });

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  private drawHeader(page: PDFPage, font: PDFFont, bold: PDFFont, data: AccountStatementPdfData): number {
    let y = PAGE_HEIGHT - MARGIN;
    page.drawText('EXTRACTO DE CUENTA CORRIENTE', { x: MARGIN, y, size: 16, font: bold });
    y -= 26;
    page.drawText(`Cliente: ${data.customerName} (${data.customerCode})`, { x: MARGIN, y, size: 11, font });
    y -= 16;
    if (data.customerCuit) {
      page.drawText(`CUIT: ${data.customerCuit}`, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 16;
    }
    const periodLabel =
      data.from || data.to
        ? `Período: ${data.from ? data.from.toLocaleDateString('es-AR') : 'inicio'} — ${data.to ? data.to.toLocaleDateString('es-AR') : 'hoy'}`
        : 'Período: histórico completo';
    page.drawText(periodLabel, { x: MARGIN, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 24;
    return y;
  }

  private drawColumnHeaders(page: PDFPage, bold: PDFFont, y: number): number {
    page.drawText('Fecha', { x: MARGIN, y, size: 9, font: bold });
    page.drawText('Tipo', { x: MARGIN + 75, y, size: 9, font: bold });
    page.drawText('Referencia', { x: MARGIN + 175, y, size: 9, font: bold });
    page.drawText('Debe', { x: MARGIN + 340, y, size: 9, font: bold });
    page.drawText('Haber', { x: MARGIN + 410, y, size: 9, font: bold });
    page.drawText('Saldo', { x: MARGIN + 480, y, size: 9, font: bold });
    y -= 12;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 16;
    return y;
  }
}
