import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductSupplierReferencesService } from './product-supplier-references.service';

describe('ProductSupplierReferencesService — matching masivo', () => {
  function buildAuditService() {
    return { record: jest.fn(async () => undefined) };
  }

  function buildPrisma(opts: {
    references: { id: string; productId: string | null; matchStatus: string; internalCode?: never }[];
    products: { id: string; internalCode: string }[];
  }) {
    const referenceUpdates: { id: string; data: Record<string, unknown> }[] = [];
    const tx = {
      productSupplierReference: {
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          referenceUpdates.push({ id: where.id, data });
          return { id: where.id, ...data };
        }),
      },
      product: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new-product-1', ...data })),
      },
    };

    return {
      prisma: {
        productSupplierReference: {
          findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
            const ids = new Set(where.id.in);
            return opts.references.filter((r) => ids.has(r.id));
          }),
          findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
            opts.references.find((r) => r.id === where.id) ?? null,
          ),
        },
        product: {
          findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
            const ids = new Set(where.id.in);
            return opts.products.filter((p) => ids.has(p.id));
          }),
          findUnique: jest.fn(async ({ where }: { where: { internalCode: string } }) =>
            opts.products.find((p) => p.internalCode === where.internalCode) ?? null,
          ),
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
      },
      tx,
      referenceUpdates,
    };
  }

  it('bulkMatch aplica todos los matches en una sola transacción, sin round-trips por ítem', async () => {
    const { prisma, tx, referenceUpdates } = buildPrisma({
      references: [
        { id: 'ref-1', productId: null, matchStatus: 'UNMATCHED' },
        { id: 'ref-2', productId: null, matchStatus: 'UNMATCHED' },
      ],
      products: [{ id: 'prod-1', internalCode: 'A-1' }],
    });
    const audit = buildAuditService();
    const service = new ProductSupplierReferencesService(prisma as never, audit as never);

    const result = await service.bulkMatch(
      [
        { referenceId: 'ref-1', productId: 'prod-1' },
        { referenceId: 'ref-2', productId: 'prod-1' },
      ],
      'user-1',
    );

    expect(result).toEqual({ matched: 2 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.productSupplierReference.update).toHaveBeenCalledTimes(2);
    expect(referenceUpdates.map((u) => u.data.matchStatus)).toEqual(['MATCHED', 'MATCHED']);
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('bulkMatch no aplica ningún cambio si algún producto del lote no existe', async () => {
    const { prisma, tx } = buildPrisma({
      references: [{ id: 'ref-1', productId: null, matchStatus: 'UNMATCHED' }],
      products: [],
    });
    const service = new ProductSupplierReferencesService(prisma as never, buildAuditService() as never);

    await expect(
      service.bulkMatch([{ referenceId: 'ref-1', productId: 'prod-inexistente' }], 'user-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.productSupplierReference.update).not.toHaveBeenCalled();
  });

  it('bulkIgnore marca todas las referencias como IGNORED en una sola transacción', async () => {
    const { prisma, tx } = buildPrisma({
      references: [
        { id: 'ref-1', productId: null, matchStatus: 'UNMATCHED' },
        { id: 'ref-2', productId: null, matchStatus: 'UNMATCHED' },
      ],
      products: [],
    });
    const audit = buildAuditService();
    const service = new ProductSupplierReferencesService(prisma as never, audit as never);

    const result = await service.bulkIgnore(['ref-1', 'ref-2'], 'user-1');

    expect(result).toEqual({ ignored: 2 });
    expect(tx.productSupplierReference.update).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('createProductAndMatch crea el producto y matchea la referencia atómicamente', async () => {
    const { prisma, tx } = buildPrisma({
      references: [{ id: 'ref-1', productId: null, matchStatus: 'UNMATCHED' }],
      products: [],
    });
    const audit = buildAuditService();
    const service = new ProductSupplierReferencesService(prisma as never, audit as never);

    const result = await service.createProductAndMatch(
      'ref-1',
      { internalCode: 'NEW-1', description: 'Amortiguador nuevo' },
      'user-1',
    );

    expect(tx.product.create).toHaveBeenCalledTimes(1);
    expect(tx.productSupplierReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ref-1' },
        data: expect.objectContaining({ productId: 'new-product-1', matchStatus: 'MATCHED' }),
      }),
    );
    expect(result.product.id).toBe('new-product-1');
    expect(result.reference.productId).toBe('new-product-1');
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('createProductAndMatch rechaza un código interno duplicado sin tocar la referencia', async () => {
    const { prisma, tx } = buildPrisma({
      references: [{ id: 'ref-1', productId: null, matchStatus: 'UNMATCHED' }],
      products: [{ id: 'prod-existing', internalCode: 'DUP-1' }],
    });
    const service = new ProductSupplierReferencesService(prisma as never, buildAuditService() as never);

    await expect(
      service.createProductAndMatch('ref-1', { internalCode: 'DUP-1', description: 'x' }, 'user-1'),
    ).rejects.toThrow(ConflictException);
    expect(tx.product.create).not.toHaveBeenCalled();
    expect(tx.productSupplierReference.update).not.toHaveBeenCalled();
  });
});
