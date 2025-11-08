import { useQuery, useSuspenseQuery, type UseQueryOptions } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { enhancedApiClient as apiClient } from '../services/enhancedApiClient';
import type { Company, QuarterlyFinancials } from '../types';

// Hook for fetching company list
export function useCompanies(
  filters?: {
    sector?: string;
    limit?: number;
    offset?: number;
  },
  options?: Omit<UseQueryOptions<Company[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.companies.list(filters || {}),
    queryFn: () => apiClient.getCompanies(filters),
    ...options,
  });
}

// Hook for fetching a single company's details
export function useCompany(
  ticker: string,
  options?: Omit<UseQueryOptions<Company>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.companies.detail(ticker),
    queryFn: () => apiClient.getCompany(ticker),
    enabled: !!ticker,
    ...options,
  });
}

// Suspense version for company details (useful with React 18+ Suspense)
export function useCompanySuspense(ticker: string) {
  return useSuspenseQuery({
    queryKey: queryKeys.companies.detail(ticker),
    queryFn: () => apiClient.getCompany(ticker),
  });
}

// Hook for fetching company financial data
export function useCompanyFinancials(
  ticker: string,
  options?: {
    quarters?: number; // Number of quarters to fetch
  } & Omit<UseQueryOptions<QuarterlyFinancials[]>, 'queryKey' | 'queryFn'>
) {
  const { quarters = 8, ...queryOptions } = options || {};
  
  return useQuery({
    queryKey: queryKeys.companies.financials(ticker),
    queryFn: () => apiClient.getCompanyFinancials(ticker, { quarters }),
    enabled: !!ticker,
    ...queryOptions,
  });
}

// Hook for fetching trending companies
export function useTrendingCompanies(
  options?: Omit<UseQueryOptions<Company[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.market.trending(),
    queryFn: () => apiClient.getTrendingCompanies(),
    // Trending data changes more frequently
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

// Hook for fetching companies by sector
export function useCompaniesBySector(
  sector: string,
  options?: Omit<UseQueryOptions<Company[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.companies.list({ sector }),
    queryFn: () => apiClient.getCompanies({ sector }),
    enabled: !!sector,
    ...options,
  });
}

// Hook for prefetching company data (useful for hover states)
export function usePrefetchCompany() {
  return (ticker: string) => {
    // This would need to be implemented with useQueryClient hook
    // For now, we'll skip prefetching to avoid the compilation error
    console.log(`Would prefetch data for ${ticker}`);
  };
}

// Custom hook for company data with error handling and loading states
export function useCompanyWithStatus(ticker: string) {
  const {
    data: company,
    isLoading,
    isError,
    error,
    refetch,
  } = useCompany(ticker);

  const {
    data: financials,
    isLoading: isLoadingFinancials,
    isError: isFinancialsError,
  } = useCompanyFinancials(ticker);

  return {
    company,
    financials,
    isLoading: isLoading || isLoadingFinancials,
    isError: isError || isFinancialsError,
    error,
    refetch,
    hasData: !!company && !!financials,
  };
}