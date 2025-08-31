import { IsBoolean, IsOptional, IsArray, ValidateNested, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCompanyPermissionsDto {
  @IsOptional()
  @IsBoolean()
  inventory?: boolean;

  @IsOptional()
  @IsBoolean()
  invoicing?: boolean;

  @IsOptional()
  @IsBoolean()
  calendar?: boolean;

  @IsOptional()
  @IsBoolean()
  clients?: boolean;

  @IsOptional()
  @IsBoolean()
  reporting?: boolean;

  @IsOptional()
  @IsBoolean()
  automation?: boolean;

  @IsOptional()
  @IsBoolean()
  integrations?: boolean;

  @IsOptional()
  @IsBoolean()
  communication?: boolean;

  @IsOptional()
  @IsBoolean()
  workforceManagement?: boolean;

  @IsOptional()
  @IsBoolean()
  salesPipeline?: boolean;
}

export class CompanyPermissionDto {
  @IsNumber()
  companyId: number;

  @IsString()
  permissionName: string;

  @IsBoolean()
  enabled: boolean;

  @IsString()
  title: string;
}

export class BulkCreateCompanyPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyPermissionDto)
  permissions: CompanyPermissionDto[];
}
