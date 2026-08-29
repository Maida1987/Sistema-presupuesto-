import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

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

  async getNextNumber(docType: string, series: string, year = new Date().getFullYear()): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO document_counters (id, doc_type, series, year, last_number)
        VALUES (${randomUUID()}, ${docType}, ${series}, ${year}, 0)
        ON CONFLICT (doc_type, series, year) DO NOTHING
      `;

      const rows = await tx.$queryRaw<{ id: string; last_number: number }[]>`
        SELECT id, last_number FROM document_counters
        WHERE doc_type = ${docType} AND series = ${series} AND year = ${year}
        FOR UPDATE
      `;

      const counter = rows[0];
      const nextNumber = counter.last_number + 1;

      await tx.$executeRaw`
        UPDATE document_counters SET last_number = ${nextNumber} WHERE id = ${counter.id}
      `;

      return nextNumber;
    });
  }
}
