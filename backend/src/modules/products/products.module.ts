import { Module } from '@nestjs/common';
import { AuditService } from '../../common/interceptors/audit.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductCategoriesService } from './product-categories.service';
import { ProductSupplierReferencesController } from './product-supplier-references.controller';
import { ProductSupplierReferencesService } from './product-supplier-references.service';

@Module({
  controllers: [ProductsController, ProductCategoriesController, ProductSupplierReferencesController],
  providers: [ProductsService, ProductCategoriesService, ProductSupplierReferencesService, AuditService],
  exports: [ProductsService],
})
export class ProductsModule {}
