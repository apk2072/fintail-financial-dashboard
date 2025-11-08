"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialMetricsSchema = exports.QuarterlyFinancialsRecordSchema = exports.QuarterlyFinancialsSchema = void 0;
const zod_1 = require("zod");
// Quarterly financials interface based on design document
exports.QuarterlyFinancialsSchema = zod_1.z.object({
    quarter: zod_1.z.string(), // "2024-Q1"
    reportDate: zod_1.z.string(),
    netSales: zod_1.z.number(),
    totalRevenue: zod_1.z.number(),
    netIncome: zod_1.z.number(),
    eps: zod_1.z.number(), // Earnings per share
    operatingIncome: zod_1.z.number(),
    freeCashFlow: zod_1.z.number(),
    totalAssets: zod_1.z.number().optional(),
    totalDebt: zod_1.z.number().optional(),
    shareholderEquity: zod_1.z.number().optional(),
    sharesOutstanding: zod_1.z.number().optional(),
});
// DynamoDB record for quarterly financials
exports.QuarterlyFinancialsRecordSchema = zod_1.z.object({
    PK: zod_1.z.string(), // "COMPANY#${ticker}"
    SK: zod_1.z.string(), // "QUARTER#${year}#${quarter}"
    quarter: zod_1.z.string(), // "2024-Q1"
    reportDate: zod_1.z.string(),
    netSales: zod_1.z.number(),
    totalRevenue: zod_1.z.number(),
    netIncome: zod_1.z.number(),
    eps: zod_1.z.number(), // Earnings per share
    operatingIncome: zod_1.z.number(),
    freeCashFlow: zod_1.z.number(),
    totalAssets: zod_1.z.number().optional(),
    totalDebt: zod_1.z.number().optional(),
    shareholderEquity: zod_1.z.number().optional(),
    sharesOutstanding: zod_1.z.number().optional(),
});
// Financial metrics for display components
exports.FinancialMetricsSchema = zod_1.z.object({
    netSales: zod_1.z.number(),
    totalRevenue: zod_1.z.number(),
    netIncome: zod_1.z.number(),
    eps: zod_1.z.number(),
    operatingIncome: zod_1.z.number(),
    freeCashFlow: zod_1.z.number(),
    // Calculated fields for trends
    revenueGrowth: zod_1.z.number().optional(),
    incomeGrowth: zod_1.z.number().optional(),
    epsGrowth: zod_1.z.number().optional(),
});
