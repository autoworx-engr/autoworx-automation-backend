import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class VinDecoderDto {
  @ApiProperty({
    description: 'Whether to return verbose information',
    required: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  verbose: boolean;

  @ApiProperty({
    description: 'Whether to return all trims',
    required: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  allTrims: boolean;
}
