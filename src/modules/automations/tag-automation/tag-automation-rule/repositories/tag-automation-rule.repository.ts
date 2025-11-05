import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTagAutomationRuleDto } from '../dto/create-tag-automation-rule.dto';
import { UpdateTagAutomationRuleDto } from '../dto/update-tag-automation-rule.dto';

@Injectable()
export class TagAutomationRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------
  //  CREATE RULE — handles all automation condition types
  // -------------------------------------------------------

  // async createRule(dto: CreateTagAutomationRuleDto) {
  //   const {
  //     condition_type,
  //     communicationType,
  //     isSendOfficeHours,
  //     isSendWeekDays,
  //     emailBody,
  //     smsBody,
  //     subject,
  //     attachments,
  //     tagIds,
  //     columnIds,
  //     title,
  //     pipelineType,
  //     ruleType,
  //     timeDelay,
  //     isPaused,
  //     companyId,
  //   } = dto;

  //   return await this.prisma.tagAutomationRule.create({
  //     data: {
  //       title,
  //       companyId,
  //       pipelineType,
  //       ruleType,
  //       timeDelay,
  //       isPaused,
  //       condition_type,
  //       tag: {
  //         connect: tagIds?.map((id) => ({ id })) ?? [],
  //       },
  //       ...(condition_type === 'communication' &&
  //         communicationType && {
  //           tagAutomationCommunication: {
  //             create: {
  //               communicationType,
  //               isSendWeekDays,
  //               isSendOfficeHours,
  //               emailBody,
  //               smsBody,
  //               subject,
  //               attachments: attachments?.length
  //                 ? { create: attachments.map(({ fileUrl }) => ({ fileUrl })) }
  //                 : undefined,
  //             },
  //           },
  //         }),
  //       ...(condition_type === 'pipeline' &&
  //         columnIds?.[0] != null && {
  //           tagAutomationPipeline: {
  //             create: { targetColumnId: columnIds[0] },
  //           },
  //         }),
  //       ...(condition_type === 'post_tag' && columnIds?.length
  //         ? {
  //             PostTagAutomationColumn: {
  //               create: columnIds.map((id) => ({
  //                 columnIds: { connect: { id } },
  //               })),
  //             },
  //           }
  //         : {}),
  //     },
  //     include: {
  //       tagAutomationCommunication: true,
  //       tagAutomationPipeline: true,
  //       PostTagAutomationColumn: true,
  //       tag: true,
  //     },
  //   });
  // }

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
    if (condition_type === 'communication') {
      if (!communicationType)
        throw new Error(
          'communicationType is required for communication condition',
        );
      if (!emailBody && !smsBody)
        throw new Error('At least emailBody or smsBody must be provided');
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

    if (condition_type === 'communication' && communicationType) {
      data.tagAutomationCommunication = {
        create: {
          communicationType,
          isSendWeekDays,
          isSendOfficeHours,
          emailBody,
          smsBody,
          subject,
          attachments: attachments?.length
            ? { create: attachments.map(({ fileUrl }) => ({ fileUrl })) }
            : undefined,
        },
      };
    }

    if (condition_type === 'pipeline' && validColumns[0]) {
      data.tagAutomationPipeline = {
        create: { targetColumnId: validColumns[0].id },
      };
    }

    if (condition_type === 'post_tag' && validColumns.length) {
      data.PostTagAutomationColumn = {
        create: validColumns,
      };
    }

    // --- Execute Prisma create ---
    return await this.prisma.tagAutomationRule.create({
      data,
      include: {
        tagAutomationCommunication: true,
        tagAutomationPipeline: true,
        PostTagAutomationColumn: {
          include: { columnIds: true },
        },
        tag: true,
      },
    });
  }

  // -------------------------------------------------------
  //  FIND ALL
  // -------------------------------------------------------
  async findAllRules(companyId: number) {
    return this.prisma.tagAutomationRule.findMany({
      where: { companyId },
      include: {
        tag: true,
        tagAutomationCommunication: true,
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
    const { tagIds, ...updateData } = updateDto;

    return this.prisma.tagAutomationRule.update({
      where: { id },
      data: {
        ...updateData,
        ...(tagIds ? { tag: { set: tagIds.map((id) => ({ id })) } } : {}),
      },
      include: {
        tag: true,
        tagAutomationCommunication: true,
        tagAutomationPipeline: true,
        PostTagAutomationColumn: true,
      },
    });
  }

  // -------------------------------------------------------
  //  DELETE
  // -------------------------------------------------------
  async deleteRule(id: number) {
    return this.prisma.tagAutomationRule.delete({ where: { id } });
  }
}
