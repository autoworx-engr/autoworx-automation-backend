import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { nanoid } from 'nanoid';
import {
  CreateShortLinkOptions,
  ShortLinkResponse,
  GetShortLinkResponse,
  ShortLinkStatsResponse,
  ListShortLinksResponse,
  UpdateShortLinkResponse,
  DeleteShortLinkResponse,
  ShortLinkStats,
} from './interfaces/url-shortener.interface';

@Injectable()
export class UrlShortenerService {
  private readonly logger = new Logger(UrlShortenerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a unique short code for URLs
   */
  private generateShortCode(length: number = 6): string {
    // Use only URL-safe characters: letters and numbers
    const alphabet =
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return nanoid(length).replace(
      /[^a-zA-Z0-9]/g,
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    );
  }

  /**
   * Creates a new short link or returns existing one if URL already exists
   */
  async createShortLink(
    options: CreateShortLinkOptions,
  ): Promise<ShortLinkResponse> {
    try {
      // Validate URL
      try {
        new URL(options.originalUrl);
      } catch {
        return { success: false, error: 'Invalid URL provided' };
      }

      // Check if original URL already exists
      const existingUrl = await this.prisma.shortLink.findUnique({
        where: { originalUrl: options.originalUrl },
      });

      if (existingUrl) {
        // Return existing short link
        const shortUrl = `${process.env.FRONTEND_URL}/s/${existingUrl.shortCode}`;

        return {
          success: true,
          shortCode: existingUrl.shortCode,
          shortUrl,
        };
      }

      let shortCode = options.customCode;

      // Generate unique short code if not provided
      if (!shortCode) {
        let attempts = 0;
        const maxAttempts = 10;

        do {
          shortCode = this.generateShortCode();
          attempts++;

          // Check if code already exists
          const existing = await this.prisma.shortLink.findUnique({
            where: { shortCode },
          });

          if (!existing) break;

          if (attempts >= maxAttempts) {
            return {
              success: false,
              error: 'Unable to generate unique short code',
            };
          }
        } while (true);
      } else {
        // Check if custom code is available
        const existing = await this.prisma.shortLink.findUnique({
          where: { shortCode },
        });

        if (existing) {
          return { success: false, error: 'Custom short code already exists' };
        }
      }

      // Create the short link
      const shortLink = await this.prisma.shortLink.create({
        data: {
          shortCode,
          originalUrl: options.originalUrl,
          title: options.title,
          description: options.description,
          expiresAt: options.expiresAt,
          createdBy: options.createdBy,
          companyId: options.companyId,
        },
      });
      
      const shortUrl = `${process.env.FRONTEND_URL}/s/${shortCode}`;

      return {
        success: true,
        shortCode,
        shortUrl,
      };
    } catch (error) {
      this.logger.error('Error creating short link:', error);
      return { success: false, error: 'Failed to create short link' };
    }
  }

  /**
   * Get short link without incrementing click countk
   */
  async getShortLinkInfo(shortCode: string): Promise<GetShortLinkResponse> {
    try {
      const shortLink = await this.prisma.shortLink.findUnique({
        where: { shortCode },
      });

      if (!shortLink) {
        return { success: false, error: 'Short link not found' };
      }

      if (!shortLink.isActive) {
        return { success: false, error: 'Short link is disabled' };
      }

      if (shortLink.expiresAt && shortLink.expiresAt < new Date()) {
        return { success: false, error: 'Short link has expired' };
      }

      return {
        success: true,
        originalUrl: shortLink.originalUrl,
      };
    } catch (error) {
      this.logger.error('Error retrieving short link:', error);
      return { success: false, error: 'Failed to retrieve short link' };
    }
  }

  /**
   * Retrieves and tracks a short link click
   */
  async getShortLink(shortCode: string): Promise<GetShortLinkResponse> {
    try {
      const shortLink = await this.prisma.shortLink.findUnique({
        where: { shortCode },
      });

      if (!shortLink) {
        return { success: false, error: 'Short link not found' };
      }

      if (!shortLink.isActive) {
        return { success: false, error: 'Short link is disabled' };
      }

      if (shortLink.expiresAt && shortLink.expiresAt < new Date()) {
        return { success: false, error: 'Short link has expired' };
      }

      // Increment click count
      await this.prisma.shortLink.update({
        where: { id: shortLink.id },
        data: { clicks: { increment: 1 } },
      });

      return {
        success: true,
        originalUrl: shortLink.originalUrl,
      };
    } catch (error) {
      this.logger.error('Error retrieving short link:', error);
      return { success: false, error: 'Failed to retrieve short link' };
    }
  }

  /**
   * Get short link statistics
   */
  async getShortLinkStats(shortCode: string): Promise<ShortLinkStatsResponse> {
    try {
      const shortLink = await this.prisma.shortLink.findUnique({
        where: { shortCode },
        select: {
          id: true,
          shortCode: true,
          originalUrl: true,
          title: true,
          clicks: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      if (!shortLink) {
        return { success: false, error: 'Short link not found' };
      }

      return {
        success: true,
        data: shortLink,
      };
    } catch (error) {
      this.logger.error('Error getting short link stats:', error);
      return { success: false, error: 'Failed to get statistics' };
    }
  }

  /**
   * Update short link
   */
  async updateShortLink(
    shortCode: string,
    updates: {
      title?: string;
      description?: string;
      isActive?: boolean;
      expiresAt?: Date | null;
    },
  ): Promise<UpdateShortLinkResponse> {
    try {
      await this.prisma.shortLink.update({
        where: { shortCode },
        data: updates,
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error updating short link:', error);
      return { success: false, error: 'Failed to update short link' };
    }
  }

  /**
   * Delete short link
   */
  async deleteShortLink(shortCode: string): Promise<DeleteShortLinkResponse> {
    try {
      await this.prisma.shortLink.delete({
        where: { shortCode },
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting short link:', error);
      return { success: false, error: 'Failed to delete short link' };
    }
  }

  /**
   * List short links for a user or company
   */
  async listShortLinks(filters: {
    createdBy?: number;
    companyId?: number;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ListShortLinksResponse> {
    try {
      const where: any = {};

      if (filters.createdBy !== undefined) where.createdBy = filters.createdBy;
      if (filters.companyId !== undefined) where.companyId = filters.companyId;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;

      const [shortLinks, total] = await Promise.all([
        this.prisma.shortLink.findMany({
          where,
          select: {
            id: true,
            shortCode: true,
            originalUrl: true,
            title: true,
            clicks: true,
            isActive: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: filters.limit || 50,
          skip: filters.offset || 0,
        }),
        this.prisma.shortLink.count({ where }),
      ]);

      return {
        success: true,
        data: shortLinks,
        total,
      };
    } catch (error) {
      this.logger.error('Error listing short links:', error);
      return { success: false, error: 'Failed to list short links' };
    }
  }
}
