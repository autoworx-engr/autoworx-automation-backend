import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MakesQueryParams, MakesResponse } from './interfaces/makes.interface';
import {
  ModelsQueryParams,
  ModelsResponse,
} from './interfaces/models.interface';
import { YearsQueryParams, YearsResponse } from './interfaces/years.interface';

@Injectable()
export class CarApiService {
  private readonly logger = new Logger(CarApiService.name);
  private readonly baseUrl = 'https://carapi.app';
  private jwtToken: string = '';
  private apiToken: string;
  private apiSecret: string;
  private isRefreshing = false;

  // Cache TTL constants
  private readonly JWT_TOKEN_CACHE_KEY = 'car_api_jwt_token';
  private readonly JWT_CACHE_TTL = 86400000; // 1 day in milliseconds
  private readonly DATA_CACHE_TTL = 604800000; // 7 days in milliseconds

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.apiToken = this.configService.get<string>('CAR_API_TOKEN') || '';
    this.apiSecret = this.configService.get<string>('CAR_API_SECRET') || '';

    if (!this.apiToken || !this.apiSecret) {
      this.logger.error('Car API credentials are not properly configured');
    }
  }

  private getHeaders() {
    return {
      Accept: 'application/json',
      Authorization: this.jwtToken ? `Bearer ${this.jwtToken}` : '',
    };
  }

  private async getJwtToken(): Promise<string> {
    // Try to get token from cache first
    const cachedToken = await this.cacheManager.get<string>(
      this.JWT_TOKEN_CACHE_KEY,
    );
    if (cachedToken) {
      this.jwtToken = cachedToken;
      return this.jwtToken;
    }

    // If we already have a token in memory, return it
    if (this.jwtToken) {
      // Cache it for next time
      await this.cacheManager.set(
        this.JWT_TOKEN_CACHE_KEY,
        this.jwtToken,
        this.JWT_CACHE_TTL,
      );
      return this.jwtToken;
    }

    // Otherwise, generate a new one
    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    if (this.isRefreshing) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.jwtToken;
    }

    this.isRefreshing = true;
    try {
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.baseUrl}/api/auth/login`, {
            api_token: this.apiToken,
            api_secret: this.apiSecret,
          })
          .pipe(
            map((response) => response.data),
            catchError((error) => {
              if (error.response) {
                this.logger.error(
                  `Failed to generate token - Status: ${error.response.status}`,
                  error.response.data,
                );
              } else {
                this.logger.error('Failed to generate token', error.message);
              }

              return throwError(
                () =>
                  new ServiceUnavailableException(
                    'Failed to generate authentication token',
                  ),
              );
            }),
          ),
      );

      // Handle both possible response formats
      if (typeof response === 'string') {
        this.jwtToken = response;
      } else if (
        response &&
        typeof response === 'object' &&
        'token' in response
      ) {
        this.jwtToken = response.token;
      } else {
        throw new ServiceUnavailableException(
          'Invalid authentication response format from Car API',
        );
      }

      // Cache the token
      if (this.jwtToken) {
        await this.cacheManager.set(
          this.JWT_TOKEN_CACHE_KEY,
          this.jwtToken,
          this.JWT_CACHE_TTL,
        );
      } else {
        throw new ServiceUnavailableException(
          'Empty JWT token received from Car API',
        );
      }

      return this.jwtToken;
    } finally {
      this.isRefreshing = false;
    }
  }

  private handleError(error: any, retryFn?: () => Promise<any>) {
    if (error.response) {
      const { status, data } = error.response;

      // Handle 401 with token refresh and retry
      if (status === 401 && retryFn) {
        // Clear the current token from both memory and cache
        this.jwtToken = '';
        this.cacheManager.del(this.JWT_TOKEN_CACHE_KEY);
        return this.refreshToken().then(() => retryFn());
      }

      // Handle 403 specifically for deprecated endpoints
      if (status === 403 && data?.exception === 'DeprecatedException') {
        this.logger.warn(`API endpoint deprecated: ${data?.message}`);
      }

      switch (status) {
        case 400:
          return throwError(
            () => new BadRequestException(data?.message || 'Invalid request'),
          );
        case 401:
          return throwError(
            () =>
              new BadRequestException(
                'Authentication failed - JWT token may be invalid or expired',
              ),
          );
        case 403:
          return throwError(
            () => new BadRequestException(data?.message || 'Forbidden'),
          );
        case 429:
          return throwError(
            () =>
              new BadRequestException(
                'Too many requests - rate limit exceeded',
              ),
          );
        default:
          return throwError(
            () =>
              new ServiceUnavailableException('Car API service unavailable'),
          );
      }
    }

    return throwError(
      () => new ServiceUnavailableException('Failed to connect to Car API'),
    );
  }

  async getMakes(queryParams?: MakesQueryParams): Promise<MakesResponse> {
    // Try to get cached data first
    const cacheKey = `car_api_makes:${JSON.stringify(queryParams || {})}`;
    const cachedData = await this.cacheManager.get<string>(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const makeRequest = async () => {
      await this.getJwtToken();

      const response = await firstValueFrom(
        this.httpService
          .get<MakesResponse>(`${this.baseUrl}/api/makes`, {
            headers: this.getHeaders(),
            params: queryParams,
          })
          .pipe(
            map((response: any) => response.data),
            catchError((error) =>
              this.handleError(error, () => this.getMakes(queryParams)),
            ),
          ),
      );

      // Cache the response
      await this.cacheManager.set(
        cacheKey,
        JSON.stringify(response),
        this.DATA_CACHE_TTL,
      );
      return response;
    };

    return makeRequest();
  }

  async getModels(queryParams?: ModelsQueryParams): Promise<ModelsResponse> {
    // Try to get cached data first
    const cacheKey = `car_api_models:${JSON.stringify(queryParams || {})}`;
    const cachedData = await this.cacheManager.get<string>(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const makeRequest = async () => {
      await this.getJwtToken();

      const response = await firstValueFrom(
        this.httpService
          .get<ModelsResponse>(`${this.baseUrl}/api/models/v2`, {
            headers: this.getHeaders(),
            params: queryParams,
          })
          .pipe(
            map((response: any) => response.data),
            catchError((error) =>
              this.handleError(error, () => this.getModels(queryParams)),
            ),
          ),
      );

      // Cache the response
      await this.cacheManager.set(
        cacheKey,
        JSON.stringify(response),
        this.DATA_CACHE_TTL,
      );
      return response;
    };

    return makeRequest();
  }

  async getYears(queryParams?: YearsQueryParams): Promise<YearsResponse> {
    // Try to get cached data first
    const cacheKey = `car_api_years:${JSON.stringify(queryParams || {})}`;
    const cachedData = await this.cacheManager.get<string>(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const makeRequest = async () => {
      await this.getJwtToken();

      const response = await firstValueFrom(
        this.httpService
          .get<YearsResponse>(`${this.baseUrl}/api/years`, {
            headers: this.getHeaders(),
            params: queryParams,
          })
          .pipe(
            map((response: any) => response.data),
            catchError((error) =>
              this.handleError(error, () => this.getYears(queryParams)),
            ),
          ),
      );

      // Cache the response
      await this.cacheManager.set(
        cacheKey,
        JSON.stringify(response),
        this.DATA_CACHE_TTL,
      );
      return response;
    };

    return makeRequest();
  }

  // Method to invalidate all car API caches
  async invalidateAllCaches(): Promise<void> {
    await this.cacheManager.del(this.JWT_TOKEN_CACHE_KEY);
    // Additional pattern-based deletion could be implemented if your cache manager supports it
    this.logger.log('Car API caches invalidated');
  }
}
