import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions('products.read')
  search(@Query('search') search?: string) {
    return this.productsService.search(search);
  }

  @Get(':id')
  @RequirePermissions('products.read')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @RequirePermissions('products.write')
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('products.write')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.update(id, dto, user.id);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('products.write')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.setStatus(id, 'INACTIVE', user.id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('products.write')
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.setStatus(id, 'ACTIVE', user.id);
  }
}
