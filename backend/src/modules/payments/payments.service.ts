import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/interceptors/audit.service';
import { AccountMovementsService } from '../accounts/account-movements.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

const PAYMENT_DETAIL_INCLUDE = {
  customer: true,
  paymentMethod: true,
} satisfies Prisma.PaymentInclude;

type PaymentDetail = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_DETAIL_INCLUDE }>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accountMovements: AccountMovementsService,
  ) {}

  /**
   * Registrar un pago siempre impacta la cuenta corriente en la misma
   * transacción (docs/01 §21): un pago sin su movimiento asociado (o
   * viceversa) no puede existir.
   */
  async create(dto: CreatePaymentDto, actingUserId: string): Promise<PaymentDetail> {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new BadRequestException('El cliente indicado no existe');
    }

    const paymentMethod = await this.prisma.paymentMethod.findUnique({ where: { id: dto.paymentMethodId } });
    if (!paymentMethod || !paymentMethod.active) {
      throw new BadRequestException('El medio de pago indicado no existe o no está activo');
    }
    if (paymentMethod.requiresReference && !dto.referenceNumber) {
      throw new BadRequestException(`El medio de pago "${paymentMethod.name}" requiere un número de comprobante`);
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          customerId: dto.customerId,
          paymentDate,
          amount: dto.amount,
          paymentMethodId: dto.paymentMethodId,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          createdById: actingUserId,
          status: 'REGISTRADO',
        },
      });

      await this.accountMovements.recordMovement(tx, {
        customerId: dto.customerId,
        type: 'PAGO',
        referenceType: 'Payment',
        referenceId: created.id,
        credit: dto.amount,
        movementDate: paymentDate,
        createdById: actingUserId,
      });

      return created;
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'payments',
      entityType: 'Payment',
      entityId: payment.id,
      action: 'CREATE',
      newValue: payment,
    });

    return this.findOne(payment.id);
  }

  async void(id: string, reason: string, actingUserId: string): Promise<PaymentDetail> {
    const payment = await this.findOne(id);
    if (payment.status === 'ANULADO') {
      throw new BadRequestException('El pago ya está anulado');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: { status: 'ANULADO', voidReason: reason, voidedById: actingUserId, voidedAt: new Date() },
      });

      await this.accountMovements.recordMovement(tx, {
        customerId: payment.customerId,
        type: 'AJUSTE',
        referenceType: 'Payment',
        referenceId: id,
        debit: Number(payment.amount),
        createdById: actingUserId,
      });
    });

    await this.auditService.record({
      userId: actingUserId,
      module: 'payments',
      entityType: 'Payment',
      entityId: id,
      action: 'VOID',
      oldValue: { status: payment.status },
      newValue: { status: 'ANULADO' },
      reason,
    });

    return this.findOne(id);
  }

  async findAll(filters: { customerId?: string }): Promise<PaymentDetail[]> {
    return this.prisma.payment.findMany({
      where: { customerId: filters.customerId },
      include: PAYMENT_DETAIL_INCLUDE,
      orderBy: { paymentDate: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string): Promise<PaymentDetail> {
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: PAYMENT_DETAIL_INCLUDE });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    return payment;
  }
}
