import { Module } from '@nestjs/common';
import { AuditService } from '../../common/interceptors/audit.service';
import { PricingRulesController } from './pricing-rules.controller';
import { PricingRulesService } from './pricing-rules.service';

@Module({
  controllers: [PricingRulesController],
  providers: [PricingRulesService, AuditService],
  exports: [PricingRulesService],
})
export class PricingRulesModule {}
