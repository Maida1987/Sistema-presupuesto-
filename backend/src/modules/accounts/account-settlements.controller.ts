import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SettlementStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AccountSettlementsService } from './account-settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { VoidSettlementDto } from './dto/void-settlement.dto';

@Controller('account-settlements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountSettlementsController {
  constructor(private readonly settlementsService: AccountSettlementsService) {}

  @Get('pending')
  @RequirePermissions('settlements.read')
  previewPending(@Query('customerId') customerId: string) {
    return this.settlementsService.previewPending(customerId);
  }

  @Get()
  @RequirePermissions('settlements.read')
  findAll(@Query('customerId') customerId?: string, @Query('status') status?: SettlementStatus) {
    return this.settlementsService.findAll({ customerId, status });
  }

  @Get(':id')
  @RequirePermissions('settlements.read')
  findOne(@Param('id') id: string) {
    return this.settlementsService.findOne(id);
  }

  @Post()
  @RequirePermissions('settlements.write')
  create(@Body() dto: CreateSettlementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settlementsService.create(dto, user.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('settlements.write')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.settlementsService.confirm(id, user.id);
  }

  @Post(':id/void')
  @RequirePermissions('settlements.write')
  void(@Param('id') id: string, @Body() dto: VoidSettlementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settlementsService.void(id, dto.reason, user.id);
  }
}
