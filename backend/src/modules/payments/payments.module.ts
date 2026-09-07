import { Module } from '@nestjs/common';
import { AuditService } from '../../common/interceptors/audit.service';
import { AccountsModule } from '../accounts/accounts.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentMethodsController } from './payment-methods.controller';

@Module({
  imports: [AccountsModule],
  controllers: [PaymentsController, PaymentMethodsController],
  providers: [PaymentsService, AuditService],
})
export class PaymentsModule {}
