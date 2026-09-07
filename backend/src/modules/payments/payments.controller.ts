import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions('payments.read')
  findAll(@Query('customerId') customerId?: string) {
    return this.paymentsService.findAll({ customerId });
  }

  @Get(':id')
  @RequirePermissions('payments.read')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @RequirePermissions('payments.write')
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.create(dto, user.id);
  }

  @Post(':id/void')
  @RequirePermissions('payments.write')
  void(@Param('id') id: string, @Body() dto: VoidPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.void(id, dto.reason, user.id);
  }
}
