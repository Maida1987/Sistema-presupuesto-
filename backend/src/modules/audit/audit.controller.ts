import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Auditoría consultable por entidad (docs/01 §24, criterio de cierre de la
 * Fase 6). Se escribe desde AuditService en cada módulo; este controller
 * es el único punto de lectura, restringido a quien tenga audit.read
 * (solo Administrador por defecto, ver prisma/seed.ts).
 */
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read')
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('module') module?: string,
    @Query('userId') userId?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId, module, userId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }
}
