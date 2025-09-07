import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateMarketingRuleDto } from './create-marketing-rule.dto';

export class UpdateMarketingRuleDto extends PartialType(
  CreateMarketingRuleDto,
) {
  @ApiProperty({
    description: 'Whether the rule is paused',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;

  @ApiProperty({
    description: 'Whether the rule is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
