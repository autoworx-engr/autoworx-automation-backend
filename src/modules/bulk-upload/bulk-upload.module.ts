import { Module } from '@nestjs/common';
import { BulkUploadService } from './bulk-upload.service';
import { BulkUploadController } from './bulk-upload.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { BulkUploadProcessorFactory } from './factories/bulk-upload-processor.factory';
import { ServiceBulkUploadProcessor } from './processors/service-bulk-upload.processor';
import { LaborBulkUploadProcessor } from './processors/labor-bulk-upload.processor';

@Module({
  imports: [PrismaModule],
  controllers: [BulkUploadController],
  providers: [
    BulkUploadService,
    BulkUploadProcessorFactory,
    ServiceBulkUploadProcessor,
    LaborBulkUploadProcessor,
  ],
  exports: [BulkUploadService],
})
export class BulkUploadModule {}
