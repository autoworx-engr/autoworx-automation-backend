import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePipelineRuleDto } from './create-pipeline-rule.dto';

export class UpdatePipelineRuleDto extends PartialType(CreatePipelineRuleDto) {
  @ApiProperty({
    description: 'Whether the rule is paused',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}
