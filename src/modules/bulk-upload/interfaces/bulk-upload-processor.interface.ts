import { RowData, ProcessingResult } from '../dto/bulk-upload.dto';

export interface IBulkUploadProcessor {
  /**
   * Process the uploaded data
   * @param data Array of row data from the file
   * @param companyId Company ID
   * @returns Processing result with success/failure counts
   */
  process(data: RowData[], companyId: number): Promise<ProcessingResult>;
}
