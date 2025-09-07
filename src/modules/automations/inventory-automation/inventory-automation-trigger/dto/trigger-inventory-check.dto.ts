import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class TriggerInventoryCheckDto {
  @ApiProperty({
    description: 'ID of the specific rule to trigger (optional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  ruleId?: number;
}
