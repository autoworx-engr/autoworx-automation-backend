import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAllCompaniesWithPermissions() {
    return this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        companyPermissionModules: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCompanyPermissions(companyId: number) {
    return this.prisma.companyPermissionModule.findMany({
      where: { companyId },
    });
  }

  async updateCompanyPermission(
    companyId: number,
    permissionName: string,
    enabled: boolean,
  ) {
    // Upsert permission for company
    return this.prisma.companyPermissionModule.update({
      where: {
        companyId_permission_name: {
          companyId,
          permission_name: permissionName,
        },
      },
      data: {
        enabled,
      },
    });
  }

  async bulkCreateCompanyPermissions(
    permissions: { companyId: number; permissionName: string; enabled: boolean; title: string }[]
  ) {
    // Use upsert for bulk insertion with update behavior
    const operations = permissions.map(({ companyId, permissionName, enabled, title }) =>
      this.prisma.companyPermissionModule.upsert({
        where: {
          companyId_permission_name: {
            companyId,
            permission_name: permissionName,
          },
        },
        update: {
          enabled,
          title,
        },
        create: {
          companyId,
          permission_name: permissionName,
          title,
          enabled,
        },
      })
    );

    return this.prisma.$transaction(operations);
  }
}
