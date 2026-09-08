import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ProductSupplierReferencesService } from './product-supplier-references.service';
import { CreateSupplierReferenceDto } from './dto/create-supplier-reference.dto';
import { MatchSupplierReferenceDto } from './dto/match-supplier-reference.dto';
import { BulkMatchDto } from './dto/bulk-match.dto';
import { BulkIgnoreDto } from './dto/bulk-ignore.dto';
import { SuggestBulkDto } from './dto/suggest-bulk.dto';
import { CreateProductFromReferenceDto } from './dto/create-product-from-reference.dto';

@Controller('product-supplier-references')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductSupplierReferencesController {
  constructor(private readonly referencesService: ProductSupplierReferencesService) {}

  @Get()
  @RequirePermissions('products.read')
  findAll(
    @Query('supplierId') supplierId?: string,
    @Query('matchStatus') matchStatus?: MatchStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.referencesService.findAll({
      supplierId,
      matchStatus,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id/candidates')
  @RequirePermissions('products.read')
  suggestCandidates(@Param('id') id: string) {
    return this.referencesService.suggestCandidates(id);
  }

  @Post('suggestions')
  @RequirePermissions('products.read')
  suggestBulkCandidates(@Body() dto: SuggestBulkDto) {
    return this.referencesService.suggestBulkCandidates(dto.referenceIds);
  }

  @Post()
  @RequirePermissions('products.write')
  create(@Body() dto: CreateSupplierReferenceDto) {
    return this.referencesService.create(dto);
  }

  @Post(':id/match')
  @RequirePermissions('products.write')
  match(@Param('id') id: string, @Body() dto: MatchSupplierReferenceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referencesService.match(id, dto, user.id);
  }

  @Post(':id/ignore')
  @RequirePermissions('products.write')
  ignore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referencesService.ignore(id, user.id);
  }

  @Post(':id/create-product-and-match')
  @RequirePermissions('products.write')
  createProductAndMatch(
    @Param('id') id: string,
    @Body() dto: CreateProductFromReferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.referencesService.createProductAndMatch(id, dto, user.id);
  }

  @Post('bulk-match')
  @RequirePermissions('products.write')
  bulkMatch(@Body() dto: BulkMatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referencesService.bulkMatch(dto.items, user.id);
  }

  @Post('bulk-ignore')
  @RequirePermissions('products.write')
  bulkIgnore(@Body() dto: BulkIgnoreDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referencesService.bulkIgnore(dto.referenceIds, user.id);
  }
}
