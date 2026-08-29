import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RecordAuditParams {
  userId: string | null;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string;
}

/**
 * Auditoría transversal (docs/02-arquitectura.md §6). Se invoca
 * explícitamente desde cada servicio que modifica una entidad sensible,
 * en la misma transacción que el cambio, para capturar un old_value/
 * new_value preciso (un interceptor genérico no puede saber qué cambió
 * realmente sin acoplarse a cada entidad).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        module: params.module,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        oldValue: params.oldValue as any,
        newValue: params.newValue as any,
        reason: params.reason,
        ipAddress: params.ipAddress,
      },
    });
  }
}
