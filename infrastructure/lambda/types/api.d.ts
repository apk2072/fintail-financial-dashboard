import { z } from 'zod';
import type { Company } from './company';
import type { QuarterlyFinancials } from './financials';
import type { SearchResult } from './search';
export declare const ApiResponseSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type ApiResponse<T> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
};
export declare const PaginatedResponseSchema: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    items: z.ZodArray<T>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    limit: z.ZodNumber;
    hasNext: z.ZodBoolean;
    hasPrev: z.ZodBoolean;
}, z.core.$strip>;
export type PaginatedResponse<T> = {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
};
export declare const ApiErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type CompanyListResponse = ApiResponse<PaginatedResponse<Company>>;
export type CompanyDetailResponse = ApiResponse<Company & {
    quarterlyData: QuarterlyFinancials[];
}>;
export type SearchResponse = ApiResponse<SearchResult[]>;
export declare const CompanyQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sector: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<{
        name: "name";
        ticker: "ticker";
        lastUpdated: "lastUpdated";
        marketCap: "marketCap";
    }>>;
    sortOrder: z.ZodDefault<z.ZodEnum<{
        asc: "asc";
        desc: "desc";
    }>>;
}, z.core.$strip>;
export type CompanyQuery = z.infer<typeof CompanyQuerySchema>;
