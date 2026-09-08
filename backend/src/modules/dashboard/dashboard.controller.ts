import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Requiere settlements.read (no solo customers.read): el resumen incluye
  // saldo total a cobrar y clientes con saldo elevado, información
  // financiera que un Vendedor no debería ver (docs/01 §2 — ese rol solo
  // consulta clientes/productos/remitos, no cuenta corriente).
  @Get('summary')
  @RequirePermissions('settlements.read')
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
