import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IBulkUploadProcessor } from '../interfaces/bulk-upload-processor.interface';
import { ServiceBulkUploadProcessor } from '../processors/service-bulk-upload.processor';
import { LaborBulkUploadProcessor } from '../processors/labor-bulk-upload.processor';
import { UploadType } from '../dto/bulk-upload.dto';

@Injectable()
export class BulkUploadProcessorFactory {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the appropriate processor based on the upload type
   * @param type Upload type (service or labor)
   * @returns The corresponding processor instance
   */
  getProcessor(type: UploadType): IBulkUploadProcessor {
    switch (type) {
      case UploadType.SERVICE:
        return new ServiceBulkUploadProcessor(this.prisma);
      case UploadType.LABOR:
        return new LaborBulkUploadProcessor(this.prisma);
      default:
        throw new BadRequestException(`Unsupported upload type: ${type}`);
    }
  }
}
