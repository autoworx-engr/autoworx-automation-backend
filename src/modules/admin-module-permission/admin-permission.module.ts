import { Module } from '@nestjs/common';
import { AdminPermissionController } from './admin-permission.controller';
import { AdminPermissionService } from './admin-permission.service';
import { AdminPermissionRepository } from './admin-permission.repository';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminPermissionController],
  providers: [AdminPermissionService, AdminPermissionRepository],
  exports: [AdminPermissionService],
})
export class AdminPermissionModule {}
