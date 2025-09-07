import { ApiProperty } from '@nestjs/swagger';
import {
  CommunicationType,
  MarketingTarget,
  TemplateType,
} from '@prisma/client';
import { TargetCondition } from '../enums/targetCondition.enum';

export class AttachmentDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'https://storage.example.com/files/brochure.pdf' })
  fileUrl: string;
}

export class ResponseMarketingRuleDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  companyId: number;

  @ApiProperty({
    enum: MarketingTarget,
    example: MarketingTarget.ALL_CLIENTS,
  })
  target: MarketingTarget;

  @ApiProperty({
    enum: TargetCondition,
    example: TargetCondition.ALL_CLIENTS_THIS_MONTH,
  })
  targetCondition: TargetCondition;

  @ApiProperty({ example: '2025-06-15T00:00:00Z' })
  date: Date;

  @ApiProperty({ example: '2025-06-15T09:00:00Z' })
  startTime: Date;

  @ApiProperty({ example: '2025-06-15T17:00:00Z' })
  endTime: Date;

  @ApiProperty({ example: false })
  isAppointmentCreated: boolean;

  @ApiProperty({ example: '2010', nullable: true })
  vehicleMinYear: string | null;

  @ApiProperty({ example: '2023', nullable: true })
  vehicleMaxYear: string | null;

  @ApiProperty({ example: 'Toyota', nullable: true })
  vehicleBrand: string | null;

  @ApiProperty({ example: 'Camry', nullable: true })
  vehicleModel: string | null;

  @ApiProperty({
    enum: CommunicationType,
    example: CommunicationType.EMAIL,
  })
  communicationType: CommunicationType;

  @ApiProperty({
    enum: TemplateType,
    example: TemplateType.EMAIL,
  })
  templateType: TemplateType;

  @ApiProperty({ example: 'Spring Service Special - 20% Off!', nullable: true })
  subject: string | null;

  @ApiProperty({ example: 'Dear valued customer, we are offering...' })
  body: string;

  @ApiProperty({ example: false })
  isPaused: boolean;

  @ApiProperty({ example: 'user123', nullable: true })
  createdBy: string | null;

  @ApiProperty({ type: [AttachmentDto] })
  attachments: AttachmentDto[];

  @ApiProperty({ example: '2025-05-01T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-05-01T12:00:00Z' })
  updatedAt: Date;
}
