import { Controller } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MarketingAutomationTriggerService } from '../services/marketing-automation-rule-trigger.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@ApiTags('marketing-automation-trigger')
@Controller('marketing-automation-trigger')
export class MarketingAutomationTriggerController {
  constructor(
    private readonly marketingAutomationTriggerService: MarketingAutomationTriggerService,
  ) {}

  @ApiOperation({
    summary:
      'Marketing automation trigger an automation to campaign marketing by send email/SMS to a client.',
    description:
      'This endpoint triggers an automation rule that send an email/SMS to a client on behalf of the company.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        statusCode: 200,
        message: 'Automation triggered successfully',
      },
    },
  })
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCroneJob() {
    await this.marketingAutomationTriggerService.handleStartCampaign();
  }
}
