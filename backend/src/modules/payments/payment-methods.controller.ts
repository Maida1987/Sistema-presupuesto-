import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('payment-methods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentMethodsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('payments.read')
  findAll() {
    return this.prisma.paymentMethod.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }
}
