import KeyvRedis from '@keyv/redis';
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
import { AdminPermissionModule } from './modules/admin-module-permission/admin-permission.module';
import { ReminderModule } from './modules/appointment-reminder-module/reminder.module';
import { AuthModule } from './modules/auth/auth.module';
import { AutoClockOutModule } from './modules/auto-clockout/auto-clockout.module';
import { CommunicationAutomationModule } from './modules/automations/communication-automation/communication-automation-rule/communication-automation.module';
import { CommunicationAutomationTriggerModule } from './modules/automations/communication-automation/communication-automation-trigger/communication-automation-trigger.module';
import { InventoryAutomationModule } from './modules/automations/inventory-automation/inventory-automation.module';
import { InvoiceAutomationRuleModule } from './modules/automations/invoice-automation/invoice-automation-rule/invoice-automation-rule.module';
import { InvoiceAutomationTriggerModule } from './modules/automations/invoice-automation/invoice-automation-trigger/invoice-automation-trigger.module';
import { MarketingAutomationModule } from './modules/automations/marketing-automation/marketing-automation.module';
import { PipelineAutomationModule } from './modules/automations/pipeline-automation/pipeline-automation.module';
import { ServiceAutomationModule } from './modules/automations/service-automation/service-automation.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PrismaModule } from './prisma/prisma.module';
import { GlobalModule } from './shared/global-service/global.module';

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
    // --- Bull (v3) ---
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('node_env') ?? 'development';

        if (nodeEnv === 'development') {
          return {
            redis: {
              host: config.get('redis.host'),
              port: Number(config.get('redis.port') ?? 6379),
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              connectTimeout: 10_000,
            },
          };
        }

        // production (Railway)
        const redisUrl = config.get<string>('redis.url');
        if (!redisUrl) throw new Error('redis.url is required in production');

        const u = new URL(redisUrl);
        const isInternal = u.hostname.endsWith('.railway.internal');

        return {
          redis: {
            host: u.hostname,
            port: Number(u.port || 6379),
            username: u.username || undefined,
            password: u.password || undefined,
            family: 6, // IPv6 inside Railway private net
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            connectTimeout: 10_000,
            tls: isInternal ? undefined : {},
          },
        };
      },
    }),

    // --- Cache (Keyv) ---
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('node_env') ?? 'development';
        const prefix = config.get<string>('redis.prefix') || 'autoworx:';

        if (nodeEnv === 'development') {
          return {
            stores: [
              new Keyv({
                store: new CacheableMemory({ ttl: 3_600_000, lruSize: 5000 }),
              }),
              new Keyv({
                store: new KeyvRedis(
                  `redis://${config.get('redis.host')}:${config.get('redis.port')}`,
                ),
                namespace: prefix,
              }),
            ],
          };
        }

        // production (Railway)
        const redisUrl = config.get<string>('redis.url');
        if (!redisUrl) throw new Error('redis.url is required in production');

        const redisStore = new KeyvRedis(redisUrl, {
          // family: 6, // force IPv6 for Railway
        });

        return {
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 3_600_000, lruSize: 5000 }),
              namespace: `${prefix}mem`,
            }),
            new Keyv({
              store: redisStore,
              namespace: prefix,
            }),
          ],
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
    AutoClockOutModule,
  ],
  controllers: [],
  providers: [],
  exports: [CacheModule],
})
export class AppModule {}
