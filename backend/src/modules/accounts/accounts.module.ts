import { Module } from '@nestjs/common';
import { AuditService } from '../../common/interceptors/audit.service';
import { AccountMovementsService } from './account-movements.service';
import { AccountSettlementsService } from './account-settlements.service';
import { AccountSettlementsController } from './account-settlements.controller';
import { CustomerAccountController } from './customer-account.controller';

@Module({
  controllers: [AccountSettlementsController, CustomerAccountController],
  providers: [AccountMovementsService, AccountSettlementsService, AuditService],
  exports: [AccountMovementsService],
})
export class AccountsModule {}
