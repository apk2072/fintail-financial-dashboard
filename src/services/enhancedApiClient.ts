import { 
  requestInterceptors, 
  responseInterceptors, 
  errorInterceptors,
  loadingStateManager 
} from './interceptors';
import { ApiError } from './apiClient';
import type { 
  Company, 
  QuarterlyFinancials, 
  SearchResult, 
  PaginatedResponse,
  CompanyQuery 
} from '../types';

// Enhanced API client with interceptors and optimistic updates
export class EnhancedApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private requestCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.baseURL = `${import.meta.env.VITE_API_BASE_URL || 'https://api.fintail.me'}/v1`;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  // Enhanced request method with interceptors
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache = true
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const requestId = this.generateRequestId();
    
    // Check cache first for GET requests
    if (useCache && (!options.method || options.method === 'GET')) {
      const cached = this.getFromCache(url);
      if (cached) {
        return cached;
      }
    }

    // Apply request interceptors
    let config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    for (const interceptor of requestInterceptors) {
      config = await interceptor(config);
    }

    // Add to loading state
    loadingStateManager.addRequest(requestId);

    try {
      const response = await fetch(url, config);
      
      // Apply response interceptors
      let processedResponse = response;
      for (const interceptor of responseInterceptors) {
        processedResponse = await interceptor(processedResponse);
      }

      if (!processedResponse.ok) {
        let error = new ApiError(
          processedResponse.status,
          `HTTP ${processedResponse.status}: ${processedResponse.statusText}`,
          await this.parseErrorResponse(processedResponse)
        );

        // Apply error interceptors
        for (const interceptor of errorInterceptors) {
          error = await interceptor(error);
        }

        throw error;
      }

      const data = await processedResponse.json();
      
      // Handle API response wrapper format
      if (data.success === false) {
        let error = new ApiError(
          processedResponse.status,
          data.error || 'API request failed',
          data
        );

        for (const interceptor of errorInterceptors) {
          error = await interceptor(error);
        }

        throw error;
      }

      const result = data.data || data;

      // Cache successful GET requests
      if (useCache && (!options.method || options.method === 'GET')) {
        this.setCache(url, result);
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(0, 'Network error: Unable to connect to server', error);
      }
      
      throw new ApiError(500, 'Unexpected error occurred', error);
    } finally {
      // Remove from loading state
      loadingStateManager.removeRequest(requestId);
    }
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.requestCache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.requestCache.set(key, { data, timestamp: Date.now() });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async parseErrorResponse(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return { message: response.statusText };
    }
  }

  // Clear cache
  public clearCache(): void {
    this.requestCache.clear();
  }

  // Company API methods with optimistic updates
  async getCompanies(filters?: Partial<CompanyQuery>): Promise<Company[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const endpoint = `/companies${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.request<PaginatedResponse<Company>>(endpoint);
    
    return response.items || [];
  }

  async getCompany(ticker: string): Promise<Company> {
    if (!ticker) {
      throw new ApiError(400, 'Ticker symbol is required');
    }
    
    return this.request<Company>(`/companies/${ticker.toUpperCase()}`);
  }

  async getCompanyFinancials(
    ticker: string, 
    options?: { quarters?: number }
  ): Promise<QuarterlyFinancials[]> {
    if (!ticker) {
      throw new ApiError(400, 'Ticker symbol is required');
    }
    
    const params = new URLSearchParams();
    if (options?.quarters) {
      params.append('quarters', String(options.quarters));
    }
    
    const endpoint = `/companies/${ticker.toUpperCase()}/financials${
      params.toString() ? `?${params.toString()}` : ''
    }`;
    
    return this.request<QuarterlyFinancials[]>(endpoint);
  }

  async getTrendingCompanies(): Promise<Company[]> {
    return this.request<Company[]>('/companies/trending');
  }

  // Search methods with debouncing built-in
  async searchCompanies(query: string): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }
    
    const params = new URLSearchParams({
      q: query.trim(),
      limit: '20',
    });
    
    return this.request<SearchResult[]>(`/search?${params.toString()}`);
  }

  async getSearchSuggestions(
    query: string, 
    options?: { limit?: number }
  ): Promise<Company[]> {
    if (!query || query.trim().length < 1) {
      return [];
    }
    
    const params = new URLSearchParams({
      q: query.trim(),
      limit: String(options?.limit || 5),
    });
    
    return this.request<Company[]>(`/search/suggestions?${params.toString()}`);
  }

  async getPopularSearches(): Promise<string[]> {
    return this.request<string[]>('/search/popular');
  }

  // Optimistic update methods
  async updateCompanyOptimistic(
    ticker: string, 
    updates: Partial<Company>,
    rollback?: () => void
  ): Promise<Company> {
    try {
      // Apply optimistic update immediately
      const cacheKey = `${this.baseURL}/companies/${ticker.toUpperCase()}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.setCache(cacheKey, { ...cached, ...updates });
      }

      // Make actual API call
      const result = await this.request<Company>(
        `/companies/${ticker.toUpperCase()}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        },
        false // Don't use cache for updates
      );

      // Update cache with real result
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      // Rollback optimistic update on error
      if (rollback) {
        rollback();
      }
      throw error;
    }
  }

  // Batch requests
  async batchRequest<T>(requests: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(requests.map(request => request()));
  }

  // Health check with retry
  async healthCheck(retries = 3): Promise<{ status: string; timestamp: string }> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.request<{ status: string; timestamp: string }>('/health');
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Health check failed after retries');
  }
}

// Create enhanced API client instance
export const enhancedApiClient = new EnhancedApiClient();