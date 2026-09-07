import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

/**
 * Numeración transaccional segura de documentos (remitos, liquidaciones,
 * pagos). Nunca usa SELECT MAX(numero)+1: bloquea la fila del contador con
 * SELECT ... FOR UPDATE dentro de la misma transacción que la incrementa,
 * de forma que dos vendedores emitiendo en simultáneo nunca obtengan el
 * mismo número (ver docs/02-arquitectura.md §4).
 */
@Injectable()
export class DocumentCountersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Si se pasa `tx` (una transacción ya abierta por el llamador, p. ej. la
   * que crea el remito), el número se reserva dentro de esa misma
   * transacción — reservar el número y crear el documento son una única
   * operación atómica (docs/02 §4/§5). Sin `tx`, abre su propia
   * transacción (uso standalone).
   */
  async getNextNumber(
    docType: string,
    series: string,
    year = new Date().getFullYear(),
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    if (tx) {
      return this.reserveNumber(tx, docType, series, year);
    }
    return this.prisma.$transaction((innerTx) => this.reserveNumber(innerTx, docType, series, year));
  }

  private async reserveNumber(
    client: PrismaClientOrTx,
    docType: string,
    series: string,
    year: number,
  ): Promise<number> {
    await client.$executeRaw`
      INSERT INTO document_counters (id, doc_type, series, year, last_number)
      VALUES (${randomUUID()}, ${docType}, ${series}, ${year}, 0)
      ON CONFLICT (doc_type, series, year) DO NOTHING
    `;

    const rows = await client.$queryRaw<{ id: string; last_number: number }[]>`
      SELECT id, last_number FROM document_counters
      WHERE doc_type = ${docType} AND series = ${series} AND year = ${year}
      FOR UPDATE
    `;

    const counter = rows[0];
    const nextNumber = counter.last_number + 1;

    await client.$executeRaw`
      UPDATE document_counters SET last_number = ${nextNumber} WHERE id = ${counter.id}
    `;

    return nextNumber;
  }
}
