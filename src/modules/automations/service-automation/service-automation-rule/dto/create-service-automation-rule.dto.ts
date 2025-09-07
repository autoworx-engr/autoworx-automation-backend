import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { TemplateTypeEnum } from '../enums/create-service-automation.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceAutomationRuleDto {
  @IsInt()
  @ApiProperty({
    description: 'Company ID to which the service automation rule belongs',
    example: 1,
    type: Number,
    required: true,
  })
  companyId: number;

  @ApiProperty({
    description: 'Title of the service automation rule',
    type: String,
    example: 'Service Automation Rule 1',
    required: true,
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Array of service IDs where the rule should be applied',
    type: [Number],
    example: [1, 2, 3],
    required: true,
  })
  @IsArray()
  @IsInt({ each: true })
  selectedServiceIds: number[];

  @ApiProperty({
    description: 'Condition that triggers the service automation rule',
    type: Number,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  conditionColumnId: number;

  @ApiProperty({
    description: 'Indicates if the service automation rule is paused',
    type: Boolean,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isPaused: boolean;

  @ApiProperty({
    description: 'Target column/stage ID where the service will be moved',
    type: Number,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  targetColumnId: number;

  @ApiProperty({
    description: 'Target column/stage ID where the service will be moved',
    enum: TemplateTypeEnum,
    type: String,
    example: 'EMAIL',
  })
  @IsEnum(TemplateTypeEnum, {
    message: 'Template type must be one of: EMAIL, SMS',
  })
  @IsOptional()
  templateType: TemplateTypeEnum;

  @ApiProperty({
    description: 'Email subject for the service automation rule',
    type: String,
    example: 'Service Notification',
  })
  @IsOptional()
  @IsString()
  emailSubject: string;

  @ApiProperty({
    description:
      'Time delay in seconds before the service automation rule is triggered',
    type: Number,
    example: 3600,
    required: true,
  })
  @IsNumber()
  @Validate((delay: number) => delay > 0, {
    message: 'Time delay must be a positive number',
  })
  timeDelay: number;

  @ApiProperty({
    description: 'Email body for the service automation rule',
    type: String,
    example: 'This is a notification for your service.',
  })
  @IsOptional()
  @IsString()
  emailBody: string;

  @ApiProperty({
    description: 'SMS body for the service automation rule',
    type: String,
    example: 'This is a notification for your service.',
  })
  @IsOptional()
  @IsString()
  smsBody: string;

  @ApiProperty({
    description: 'User Email of the creator of the service automation rule',
    type: String,
    example: 'rayhanmujumdar0177@gmail.com',
  })
  @IsEmail()
  @IsString()
  createdBy: string;

  @ApiProperty({
    description:
      'Array of email addresses to which the service automation rule will be sent',
    type: [String],
    example: ['image url 1', 'image url 2'],
  })
  @IsOptional()
  @IsString({ each: true })
  attachments: string[];
}
