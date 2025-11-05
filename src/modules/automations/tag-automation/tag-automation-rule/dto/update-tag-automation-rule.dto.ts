import { OmitType, PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTagAutomationRuleDto } from './create-tag-automation-rule.dto';

export class UpdateTagAutomationRuleDto extends PartialType(
  OmitType(CreateTagAutomationRuleDto, []),
) {
  @ApiProperty({
    description: 'Whether the rule is paused',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}
