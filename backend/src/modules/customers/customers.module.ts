import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { AuditService } from '../../common/interceptors/audit.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, AuditService],
})
export class CustomersModule {}
