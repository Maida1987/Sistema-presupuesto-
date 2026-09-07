import { AccountMovementsService } from './account-movements.service';

describe('AccountMovementsService.recordMovement', () => {
  function buildTx(movements: { balanceAfter: number; createdAt: Date }[]) {
    return {
      $executeRaw: jest.fn(async () => undefined),
      accountMovement: {
        findFirst: jest.fn(async () => {
          if (movements.length === 0) return null;
          const latest = [...movements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          return { balanceAfter: latest.balanceAfter } as never;
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      },
    };
  }

  it('parte de saldo 0 cuando el cliente no tiene movimientos previos', async () => {
    const tx = buildTx([]);
    const service = new AccountMovementsService(undefined as never);

    const movement = await service.recordMovement(tx as never, {
      customerId: 'c1',
      type: 'LIQUIDACION',
      referenceType: 'AccountSettlement',
      referenceId: 's1',
      debit: 150000,
      createdById: 'u1',
    });

    expect(movement.balanceAfter).toBe(150000);
  });

  it('un débito (liquidación) suma al saldo anterior', async () => {
    const tx = buildTx([{ balanceAfter: 100, createdAt: new Date('2026-01-01') }]);
    const service = new AccountMovementsService(undefined as never);

    const movement = await service.recordMovement(tx as never, {
      customerId: 'c1',
      type: 'LIQUIDACION',
      referenceType: 'AccountSettlement',
      referenceId: 's1',
      debit: 50,
      createdById: 'u1',
    });

    expect(movement.balanceAfter).toBe(150);
  });

  it('un crédito (pago o ajuste de reverso) resta del saldo anterior', async () => {
    const tx = buildTx([{ balanceAfter: 150, createdAt: new Date('2026-01-01') }]);
    const service = new AccountMovementsService(undefined as never);

    const movement = await service.recordMovement(tx as never, {
      customerId: 'c1',
      type: 'AJUSTE',
      referenceType: 'AccountSettlement',
      referenceId: 's1',
      credit: 150,
      createdById: 'u1',
    });

    expect(movement.balanceAfter).toBe(0);
  });

  it('bloquea la fila del cliente antes de leer el último movimiento (evita condiciones de carrera)', async () => {
    const tx = buildTx([]);
    const service = new AccountMovementsService(undefined as never);

    await service.recordMovement(tx as never, {
      customerId: 'c1',
      type: 'PAGO',
      referenceType: 'Payment',
      referenceId: 'p1',
      credit: 10,
      createdById: 'u1',
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const lockCallOrder = tx.$executeRaw.mock.invocationCallOrder[0];
    const readCallOrder = tx.accountMovement.findFirst.mock.invocationCallOrder[0];
    expect(lockCallOrder).toBeLessThan(readCallOrder);
  });
});
