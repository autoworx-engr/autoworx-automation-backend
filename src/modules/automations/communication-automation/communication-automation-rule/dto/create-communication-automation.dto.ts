import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsArray,
  IsEnum,
  IsBoolean,
  IsOptional,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { AutomationAttachmentDto } from './automation-attachment.dto';
import {
  CommunicationType,
  TemplateType,
} from '../enums/communication-type.enum';

export class CreateCommunicationAutomationDto {
  @ApiProperty({
    description: 'Company ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  companyId: number;

  @ApiProperty({
    description: 'Title of the automation',
    example: 'Welcome Email',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Array of stage IDs',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  stages: number[];

  @ApiProperty({
    description: 'Time delay in minutes',
    example: 30,
  })
  @IsInt()
  @IsNotEmpty()
  timeDelay: number;

  @ApiProperty({
    description: 'Target column ID',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  targetColumnId: number;

  @ApiProperty({
    description: 'Type of communication',
    enum: CommunicationType,
    example: CommunicationType.EMAIL,
  })
  @IsEnum(CommunicationType)
  @IsNotEmpty()
  communicationType: CommunicationType;

  @ApiProperty({
    description: 'Send on weekdays only',
    default: false,
  })
  @IsBoolean()
  isSendWeekDays: boolean = false;

  @ApiProperty({
    description: 'Template type',
    enum: TemplateType,
    example: TemplateType.EMAIL,
  })
  @IsEnum(TemplateType)
  @IsNotEmpty()
  templateType: TemplateType;

  @ApiProperty({
    description: 'Email subject',
    required: false,
    example: 'Welcome to our service',
  })
  @IsString()
  @IsOptional()
  subject?: string;

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
    description: 'Is automation paused',
    default: false,
  })
  @IsBoolean()
  isPaused: boolean = false;

  @ApiProperty({
    description: 'Created by user ID',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @ApiProperty({
    description: 'Attachments for the automation',
    type: [AutomationAttachmentDto],
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AutomationAttachmentDto)
  attachments?: AutomationAttachmentDto[];
}
