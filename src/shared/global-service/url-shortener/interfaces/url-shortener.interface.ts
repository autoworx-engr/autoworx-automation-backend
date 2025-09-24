export interface CreateShortLinkOptions {
  originalUrl: string;
  title?: string;
  description?: string;
  customCode?: string;
  expiresAt?: Date;
  createdBy?: number;
  companyId?: number;
}

export interface ShortLinkStats {
  id: number;
  shortCode: string;
  originalUrl: string;
  title?: string | null;
  clicks: number;
  isActive: boolean;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface ShortLinkResponse {
  success: boolean;
  shortCode?: string;
  shortUrl?: string;
  error?: string;
}

export interface GetShortLinkResponse {
  success: boolean;
  originalUrl?: string;
  error?: string;
}

export interface ShortLinkStatsResponse {
  success: boolean;
  data?: ShortLinkStats;
  error?: string;
}

export interface ListShortLinksResponse {
  success: boolean;
  data?: ShortLinkStats[];
  total?: number;
  error?: string;
}

export interface UpdateShortLinkResponse {
  success: boolean;
  error?: string;
}

export interface DeleteShortLinkResponse {
  success: boolean;
  error?: string;
}
