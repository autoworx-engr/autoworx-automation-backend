import { Module } from '@nestjs/common';
import { MarketingAutomationTriggerService } from './services/marketing-automation-rule-trigger.service';
import { MarketingAutomationTriggerController } from './controllers/marketing-automation-rule-trigger.controller';
import { BullModule } from '@nestjs/bull';
import { MarketingAutomationTriggerRepository } from './repository/marketing-automation-trigger.repository';
import { MarketingAutomationProcessor } from './processors/marketing-automation-trigger.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'marketing-campaign-trigger',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [MarketingAutomationTriggerController],
  providers: [
    MarketingAutomationTriggerRepository,
    MarketingAutomationTriggerService,
    MarketingAutomationProcessor,
  ],
  exports: [
    MarketingAutomationTriggerRepository,
    MarketingAutomationTriggerService,
  ],
})
export class MarketingAutomationTriggerModule {}
