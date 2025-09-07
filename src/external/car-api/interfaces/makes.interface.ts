export interface Make {
  id: number;
  name: string;
  niceName: string;
  created?: string;
  updated?: string;
}

export interface MakesQueryParams {
  sort?: string;
  make?: string;
  year?: string;
}

export interface MakesResponse {
  makes: Make[];
}
