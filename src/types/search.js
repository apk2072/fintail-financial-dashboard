"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchQuerySchema = exports.SearchResultSchema = exports.SearchIndexSchema = void 0;
const zod_1 = require("zod");
// Search index interface for DynamoDB
exports.SearchIndexSchema = zod_1.z.object({
    PK: zod_1.z.string(), // "SEARCH#${normalizedTerm}"
    SK: zod_1.z.string(), // "COMPANY#${ticker}"
    searchTerm: zod_1.z.string(),
    companyName: zod_1.z.string(),
    ticker: zod_1.z.string(),
    relevanceScore: zod_1.z.number(),
});
// Search result interface
exports.SearchResultSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    ticker: zod_1.z.string(),
    sector: zod_1.z.string(),
    marketCap: zod_1.z.number(),
    relevanceScore: zod_1.z.number().optional(),
});
// Search query interface
exports.SearchQuerySchema = zod_1.z.object({
    query: zod_1.z.string().min(1),
    limit: zod_1.z.number().min(1).max(50).default(10),
    offset: zod_1.z.number().min(0).default(0),
});
