import { ApiError } from './apiClient';

// Request interceptor type
export type RequestInterceptor = (config: RequestInit) => RequestInit | Promise<RequestInit>;

// Response interceptor type
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

// Error interceptor type
export type ErrorInterceptor = (error: ApiError) => ApiError | Promise<ApiError>;

// Request interceptors
export const requestInterceptors: RequestInterceptor[] = [
  // Add authentication token if available
  (config) => {
    const token = localStorage.getItem('auth-token');
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      };
    }
    return config;
  },

  // Add request ID for tracing
  (config) => {
    const requestId = generateRequestId();
    config.headers = {
      ...config.headers,
      'X-Request-ID': requestId,
    };
    return config;
  },

  // Add user agent and client info
  (config) => {
    config.headers = {
      ...config.headers,
      'X-Client-Version': import.meta.env.VITE_APP_VERSION || '1.0.0',
      'X-Client-Platform': 'web',
    };
    return config;
  },
];

// Response interceptors
export const responseInterceptors: ResponseInterceptor[] = [
  // Log response times in development
  (response) => {
    if (import.meta.env.DEV) {
      const requestId = response.headers.get('X-Request-ID');
      const responseTime = response.headers.get('X-Response-Time');
      if (requestId && responseTime) {
        console.log(`[API] ${response.url} - ${responseTime}ms (${requestId})`);
      }
    }
    return response;
  },

  // Handle rate limiting
  (response) => {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        console.warn(`[API] Rate limited. Retry after ${retryAfter} seconds`);
      }
    }
    return response;
  },
];

// Error interceptors
export const errorInterceptors: ErrorInterceptor[] = [
  // Log errors in development
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API Error]', {
        status: error.status,
        message: error.message,
        details: error.details,
      });
    }
    return error;
  },

  // Handle authentication errors
  (error) => {
    if (error.status === 401) {
      // Clear auth token and redirect to login
      localStorage.removeItem('auth-token');
      // You could dispatch a logout action here
      console.warn('[API] Authentication failed - token cleared');
    }
    return error;
  },

  // Transform specific error messages
  (error) => {
    if (error.status === 404 && error.message.includes('Company')) {
      error.message = 'Company not found. Please check the ticker symbol and try again.';
    }
    return error;
  },
];

// Utility functions
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Loading state manager for global loading indicators
class LoadingStateManager {
  private activeRequests = new Set<string>();
  private listeners = new Set<(isLoading: boolean) => void>();

  addRequest(requestId: string): void {
    this.activeRequests.add(requestId);
    this.notifyListeners();
  }

  removeRequest(requestId: string): void {
    this.activeRequests.delete(requestId);
    this.notifyListeners();
  }

  get isLoading(): boolean {
    return this.activeRequests.size > 0;
  }

  subscribe(listener: (isLoading: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.isLoading));
  }
}

export const loadingStateManager = new LoadingStateManager();

// Hook for global loading state
export function useGlobalLoading(): boolean {
  const [isLoading, setIsLoading] = React.useState(loadingStateManager.isLoading);

  React.useEffect(() => {
    return loadingStateManager.subscribe(setIsLoading);
  }, []);

  return isLoading;
}

// Import React for the hook
import React from 'react';