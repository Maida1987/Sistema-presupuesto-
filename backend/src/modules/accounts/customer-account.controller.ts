import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AccountMovementsService } from './account-movements.service';

/** GET /customers/:id/account — saldo y movimientos (docs/01 §6, §17). */
@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomerAccountController {
  constructor(private readonly accountMovements: AccountMovementsService) {}

  @Get(':id/account')
  @RequirePermissions('customers.read')
  getAccount(@Param('id') id: string) {
    return this.accountMovements.getAccount(id);
  }
}
