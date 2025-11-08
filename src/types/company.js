"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyRecordSchema = exports.CompanySchema = void 0;
const zod_1 = require("zod");
// Company interface based on design document
exports.CompanySchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    ticker: zod_1.z.string(),
    sector: zod_1.z.string(),
    industry: zod_1.z.string().optional(),
    marketCap: zod_1.z.number(),
    employees: zod_1.z.number().optional(),
    founded: zod_1.z.number().optional(),
    headquarters: zod_1.z.string().optional(),
    website: zod_1.z.string().url().optional(),
    description: zod_1.z.string().optional(),
    lastUpdated: zod_1.z.string(),
});
// Company record for DynamoDB storage
exports.CompanyRecordSchema = zod_1.z.object({
    PK: zod_1.z.string(), // "COMPANY#${ticker}"
    SK: zod_1.z.string(), // "METADATA"
    name: zod_1.z.string(),
    ticker: zod_1.z.string(),
    sector: zod_1.z.string(),
    industry: zod_1.z.string().optional(),
    marketCap: zod_1.z.number(),
    employees: zod_1.z.number().optional(),
    founded: zod_1.z.number().optional(),
    headquarters: zod_1.z.string().optional(),
    website: zod_1.z.string().url().optional(),
    description: zod_1.z.string().optional(),
    lastUpdated: zod_1.z.string(),
    GSI1PK: zod_1.z.string(), // "SECTOR#${sector}"
    GSI1SK: zod_1.z.string(), // "COMPANY#${name}"
});
