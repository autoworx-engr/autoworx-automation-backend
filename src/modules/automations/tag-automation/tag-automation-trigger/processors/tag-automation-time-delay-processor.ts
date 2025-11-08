import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { ExecutionStatus } from '@prisma/client';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import { MailUtils } from 'src/shared/global-service/sendEmail/mail.utils';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
import { isValidUSMobile } from 'src/shared/global-service/utils/isValidUSMobile';
import { TimeDelayRuleService } from 'src/modules/automations/pipeline-automation/pipeline-automation-trigger/services/time-delay-rule.service';

@Processor('tag-time-delay')
export class TagTimeDelayProcessor {
  constructor(
    private readonly globalRepository: GlobalRepository,
    private readonly mailUtils: MailUtils,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => TimeDelayRuleService))
    private readonly timeDelayRuleService: TimeDelayRuleService,
  ) {}
  private readonly logger = new Logger(TagTimeDelayProcessor.name);

  @Process('process-tag-time-delay')
  async processTagTimeDelay(job: Job) {
    // const { executionId, ruleId, companyId, conditionType } = job.data;
  }
}
