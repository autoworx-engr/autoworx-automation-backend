import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AdminPermissionService } from './admin-permission.service';
import { UpdateCompanyPermissionsDto, BulkCreateCompanyPermissionsDto } from './dto/admin-permission.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { AuthUser, User } from 'src/modules/auth/decorators/user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

// TODO: Add proper authentication guards for super admin
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/permissions')
export class AdminPermissionController {
  constructor(
    private readonly adminPermissionService: AdminPermissionService,
  ) {}

  // Get all companies with their permissions
  @Get('companies')
  async getAllCompaniesWithPermissions(@User() user: AuthUser) {
    if (!user.isSuperAdmin) {
      throw new HttpException('Not Super Admin', HttpStatus.FORBIDDEN);
    }
    return this.adminPermissionService.getAllCompaniesWithPermissions();
  }

  // Get specific company permissions
  @Get('companies/:companyId')
  async getCompanyPermissions(
    @Param('companyId', ParseIntPipe) companyId: number,
    @User() user: AuthUser,
  ) {
    // if (!user.isSuperAdmin) {
    //   throw new HttpException('Not Super Admin', HttpStatus.FORBIDDEN);
    // }
    // console.log(this.adminPermissionService.getCompanyPermissions(companyId));

    return this.adminPermissionService.getCompanyPermissions(companyId);
  }

  // Toggle/Update company permissions
  @Put('companies/:companyId')
  async updateCompanyPermissions(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() updateDto: UpdateCompanyPermissionsDto,
    @User() user: AuthUser,
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpException('Not Super Admin', HttpStatus.FORBIDDEN);
    }
    return this.adminPermissionService.updateCompanyPermissions(
      companyId,
      updateDto,
    );
  }

  // Bulk create/update company permissions
  @Post('companies/bulk')
  async bulkCreateCompanyPermissions(
    @Body() bulkDto: BulkCreateCompanyPermissionsDto,
  ) {
    return this.adminPermissionService.bulkCreateCompanyPermissions(bulkDto);
  }
}
