import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { CreateCommunicationAutomationDto } from '../dto/create-communication-automation.dto';
import { UpdateCommunicationAutomationDto } from '../dto/update-communication-automation.dto';

@Injectable()
export class CommunicationAutomationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateCommunicationAutomationDto) {
    const { stages, attachments, targetColumnId, isSendWeekDays, ...rest } =
      data;

    const result = await this.prisma.$transaction(async (prisma) => {
      const automation = await prisma.communicationAutomationRule.create({
        data: {
          ...rest,
          isSendWeekDays, // ✅ Correct casing
          targetColumnId: targetColumnId || null,
          stages: {
            create: stages.map((columnId) => ({ columnId })),
          },
          attachments: attachments && {
            create: attachments.map(({ fileUrl }) => ({ fileUrl })),
          },
        },
        include: {
          stages: {
            include: {
              column: true,
            },
          },
          attachments: true,
          targetColumn: true,
        },
      });

      return automation;
    });

    return result;
  }

  async findAll(companyId: number) {
    const rules = await this.prisma.communicationAutomationRule.findMany({
      where: { companyId },
      include: {
        stages: {
          include: {
            column: true,
          },
        },
        attachments: true,
        targetColumn: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rules;
  }

  async findOne(id: number) {
    const result = await this.prisma.communicationAutomationRule.findFirst({
      where: {
        id,
      },
      include: {
        stages: {
          include: {
            column: true,
          },
        },
        attachments: true,
        targetColumn: true,
      },
    });

    return result;
  }

  async update(id: number, data: UpdateCommunicationAutomationDto) {
    const { stages, attachments, ...updateData } = data;

    return this.prisma.$transaction(async (prisma) => {
      if (stages) {
        // Delete existing stages
        await prisma.communicationStage.deleteMany({
          where: { communicationRuleId: id },
        });
      }

      if (attachments) {
        // Delete existing attachments
        await prisma.automationAttachment.deleteMany({
          where: { communicationId: id },
        });
      }

      // Update the automation rule
      const automation = await prisma.communicationAutomationRule.update({
        where: {
          id,
        },
        data: {
          ...updateData,
          stages: stages && {
            create: stages.map((columnId) => ({
              columnId,
            })),
          },
          attachments: attachments && {
            create: attachments.map(({ fileUrl }) => ({
              fileUrl,
            })),
          },
        },
        include: {
          stages: {
            include: {
              column: true,
            },
          },
          attachments: true,
          targetColumn: true,
        },
      });

      return automation;
    });
  }

  async remove(id: number) {
    // Get the automation rule to find the companyId
    await this.prisma.communicationAutomationRule.findUnique({
      where: { id },
      select: { companyId: true },
    });

    // Delete the automation rule

    const result = await this.prisma.communicationAutomationRule.delete({
      where: {
        id,
      },
      include: {
        stages: true,
        attachments: true,
      },
    });

    return result;
  }

  async togglePause(id: number, companyId: number) {
    await this.prisma.communicationAutomationRule.findFirst({
      where: {
        id,
        companyId,
      },
    });

    const result = await this.prisma.communicationAutomationRule.update({
      where: {
        id,
        companyId,
      },
      data: {
        // isPaused: !automation.isPaused
      },
    });

    return result;
  }
}
