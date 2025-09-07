import { BullModule } from '@nestjs/bull';
import { forwardRef, Module } from '@nestjs/common';
import { InvoiceAutomationTriggerRepository } from './repository/invoice-automation-trigger.repository';
import { InvoiceAutomationTriggerService } from './services/invoice-automation-trigger.service';
import { InvoiceTimeDelayProcessor } from './processors/invoice-time-delay.processor';
import { InvoiceAutomationTriggerController } from './controllers/invoice-automation-trigger.controller';
import { PipelineAutomationTriggerModule } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/pipeline-automation-trigger.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'invoice-time-delay',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    forwardRef(() => PipelineAutomationTriggerModule),
  ],
  controllers: [InvoiceAutomationTriggerController],
  providers: [
    InvoiceAutomationTriggerRepository,
    InvoiceAutomationTriggerService,
    InvoiceTimeDelayProcessor,
  ],
  exports: [
    InvoiceAutomationTriggerRepository,
    InvoiceAutomationTriggerService,
  ],
})
export class InvoiceAutomationTriggerModule {}
