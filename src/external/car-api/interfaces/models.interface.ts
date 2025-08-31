export interface Model {
  id: number;
  make_id: number;
  name: string;
  niceName?: string;
  year?: number;
  make?: string; // When verbose=yes
  created?: string;
  updated?: string;
}

export interface ModelsQueryParams {
  sort?: string;
  verbose?: string;
  year?: string;
  make?: string;
  model?: string;
  make_id?: string;
  json?: string;
}

export interface ModelsResponse {
  models: Model[];
}
