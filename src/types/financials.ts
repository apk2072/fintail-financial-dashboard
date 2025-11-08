import { z } from 'zod';

// Quarterly financials interface based on design document
export const QuarterlyFinancialsSchema = z.object({
  quarter: z.string(), // "2024-Q1"
  reportDate: z.string(),
  netSales: z.number(),
  totalRevenue: z.number(),
  netIncome: z.number(),
  eps: z.number(), // Earnings per share
  operatingIncome: z.number(),
  freeCashFlow: z.number(),
  totalAssets: z.number().optional(),
  totalDebt: z.number().optional(),
  shareholderEquity: z.number().optional(),
  sharesOutstanding: z.number().optional(),
});

export type QuarterlyFinancials = z.infer<typeof QuarterlyFinancialsSchema>;

// DynamoDB record for quarterly financials
export const QuarterlyFinancialsRecordSchema = z.object({
  PK: z.string(), // "COMPANY#${ticker}"
  SK: z.string(), // "QUARTER#${year}#${quarter}"
  quarter: z.string(), // "2024-Q1"
  reportDate: z.string(),
  netSales: z.number(),
  totalRevenue: z.number(),
  netIncome: z.number(),
  eps: z.number(), // Earnings per share
  operatingIncome: z.number(),
  freeCashFlow: z.number(),
  totalAssets: z.number().optional(),
  totalDebt: z.number().optional(),
  shareholderEquity: z.number().optional(),
  sharesOutstanding: z.number().optional(),
});

export type QuarterlyFinancialsRecord = z.infer<
  typeof QuarterlyFinancialsRecordSchema
>;

// Financial metrics for display components
export const FinancialMetricsSchema = z.object({
  netSales: z.number(),
  totalRevenue: z.number(),
  netIncome: z.number(),
  eps: z.number(),
  operatingIncome: z.number(),
  freeCashFlow: z.number(),
  // Calculated fields for trends
  revenueGrowth: z.number().optional(),
  incomeGrowth: z.number().optional(),
  epsGrowth: z.number().optional(),
});

export type FinancialMetrics = z.infer<typeof FinancialMetricsSchema>;
