import { ApiProperty } from '@nestjs/swagger';
import { CommunicationType, InvoiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AutomationAttachmentDto } from 'src/modules/automations/communication-automation/communication-automation-rule/dto/automation-attachment.dto';

export class CreateInvoiceRuleDto {
  @ApiProperty({
    description: 'This is company ID',
    example: 1,
    type: Number,
    required: true,
  })
  @IsInt()
  companyId: number;

  @ApiProperty({
    description: 'Title for the invoice Rule',
    type: String,
    example: 'Invoice Automation Rule 1!',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Invoice type',
    example: InvoiceType.Invoice,
    required: true,
    enum: InvoiceType,
  })
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @ApiProperty({
    description: 'Invoice Status Id',
    example: 1,
    required: true,
    type: Number,
  })
  @IsInt()
  invoiceStatusId: number;

  @ApiProperty({
    description: 'Indicates if the service invoice automation rule is paused',
    type: Boolean,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isPaused: boolean;

  @ApiProperty({
    description:
      'Time delay in seconds or Instant before the invoice automation rule is triggered',
    type: String,
    example: '3600',
    required: true,
  })
  @IsString()
  timeDelay: string;

  @ApiProperty({ example: CommunicationType.EMAIL, enum: CommunicationType })
  @IsEnum(CommunicationType)
  communicationType: CommunicationType;

  @ApiProperty({
    example: 'Welcome to our service',
    description: 'Email Subject',
  })
  @IsString()
  @IsOptional()
  emailSubject?: string;

  @ApiProperty({
    description: 'Message body',
    example: 'Hello {{name}}, welcome to our service!',
  })
  @IsString()
  @IsOptional()
  smsBody: string;

  @ApiProperty({
    description: 'Email body',
    example: 'Hello {{name}}, welcome to our service!',
  })
  @IsString()
  @IsOptional()
  emailBody: string;

  @ApiProperty({
    description: 'Attachments for the automation',
    type: [AutomationAttachmentDto],
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AutomationAttachmentDto)
  attachments?: AutomationAttachmentDto[];

  @ApiProperty({
    description: 'Created by user ID',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
