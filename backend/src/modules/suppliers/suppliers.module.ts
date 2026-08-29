import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { AuditService } from '../../common/interceptors/audit.service';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, AuditService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
