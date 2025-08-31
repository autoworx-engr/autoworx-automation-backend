export interface YearsQueryParams {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  make_model_id?: string;
  make_id?: string;
  description?: string;
  json?: string;
}

export type YearsResponse = number[];
