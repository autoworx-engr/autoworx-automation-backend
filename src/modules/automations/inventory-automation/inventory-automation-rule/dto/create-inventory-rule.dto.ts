import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DayOfWeek,
  InventoryAutomationFrequency,
  InventoryCondition,
  InventoryNotificationAction,
} from '@prisma/client';

export class CreateInventoryRuleDto {
  @ApiProperty({
    description: 'Title of the automation rule',
    example: 'Low Stock Alert for Warehouse A',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'ID of the company associated with this rule',
    example: 1,
  })
  @IsInt()
  companyId: number;

  @ApiProperty({
    description: 'Frequency of automation',
    enum: InventoryAutomationFrequency,
    example: InventoryAutomationFrequency.WEEKLY,
  })
  @IsEnum(InventoryAutomationFrequency)
  frequency: InventoryAutomationFrequency;

  @ValidateIf((obj) => obj.frequency === InventoryAutomationFrequency.WEEKLY)
  @IsEnum(DayOfWeek)
  @IsNotEmpty()
  @ApiPropertyOptional({
    description: 'Applicable day when frequency is WEEKLY',
    enum: DayOfWeek,
    example: DayOfWeek.MONDAY,
  })
  day?: DayOfWeek;

  @ApiProperty({
    description: 'Condition under which automation triggers',
    enum: InventoryCondition,
    example: InventoryCondition.LOW_STOCK,
  })
  @IsEnum(InventoryCondition)
  condition: InventoryCondition;

  @ApiProperty({
    description: 'Action to be taken when the condition matches',
    enum: InventoryNotificationAction,
  })
  @IsEnum(InventoryNotificationAction)
  action: InventoryNotificationAction;

  @ApiPropertyOptional({
    description: 'Whether the rule is paused or not',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;

  @ApiPropertyOptional({
    description: 'ID of the user who created this rule',
    example: 'admin_user_123',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'IDs of time delay execution entries associated',
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  timeDelayExecutionIds?: number[];

  @ApiPropertyOptional({
    description: 'User IDs of team members for this rule',
    type: [Number],
    example: [3, 5, 7],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  teamMemberUserIds?: number[];
}
