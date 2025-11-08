import { z } from 'zod';
import type { Company } from './company';
import type { QuarterlyFinancials } from './financials';
import type { SearchResult } from './search';

// Generic API response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.string(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
};

// Paginated response
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  });

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// API Error types
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// Company API responses
export type CompanyListResponse = ApiResponse<PaginatedResponse<Company>>;
export type CompanyDetailResponse = ApiResponse<
  Company & { quarterlyData: QuarterlyFinancials[] }
>;
export type SearchResponse = ApiResponse<SearchResult[]>;

// Request validation schemas
export const CompanyQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sector: z.string().optional(),
  sortBy: z
    .enum(['name', 'ticker', 'marketCap', 'lastUpdated'])
    .default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CompanyQuery = z.infer<typeof CompanyQuerySchema>;
