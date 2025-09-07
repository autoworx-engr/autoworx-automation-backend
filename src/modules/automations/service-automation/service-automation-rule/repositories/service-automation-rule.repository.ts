import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  AutomationAttachment,
  ServiceMaintenanceAutomationRule,
  ServiceMaintenanceStage,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateServiceAutomationRuleDto } from '../dto/create-service-automation-rule.dto';
import { UpdateServiceAutomationRuleDto } from '../dto/update-service-automation-rule.dto';
import { TransactionPrismaClient } from '../interfaces/service-automation-rule.interface';

@Injectable()
export class ServiceAutomationRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // findAll method to retrieve all service automation rules
  async findAll(
    companyId: number,
    params?: Parameters<
      typeof this.prisma.serviceMaintenanceAutomationRule.findMany
    >[0],
  ): Promise<ServiceMaintenanceAutomationRule[]> {
    if (!companyId) {
      throw new Error(
        'Company ID is required to fetch service automation rules',
      );
    }
    return this.prisma.serviceMaintenanceAutomationRule.findMany({
      where: {
        companyId,
        ...params,
      },
      include: {
        serviceMaintenanceStage: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
  }

  // findById method to retrieve a service automation rule by its ID

  async findById(
    id: number,
    params?: Omit<
      Parameters<
        typeof this.prisma.serviceMaintenanceAutomationRule.findUnique
      >[0],
      'where'
    >,
  ): Promise<ServiceMaintenanceAutomationRule> {
    const rule = await this.prisma.serviceMaintenanceAutomationRule.findUnique({
      where: { id },
      ...params,
    });
    if (!rule) {
      throw new Error('Service Automation Rule not found');
    }
    return rule;
  }

  // createServiceAttachment method to create an attachment for a service automation rule
  async createServiceAttachment(
    prisma: TransactionPrismaClient | null,
    serviceAutomationId: number,
    fileUrl: string,
  ): Promise<AutomationAttachment> {
    const prismaClient = prisma ? prisma : this.prisma;
    return prismaClient.automationAttachment.create({
      data: {
        serviceMaintenanceId: serviceAutomationId,
        fileUrl,
      },
    });
  }

  // createServiceStage method to create a stage for a service automation rule
  async createServiceStage(
    prisma: TransactionPrismaClient | null,
    serviceAutomationRuleId: number,
    serviceId: number,
  ) {
    const prismaClient = prisma ? prisma : this.prisma;
    return prismaClient.serviceMaintenanceStage.create({
      data: {
        serviceMaintenanceRuleId: serviceAutomationRuleId,
        serviceId,
      },
    });
  }

  // create method to create a new service automation rule
  async create(
    data: CreateServiceAutomationRuleDto,
  ): Promise<ServiceMaintenanceAutomationRule> {
    const serviceAutomationRule = await this.prisma.$transaction(
      async (prisma) => {
        const findServiceAutomationRuleCount =
          await prisma.serviceMaintenanceAutomationRule.count({
            where: {
              companyId: data.companyId,
            },
          });

        if (findServiceAutomationRuleCount > 3) {
          throw new HttpException(
            'You can only create a maximum of 3 service automation rules per company.',
            HttpStatus.NOT_ACCEPTABLE,
          );
        }
        const createServiceAutomationRule =
          await prisma.serviceMaintenanceAutomationRule.create({
            data: {
              companyId: data.companyId,
              title: data.title,
              conditionColumnId: data.conditionColumnId,
              createdBy: data.createdBy,
              emailSubject: data.emailSubject,
              isPaused: data.isPaused || false,
              targetColumnId: data.targetColumnId || null,
              emailBody: data.emailBody,
              smsBody: data.smsBody,
              templateType: data.templateType,
              timeDelay: data.timeDelay,
            },
          });

        let createdAttachments: AutomationAttachment[] | null = null;
        let createdServiceStages: ServiceMaintenanceStage[] | null = null;

        if (data.attachments && data.attachments.length > 0) {
          createdAttachments = await Promise.all(
            data.attachments.map(
              async (attachmentUrl: string): Promise<AutomationAttachment> => {
                const createServiceAutomationAttachments =
                  await this.createServiceAttachment(
                    prisma,
                    createServiceAutomationRule.id,
                    attachmentUrl,
                  );
                return createServiceAutomationAttachments;
              },
            ),
          );
        }

        if (data.selectedServiceIds && data.selectedServiceIds.length > 0) {
          createdServiceStages = await Promise.all(
            data.selectedServiceIds.map(
              async (serviceId: number): Promise<ServiceMaintenanceStage> => {
                const createServiceAutomationStage =
                  await this.createServiceStage(
                    prisma,
                    createServiceAutomationRule.id,
                    serviceId,
                  );
                return createServiceAutomationStage;
              },
            ),
          );
        }

        return {
          ...createServiceAutomationRule,
          attachments: createdAttachments,
          serviceMaintenanceStage: createdServiceStages,
        };
      },
    );

    return serviceAutomationRule;
  }

  // update method to update an existing service automation rule
  async update(
    id: number,
    data: UpdateServiceAutomationRuleDto,
  ): Promise<ServiceMaintenanceAutomationRule> {
    const rule = await this.findById(id);
    if (!rule) {
      throw new Error('Service Automation Rule not found');
    }

    const {
      attachments,
      selectedServiceIds,
      ...serviceMaintenanceAutomationRuleData
    } = data || {};

    // if campaign is paused and being resumed, check the date and time
    // const now = Date.now();

    // const startTime = new Date(rule.startTime as Date);
    // // Combine date + time to get scheduled timestamp
    // const scheduledDateTime = new Date(
    //   startTime.getFullYear(),
    //   startTime.getMonth(),
    //   startTime.getDate(),
    //   startTime.getHours(),
    //   startTime.getMinutes(),
    //   startTime.getSeconds(),
    // ).getTime();
    // const delay = Math.max(0, scheduledDateTime - now);

    // if (
    //   rule?.isPaused == true &&
    //   data.isPaused == false &&
    //   rule.isActive == false
    // ) {
    //   if (delay <= 0) {
    //     throw new HttpException(
    //       'Please update the service maintenance time delay and then resume the rule!',
    //       HttpStatus.EXPECTATION_FAILED,
    //     );
    //   }

    //   data.isActive = true; // Automatically set to active when resuming
    // }

    const updatedServiceAutomationRule = await this.prisma.$transaction(
      async (prisma) => {
        const updatedServiceAutomationRule =
          await prisma.serviceMaintenanceAutomationRule.update({
            where: { id: rule.id },
            data: serviceMaintenanceAutomationRuleData,
          });

        let createdAttachments: AutomationAttachment[] | null = null;
        let createdServiceStages: ServiceMaintenanceStage[] | null = null;

        if (attachments && attachments.length > 0) {
          createdAttachments = await Promise.all(
            attachments.map(
              async (attachmentUrl: string): Promise<AutomationAttachment> => {
                // find first attachment with the same URL
                const existingAttachment =
                  await prisma.automationAttachment.findFirst({
                    where: {
                      fileUrl: attachmentUrl,
                      serviceMaintenanceId: id,
                    },
                  });

                if (existingAttachment) {
                  return existingAttachment;
                }

                // create a new attachment if it doesn't exist
                const createServiceAutomationAttachments =
                  await this.createServiceAttachment(prisma, id, attachmentUrl);
                return createServiceAutomationAttachments;
              },
            ),
          );
        }

        if (selectedServiceIds && selectedServiceIds.length > 0) {
          createdServiceStages = await Promise.all(
            selectedServiceIds.map(
              async (serviceId: number): Promise<ServiceMaintenanceStage> => {
                // find first stage with the same serviceId
                const existingStage =
                  await prisma.serviceMaintenanceStage.findFirst({
                    where: {
                      serviceMaintenanceRuleId: id,
                      serviceId: serviceId,
                    },
                  });
                if (existingStage) {
                  return existingStage;
                }
                // create a new stage if it doesn't exist
                const createServiceAutomationStage =
                  await this.createServiceStage(prisma, id, serviceId);
                return createServiceAutomationStage;
              },
            ),
          );
        }
        return {
          ...updatedServiceAutomationRule,
          attachments: createdAttachments,
          serviceMaintenanceStage: createdServiceStages,
        };
      },
    );
    return updatedServiceAutomationRule;
  }

  // delete method to delete a service automation rule by its ID
  async delete(id: number): Promise<ServiceMaintenanceAutomationRule> {
    return this.prisma.serviceMaintenanceAutomationRule.delete({
      where: { id },
    });
  }
}
