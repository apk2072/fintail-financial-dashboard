import React, { useMemo } from 'react';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { enhancedApiClient as apiClient } from '../services/enhancedApiClient';
import type { Company, SearchResult } from '../types';

// Hook for search results with debouncing
export function useSearch(
  query: string,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
  } & Omit<UseQueryOptions<SearchResult[]>, 'queryKey' | 'queryFn'>
) {
  const { enabled = true, debounceMs = 300, ...queryOptions } = options || {};
  
  // Debounce the query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, debounceMs);
  
  return useQuery({
    queryKey: queryKeys.search.results(debouncedQuery),
    queryFn: () => apiClient.searchCompanies(debouncedQuery),
    enabled: enabled && debouncedQuery.length >= 2, // Only search with 2+ characters
    // Search results can be cached for a shorter time
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...queryOptions,
  });
}

// Hook for search suggestions (autocomplete)
export function useSearchSuggestions(
  query: string,
  options?: {
    enabled?: boolean;
    limit?: number;
  } & Omit<UseQueryOptions<Company[]>, 'queryKey' | 'queryFn'>
) {
  const { enabled = true, limit = 5, ...queryOptions } = options || {};
  const debouncedQuery = useDebounce(query, 200); // Faster debounce for suggestions
  
  return useQuery({
    queryKey: queryKeys.search.suggestions(debouncedQuery),
    queryFn: () => apiClient.getSearchSuggestions(debouncedQuery, { limit }),
    enabled: enabled && debouncedQuery.length >= 1, // Show suggestions with 1+ characters
    staleTime: 1 * 60 * 1000, // 1 minute
    ...queryOptions,
  });
}

// Hook for recent searches (stored in localStorage)
export function useRecentSearches() {
  const getRecentSearches = (): string[] => {
    try {
      const stored = localStorage.getItem('fintail-recent-searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const addRecentSearch = (query: string) => {
    if (!query.trim()) return;
    
    const recent = getRecentSearches();
    const updated = [query, ...recent.filter(q => q !== query)].slice(0, 10); // Keep last 10
    
    try {
      localStorage.setItem('fintail-recent-searches', JSON.stringify(updated));
    } catch {
      // Handle localStorage errors gracefully
    }
  };

  const clearRecentSearches = () => {
    try {
      localStorage.removeItem('fintail-recent-searches');
    } catch {
      // Handle localStorage errors gracefully
    }
  };

  return {
    recentSearches: getRecentSearches(),
    addRecentSearch,
    clearRecentSearches,
  };
}

// Hook for popular searches
export function usePopularSearches(
  options?: Omit<UseQueryOptions<string[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['search', 'popular'],
    queryFn: () => apiClient.getPopularSearches(),
    staleTime: 30 * 60 * 1000, // 30 minutes - popular searches don't change often
    ...options,
  });
}

// Combined search hook with enhanced functionality
export function useEnhancedSearch(query: string) {
  const { data: results, isLoading: isSearching, error: searchError } = useSearch(query);
  const { data: suggestions, isLoading: isLoadingSuggestions } = useSearchSuggestions(query);
  const { recentSearches, addRecentSearch } = useRecentSearches();
  const { data: popularSearches } = usePopularSearches();

  // Combine and deduplicate suggestions
  const combinedSuggestions = useMemo(() => {
    const allSuggestions = [
      ...(suggestions || []),
      ...(query.length === 0 ? (popularSearches || []).map(term => ({ name: term, ticker: '' })) : []),
    ];
    
    // Remove duplicates based on name and ticker
    const seen = new Set();
    return allSuggestions.filter(item => {
      const key = `${item.name}-${item.ticker}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [suggestions, popularSearches, query]);

  return {
    // Search results
    results: results || [],
    isSearching,
    searchError,
    
    // Suggestions
    suggestions: combinedSuggestions,
    isLoadingSuggestions,
    
    // Recent searches
    recentSearches,
    addRecentSearch,
    
    // Popular searches
    popularSearches: popularSearches || [],
    
    // Helper methods
    hasResults: (results || []).length > 0,
    hasSuggestions: combinedSuggestions.length > 0,
  };
}

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

