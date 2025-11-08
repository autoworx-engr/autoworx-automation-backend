import { Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceType, Lead } from '@prisma/client';
import {
  ITimeExecutionCreate,
  ITimeExecutionStatus,
} from 'src/common/interfaces/api-response.interface';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GlobalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLeadById(
    leadId: number,
    companyId: number,
    params?: Omit<Parameters<typeof this.prisma.lead.findUnique>[0], 'where'>,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId,
      },
      ...params,
      include: {
        leadTags: true,
        Client: true,
      },
    });
    if (!lead) {
      throw new Error('Lead not found');
    }
    return lead;
  }
  async findInvoiceById(
    invoiceId: string,
    companyId: number,
    type: InvoiceType,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
        type: type,
      },
      include: {
        client: {
          include: {
            Lead: {
              include: {
                Service: true,
              },
            },
          },
        },
      },
    });
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice;
  }

  async findEstimateById(estimateId: string, companyId: number) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: estimateId,
        companyId,
      },
      include: {
        client: {
          include: {
            Lead: {
              include: {
                Service: true,
              },
            },
          },
        },
        invoiceItems: {
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
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice;
  }

  async createTimeDelayExecution({
    pipelineRuleId = null,
    communicationRuleId = null,
    serviceMaintenanceRuleId = null,
    invoiceAutomationRuleId = null,
    tagAutomationRuleId,
    leadId = null,
    estimateId = null,
    columnId,
    executeAt,
  }: ITimeExecutionCreate) {
    return this.prisma.timeDelayExecution.create({
      data: {
        pipelineRuleId,
        communicationRuleId,
        serviceMaintenanceRuleId,
        invoiceAutomationRuleId,
        tagAutomationRuleId,
        leadId,
        estimateId,
        columnId,
        status: 'PENDING',
        executeAt,
      },
    });
  }

  async updateTimeDelayExecution(id: number, jobId: string) {
    return this.prisma.timeDelayExecution.update({
      where: { id },
      data: { jobId },
    });
  }

  async findTimeDelayExecution(executionId: number) {
    return this.prisma.timeDelayExecution.findUnique({
      where: { id: executionId },
    });
  }

  async updateExecutionStatus(
    executionId: number,
    status: ITimeExecutionStatus,
  ) {
    return this.prisma.timeDelayExecution.update({
      where: { id: executionId },
      data: { status },
    });
  }

  /**
   * Updates the executeAt time for a TimeDelayExecution
   * @param executionId The ID of the TimeDelayExecution to update
   * @param executeAt The new execution time
   * @returns The updated TimeDelayExecution record
   */
  async updateExecutionTime(executionId: number, executeAt: Date) {
    return this.prisma.timeDelayExecution.update({
      where: { id: executionId },
      data: { executeAt },
    });
  }

  async updatePipelineLeadColumn({
    companyId,
    leadId,
    targetedColumnId,
  }: {
    companyId: number;
    leadId: number;
    targetedColumnId: number;
  }): Promise<Lead> {
    const findLead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
        companyId,
      },
    });

    if (!findLead) {
      throw new NotFoundException('Lead not found');
    }

    // Update the lead with new column and track the column change time
    const updatedLead = await this.prisma.lead.update({
      where: {
        id: leadId,
        companyId,
      },
      data: {
        columnId: targetedColumnId,
        columnChangedAt: new Date(), // Track when the column change happened
      },
    });
    return updatedLead;
  }
  async updateEstimateColumn({
    companyId,
    estimateId,
    targetedColumnId,
  }: {
    companyId: number;
    estimateId: string;
    targetedColumnId: number;
  }): Promise<Invoice> {
    const findInvoice = await this.prisma.invoice.findUnique({
      where: {
        id: estimateId,
        companyId,
      },
    });

    if (!findInvoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Update the lead with new column and track the column change time
    const updateEstimate = await this.prisma.invoice.update({
      where: {
        id: estimateId,
        companyId,
      },
      data: {
        columnId: targetedColumnId,
        columnChangedAt: new Date(), // Track when the column change happened
      },
    });
    return updateEstimate;
  }

  async findCompanyById(
    companyId: number,
    params?: Omit<
      Parameters<typeof this.prisma.company.findUnique>[0],
      'where'
    >,
  ) {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      ...params,
    });
  }

  async findVehicleById(
    vehicleId: number,
    params?: Omit<
      Parameters<typeof this.prisma.vehicle.findUnique>[0],
      'where'
    >,
  ) {
    return this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      ...params,
    });
  }
}
