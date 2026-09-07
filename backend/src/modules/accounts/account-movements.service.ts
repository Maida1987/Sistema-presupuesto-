import { Injectable } from '@nestjs/common';
import { AccountMovement, AccountMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface RecordMovementParams {
  customerId: string;
  type: AccountMovementType;
  referenceType: string;
  referenceId: string;
  debit?: number;
  credit?: number;
  movementDate?: Date;
  createdById: string;
}

/**
 * Libro de movimientos de cuenta corriente (docs/03 §3 "Cuenta corriente",
 * [append-only]): nunca se actualiza un movimiento, cada cambio de saldo es
 * una fila nueva. El saldo es siempre reconstruible sumando esta tabla;
 * balance_after se graba como cache de lectura en la misma transacción.
 *
 * Reutilizable desde Liquidaciones (Fase 4) y Pagos (Fase 5): ambos módulos
 * inyectan este servicio en vez de escribir en account_movements
 * directamente, para que el balance nunca se calcule de dos formas
 * distintas en el sistema.
 */
@Injectable()
export class AccountMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Debe llamarse dentro de una transacción (`tx`) para que el bloqueo de
   * fila del cliente y el cálculo del saldo sean atómicos junto con el
   * resto de la operación (confirmar una liquidación, registrar un pago).
   * Bloquear la fila del cliente serializa a cualquier otra transacción
   * que intente escribir un movimiento para el mismo cliente al mismo
   * tiempo, evitando que dos liquidaciones/pagos concurrentes calculen el
   * mismo `balance_after` de partida (docs/02-arquitectura.md §5).
   */
  async recordMovement(tx: Prisma.TransactionClient, params: RecordMovementParams): Promise<AccountMovement> {
    await tx.$executeRaw`SELECT id FROM customers WHERE id = ${params.customerId} FOR UPDATE`;

    const lastMovement = await tx.accountMovement.findFirst({
      where: { customerId: params.customerId },
      orderBy: { createdAt: 'desc' },
    });
    const previousBalance = lastMovement ? Number(lastMovement.balanceAfter) : 0;
    const debit = params.debit ?? 0;
    const credit = params.credit ?? 0;
    const balanceAfter = previousBalance + debit - credit;

    return tx.accountMovement.create({
      data: {
        customerId: params.customerId,
        movementDate: params.movementDate ?? new Date(),
        type: params.type,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        debit,
        credit,
        balanceAfter,
        createdById: params.createdById,
      },
    });
  }

  async getAccount(customerId: string): Promise<{ balance: number; movements: AccountMovement[] }> {
    const movements = await this.prisma.accountMovement.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    const balance = movements[0] ? Number(movements[0].balanceAfter) : 0;
    return { balance, movements };
  }
}
