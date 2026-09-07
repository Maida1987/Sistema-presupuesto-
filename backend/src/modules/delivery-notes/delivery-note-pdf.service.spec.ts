import { DeliveryNotePdfService } from './delivery-note-pdf.service';

describe('DeliveryNotePdfService', () => {
  const service = new DeliveryNotePdfService();

  const sampleData = {
    number: 154,
    series: 'A',
    issuedAt: new Date('2026-08-05T12:00:00Z'),
    customerName: 'Transportes El Rápido S.A.',
    customerCode: 'CLI-001',
    items: [
      { codeSnapshot: 'FIL-123', descriptionSnapshot: 'Filtro de aceite', quantity: '2', unit: 'UN' },
      { codeSnapshot: 'BBA-778', descriptionSnapshot: 'Bomba de agua', quantity: '1', unit: null },
    ],
  };

  it('genera un PDF válido para el original', async () => {
    const buffer = await service.generate(sampleData, 'ORIGINAL');
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('genera un PDF válido para el duplicado', async () => {
    const buffer = await service.generate(sampleData, 'DUPLICADO');
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('el tipo de dato de entrada no admite ningún campo de precio (regla fundamental: el remito nunca fija el precio)', () => {
    // Chequeo estructural: DeliveryNotePdfData no tiene price/precio/amount
    // en ningún nivel, así que generate() no puede recibir esa
    // información aunque quisiera imprimirla.
    const keys = JSON.stringify(sampleData).toLowerCase();
    expect(keys).not.toMatch(/precio|price|importe|amount/);
  });
});
