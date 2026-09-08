import { PriceListsService } from './price-lists.service';
import { ConfirmSheetInput } from './price-lists.types';

/**
 * importSheet es privado: se llega a él a través de confirm(), pero
 * mockear todo lo que confirm() toca (storage, auditService, parseo real
 * del buffer) sería puro ruido para lo que estas pruebas necesitan probar.
 * En su lugar se invoca directamente, como se hace en otros services con
 * lógica transaccional (ver account-movements.service.spec.ts).
 */
function callImportSheet(
  service: PriceListsService,
  rows: (string | number | null)[][],
  overrides: Partial<ConfirmSheetInput> = {},
) {
  const input: ConfirmSheetInput = {
    sheetName: 'Sheet',
    include: true,
    mapping: { code: 0, description: 1, price: 2 },
    dataStartRow: 0,
    effectiveDate: '2026-09-08',
    currency: 'ARS',
    ...overrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (service as any).importSheet(rows, input, 'sup1', 'file1', 'user1');
}

describe('PriceListsService — escritura en lote de importSheet', () => {
  let referenceStore: { id: string; supplierCode: string; matchStatus: string; productId: string | null }[];
  let priceListItemStore: { id: string; supplierReferenceId: string; priceListId: string }[];
  let refIdCounter = 0;
  let priceListItemIdCounter = 0;

  function buildTx() {
    return {
      priceList: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pl1', ...data })),
      },
      importError: { createMany: jest.fn(async () => ({ count: 0 })) },
      productSupplierReference: {
        findMany: jest.fn(async ({ where }: { where: { supplierCode: { in: string[] } } }) => {
          const codes = new Set(where.supplierCode.in);
          return referenceStore.filter((r) => codes.has(r.supplierCode));
        }),
        createMany: jest.fn(async ({ data }: { data: { supplierCode: string; supplierDescription: string }[] }) => {
          for (const d of data) {
            refIdCounter += 1;
            referenceStore.push({ id: `ref-${refIdCounter}`, supplierCode: d.supplierCode, matchStatus: 'UNMATCHED', productId: null });
          }
          return { count: data.length };
        }),
      },
      priceListItem: {
        createMany: jest.fn(async ({ data }: { data: { supplierReferenceId: string; priceListId: string }[] }) => {
          for (const d of data) {
            priceListItemIdCounter += 1;
            priceListItemStore.push({ id: `pli-${priceListItemIdCounter}`, supplierReferenceId: d.supplierReferenceId, priceListId: d.priceListId });
          }
          return { count: data.length };
        }),
        findMany: jest.fn(async ({ where }: { where: { priceListId: string; supplierReferenceId: { in: string[] } } }) => {
          const ids = new Set(where.supplierReferenceId.in);
          return priceListItemStore
            .filter((pli) => pli.priceListId === where.priceListId && ids.has(pli.supplierReferenceId))
            .map((pli) => ({ id: pli.id, supplierReferenceId: pli.supplierReferenceId }));
        }),
      },
      product: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, categoryId: null })),
      },
      priceHistory: {
        updateMany: jest.fn(async () => ({ count: 0 })),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      },
    };
  }

  function buildService(tx: ReturnType<typeof buildTx>, rule: unknown = null) {
    const service = new PriceListsService(undefined as never, undefined as never, undefined as never, {
      resolveApplicableRule: jest.fn(async () => rule),
    } as never);
    // getPreviousPrices consulta this.prisma directamente (fuera de la
    // transacción) — se stubea para no necesitar un Prisma real.
    jest
      .spyOn(service as unknown as { getPreviousPrices: () => Promise<Map<string, number>> }, 'getPreviousPrices')
      .mockResolvedValue(new Map());
    (service as unknown as { prisma: unknown }).prisma = {
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    };
    return service;
  }

  beforeEach(() => {
    referenceStore = [];
    priceListItemStore = [];
    refIdCounter = 0;
    priceListItemIdCounter = 0;
  });

  it('crea referencias nuevas en lote (createMany), no una por una', async () => {
    const tx = buildTx();
    const service = buildService(tx);

    const rows = [
      ['A-1', 'Filtro de aceite', 1000],
      ['A-2', 'Filtro de aire', 2000],
      ['A-3', 'Bomba de agua', 3000],
    ];

    const report = await callImportSheet(service, rows);

    expect(tx.productSupplierReference.createMany).toHaveBeenCalledTimes(1);
    expect(tx.priceListItem.createMany).toHaveBeenCalledTimes(1);
    // Nunca debe volver a llamar a findUnique/create por fila (el bug real:
    // 2-3 round-trips por fila).
    expect(report).toMatchObject({ imported: 3, newReferences: 3, updatedReferences: 0, errors: 0 });
    expect(referenceStore).toHaveLength(3);
    expect(priceListItemStore).toHaveLength(3);
  });

  it('no vuelve a crear una referencia que ya existe (código repetido entre importaciones)', async () => {
    const tx = buildTx();
    const service = buildService(tx);
    referenceStore.push({ id: 'ref-existing', supplierCode: 'A-1', matchStatus: 'UNMATCHED', productId: null });

    const rows = [
      ['A-1', 'Filtro de aceite', 1500],
      ['A-2', 'Filtro de aire', 2000],
    ];

    const report = await callImportSheet(service, rows);

    expect(report).toMatchObject({ imported: 2, newReferences: 1 });
    expect(tx.productSupplierReference.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ supplierCode: 'A-2' })] }),
    );
  });

  it('registra price_history solo para referencias ya matcheadas, asociado al priceListItem correcto', async () => {
    const tx = buildTx();
    const rule = {
      id: 'rule1',
      marginPct: 0.3,
      marginBase: 'COST',
      expensesPct: 0,
      expensesFixed: 0,
      ivaPct: 0.21,
      roundingRule: 'NONE',
    };
    const service = buildService(tx, rule);
    referenceStore.push(
      { id: 'ref-matched', supplierCode: 'A-1', matchStatus: 'MATCHED', productId: 'prod-1' },
      { id: 'ref-unmatched', supplierCode: 'A-2', matchStatus: 'UNMATCHED', productId: null },
    );

    const rows = [
      ['A-1', 'Filtro de aceite', 1500],
      ['A-2', 'Filtro de aire', 2000],
    ];

    await callImportSheet(service, rows);

    // Solo un llamado a priceHistory.create, para la referencia MATCHED.
    expect(tx.priceHistory.create).toHaveBeenCalledTimes(1);
    const call = tx.priceHistory.create.mock.calls[0][0];
    expect(call.data.productId).toBe('prod-1');
    expect(call.data.supplierReferenceId).toBe('ref-matched');
    // El priceListItemId asociado debe ser el que realmente se creó para
    // ESTA referencia en ESTA hoja (no cualquier priceListItem al azar).
    const createdForMatched = priceListItemStore.find((pli) => pli.supplierReferenceId === 'ref-matched');
    expect(call.data.sourcePriceListItemId).toBe(createdForMatched?.id);
  });
});
