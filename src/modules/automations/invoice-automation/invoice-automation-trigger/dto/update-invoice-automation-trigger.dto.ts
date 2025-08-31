import { IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';

export class UpdateInvoiceAutomationTriggerDto {
  @ApiProperty({
    description: 'This is company ID',
    example: 1,
    type: Number,
    required: true,
  })
  @IsNumber({}, { message: 'Company ID must be a number' })
  companyId: number;

  @ApiProperty({
    description: 'This is invoice ID',
    example: '13489758',
    type: String,
    required: true,
  })
  @IsString()
  invoiceId: string;

  @ApiProperty({
    description: 'Invoice type',
    example: InvoiceType.Invoice,
    required: true,
    enum: InvoiceType,
  })
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @ApiProperty({
    description: 'This is column ID',
    example: 1,
    type: Number,
    required: true,
  })
  @IsNumber({}, { message: 'Column must be a number' })
  columnId: number;
}
