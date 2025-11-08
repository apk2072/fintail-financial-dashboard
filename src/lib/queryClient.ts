import { QueryClient } from '@tanstack/react-query';
// import { configureQueryClientErrorHandling } from '../utils/queryErrorHandler';

// Create a client with optimized defaults for financial data
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Financial data doesn't change frequently, so we can cache for longer
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      
      // Retry configuration for API failures
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus for real-time data
      refetchOnWindowFocus: true,
      
      // Don't refetch on reconnect to avoid excessive API calls
      refetchOnReconnect: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Configure error handling (commented out due to API changes)
// configureQueryClientErrorHandling(queryClient);

// Query keys factory for consistent key management
export const queryKeys = {
  // Company-related queries
  companies: {
    all: ['companies'] as const,
    lists: () => [...queryKeys.companies.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.companies.lists(), filters] as const,
    details: () => [...queryKeys.companies.all, 'detail'] as const,
    detail: (ticker: string) => [...queryKeys.companies.details(), ticker] as const,
    financials: (ticker: string) => [...queryKeys.companies.detail(ticker), 'financials'] as const,
  },
  
  // Search-related queries
  search: {
    all: ['search'] as const,
    results: (query: string) => [...queryKeys.search.all, 'results', query] as const,
    suggestions: (query: string) => [...queryKeys.search.all, 'suggestions', query] as const,
  },
  
  // Market data queries
  market: {
    all: ['market'] as const,
    sectors: () => [...queryKeys.market.all, 'sectors'] as const,
    trending: () => [...queryKeys.market.all, 'trending'] as const,
  },
} as const;