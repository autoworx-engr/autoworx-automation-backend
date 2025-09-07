import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInventoryRuleDto } from '../dto/create-inventory-rule.dto';
import { UpdateInventoryRuleDto } from '../dto/update-inventory-rule.dto';

@Injectable()
export class InventoryAutomationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInventoryRuleDto) {
    // team members validations
    if (data?.teamMemberUserIds && data.teamMemberUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: data.teamMemberUserIds } },
        select: { id: true },
      });

      const existingIds = users.map((u) => u.id);
      const missingIds = data.teamMemberUserIds.filter(
        (i) => !existingIds.includes(i),
      );

      if (missingIds.length > 0) {
        throw new NotFoundException(
          `User(s) not found with ID(s): ${missingIds.join(', ')}`,
        );
      }
    }
    return await this.prisma.inventoryAutomationRule.create({
      data: {
        title: data?.title,
        companyId: data?.companyId,
        frequency: data?.frequency,

        condition: data?.condition,
        action: data?.action,
        isPaused: data?.isPaused ?? false,
        createdBy: data?.createdBy,
        ...(data.frequency === 'WEEKLY' && data.day ? { day: data.day } : {}), // only if WEEKLY and day is provided
        teamMembers:
          data?.teamMemberUserIds && data?.teamMemberUserIds?.length > 0
            ? {
                create: data?.teamMemberUserIds.map((userId) => ({
                  user: { connect: { id: userId } },
                })),
              }
            : undefined,
      },

      include: {
        teamMembers: true,
      },
    });
  }

  async findAll(companyId: number) {
    return await this.prisma.inventoryAutomationRule.findMany({
      where: { companyId },
      include: {
        teamMembers: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    return await this.prisma.inventoryAutomationRule.findUnique({
      where: { id },
      include: {
        teamMembers: true,
      },
    });
  }

  async update(id: number, data: UpdateInventoryRuleDto) {
    // Use transaction to handle team members update properly
    return await this.prisma.$transaction(async (prisma) => {
      // If team members are being updated, handle them separately
      if (data?.teamMemberUserIds !== undefined) {
        // Validate team members if provided
        if (data.teamMemberUserIds.length > 0) {
          const users = await prisma.user.findMany({
            where: { id: { in: data.teamMemberUserIds } },
            select: { id: true },
          });

          const existingIds = users.map((u) => u.id);
          const missingIds = data.teamMemberUserIds.filter(
            (i) => !existingIds.includes(i),
          );

          if (missingIds.length > 0) {
            throw new NotFoundException(
              `User(s) not found with ID(s): ${missingIds.join(', ')}`,
            );
          }
        }

        // Delete existing team members
        await prisma.inventoryAutomationTeamMember.deleteMany({
          where: {
            inventoryRuleId: id,
          },
        });

        // Create new team members if provided
        if (data.teamMemberUserIds.length > 0) {
          await prisma.inventoryAutomationTeamMember.createMany({
            data: data.teamMemberUserIds.map((userId) => ({
              inventoryRuleId: id,
              userId: userId,
            })),
          });
        }
      }

      // Update the main rule
      return await prisma.inventoryAutomationRule.update({
        where: { id },
        data: {
          title: data?.title,
          companyId: data?.companyId,
          frequency: data?.frequency,
          condition: data?.condition,
          action: data?.action,
          isPaused: data?.isPaused,
          createdBy: data?.createdBy,
          ...(data.frequency === 'WEEKLY' && data.day
            ? { day: data.day }
            : { day: null }),
        },
        include: {
          teamMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async remove(id: number) {
    return await this.prisma.inventoryAutomationRule.delete({
      where: { id },
    });
  }
}
