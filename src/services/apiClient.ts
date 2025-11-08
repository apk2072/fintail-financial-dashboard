import type { 
  Company, 
  QuarterlyFinancials, 
  SearchResult, 
  CompanyQuery 
} from '../types';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://9468zcsjg8.execute-api.us-east-1.amazonaws.com/prod';
const API_VERSION = '';

// API client class with error handling and request/response interceptors
class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseURL = API_VERSION ? `${API_BASE_URL}/${API_VERSION}` : API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  // Generic request method with error handling
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new ApiError(
          response.status,
          `HTTP ${response.status}: ${response.statusText}`,
          await this.parseErrorResponse(response)
        );
      }

      const data = await response.json();
      
      // Handle API response wrapper format
      if (data.success === false) {
        throw new ApiError(
          response.status,
          data.error || 'API request failed',
          data
        );
      }

      return data.data || data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(0, 'Network error: Unable to connect to server', error);
      }
      
      throw new ApiError(500, 'Unexpected error occurred', error);
    }
  }

  private async parseErrorResponse(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return { message: response.statusText };
    }
  }

  // Company-related API methods
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
    const response = await this.request<any>(endpoint);
    
    // Handle both direct array and paginated response formats
    if (Array.isArray(response)) {
      return response;
    }
    
    return response.items || response.data?.items || [];
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

  // Search-related API methods
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

  // Market data methods
  async getSectors(): Promise<string[]> {
    return this.request<string[]>('/market/sectors');
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

// Custom API Error class
export class ApiError extends Error {
  public status: number;
  public details?: any;

  constructor(
    status: number,
    message: string,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Mock API client for development/testing
class MockApiClient extends ApiClient {
  private mockData = {
    companies: [
      {
        id: 'aapl',
        name: 'Apple Inc.',
        ticker: 'AAPL',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: 3000000000000,
        employees: 164000,
        headquarters: 'Cupertino, California',
        website: 'https://www.apple.com',
        description: 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
        lastUpdated: new Date().toISOString(),
      },
      {
        id: 'msft',
        name: 'Microsoft Corporation',
        ticker: 'MSFT',
        sector: 'Technology',
        industry: 'Software',
        marketCap: 2800000000000,
        employees: 221000,
        headquarters: 'Redmond, Washington',
        website: 'https://www.microsoft.com',
        description: 'Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide.',
        lastUpdated: new Date().toISOString(),
      },
    ] as Company[],
    
    financials: [
      {
        quarter: '2025-Q3',
        reportDate: '2025-09-30',
        netSales: 125575000000,
        totalRevenue: 125575000000,
        netIncome: 36916000000,
        eps: 2.45,
        operatingIncome: 43323000000,
        freeCashFlow: 29274000000,
      },
      {
        quarter: '2025-Q2',
        reportDate: '2025-06-30',
        netSales: 119575000000,
        totalRevenue: 119575000000,
        netIncome: 33916000000,
        eps: 2.18,
        operatingIncome: 40323000000,
        freeCashFlow: 26274000000,
      },
    ] as QuarterlyFinancials[],
  };

  async getCompanies(): Promise<Company[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.mockData.companies;
  }

  async getCompany(ticker: string): Promise<Company> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const company = this.mockData.companies.find(c => c.ticker === ticker.toUpperCase());
    if (!company) {
      throw new ApiError(404, `Company with ticker ${ticker} not found`);
    }
    return company;
  }

  async getCompanyFinancials(_ticker: string): Promise<QuarterlyFinancials[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return this.mockData.financials;
  }

  async searchCompanies(query: string): Promise<SearchResult[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.mockData.companies
      .filter(company => 
        company.name.toLowerCase().includes(query.toLowerCase()) ||
        company.ticker.toLowerCase().includes(query.toLowerCase())
      )
      .map(company => ({
        id: company.id,
        name: company.name,
        ticker: company.ticker,
        sector: company.sector,
        marketCap: company.marketCap,
        relevanceScore: 1,
      }));
  }

  async getSearchSuggestions(query: string): Promise<Company[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.mockData.companies.filter(company => 
      company.name.toLowerCase().includes(query.toLowerCase()) ||
      company.ticker.toLowerCase().includes(query.toLowerCase())
    );
  }

  async getPopularSearches(): Promise<string[]> {
    return ['Apple', 'Microsoft', 'Google', 'Amazon', 'Tesla'];
  }

  async getTrendingCompanies(): Promise<Company[]> {
    return this.mockData.companies;
  }
}

// Export mock client for development
export const mockApiClient = new MockApiClient();

// Always use real API client now that we have real data
export const apiClientInstance = apiClient;