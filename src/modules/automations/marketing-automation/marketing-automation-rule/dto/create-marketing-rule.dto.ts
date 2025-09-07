import { ApiProperty } from '@nestjs/swagger';
import {
  CommunicationType,
  MarketingTarget,
  TargetCondition,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateMarketingRuleDto {
  @ApiProperty({
    description: 'Company ID',
    example: 1,
  })
  @IsInt()
  companyId: number;

  @ApiProperty({
    description: 'Target audience for marketing campaign',
    enum: MarketingTarget,
    isArray: true,
    example: [MarketingTarget.ALL_CLIENTS, MarketingTarget.INVOICE],
  })
  @IsEnum(MarketingTarget, { each: true })
  @IsArray()
  target: MarketingTarget[];

  @ApiProperty({
    description: 'Target conditions for filtering clients',
    enum: TargetCondition,
    example: TargetCondition.ALL_CLIENTS_THIS_MONTH,
  })
  @IsEnum(TargetCondition, { each: true })
  targetCondition: TargetCondition;

  @ApiProperty({
    description: 'Campaign date',
    example: '2025-06-15',
  })
  @IsDateString()
  date: Date;

  @ApiProperty({
    description: 'Campaign start time',
    example: '2025-06-15T09:00:00Z',
  })
  @IsString()
  startTime: string;

  @ApiProperty({
    description: 'Whether an appointment should be created',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isAppointmentCreated?: boolean;

  @ApiProperty({
    description: 'Minimum vehicle year for targeting',
    example: '2010',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleMinYear?: string;

  @ApiProperty({
    description: 'Maximum vehicle year for targeting',
    example: '2023',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleMaxYear?: string;

  @ApiProperty({
    description: 'Vehicle brand for targeting',
    example: 'Toyota',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleBrand?: string;

  @ApiProperty({
    description: 'Vehicle model for targeting',
    example: 'Camry',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleModel?: string;

  @ApiProperty({
    description: 'Type of communication',
    enum: CommunicationType,
    example: CommunicationType.EMAIL,
  })
  @IsEnum(CommunicationType)
  communicationType: CommunicationType;

  @ApiProperty({
    description: 'Email subject (required for EMAIL and BOTH types)',
    example: 'Spring Service Special - 20% Off!',
    required: false,
  })
  @ValidateIf(
    (o) => o.communicationType === 'EMAIL' || o.communicationType === 'BOTH',
  )
  @IsString()
  emailSubject?: string;

  @ApiProperty({
    description: 'Email body content (required for EMAIL and BOTH types)',
    example:
      'Dear valued customer, we are offering a special spring discount...',
    required: false,
  })
  @ValidateIf(
    (o) => o.communicationType === 'EMAIL' || o.communicationType === 'BOTH',
  )
  @IsString()
  emailBody?: string;

  @ApiProperty({
    description: 'SMS body content (required for SMS and BOTH types)',
    example: '20% off Spring Service Special! Book now: example.com/book',
    required: false,
  })
  @ValidateIf(
    (o) => o.communicationType === 'SMS' || o.communicationType === 'BOTH',
  )
  @IsString()
  smsBody?: string;

  @ApiProperty({
    description: 'ID of user who created the rule',
    example: 'user123',
    required: false,
  })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiProperty({
    description: 'File URLs for attachments',
    type: [String],
    required: false,
    example: ['https://example.com/file1.pdf', 'https://example.com/file2.jpg'],
  })
  @IsOptional()
  @IsString({ each: true })
  attachments?: string[];
}
