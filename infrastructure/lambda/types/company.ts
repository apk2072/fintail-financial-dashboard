import { z } from 'zod';

// Company interface based on design document
export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  ticker: z.string(),
  sector: z.string(),
  industry: z.string().optional(),
  marketCap: z.number(),
  employees: z.number().optional(),
  founded: z.number().optional(),
  headquarters: z.string().optional(),
  website: z.string().url().optional(),
  description: z.string().optional(),
  lastUpdated: z.string(),
});

export type Company = z.infer<typeof CompanySchema>;

// Company record for DynamoDB storage
export const CompanyRecordSchema = z.object({
  PK: z.string(), // "COMPANY#${ticker}"
  SK: z.string(), // "METADATA"
  name: z.string(),
  ticker: z.string(),
  sector: z.string(),
  industry: z.string().optional(),
  marketCap: z.number(),
  employees: z.number().optional(),
  founded: z.number().optional(),
  headquarters: z.string().optional(),
  website: z.string().url().optional(),
  description: z.string().optional(),
  lastUpdated: z.string(),
  GSI1PK: z.string(), // "SECTOR#${sector}"
  GSI1SK: z.string(), // "COMPANY#${name}"
});

export type CompanyRecord = z.infer<typeof CompanyRecordSchema>;
