import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTagAutomationRuleDto } from '../dto/create-tag-automation-rule.dto';
import { UpdateTagAutomationRuleDto } from '../dto/update-tag-automation-rule.dto';

@Injectable()
export class TagAutomationRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------
  //  CREATE RULE — handles all automation condition types
  // -------------------------------------------------------

  async createRule(dto: CreateTagAutomationRuleDto) {
    const {
      condition_type,
      communicationType,
      isSendOfficeHours,
      isSendWeekDays,
      emailBody,
      smsBody,
      subject,
      attachments,
      tagIds,
      columnIds,
      title,
      pipelineType,
      ruleType,
      timeDelay,
      isPaused,
      companyId,
      targetColumnId,
    } = dto;

    // --- Basic validation ---
    if (!companyId) throw new BadRequestException('CompanyId is required');
    if (!condition_type)
      throw new BadRequestException('condition_type is required');
    if (!pipelineType)
      throw new BadRequestException('pipelineType is required');

    // --- Filter valid tags from DB ---
    const validTags = tagIds?.length
      ? await this.prisma.tag.findMany({
          where: { id: { in: tagIds } },
          select: { id: true },
        })
      : [];

    if (!validTags) {
      throw new BadRequestException('No valid tags found for provided IDs');
    }

    // --- Filter valid columns if needed ---
    let validColumns: { id: number }[] = [];
    if (
      (condition_type === 'pipeline' || condition_type === 'post_tag') &&
      columnIds?.length
    ) {
      validColumns = await this.prisma.column.findMany({
        where: { id: { in: columnIds } },
        select: { id: true },
      });
      if (!validColumns)
        throw new BadRequestException(
          'No valid columns found for provided IDs',
        );
    }

    // --- Condition-specific validation ---

    //--- Condition-specific validation for communication ---
    if (condition_type === 'communication') {
      if (!communicationType)
        throw new Error(
          'communicationType is required for communication condition',
        );
      if (!emailBody && !smsBody)
        throw new BadRequestException(
          'At least emailBody or smsBody must be provided',
        );
    }

    // --- Condition-specific validation for pipeline ---
    if (condition_type === 'pipeline') {
      if (!targetColumnId)
        throw new BadRequestException(
          'targetColumnId is required for pipeline condition',
        );

      const targetColumn = await this.prisma.column.findUnique({
        where: { id: targetColumnId },
      });
      if (!targetColumn)
        throw new BadRequestException(
          'No valid targetColumn found for provided targetColumnId',
        );
    }

    // --- Condition-specific validation for post_tag ---
    if (condition_type === 'post_tag') {
      if (!validColumns.length)
        throw new BadRequestException(
          'At least one valid columnId is required for post_tag condition',
        );
    }

    // --- Build Prisma data object ---
    const data: any = {
      title,
      companyId,
      pipelineType,
      ruleType,
      timeDelay,
      isPaused,
      condition_type,
      tag: {
        connect: validTags.map(({ id }) => ({ id })),
      },
    };

    const tagAutomationRuleData = await this.prisma.tagAutomationRule.create({
      data: data,
      include: {
        tagAutomationCommunication: { include: { attachments: true } },
        tag: true,
        tagAutomationPipeline: true,
        PostTagAutomationColumn: true,
      },
    });

    if (condition_type === 'communication' && communicationType) {
      // await this.prisma.tagAutomationCommunication.create({
      //   data: {
      //     communicationType,
      //     isSendWeekDays,
      //     isSendOfficeHours,
      //     emailBody,
      //     smsBody,
      //     subject,
      //     tagAutomationId: tagAutomationRuleData?.id,
      //     attachments: attachments?.length
      //       ? { create: attachments.map(({ fileUrl }) => ({ fileUrl })) }
      //       : undefined,
      //   },
      //   include: {
      //     attachments: true,
      //   },
      // });

      const communicationRecord =
        await this.prisma.tagAutomationCommunication.create({
          data: {
            communicationType,
            isSendWeekDays,
            isSendOfficeHours,
            emailBody,
            smsBody,
            subject,
            tagAutomationId: tagAutomationRuleData.id,
            attachments: attachments?.length
              ? { create: attachments.map(({ fileUrl }) => ({ fileUrl })) }
              : undefined,
          },
          include: { attachments: true },
        });

      // attach to main object
      tagAutomationRuleData.tagAutomationCommunication = communicationRecord;
    }

    if (condition_type === 'pipeline' && targetColumnId) {
      const pipeline = await this.prisma.tagAutomationPipeline.create({
        data: {
          tagAutomationId: tagAutomationRuleData.id,
          targetColumnId,
        },
        include: {
          column: true,
          // tagAutomation: true,
        },
      });

      // Attach it manually to the main rule object
      tagAutomationRuleData.tagAutomationPipeline = pipeline;
      // console.log('Created pipeline:', pipeline);
    }

    if (condition_type === 'post_tag' && validColumns.length) {
      const postTagColumn = await this.prisma.postTagAutomationColumn.create({
        data: {
          tagAutomationId: tagAutomationRuleData?.id,
          columnIds: {
            connect: columnIds?.map((cid) => ({ id: cid })),
          },
        },
        include: {
          columnIds: true,
          tagAutomation: { include: { tag: true } },
        },
      });
      // console.log('Created PostTagAutomationColumn:', postTagColumn);
      return postTagColumn;
    }

    return tagAutomationRuleData;
  }

  // -------------------------------------------------------
  //  FIND ALL
  // -------------------------------------------------------
  async findAllRules(companyId: number) {
    return this.prisma.tagAutomationRule.findMany({
      where: { companyId },
      include: {
        tag: true,
        tagAutomationCommunication: { include: { attachments: true } },
        tagAutomationPipeline: true,
        PostTagAutomationColumn: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------
  //  FIND BY ID
  // -------------------------------------------------------
  async findRuleById(id: number) {
    return this.prisma.tagAutomationRule.findUnique({
      where: { id },
      include: {
        tag: true,
        tagAutomationCommunication: true,
        tagAutomationPipeline: true,
        PostTagAutomationColumn: true,
      },
    });
  }

  // -------------------------------------------------------
  //  UPDATE
  // -------------------------------------------------------

  async updateRule(id: number, updateDto: UpdateTagAutomationRuleDto) {
    const {
      tagIds,
      columnIds,
      targetColumnId,
      communicationType,
      isSendWeekDays,
      isSendOfficeHours,
      emailBody,
      smsBody,
      subject,
      attachments,
      ...updateData
    } = updateDto;

    return this.prisma.$transaction(async (prisma) => {
      const existingRule = await prisma.tagAutomationRule.findUnique({
        where: { id },
        include: {
          tagAutomationCommunication: true,
          tagAutomationPipeline: true,
          PostTagAutomationColumn: true,
          tag: true,
        },
      });

      if (!existingRule) {
        throw new NotFoundException(
          `Tag automation rule with ID ${id} not found`,
        );
      }

      // --------------------------
      // Update tags if provided
      // --------------------------
      if (tagIds) {
        await prisma.tagAutomationRule.update({
          where: { id },
          data: {
            tag: {
              set: tagIds.map((tid) => ({ id: tid })),
            },
          },
        });
      }

      // --------------------------
      // Update communication condition
      // --------------------------
      if (
        existingRule.condition_type === 'communication' &&
        (communicationType || attachments)
      ) {
        // Delete old attachments
        await prisma.automationAttachment.deleteMany({
          where: {
            tagCommunicationId: existingRule.tagAutomationCommunication?.id,
          },
        });

        // Create new attachments
        if (
          attachments?.length &&
          existingRule.tagAutomationCommunication?.id
        ) {
          await prisma.automationAttachment.createMany({
            data: attachments.map((att) => ({
              tagCommunicationId: existingRule.tagAutomationCommunication!.id,
              fileUrl: att.fileUrl,
            })),
          });
        }

        // Update communication details
        await prisma.tagAutomationCommunication.update({
          where: { id: existingRule.tagAutomationCommunication!.id },
          data: {
            communicationType,
            isSendWeekDays,
            isSendOfficeHours,
            emailBody,
            smsBody,
            subject,
          },
        });
      }

      // --------------------------
      // Update pipeline condition
      // --------------------------
      if (existingRule.condition_type === 'pipeline' && targetColumnId) {
        await prisma.tagAutomationPipeline.update({
          where: { id: existingRule.tagAutomationPipeline?.id },
          data: {
            targetColumnId,
          },
        });
      }

      // --------------------------
      // Update post_tag condition
      // --------------------------
      if (existingRule.condition_type === 'post_tag' && columnIds) {
        // Delete old post_tag columns
        await prisma.postTagAutomationColumn.deleteMany({
          where: { tagAutomationId: id },
        });

        // Add new columns
        if (columnIds.length) {
          await prisma.postTagAutomationColumn.createMany({
            data: columnIds.map((cid) => ({
              tagAutomationId: id,
              columnIdsId: cid, // make sure your Prisma field name is correct
            })),
          });
        }
      }

      // --------------------------
      // Update main rule
      // --------------------------
      const updatedRule = await prisma.tagAutomationRule.update({
        where: { id },
        data: updateData,
        include: {
          tag: true,
          tagAutomationCommunication: true,
          tagAutomationPipeline: true,
          PostTagAutomationColumn: true,
        },
      });

      return updatedRule;
    });
  }

  // -------------------------------------------------------
  //  DELETE
  // -------------------------------------------------------
  async deleteRule(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      const existingRule = await prisma.tagAutomationRule.findUnique({
        where: { id },
        include: {
          tagAutomationCommunication: true,
          tagAutomationPipeline: true,
          PostTagAutomationColumn: true,
          tag: true,
        },
      });

      if (!existingRule) {
        throw new NotFoundException(
          `Tag automation rule with ID ${id} not found`,
        );
      }

      // --------------------------
      // Delete attachments for communication
      // --------------------------
      if (
        existingRule.condition_type === 'communication' &&
        existingRule.tagAutomationCommunication?.id
      ) {
        await prisma.automationAttachment.deleteMany({
          where: {
            tagCommunicationId: existingRule.tagAutomationCommunication.id,
          },
        });

        await prisma.tagAutomationCommunication.delete({
          where: { id: existingRule.tagAutomationCommunication.id },
        });
      }

      // --------------------------
      // Delete pipeline record
      // --------------------------
      if (
        existingRule.condition_type === 'pipeline' &&
        existingRule.tagAutomationPipeline?.id
      ) {
        await prisma.tagAutomationPipeline.delete({
          where: { id: existingRule.tagAutomationPipeline.id },
        });
      }

      // --------------------------
      // Delete post_tag columns
      // --------------------------
      if (existingRule.condition_type === 'post_tag') {
        await prisma.postTagAutomationColumn.deleteMany({
          where: { tagAutomationId: id },
        });
      }

      // --------------------------
      // Finally delete main tag automation rule
      // --------------------------
      await prisma.tagAutomationRule.delete({
        where: { id },
      });

      return { id, message: 'Tag automation rule deleted successfully' };
    });
  }
}
