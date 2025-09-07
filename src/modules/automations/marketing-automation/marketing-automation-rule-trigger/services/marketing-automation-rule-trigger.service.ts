/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { MarketingAutomationTriggerRepository } from '../repository/marketing-automation-trigger.repository';

import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class MarketingAutomationTriggerService {
  private readonly logger: LoggerService = new Logger();

  // Define cache keys and TTLs as variables
  private readonly RULE_CACHE_KEY = 'marketing_automation_rule:';
  private readonly RULES_LIST_KEY = 'marketing_automation_rules:list:';
  constructor(
    private readonly marketingAutomationRuleTriggerRepository: MarketingAutomationTriggerRepository,

    @InjectQueue('marketing-campaign-trigger')
    private readonly marketingQueue: Queue,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  private applyTargetFilters(clients: any[], target: string[]): any[] {
    if (!Array.isArray(target)) return clients;

    let filteredClients = [...clients];

    if (target.includes('WITH_ESTIMATE')) {
      filteredClients = filteredClients.filter((client) =>
        client?.Invoice?.some((i: { type: string }) => i.type === 'Estimate'),
      );
    }

    if (target.includes('WITH_INVOICE')) {
      filteredClients = filteredClients.filter((client) =>
        client?.Invoice?.some((i: { type: string }) => i.type === 'Invoice'),
      );
    }

    if (target.includes('WITHOUT_AN_ESTIMATE')) {
      filteredClients = filteredClients.filter(
        (client) =>
          !client?.Invoice?.some(
            (i: { type: string }) => i.type === 'Estimate',
          ),
      );
    }

    if (target.includes('INVOICE')) {
      filteredClients = filteredClients.filter(
        (client) => client?.Invoice?.length > 0,
      );
    }

    // If only ALL_CLIENTS is selected, skip filtering
    if (target.length === 1 && target.includes('ALL_CLIENTS')) {
      return clients;
    }

    return filteredClients;
  }

  async updateMarketingRule(
    ruleId: number,
    data: { isActive?: boolean; isPaused?: boolean },
  ) {
    const result =
      await this.marketingAutomationRuleTriggerRepository.updateRule(
        ruleId,
        data,
      );

    // Invalidate rules cache
    await this.cacheManager.del(`${this.RULE_CACHE_KEY}${ruleId}`);
    if (ruleId) {
      await this.cacheManager.del(`${this.RULES_LIST_KEY}${result.companyId}`);
    }

    this.logger.log(
      `Cache invalidated for marketing automation rule ${ruleId}`,
    );
  }

  async scheduleTimeDelay(rule, client) {
    const now = Date.now();

    const ruleDate = new Date(rule.date);
    const startTime = new Date(rule.startTime);
    // Combine date + time to get scheduled timestamp
    const scheduledDateTime = new Date(
      ruleDate.getFullYear(),
      ruleDate.getMonth(),
      ruleDate.getDate(),
      startTime.getHours(),
      startTime.getMinutes(),
      startTime.getSeconds(),
    ).getTime();
    const delay = Math.max(0, scheduledDateTime - now);

    const jobId = `rule-${rule.id}-client-${client.id}`;
    const existingJob = await this.marketingQueue.getJob(jobId);

    if (existingJob) {
      this.logger.warn(
        `Job already exists for rule ${rule.id} and client ${client.id}`,
      );
      return;
    }

    try {
      const job = await this.marketingQueue.add(
        'marketing-campaign-trigger',
        { ruleId: rule.id, clientId: client.id },
        {
          delay,
          jobId: `rule-${rule.id}-client-${client.id}-${rule.startTime}`,
        },
      );

      this.logger.log(
        `Scheduled time delay job ${job.id} for client ${client.id} and rule ${rule.id}`,
      );

      return { jobId: job.id.toString() };
    } catch (error) {
      this.logger.error(`Failed to schedule time delay: ${error.message}`);
      throw error;
    }
  }

  async handleStartCampaign(companyId?: number) {
    this.logger.log('Marketing automation rule trigger started');

    const rules =
      await this.marketingAutomationRuleTriggerRepository.findAllRule(
        companyId,
      );

    if (!rules || rules.length === 0) {
      this.logger.warn(
        "Today's marketing automation rules not found to process",
      );
      return;
    }

    for (const rule of rules) {
      if (rule.isPaused) continue;

      // Step 1: Get all clients for the rule's company
      let clients =
        await this.marketingAutomationRuleTriggerRepository.findAllClientsByCompanyId(
          rule.companyId,
          rule.targetCondition,
        );

      const target: string[] =
        typeof rule.target === 'string' ? JSON.parse(rule.target) : rule.target;

      // Step 2: Filter clients based on rule target
      clients = this.applyTargetFilters(clients, target);

      // Step 3: Filter by appointment status
      if (rule.isAppointmentCreated) {
        clients = clients.filter((client) => client?.appointments?.length > 0);
        this.logger.log('Filtered clients by appointment created');
      }

      // Step 4: Filter by vehicle year range
      if (rule.vehicleMinYear && rule.vehicleMaxYear) {
        const minYear = Number(rule.vehicleMinYear);
        const maxYear = Number(rule.vehicleMaxYear);
        clients = clients.filter((client) =>
          client.Vehicle?.some((vehicle) => {
            const year = Number(vehicle.year);
            return year >= minYear && year <= maxYear;
          }),
        );
      }

      // Step 5: Filter by vehicle brand
      if (rule.vehicleBrand) {
        const brand = rule.vehicleBrand.trim().toLowerCase();
        clients = clients.filter((client) =>
          client.Vehicle?.some(
            (vehicle) => vehicle.make?.trim().toLowerCase() === brand,
          ),
        );
        this.logger.log('Filtered clients by vehicle brand');
      }

      // Step 6: Filter by vehicle model
      if (rule.vehicleModel) {
        const model = rule.vehicleModel.trim().toLowerCase();
        clients = clients.filter((client) =>
          client.Vehicle?.some(
            (vehicle) => vehicle.model?.trim().toLowerCase() === model,
          ),
        );
      }

      if (clients.length === 0) {
        this.logger.warn('No clients matched after filtering!');
        return;
      }

      // Step 7: Schedule campaign per client
      for (const client of clients) {
        await this.scheduleTimeDelay(rule, client);
      }

      await this.updateMarketingRule(rule.id, {
        isActive: false,
      });
    }
  }
}
