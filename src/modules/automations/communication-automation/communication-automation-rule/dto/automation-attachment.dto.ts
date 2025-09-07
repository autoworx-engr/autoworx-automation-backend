import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AutomationAttachmentDto {
  @ApiProperty({
    description: 'The file path of the attachment',
    example: '/uploads/document.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;
}
