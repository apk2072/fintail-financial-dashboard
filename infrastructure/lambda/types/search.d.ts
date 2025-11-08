import { z } from 'zod';
export declare const SearchIndexSchema: z.ZodObject<{
    PK: z.ZodString;
    SK: z.ZodString;
    searchTerm: z.ZodString;
    companyName: z.ZodString;
    ticker: z.ZodString;
    relevanceScore: z.ZodNumber;
}, z.core.$strip>;
export type SearchIndex = z.infer<typeof SearchIndexSchema>;
export declare const SearchResultSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    ticker: z.ZodString;
    sector: z.ZodString;
    marketCap: z.ZodNumber;
    relevanceScore: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export declare const SearchQuerySchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
