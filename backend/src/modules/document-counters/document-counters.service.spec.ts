import { DocumentCountersService } from './document-counters.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('DocumentCountersService', () => {
  it('incrementa el contador dentro de una transacción y nunca reutiliza un número', async () => {
    let lastNumber = 0;

    const fakeTx = {
      $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
        if (strings[0].includes('UPDATE')) {
          // el número actualizado viaja como segundo valor interpolado
          return undefined;
        }
        return undefined;
      }),
      $queryRaw: jest.fn(async () => [{ id: 'counter-1', last_number: lastNumber }]),
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof fakeTx) => Promise<number>) => {
        const result = await callback(fakeTx);
        return result;
      }),
    } as unknown as PrismaService;

    const service = new DocumentCountersService(prisma);

    const first = await service.getNextNumber('REMITO', 'A', 2026);
    expect(first).toBe(1);

    lastNumber = 1;
    const second = await service.getNextNumber('REMITO', 'A', 2026);
    expect(second).toBe(2);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
