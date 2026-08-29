import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers.read')
  findAll(@Query('search') search?: string) {
    return this.suppliersService.findAll(search);
  }

  @Get(':id')
  @RequirePermissions('suppliers.read')
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @RequirePermissions('suppliers.write')
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.write')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.update(id, dto, user.id);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('suppliers.write')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.setStatus(id, 'INACTIVE', user.id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('suppliers.write')
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.setStatus(id, 'ACTIVE', user.id);
  }
}
