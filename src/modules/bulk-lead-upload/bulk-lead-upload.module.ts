import { Module } from '@nestjs/common';
import { BulkLeadUploadService } from './bulk-lead-upload.service';
import { BulkLeadUploadController } from './bulk-lead-upload.controller';
import { BullModule } from '@nestjs/bull';
import { BulkLeadUploadProcessor } from './bulk-lead-upload.processor';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'bulk-lead-upload',
    }),
    PrismaModule,
  ],
  controllers: [BulkLeadUploadController],
  providers: [BulkLeadUploadService, BulkLeadUploadProcessor],
  exports: [BulkLeadUploadService],
})
export class BulkLeadUploadModule {}
