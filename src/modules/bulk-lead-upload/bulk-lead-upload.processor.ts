import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';
import { LeadRowDto } from './dto/create-bulk-lead-upload.dto';

interface BulkLeadJobData {
  leads: LeadRowDto[];
  companyId: number;
  columnId?: number;
}

@Processor('bulk-lead-upload')
export class BulkLeadUploadProcessor {
  private readonly logger = new Logger(BulkLeadUploadProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  private parseVehicleInfo(vehicleStr: string): {
    year: number | null;
    make: string | null;
    model: string | null;
  } {
    // Expected formats: 
    // - "2002 toyota test" (space-separated)
    // - "2002-toyota-test" (dash-separated)
    // Try space-separated first, then dash-separated
    let parts = vehicleStr.trim().split(/\s+/);
    if (parts.length === 1) {
      // If no spaces, try dash-separated
      parts = vehicleStr.split('-').map(p => p.trim());
    }
    
    const result = {
      year: null as number | null,
      make: null as string | null,
      model: null as string | null,
    };

    if (parts.length >= 1) {
      // Try to parse year from first part
      const yearNum = parseInt(parts[0]);
      if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100) {
        result.year = yearNum;
        // If first part is year, next parts are make and model
        if (parts.length >= 2) result.make = parts[1];
        if (parts.length >= 3) result.model = parts.slice(2).join(' ');
      } else {
        // If first part is not year, assume format is make-model-year or just make-model
        result.make = parts[0];
        if (parts.length >= 2) {
          // Check if last part is year
          const lastYearNum = parseInt(parts[parts.length - 1]);
          if (!isNaN(lastYearNum) && lastYearNum >= 1900 && lastYearNum <= 2100) {
            result.year = lastYearNum;
            result.model = parts.slice(1, -1).join(' ');
          } else {
            result.model = parts.slice(1).join(' ');
          }
        }
      }
    }

    return result;
  }

  @Process('process-bulk-leads')
  async handleBulkLeadUpload(job: Job<BulkLeadJobData>) {
    const { leads, companyId, columnId } = job.data;
    this.logger.log(
      `Processing bulk lead upload for company ${companyId} with ${leads.length} leads`,
    );

    const results = {
      total: leads.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data: LeadRowDto }>,
    };

    for (let i = 0; i < leads.length; i++) {
      try {
        const leadData = leads[i];
        
        // Update progress
        const progress = Math.round(((i + 1) / leads.length) * 100);
        await job.progress(progress);

        // Check if company exists
        const company = await this.prisma.company.findUnique({
          where: { id: companyId },
        });

        if (!company) {
          results.errors.push({
            row: i + 1,
            error: 'Company not found',
            data: leadData,
          });
          results.failed++;
          continue;
        }

        // Parse name into firstName and lastName
        const nameParts = leadData.name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // Step 1: Check if client with this phone already exists (phone must be unique)
        if (leadData.contact) {
          const existingClientByPhone = await this.prisma.client.findFirst({
            where: {
              companyId: companyId,
              mobile: leadData.contact,
            },
          });

          // If client with this phone exists, skip this row
          if (existingClientByPhone) {
            this.logger.warn(
              `Client with phone ${leadData.contact} already exists, skipping row ${i + 1}`,
            );
            results.failed++;
            results.errors.push({
              row: i + 1,
              error: 'Client with this phone number already exists',
              data: leadData,
            });
            continue;
          }
        }

        // Step 2: Create client
        const client = await this.prisma.client.create({
          data: {
            firstName: firstName,
            lastName: lastName || null,
            email: leadData.email || null,
            mobile: leadData.contact || null,
            companyId: companyId,
            createdAt: leadData.created_at ? new Date(leadData.created_at) : new Date(),
          },
        });
        this.logger.debug(`Created client ${client.id} for ${leadData.name}`);

        // Step 3: Parse and create/find vehicle
        this.logger.debug(`Vehicle data from CSV: "${leadData.vehicle}"`);
        let vehicleId: number | undefined;
        if (leadData.vehicle && leadData.vehicle.trim()) {
          const vehicleInfo = this.parseVehicleInfo(leadData.vehicle);
          this.logger.debug(`Parsed vehicle info: ${JSON.stringify(vehicleInfo)}`);
          
          if (vehicleInfo.year || vehicleInfo.make || vehicleInfo.model) {
            // Check if vehicle exists for this client
            const existingVehicle = await this.prisma.vehicle.findFirst({
              where: {
                clientId: client.id,
                companyId: companyId,
                year: vehicleInfo.year,
                make: vehicleInfo.make,
                model: vehicleInfo.model,
              },
            });

            if (existingVehicle) {
              vehicleId = existingVehicle.id;
              this.logger.debug(`Found existing vehicle ${vehicleId}`);
            } else {
              // Create new vehicle
              const vehicle = await this.prisma.vehicle.create({
                data: {
                  year: vehicleInfo.year,
                  make: vehicleInfo.make,
                  model: vehicleInfo.model,
                  clientId: client.id,
                  companyId: companyId,
                },
              });
              vehicleId = vehicle.id;
              this.logger.debug(`Created vehicle ${vehicleId} for client ${client.id}`);
            }
          } else {
            this.logger.warn(`Could not parse vehicle info from: ${leadData.vehicle}`);
          }
        }

        // Step 4: Create the lead
        const leadData_create: any = {
          clientName: leadData.name,
          clientEmail: leadData.email || null,
          clientPhone: leadData.contact || null,
          vehicleInfo: leadData.vehicle || 'No vehicle info',
          services: '', // Nullable as requested
          source: leadData.source || 'Bulk Upload',
          comments: `Imported from bulk upload${leadData.created_at ? ` (original date: ${leadData.created_at})` : ''}`,
          companyId: companyId,
          isLead: true,
          isQualified: true,
          clientId: client.id,
          createdAt: leadData.created_at ? new Date(leadData.created_at) : new Date(),
        };

        // Only add vehicleId if it exists
        if (vehicleId) {
          leadData_create.vehicleId = vehicleId;
        }

        const lead = await this.prisma.lead.create({
          data: leadData_create,
        });

        // Update client with leadId to establish the relationship
        await this.prisma.client.update({
          where: { id: client.id },
          data: { leadId: lead.id },
        });

        this.logger.debug(
          `Created lead ${lead.id} for ${leadData.name}, linked to client ${client.id}${vehicleId ? ` and vehicle ${vehicleId}` : ''}`,
        );
        results.successful++;
      } catch (error) {
        this.logger.error(
          `Failed to process lead at row ${i + 1}: ${error.message}`,
        );
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: leads[i],
        });
        results.failed++;
      }
    }

    this.logger.log(
      `Bulk lead upload completed. Success: ${results.successful}, Failed: ${results.failed}`,
    );

    return results;
  }
}
