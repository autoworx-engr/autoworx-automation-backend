import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInvoiceRuleDto } from '../dto/create-invoice-rule.dto';
import { InvoiceAutomationRule } from '@prisma/client';
import { UpdateInvoiceRuleDto } from '../dto/update-invoice-rule.dto';

@Injectable()
export class InvoiceAutomationRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInvoiceRuleDto): Promise<InvoiceAutomationRule> {
    return await this.prisma.invoiceAutomationRule.create({
      data: {
        title: data.title,
        companyId: data.companyId,
        type: data.type,
        invoiceStatusId: data.invoiceStatusId,
        timeDelay: data.timeDelay,
        isPaused: data.isPaused ?? false,
        communicationType: data.communicationType,
        emailBody: data.emailBody,
        smsBody: data.smsBody,
        emailSubject: data.emailSubject,
        createdBy: data.createdBy,
        attachments: data.attachments
          ? {
              create: data.attachments.map((a) => ({
                ...a,
              })),
            }
          : undefined,
      },
      include: {
        attachments: true,
      },
    });
  }

  async findAll(companyId: number) {
    const allRules = await this.prisma.invoiceAutomationRule.findMany({
      where: { companyId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return allRules;
  }

  async findOne(id: number) {
    return await this.prisma.invoiceAutomationRule.findUnique({
      where: { id },
      include: {
        attachments: true,
      },
    });
  }

  async update(id: number, data: UpdateInvoiceRuleDto) {
    const { attachments } = data;

    if (attachments) {
      // Delete existing attachments
      await this.prisma.automationAttachment.deleteMany({
        where: { invoiceId: id },
      });
    }

    const updatedRule = await this.prisma.invoiceAutomationRule.update({
      where: { id },
      data: {
        title: data.title,
        companyId: data.companyId,
        type: data.type,
        invoiceStatusId: data.invoiceStatusId,
        timeDelay: data.timeDelay,
        isPaused: data.isPaused ?? false,
        communicationType: data.communicationType,
        emailBody: data.emailBody,
        smsBody: data.smsBody,
        emailSubject: data.emailSubject,
        createdBy: data.createdBy,
        attachments: data.attachments
          ? {
              create: data.attachments.map((a) => ({
                ...a,
              })),
            }
          : undefined,
      },
      include: {
        attachments: true,
      },
    });

    return updatedRule;
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      const rule = await this.prisma.invoiceAutomationRule.findUnique({
        where: { id },
        include: {
          attachments: true,
          timeDelayExecution: true,
        },
      });

      if (!rule) {
        throw new Error(`Automation rule with id ${id} not found`);
      }
      if (rule.attachments.length > 0) {
        // delete attachments
        await this.prisma.automationAttachment.deleteMany({
          where: { invoiceId: id },
        });
      }

      // Delete the automation rule
      return prisma.invoiceAutomationRule.delete({
        where: { id: id },
      });
    });
  }
}
