import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import {
  MailUtils,
  TPlaceholder,
} from 'src/shared/global-service/sendEmail/mail.utils';
import { MailService } from 'src/shared/global-service/sendEmail/mail.service';
import { SmsService } from 'src/shared/global-service/sendSms/sms.service';
import { InfobipSmsService } from 'src/shared/global-service/sendInfobipSms/infobip-sms.service';
import { Logger, LoggerService, NotFoundException } from '@nestjs/common';
import { MarketingAutomationTriggerRepository } from '../repository/marketing-automation-trigger.repository';
import { MarketingAutomationTriggerService } from '../services/marketing-automation-rule-trigger.service';
import { isValidUSMobile } from 'src/shared/global-service/utils/isValidUSMobile';
import { GlobalRepository } from 'src/shared/global-service/repository/global.repository';

@Processor('marketing-campaign-trigger')
export class MarketingAutomationProcessor {
  private readonly logger: LoggerService = new Logger();
  constructor(
    private readonly marketingAutomationRuleTriggerRepository: MarketingAutomationTriggerRepository,
    private readonly marketingTriggerService: MarketingAutomationTriggerService,
    private readonly globalRepository: GlobalRepository,
    private readonly smsService: SmsService,
    private readonly infobipSms: InfobipSmsService,
    private readonly mailService: MailService,
    private readonly mailUtils: MailUtils,
  ) {}
  @Process('marketing-campaign-trigger')
  async handleSendEmailAndSms(job: Job) {
    const { ruleId, clientId } = job.data;

    const marketingRule =
      await this.marketingAutomationRuleTriggerRepository.findRuleById(
        ruleId as number,
      );
    const client =
      await this.marketingAutomationRuleTriggerRepository.findClientById(
        clientId as number,
      );

    if (!marketingRule || !client) {
      new NotFoundException('Rule or client not found');
      return;
    }

    const companyInfo = await this.globalRepository.findCompanyById(
      marketingRule?.companyId,
      {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          email: true,
          smsGateway: true,
        },
      },
    );

    const vehicleInfo = client?.Lead?.vehicleId
      ? await this.globalRepository.findVehicleById(client?.Lead?.vehicleId, {
          select: { id: true, make: true, model: true, year: true },
        })
      : null;

    const placeholdersValue: TPlaceholder = {
      contactName: `${client.firstName} ${client.lastName}`,
      client: `${client.firstName} ${client.lastName}`,
      vehicle: vehicleInfo
        ? `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.year}`
        : '',
      businessName: companyInfo?.name || '',
      businessPhone: companyInfo?.phone || '',
      businessAddress: companyInfo?.address || '',
      videoDirection: 'N/A',
      googleMapLink: 'N/A',
    };

    const formattedEmailBody = this.mailUtils.formatBody(
      marketingRule.emailBody || '',
      placeholdersValue,
    );

    const formattedSmsBody = this.mailUtils.formatBody(
      marketingRule.smsBody || '',
      placeholdersValue,
    );

    try {
      const attachmentUrls = marketingRule.attachments.map(
        (attachment: any) => attachment.fileUrl as string,
      );
      if (['EMAIL', 'BOTH'].includes(marketingRule.communicationType)) {
        // Send email only if the client has an email address
        if (client.email) {
          await this.mailService.sendEmail({
            subject: marketingRule.emailSubject! || '',
            clientEmail: client.email,
            emailBody: formattedEmailBody,
            companyEmail: client.company?.email || '',
            companyId: marketingRule.companyId,
            attachments: attachmentUrls,
            clientId: client.id,
          });

          this.logger.log(
            `Email successfully sent to Name:${client.firstName + ' ' + client.lastName}, Email:${client.email} via marketing automation.`,
          );
        }
      }

      if (['SMS', 'BOTH'].includes(marketingRule.communicationType)) {
        if (client.mobile && isValidUSMobile(client.mobile)) {
          try {
            if (companyInfo?.smsGateway === 'TWILIO') {
              await this.smsService.sendSms({
                companyId: marketingRule.companyId,
                clientId: client.id,
                message: formattedSmsBody,
                attachments: attachmentUrls,
              });
            } else if (companyInfo?.smsGateway === 'INFOBIP') {
              await this.infobipSms.sendInfobipSms({
                companyId: marketingRule.companyId,
                clientId: client.id,
                message: formattedSmsBody,
                attachments: attachmentUrls,
              });
            }
          } catch (error) {
            this.logger.error(`Failed to send SMS: ${error.message}`);
          }
        }

        this.logger.log(
          `SMS successfully sent to Name:${client.firstName + ' ' + client.lastName}, Mobile:${client.mobile} via marketing automation.`,
        );
      }

      if (!marketingRule.isPaused) {
        await this.marketingTriggerService.updateMarketingRule(
          ruleId as number,
          {
            isPaused: true,
            isActive: false,
          },
        );
      }

      this.logger.log('The marketing automation successfully completed!');
    } catch (error) {
      this.logger.error(
        `Failed to process execution in marketing automation!`,
        error.stack,
      );

      return {
        statusCode: 500,
        reason: 'Failed to process execution in marketing automation!',
        error: error.message,
      };
    }
  }
}
