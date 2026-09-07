import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { AccountMovementsService } from '../accounts/account-movements.service';

function buildService(overrides: {
  customer?: unknown;
  paymentMethod?: unknown;
}) {
  const customer = 'customer' in overrides ? overrides.customer : { id: 'c1' };
  const paymentMethod =
    'paymentMethod' in overrides ? overrides.paymentMethod : { id: 'pm1', active: true, requiresReference: false };

  const prisma = {
    customer: { findUnique: jest.fn().mockResolvedValue(customer) },
    paymentMethod: { findUnique: jest.fn().mockResolvedValue(paymentMethod) },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const auditService = { record: jest.fn() } as unknown as AuditService;
  const accountMovements = { recordMovement: jest.fn() } as unknown as AccountMovementsService;

  return new PaymentsService(prisma, auditService, accountMovements);
}

describe('PaymentsService.create — validaciones', () => {
  it('rechaza un cliente inexistente', async () => {
    const service = buildService({ customer: null });
    await expect(
      service.create({ customerId: 'nope', amount: 100, paymentMethodId: 'pm1' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un medio de pago inexistente', async () => {
    const service = buildService({ paymentMethod: null });
    await expect(
      service.create({ customerId: 'c1', amount: 100, paymentMethodId: 'nope' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un medio de pago inactivo', async () => {
    const service = buildService({ paymentMethod: { id: 'pm1', active: false, requiresReference: false } });
    await expect(
      service.create({ customerId: 'c1', amount: 100, paymentMethodId: 'pm1' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('exige número de comprobante cuando el medio de pago lo requiere (p. ej. cheque/transferencia)', async () => {
    const service = buildService({ paymentMethod: { id: 'pm1', active: true, requiresReference: true } });
    await expect(
      service.create({ customerId: 'c1', amount: 100, paymentMethodId: 'pm1' }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });
});
