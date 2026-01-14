import { PartialType } from '@nestjs/mapped-types';
import { CreateBulkUploadDto } from './create-bulk-upload.dto';

export class UpdateBulkUploadDto extends PartialType(CreateBulkUploadDto) {}
