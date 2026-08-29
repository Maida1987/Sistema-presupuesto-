import { Module } from '@nestjs/common';
import { DocumentCountersService } from './document-counters.service';

@Module({
  providers: [DocumentCountersService],
  exports: [DocumentCountersService],
})
export class DocumentCountersModule {}
