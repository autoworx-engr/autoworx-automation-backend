import { Module, forwardRef } from '@nestjs/common';
import { CommunicationAutomationService } from './communication-automation.service';
import { CommunicationAutomationController } from './communication-automation.controller';
import { CommunicationAutomationRepository } from './repositories/communication-automation.repository';
import { CommunicationAutomationTriggerModule } from '../communication-automation-trigger/communication-automation-trigger.module';

@Module({
  imports: [forwardRef(() => CommunicationAutomationTriggerModule)],
  controllers: [CommunicationAutomationController],
  providers: [
    CommunicationAutomationService,
    CommunicationAutomationRepository,
  ],
  exports: [CommunicationAutomationService],
})
export class CommunicationAutomationModule {}
