import { createKeyv } from '@keyv/redis';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import configuration from 'src/config/configuration';
import { CarApiModule } from './external/car-api/car-api.module';
import { CommunicationAutomationModule } from './modules/automations/communication-automation/communication-automation-rule/communication-automation.module';
import { CommunicationAutomationTriggerModule } from './modules/automations/communication-automation/communication-automation-trigger/communication-automation-trigger.module';
import { MarketingAutomationModule } from './modules/automations/marketing-automation/marketing-automation.module';
import { PipelineAutomationModule } from './modules/automations/pipeline-automation/pipeline-automation.module';
import { PrismaModule } from './prisma/prisma.module';
import { GlobalModule } from './shared/global-service/global.module';
import { ServiceAutomationModule } from './modules/automations/service-automation/service-automation.module';
import { InvoiceAutomationRuleModule } from './modules/automations/invoice-automation/invoice-automation-rule/invoice-automation-rule.module';
import { InvoiceAutomationTriggerModule } from './modules/automations/invoice-automation/invoice-automation-trigger/invoice-automation-trigger.module';
import { InventoryAutomationModule } from './modules/automations/inventory-automation/inventory-automation.module';
import { AdminPermissionModule } from './modules/admin-module-permission/admin-permission.module';
import { AuthModule } from './modules/auth/auth.module';

import { ReminderModule } from './modules/appointment-reminder-module/reminder.module';
import { NotificationModule } from './modules/notification/notification.module';
@Global()
@Module({
  imports: [
    GlobalModule,
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [
          new Keyv({
            store: new CacheableMemory({ ttl: 3600000, lruSize: 5000 }),
          }),
          createKeyv(
            `redis://${configService.get('redis.host')}:${configService.get('redis.port')}`,
            {
              namespace: configService.get('redis.prefix') || 'autoworx:',
            },
          ),
        ],
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Use individual Redis config values instead of a URL
        const host = configService.get('redis.host');
        const port = configService.get('redis.port');
        const password = configService.get('redis.password');

        return {
          connection: {
            host,
            port,
            password,
            family: 0,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
            connectTimeout: 10000,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
          },
        };
      },
    }),

    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    PipelineAutomationModule,
    CommunicationAutomationModule,
    CommunicationAutomationTriggerModule,
    MarketingAutomationModule,
    CarApiModule,
    ServiceAutomationModule,
    InvoiceAutomationRuleModule,
    InvoiceAutomationTriggerModule,
    InventoryAutomationModule,
    AdminPermissionModule,
    ReminderModule,
    NotificationModule,
  ],
  controllers: [],
  providers: [],
  exports: [CacheModule],
})
export class AppModule {}
