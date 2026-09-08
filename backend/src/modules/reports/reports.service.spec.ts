import * as ExcelJS from 'exceljs';
import { ReportsService } from './reports.service';
import { AccountStatementPdfService } from './account-statement-pdf.service';

async function readXlsxRows(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  const headers = (sheet.getRow(1).values as unknown[]).slice(1) as string[];
  const rows: Record<string, unknown>[] = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const values = (sheet.getRow(r).values as unknown[]).slice(1);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => (row[h] = values[i]));
    rows.push(row);
  }
  return rows;
}

describe('ReportsService', () => {
  it('exportDeliveryNotes nunca incluye una columna de precio (el remito no fija el precio)', async () => {
    const prisma = {
      deliveryNote: {
        findMany: jest.fn(async () => [
          {
            number: 1,
            series: 'A',
            issuedAt: new Date('2026-01-15'),
            status: 'FIRMADO',
            customer: { businessName: 'Cliente Uno', internalCode: 'C-1' },
            items: [{}, {}, {}],
          },
        ]),
      },
    };
    const service = new ReportsService(prisma as never, {} as AccountStatementPdfService);

    const buffer = await service.exportDeliveryNotes({}, 'xlsx');
    const rows = await readXlsxRows(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ 'Cantidad de ítems': 3, Cliente: 'Cliente Uno' });
    const headerText = Object.keys(rows[0]).join(' ').toLowerCase();
    expect(headerText).not.toContain('precio');
    expect(headerText).not.toContain('monto');
    expect(headerText).not.toContain('total');
  });

  it('exportAccountStatement traduce el tipo de movimiento a las mismas etiquetas que usa la UI', async () => {
    const prisma = {
      customer: {
        findUnique: jest.fn(async () => ({
          id: 'c1',
          businessName: 'Cliente Uno',
          internalCode: 'C-1',
          cuit: null,
        })),
      },
      accountMovement: {
        findMany: jest.fn(async () => [
          {
            movementDate: new Date('2026-01-10'),
            type: 'REMITO_PENDIENTE',
            referenceType: 'DeliveryNote',
            referenceId: 'dn-12345678-abcd',
            debit: 1000,
            credit: 0,
            balanceAfter: 1000,
          },
          {
            movementDate: new Date('2026-01-20'),
            type: 'PAGO',
            referenceType: 'Payment',
            referenceId: 'pay-12345678-abcd',
            debit: 0,
            credit: 400,
            balanceAfter: 600,
          },
        ]),
      },
    };
    const service = new ReportsService(prisma as never, {} as AccountStatementPdfService);

    const buffer = await service.exportAccountStatement('c1', {}, 'xlsx');
    const rows = await readXlsxRows(buffer);

    expect(rows.map((r) => r['Tipo'])).toEqual(['Remito pendiente', 'Pago']);
    expect(rows[1]['Saldo']).toBe(600);
  });

  it('exportAccountStatement rechaza un cliente inexistente', async () => {
    const prisma = { customer: { findUnique: jest.fn(async () => null) } };
    const service = new ReportsService(prisma as never, {} as AccountStatementPdfService);

    await expect(service.exportAccountStatement('nope', {}, 'xlsx')).rejects.toThrow('Cliente no encontrado');
  });
});
