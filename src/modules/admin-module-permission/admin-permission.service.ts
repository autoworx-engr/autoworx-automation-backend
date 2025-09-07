import { Injectable, Inject, Logger } from '@nestjs/common';
import { AdminPermissionRepository } from './admin-permission.repository';
import {
  UpdateCompanyPermissionsDto,
  BulkCreateCompanyPermissionsDto,
} from './dto/admin-permission.dto';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class AdminPermissionService {
  private readonly logger = new Logger(AdminPermissionService.name);
  private readonly COMPANY_PERMISSIONS_KEY = 'company_permissions:';
  private readonly ALL_COMPANIES_KEY = 'all_companies_permissions';
  private readonly CACHE_TTL = 15 * 24 * 3600; // 15 day in seconds

  constructor(
    private readonly repo: AdminPermissionRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Get all companies with their permission settings
  async getAllCompaniesWithPermissions() {
    const cached = await this.cacheManager.get<string>(this.ALL_COMPANIES_KEY);
    if (cached) {
      this.logger.log('Returning all companies permissions from cache');
      return JSON.parse(cached);
    }
    const result = await this.repo.getAllCompaniesWithPermissions();
    await this.cacheManager.set(
      this.ALL_COMPANIES_KEY,
      JSON.stringify(result),
      this.CACHE_TTL * 1000,
    );
    return result;
  }

  // Get permissions for a specific company
  async getCompanyPermissions(companyId: number) {
    const cacheKey = `${this.COMPANY_PERMISSIONS_KEY}${companyId}`;
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      this.logger.log(
        `Returning permissions for company ${companyId} from cache`,
      );
      return JSON.parse(cached);
    }
    const result = await this.repo.getCompanyPermissions(companyId);
    await this.cacheManager.set(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL * 1000,
    );
    return result;
  }

  // Update/Toggle company permissions
  async updateCompanyPermissions(
    companyId: number,
    permissions: UpdateCompanyPermissionsDto,
  ) {
    // permissions: { [permissionName: string]: boolean }
    const promises: Promise<any>[] = [];
    for (const [permissionName, enabled] of Object.entries(permissions)) {
      if (typeof enabled === 'boolean') {
        promises.push(
          this.repo.updateCompanyPermission(companyId, permissionName, enabled),
        );
      }
    }

    // Invalidate caches
    await Promise.all(promises);
    await this.cacheManager.del(`${this.COMPANY_PERMISSIONS_KEY}${companyId}`);
    await this.cacheManager.del(this.ALL_COMPANIES_KEY);

    return this.getCompanyPermissions(companyId);
  }

  // Bulk create/update company permissions
  async bulkCreateCompanyPermissions(data: BulkCreateCompanyPermissionsDto) {
    if (!data.permissions || data.permissions.length === 0) {
      throw new Error('No permissions provided');
    }

    // Direct pass-through to repository
    const result = await this.repo.bulkCreateCompanyPermissions(data.permissions);

    // Invalidate all related caches
    const cacheKeys = [this.ALL_COMPANIES_KEY];
    const companyIds = [...new Set(data.permissions.map(p => p.companyId))];
    for (const companyId of companyIds) {
      cacheKeys.push(`${this.COMPANY_PERMISSIONS_KEY}${companyId}`);
    }
    
    await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));

    return {
      message: `Successfully processed ${result.length} permissions for ${companyIds.length} companies`,
      processedPermissions: result.length,
      affectedCompanies: companyIds.length,
    };
  }
}
