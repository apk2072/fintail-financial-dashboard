"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyQuerySchema = exports.ApiErrorSchema = exports.PaginatedResponseSchema = exports.ApiResponseSchema = void 0;
const zod_1 = require("zod");
// Generic API response wrapper
const ApiResponseSchema = (dataSchema) => zod_1.z.object({
    success: zod_1.z.boolean(),
    data: dataSchema.optional(),
    error: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
    timestamp: zod_1.z.string(),
});
exports.ApiResponseSchema = ApiResponseSchema;
// Paginated response
const PaginatedResponseSchema = (itemSchema) => zod_1.z.object({
    items: zod_1.z.array(itemSchema),
    total: zod_1.z.number(),
    page: zod_1.z.number(),
    limit: zod_1.z.number(),
    hasNext: zod_1.z.boolean(),
    hasPrev: zod_1.z.boolean(),
});
exports.PaginatedResponseSchema = PaginatedResponseSchema;
// API Error types
exports.ApiErrorSchema = zod_1.z.object({
    code: zod_1.z.string(),
    message: zod_1.z.string(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// Request validation schemas
exports.CompanyQuerySchema = zod_1.z.object({
    page: zod_1.z.number().min(1).default(1),
    limit: zod_1.z.number().min(1).max(100).default(20),
    sector: zod_1.z.string().optional(),
    sortBy: zod_1.z
        .enum(['name', 'ticker', 'marketCap', 'lastUpdated'])
        .default('name'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
