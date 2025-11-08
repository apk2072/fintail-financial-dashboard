import { z } from 'zod';

// Search index interface for DynamoDB
export const SearchIndexSchema = z.object({
  PK: z.string(), // "SEARCH#${normalizedTerm}"
  SK: z.string(), // "COMPANY#${ticker}"
  searchTerm: z.string(),
  companyName: z.string(),
  ticker: z.string(),
  relevanceScore: z.number(),
});

export type SearchIndex = z.infer<typeof SearchIndexSchema>;

// Search result interface
export const SearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  ticker: z.string(),
  sector: z.string(),
  marketCap: z.number(),
  relevanceScore: z.number().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Search query interface
export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
  offset: z.number().min(0).default(0),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
