import { Module } from '@nestjs/common';
import { AuditService } from '../../common/interceptors/audit.service';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { PricingRulesModule } from '../pricing-rules/pricing-rules.module';
import { PriceListsController } from './price-lists.controller';
import { ImportMappingsController } from './import-mappings.controller';
import { PriceListsService } from './price-lists.service';

@Module({
  imports: [PricingRulesModule],
  controllers: [PriceListsController, ImportMappingsController],
  providers: [PriceListsService, AuditService, FileStorageService],
})
export class PriceListsModule {}
