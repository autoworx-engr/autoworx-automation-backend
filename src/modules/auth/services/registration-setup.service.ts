import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class RegistrationSetupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create all default company setup - matches your Next.js logic exactly
   */
  async createDefaultCompanySetup(
    companyId: number,
    userId: number,
    employeeType: string,
  ) {
    try {
      // Create default permissions for the company (exactly like your Next.js)
      await Promise.all([
        this.prisma.permissionForManager.create({
          data: { companyId },
        }),
        this.prisma.permissionForSales.create({
          data: { companyId },
        }),
        this.prisma.permissionForTechnician.create({
          data: { companyId },
        }),
        this.prisma.permissionForOther.create({
          data: { companyId },
        }),
      ]);

      // Create default calendar settings (exactly like your Next.js)
      await this.prisma.calendarSettings.create({
        data: {
          companyId,
          weekStart: 'Sunday',
          dayStart: '10:00',
          dayEnd: '18:00',
          weekend1: 'Saturday',
          weekend2: 'Sunday',
        },
      });

      // Create notification settings
      await this.createNotificationSettings(userId, employeeType, companyId);

      // Create default columns
      await this.insertDefaultColumns(companyId);

      // Insert preloaded data
      await this.insertPreloadedData(companyId);
    } catch (error) {
      console.log('Error creating default company setup:', error);
      // Continue without throwing - basic user creation succeeded
    }
  }

  /**
   * Create notification settings (matches uploadNotificationSettings)
   */
  private async createNotificationSettings(
    userId: number,
    employeeType: string,
    companyId: number,
  ) {
    try {
      // Check if notification settings already exist
      const findNotificationCount =
        await this.prisma.notificationSettingsV2.count({
          where: {
            userId,
            companyId,
          },
        });

      // Get default notification settings based on user role
      const notificationSettings =
        this.getDefaultNotificationSettings(employeeType);

      if (findNotificationCount === notificationSettings?.length) {
        return;
      } else if (findNotificationCount > notificationSettings?.length) {
        await this.prisma.notificationSettingsV2.deleteMany({
          where: {
            userId,
            companyId,
            notification_type: {
              notIn: notificationSettings.map(
                (notification) => notification.notification_type,
              ),
            },
          },
        });
        return;
      }

      await Promise.all(
        notificationSettings.map(async (notification) => {
          const findNotificationSetting =
            await this.prisma.notificationSettingsV2.findFirst({
              where: {
                userId,
                section: notification.section,
                notification_type: notification.notification_type,
              },
            });

          if (findNotificationSetting) {
            return;
          }

          await this.prisma.notificationSettingsV2.create({
            data: {
              userId,
              section: notification.section,
              notification_type: notification.notification_type,
              companyId,
              email_enabled: notification.email_enabled,
              push_enabled: notification.push_enabled,
            },
          });
        }),
      );
    } catch (error) {
      console.error('Error creating notification settings:', error);
    }
  }

  /**
   * Create default columns (matches insertDefaultColumns from Next.js)
   */
  private async insertDefaultColumns(companyId: number) {
    try {
      // Create default columns for both sales and shop types
      await Promise.all([
        this.createColumnsForType(companyId, 'sales'),
        this.createColumnsForType(companyId, 'shop'),
      ]);
    } catch (error) {
      console.error('Error creating default columns:', error);
    }
  }

  /**
   * Helper method to create columns for a specific type
   */
  private async createColumnsForType(companyId: number, type: string) {
    const defaultSalesColumn = [
      {
        title: 'New Leads',
        type: 'sales',
        order: 0,
        bgColor: '#E3F2FD',
        textColor: '#0D47A1',
      },
      {
        title: 'Ongoing',
        type: 'sales',
        order: 1,
        bgColor: '#BBDEFB',
        textColor: '#1976D2',
      },
      {
        title: 'Opportunity',
        type: 'sales',
        order: 2,
        bgColor: '#C8E6C9',
        textColor: '#2E7D32',
      },
      {
        title: 'Converted',
        type: 'sales',
        order: 3,
        bgColor: '#FFECB3',
        textColor: '#FFA000',
      },
      {
        title: 'Lead Lost',
        type: 'sales',
        order: 4,
        bgColor: '#CFD8DC',
        textColor: '#37474F',
      },
      {
        title: 'Follow Up',
        type: 'sales',
        order: 5,
        bgColor: '#D1C4E9',
        textColor: '#512DA8',
      },
    ];

    const defaultShopColumn = [
      {
        title: 'Pending',
        type: 'shop',
        order: 0,
        bgColor: '#FFFACD',
        textColor: '#FF8C00',
      },
      {
        title: 'In Progress',
        type: 'shop',
        order: 1,
        bgColor: '#FFEFD5',
        textColor: '#6C757D',
      },
      {
        title: 'Completed',
        type: 'shop',
        order: 2,
        bgColor: '#DDEEFF',
        textColor: '#004085',
      },
      {
        title: 'Delivered',
        type: 'shop',
        order: 3,
        bgColor: '#D4EDDA',
        textColor: '#155724',
      },
      {
        title: 'Re-Dos',
        type: 'shop',
        order: 4,
        bgColor: '#FFE0B2',
        textColor: '#EF6C00',
      },
      {
        title: 'Cancelled',
        type: 'shop',
        order: 5,
        bgColor: '#FFCDD2',
        textColor: '#C62828',
      },
    ];

    const allColumns = [...defaultSalesColumn, ...defaultShopColumn];
    const columnsFortypes = allColumns.filter((column) => column.type === type);

    const columnsWithCompany = columnsFortypes.map((column) => ({
      ...column,
      companyId,
    }));

    await this.prisma.column.createMany({
      data: columnsWithCompany,
      skipDuplicates: true,
    });
  }

  /**
   * Insert preloaded data (matches insertPreloadedData from Next.js)
   */
  private async insertPreloadedData(companyId: number) {
    try {
      // Basic preloaded categories
      const preloadedCategories = [
        { name: 'Vinyl Wrap' },
        { name: 'Window Tint' },
        { name: 'Paint Protection Film' },
        { name: 'Collision Repair' },
        { name: 'Audio/Electronics' },
        { name: 'General Maintenance' },
      ];

      // Insert preloaded categories
      const categories = await this.prisma.category.createMany({
        data: preloadedCategories.map((category) => ({
          ...category,
          companyId,
        })),
        skipDuplicates: true,
      });

      // Basic preloaded labor data
      const preloadedCannedLaborData = [
        {
          name: 'Wrap Installation',
          category: 'Vinyl Wrap',
          notes: null,
          hours: 1,
          charge: 100,
        },
        {
          name: 'Tint Installation',
          category: 'Window Tint',
          notes: null,
          hours: 1,
          charge: 100,
        },
        {
          name: 'PPF Installation',
          category: 'Paint Protection Film',
          notes: null,
          hours: 1,
          charge: 100,
        },
        {
          name: 'Body Repair',
          category: 'Collision Repair',
          notes: null,
          hours: 1,
          charge: 100,
        },
      ];

      // For labor, find/create category by name, then insert
      const laborRecords: any[] = [];
      for (const labor of preloadedCannedLaborData) {
        let existingCategory = await this.prisma.category.findFirst({
          where: {
            name: labor.category,
            companyId: companyId,
          },
        });

        if (!existingCategory) {
          existingCategory = await this.prisma.category.create({
            data: {
              name: labor.category,
              companyId,
            },
          });
        }

        laborRecords.push({
          name: labor.name,
          categoryId: existingCategory.id,
          notes: labor.notes,
          hours: labor.hours,
          charge: labor.charge,
          cannedLabor: true,
          companyId,
        });
      }

      const laborData = await this.prisma.labor.createMany({
        data: laborRecords,
        skipDuplicates: true,
      });

      // Basic preloaded service data
      const preloadedCannedServiceData = [
        { name: 'Full Wrap', category: 'Vinyl Wrap' },
        { name: 'Partial Wrap', category: 'Vinyl Wrap' },
        { name: 'Full Tint', category: 'Window Tint' },
        { name: 'Front PPF', category: 'Paint Protection Film' },
      ];

      const serviceRecords: any[] = [];
      for (const service of preloadedCannedServiceData) {
        let existingCategory = await this.prisma.category.findFirst({
          where: {
            name: service.category,
            companyId: companyId,
          },
        });
        if (!existingCategory) {
          existingCategory = await this.prisma.category.create({
            data: { name: service.category, companyId },
          });
        }

        serviceRecords.push({
          name: service.name,
          categoryId: existingCategory.id,
          companyId,
        });
      }

      const serviceData = await this.prisma.service.createMany({
        data: serviceRecords.map((record: any) => ({
          ...record,
          canned: true,
        })),
        skipDuplicates: true,
      });

      return { categories, laborData, serviceData };
    } catch (error) {
      console.error('Error inserting preloaded data:', error);
    }
  }

  /**
   * Get default notification settings based on employee type
   */
  private getDefaultNotificationSettings(userRole: string) {
    // Notification types with their allowed roles
    const notificationTypes = [
      {
        type: 'TASK_ASSIGNED',
        roles: ['Admin', 'Manager', 'Technician', 'Sales'],
      },
      {
        type: 'TASK_FINISHED',
        roles: ['Admin', 'Manager', 'Technician', 'Sales'],
      },
      {
        type: 'APPOINTMENT_CREATED',
        roles: ['Admin', 'Manager', 'Technician', 'Sales'],
      },
      {
        type: 'APPOINTMENT_UPDATED',
        roles: ['Admin', 'Manager', 'Technician', 'Sales'],
      },
      {
        type: 'APPOINTMENT_REMINDER',
        roles: ['Admin', 'Manager', 'Technician', 'Sales'],
      },
      {
        type: 'TASK_REMINDER',
        roles: ['Admin', 'Manager', 'Technician', 'Sales'],
      },
      { type: 'LEADS_GENERATED', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'LEADS_CLOSED', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'LEADS_ASSIGNED', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'STAGE', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'ESTIMATE_CREATED', roles: ['Admin', 'Manager'] },
      { type: 'INVOICE_CONVERTED', roles: ['Admin', 'Manager'] },
      { type: 'INVOICE_AUTHORIZED', roles: ['Admin', 'Manager'] },
      { type: 'PAYMENT_RECEIVED', roles: ['Admin', 'Manager'] },
      { type: 'WORK_ORDER_CREATED', roles: ['Admin', 'Manager'] },
      { type: 'WORK_ORDER_COMPLETED', roles: ['Admin', 'Manager'] },
      {
        type: 'INVENTORY_COMPLETELY_OUT',
        roles: ['Admin', 'Manager', 'Sales'],
      },
      { type: 'INVENTORY_NEWLY_ADDED', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'INVENTORY_LOW', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'JOB_COMPLETED', roles: ['Admin', 'Manager', 'Technician'] },
      { type: 'JOB_ASSIGNED', roles: ['Admin', 'Manager', 'Technician'] },
      {
        type: 'INTERNAL_MESSAGE_ALERT',
        roles: ['Admin', 'Manager', 'Sales', 'Technician'],
      },
      { type: 'CLIENT_MESSAGE_ALERT', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'CLIENT_CALL_ALERT', roles: ['Admin', 'Manager', 'Sales'] },
      { type: 'CLIENT_EMAIL_ALERT', roles: ['Admin', 'Manager', 'Sales'] },
      {
        type: 'COLLABORATION_MESSAGE_ALERT',
        roles: ['Admin', 'Manager', 'Sales'],
      },
    ];

    // Section mapping
    const sectionMapping: { [key: string]: string } = {
      TASK_ASSIGNED: 'CALENDAR_AND_TASK',
      TASK_FINISHED: 'CALENDAR_AND_TASK',
      TASK_REMINDER: 'CALENDAR_AND_TASK',
      APPOINTMENT_CREATED: 'CALENDAR_AND_TASK',
      APPOINTMENT_REMINDER: 'CALENDAR_AND_TASK',
      APPOINTMENT_UPDATED: 'CALENDAR_AND_TASK',
      LEADS_GENERATED: 'LEAD_GENERATED_AND_SALES_PIPELINE',
      LEADS_CLOSED: 'LEAD_GENERATED_AND_SALES_PIPELINE',
      LEADS_ASSIGNED: 'LEAD_GENERATED_AND_SALES_PIPELINE',
      STAGE: 'LEAD_GENERATED_AND_SALES_PIPELINE',
      ESTIMATE_CREATED: 'ESTIMATE_AND_INVOICE',
      INVOICE_CONVERTED: 'ESTIMATE_AND_INVOICE',
      INVOICE_AUTHORIZED: 'ESTIMATE_AND_INVOICE',
      PAYMENT_RECEIVED: 'PAYMENT',
      WORK_ORDER_CREATED: 'OPERATION_PIPELINE',
      WORK_ORDER_COMPLETED: 'OPERATION_PIPELINE',
      INVENTORY_COMPLETELY_OUT: 'INVENTORY',
      INVENTORY_NEWLY_ADDED: 'INVENTORY',
      INVENTORY_LOW: 'INVENTORY',
      JOB_COMPLETED: 'WORK_FORCE',
      JOB_ASSIGNED: 'WORK_FORCE',
      INTERNAL_MESSAGE_ALERT: 'COMMUNICATIONS',
      CLIENT_MESSAGE_ALERT: 'COMMUNICATIONS',
      CLIENT_CALL_ALERT: 'COMMUNICATIONS',
      CLIENT_EMAIL_ALERT: 'COMMUNICATIONS',
      COLLABORATION_MESSAGE_ALERT: 'COMMUNICATIONS',
    };

    // Filter notifications for the user's role
    const notificationSettings = notificationTypes.filter((notification) => {
      return notification.roles.includes(userRole);
    });

    // Map to the format expected by Prisma
    const notificationSettingsWithSection = notificationSettings.map(
      (notification) => {
        const { type } = notification;
        return {
          section: sectionMapping[type] as any,
          notification_type: type as any,
          email_enabled: false,
          push_enabled: false,
          text_enabled: false,
        };
      },
    );

    return notificationSettingsWithSection;
  }
}
