import {
  Controller,
  Post,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Get,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InventoryTriggerService } from './services/inventory-trigger.service';
import { NotificationData } from './interfaces/inventory-trigger.interface';
import { Response } from 'express';

@Controller('inventory-automation-trigger')
export class InventoryTriggerController {
  constructor(private readonly triggerService: InventoryTriggerService) {}

  /**
   * Manually trigger inventory check for all rules
   */
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger inventory automation check for all rules',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory automation check triggered successfully',
  })
  async triggerInventoryCheck(): Promise<{ message: string }> {
    await this.triggerService.triggerInventoryCheck();
    return {
      message: 'Inventory automation check triggered successfully',
    };
  }

  /**
   * Manually trigger inventory check for a specific rule
   */
  @Post('trigger/:ruleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger inventory automation check for a specific rule',
  })
  @ApiParam({
    name: 'ruleId',
    description: 'ID of the inventory automation rule',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description:
      'Inventory automation check triggered successfully for the specified rule',
  })
  async triggerSpecificRule(
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<{ message: string }> {
    await this.triggerService.triggerInventoryCheck(ruleId);
    return {
      message: `Inventory automation check triggered successfully for rule ID: ${ruleId}`,
    };
  }
}
