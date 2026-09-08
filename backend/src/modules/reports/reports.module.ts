import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AccountStatementPdfService } from './account-statement-pdf.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, AccountStatementPdfService],
})
export class ReportsModule {}
