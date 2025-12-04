import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as XLSX from 'xlsx';
import {
  BulkLeadUploadResponseDto,
  LeadRowDto,
} from './dto/create-bulk-lead-upload.dto';

@Injectable()
export class BulkLeadUploadService {
  constructor(
    @InjectQueue('bulk-lead-upload')
    private readonly bulkLeadQueue: Queue,
  ) {}

  async processFile(
    file: Express.Multer.File,
    companyId: number,
  ): Promise<BulkLeadUploadResponseDto> {
    try {
      const leads = await this.parseFile(file);

      if (leads.length === 0) {
        throw new BadRequestException('No valid data found in file');
      }

      // Add job to queue
      const job = await this.bulkLeadQueue.add('process-bulk-leads', {
        leads,
        companyId,
      });

      return {
        jobId: job.id.toString(),
        message: 'File uploaded successfully. Processing in background.',
        totalRecords: leads.length,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to process file: ${error.message}`,
      );
    }
  }

  private async parseFile(file: Express.Multer.File): Promise<LeadRowDto[]> {
    const leads: LeadRowDto[] = [];

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);

      for (const row of data) {
        // Parse the data based on expected columns
        const lead: LeadRowDto = {
          name: row['name'] || row['Name'] || '',
          email: row['email'] || row['Email'] || '',
          contact: String(row['contact'] || row['Contact'] || ''),
          vehicle: row['vehicle(year make model)'] || row['vehicle(year-make-model)'] || row['vehicle'] || row['Vehicle'] || '',
          source: row['source'] || row['Source'] || 'Bulk Upload',
          created_at: row['created_at'] || row['Created At'] || '',
        };

        // Only add if name exists
        if (lead.name && lead.name.trim()) {
          leads.push(lead);
        }
      }

      return leads;
    } catch (error) {
      throw new Error(`Failed to parse file: ${error.message}`);
    }
  }

  async getJobStatus(jobId: string) {
    const job = await this.bulkLeadQueue.getJob(jobId);

    if (!job) {
      throw new BadRequestException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress();
    const failedReason = job.failedReason;

    return {
      jobId: job.id,
      state,
      progress,
      failedReason,
      data: job.data,
      returnvalue: job.returnvalue,
    };
  }
}
