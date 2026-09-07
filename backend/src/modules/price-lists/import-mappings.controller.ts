import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('import-mappings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImportMappingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('by-supplier/:supplierId')
  @RequirePermissions('price-lists.import')
  findBySupplier(@Param('supplierId') supplierId: string) {
    return this.prisma.importMapping.findUnique({ where: { supplierId } });
  }
}
