import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  const permissions = [
    {
      title: 'Communication Hub: Internal',
      permission_name: 'communicationHubInternal',
      status: true,
    },
    {
      title: 'Communication Hub: Clients',
      permission_name: 'communicationHubClients',
      status: true,
    },
    {
      title: 'Communication Hub: Collaboration',
      permission_name: 'communicationHubCollaboration',
      status: true,
    },
    { title: 'Calling Access', permission_name: 'callingAccess', status: true },
    {
      title: 'Estimates & Invoices',
      permission_name: 'estimateInvoices',
      status: true,
    },
    { title: 'Calendar & Task', permission_name: 'calendar', status: true },
    { title: 'Payments', permission_name: 'payments', status: true },
    { title: 'Directory', permission_name: 'directory', status: true },
    { title: 'Client', permission_name: 'clientDirectory', status: true },
    { title: 'Employee', permission_name: 'employeeDirectory', status: true },
    { title: 'Fleet', permission_name: 'fleetDirectory', status: false },
    {
      title: 'Reporting & Analytics',
      permission_name: 'reporting',
      status: true,
    },
    { title: 'Inventory', permission_name: 'inventory', status: true },
    { title: 'Integrations', permission_name: 'integrations', status: true },
    { title: 'All Automation', permission_name: 'automation', status: true },
    { title: 'Shop Pipeline', permission_name: 'shopPipeline', status: true },
    { title: 'Sales Pipeline', permission_name: 'salesPipeline', status: true },
    {
      title: 'Business Settings',
      permission_name: 'businessSettings',
      status: true,
    },
    { title: 'Communication', permission_name: 'communication', status: true },
    {
      title: 'Workforce Management',
      permission_name: 'workforceManagement',
      status: true,
    },
    {
      title: 'Service Estimator',
      permission_name: 'serviceEstimator',
      status: true,
    },
    {
      title: 'Pipeline Automation',
      permission_name: 'pipelineAutomation',
      status: true,
    },
    {
      title: 'Marketing Automation',
      permission_name: 'marketingAutomation',
      status: true,
    },
    {
      title: 'Communication Automation',
      permission_name: 'communicationAutomation',
      status: true,
    },
    {
      title: 'Invoice Automation',
      permission_name: 'invoiceAutomation',
      status: true,
    },
    {
      title: 'Inventory Automation',
      permission_name: 'inventoryAutomation',
      status: true,
    },
    {
      title: 'Service Automation',
      permission_name: 'serviceAutomation',
      status: true,
    },
  ];

  const companies = await prisma.company.findMany();

  for (const company of companies) {
    for (const perm of permissions) {
      try {
        await prisma.companyPermissionModule.upsert({
          where: {
            companyId_permission_name: {
              companyId: company.id,
              permission_name: perm.permission_name,
            },
          },
          update: {
            // Optional: update fields if needed
            title: perm.title,
            enabled: perm.status,
          },
          create: {
            companyId: company.id,
            title: perm.title,
            permission_name: perm.permission_name,
            enabled: perm.status,
          },
        });
      } catch (error) {
        console.error(
          `Failed to upsert permission '${perm.permission_name}' for company ${company.name}:`,
          error,
        );
      }
    }
    console.log(
      `Processed permissions for company: ${company.name} (ID: ${company.id})`,
    );
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
    console.log('Seed completed');
  });
