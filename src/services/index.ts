// Export API clients
export { apiClient, mockApiClient, apiClientInstance, ApiError } from './apiClient';
export { enhancedApiClient, EnhancedApiClient } from './enhancedApiClient';

// Export interceptors and utilities
export { 
  loadingStateManager, 
  useGlobalLoading,
  type RequestInterceptor,
  type ResponseInterceptor,
  type ErrorInterceptor 
} from './interceptors';

// Main service interface - use enhanced client by default
export { enhancedApiClient as defaultApiClient } from './enhancedApiClient';