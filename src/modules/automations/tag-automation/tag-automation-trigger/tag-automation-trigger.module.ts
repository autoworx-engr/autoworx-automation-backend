import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TagAutomationTriggerRepository } from './repository/tag-automation-trigger.repository';
import { TagAutomationTriggerService } from './services/tag-automation-trigger.service';
import { TagTimeDelayProcessor } from './processors/tag-automation-time-delay-processor';
import { TagAutomationTriggerController } from './controllers/tag-automation-trigger.controller';
import { CommunicationAutomationTriggerRepository } from '../../communication-automation/communication-automation-trigger/repository/communication-automation-trigger.repository';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tag-time-delay',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [TagAutomationTriggerController],
  providers: [
    TagAutomationTriggerRepository,
    TagAutomationTriggerService,
    TagTimeDelayProcessor,
    CommunicationAutomationTriggerRepository,
    GlobalRepository,
    PrismaService,
  ],
  exports: [TagAutomationTriggerRepository, TagAutomationTriggerService],
})
export class TagAutomationTriggerModule {}
