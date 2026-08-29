import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customers.read')
  findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @RequirePermissions('customers.write')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('customers.write')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.update(id, dto, user.id);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('customers.write')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.setStatus(id, 'INACTIVE', user.id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('customers.write')
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.setStatus(id, 'ACTIVE', user.id);
  }
}
