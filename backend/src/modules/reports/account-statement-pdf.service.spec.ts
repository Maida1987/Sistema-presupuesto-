import { PDFDocument } from 'pdf-lib';
import { AccountStatementPdfService, AccountStatementMovementRow } from './account-statement-pdf.service';

function buildMovement(overrides: Partial<AccountStatementMovementRow> = {}): AccountStatementMovementRow {
  return {
    movementDate: new Date('2026-01-01'),
    typeLabel: 'Liquidación',
    referenceLabel: 'AccountSettlement abcdef12…',
    debit: 1000,
    credit: 0,
    balanceAfter: 1000,
    ...overrides,
  };
}

describe('AccountStatementPdfService', () => {
  it('nunca trunca movimientos: agrega páginas nuevas en vez de cortar la lista (a diferencia del PDF de remito)', async () => {
    const service = new AccountStatementPdfService();
    // Suficientes filas para no entrar en una sola página A4 (~35-40 filas caben por página).
    const movements = Array.from({ length: 120 }, (_, i) =>
      buildMovement({ referenceLabel: `Movimiento-${i}`, balanceAfter: 1000 * (i + 1) }),
    );

    const buffer = await service.generate({
      customerName: 'Cliente de Prueba',
      customerCode: 'C-1',
      customerCuit: '20-12345678-9',
      from: null,
      to: null,
      movements,
      finalBalance: 1000 * movements.length,
    });

    const doc = await PDFDocument.load(buffer);
    // Con ROW_HEIGHT=16 y ~700pt de alto útil por página, 120 filas no
    // entran en una sola página — si el servicio las truncara en vez de
    // paginar (como hace el PDF de remito), esto seguiría dando 1 página
    // pero con datos perdidos.
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('con pocos movimientos genera una sola página', async () => {
    const service = new AccountStatementPdfService();
    const buffer = await service.generate({
      customerName: 'Cliente Chico',
      customerCode: 'C-2',
      customerCuit: null,
      from: null,
      to: null,
      movements: [buildMovement()],
      finalBalance: 1000,
    });

    const doc = await PDFDocument.load(buffer);
    expect(doc.getPageCount()).toBe(1);
  });
});
