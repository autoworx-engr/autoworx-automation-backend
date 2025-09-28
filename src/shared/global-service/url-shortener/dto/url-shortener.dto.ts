import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsBoolean, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class CreateShortLinkDto {
  @ApiProperty({
    description: 'The original URL to be shortened',
    example: 'https://www.example.com/very/long/url/that/needs/shortening'
  })
  @IsUrl({}, { message: 'Please provide a valid URL' })
  originalUrl: string;

  @ApiPropertyOptional({
    description: 'Optional title for the short link',
    example: 'My Important Link'
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional description for the short link',
    example: 'This link leads to our main product page'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Custom short code (if not provided, one will be generated)',
    example: 'mylink123'
  })
  @IsOptional()
  @IsString()
  customCode?: string;

  @ApiPropertyOptional({
    description: 'Expiration date for the short link (ISO string)',
    example: '2024-12-31T23:59:59.000Z'
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'ID of the user creating the link',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  createdBy?: number;

  @ApiPropertyOptional({
    description: 'ID of the company associated with the link',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  companyId?: number;
}

export class UpdateShortLinkDto {
  @ApiPropertyOptional({
    description: 'Updated title for the short link',
    example: 'Updated Link Title'
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated description for the short link',
    example: 'Updated description'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the link is active',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Updated expiration date (ISO string)',
    example: '2024-12-31T23:59:59.000Z'
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ListShortLinksDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  createdBy?: number;

  @ApiPropertyOptional({
    description: 'Filter by company ID',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  companyId?: number;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    example: 50,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    example: 0,
    minimum: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
