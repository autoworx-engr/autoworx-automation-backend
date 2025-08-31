import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateInvoiceRuleDto } from './create-invoice-rule.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateInvoiceRuleDto extends PartialType(CreateInvoiceRuleDto) {
  @ApiProperty({
    description: 'Whether the rule is paused',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}
