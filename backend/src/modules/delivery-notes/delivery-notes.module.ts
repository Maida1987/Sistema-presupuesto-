import { Module } from '@nestjs/common';
import { AuditService } from '../../common/interceptors/audit.service';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { DocumentCountersModule } from '../document-counters/document-counters.module';
import { DeliveryNotesController } from './delivery-notes.controller';
import { DeliveryNotesService } from './delivery-notes.service';
import { DeliveryNotePdfService } from './delivery-note-pdf.service';

@Module({
  imports: [DocumentCountersModule],
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService, AuditService, FileStorageService, DeliveryNotePdfService],
})
export class DeliveryNotesModule {}
