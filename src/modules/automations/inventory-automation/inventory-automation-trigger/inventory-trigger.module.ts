import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InventoryTriggerController } from './inventory-trigger.controller';
import { InventoryTriggerService } from './services/inventory-trigger.service';
import { InventoryCheckerService } from './services/inventory-checker.service';
import { InventoryNotificationService } from './services/inventory-notification.service';
import { InventoryMessagingService } from './services/inventory-messaging.service';
import { InventoryTriggerRepository } from './repositories/inventory-trigger.repository';
import { InventoryNotificationProcessor } from './processors/inventory-notification.processor';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'inventory-notifications',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    HttpModule,
  ],
  controllers: [InventoryTriggerController],
  providers: [
    InventoryTriggerService,
    InventoryCheckerService,
    InventoryNotificationService,
    InventoryMessagingService,
    InventoryTriggerRepository,
    InventoryNotificationProcessor,
  ],
  exports: [
    InventoryTriggerService,
    InventoryCheckerService,
    InventoryNotificationService,
    InventoryTriggerRepository,
  ],
})
export class InventoryTriggerModule {}
