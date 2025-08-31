import { ConditionType } from '@prisma/client';
import { IsNumber, IsString } from 'class-validator';

export class UpdatePipelineAutomationTriggerDto {
  @IsString({ message: 'condition must be a string' })
  condition: ConditionType;
  @IsNumber({}, { message: 'companyId must be a number' })
  companyId: number;
  @IsNumber({}, { message: 'leadId must be a number' })
  leadId: number;
  @IsNumber({}, { message: 'pipelineId must be a number' })
  columnId: number;
}
