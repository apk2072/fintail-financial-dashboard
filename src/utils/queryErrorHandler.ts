import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../services/apiClient';
import { errorLogger } from '../services/errorLogging';

/**
 * Global error handler for React Query
 */
export function handleQueryError(error: unknown) {
  if (error instanceof ApiError) {
    // Handle API errors
    errorLogger.logAPIError(
      'unknown', // endpoint would be passed in real implementation
      error.status,
      error.message,
      {
        details: error.details,
        isNetworkError: error.isNetworkError,
        isClientError: error.isClientError,
        isServerError: error.isServerError,
      }
    );

    // Show user-friendly error messages
    if (error.isNetworkError) {
      showErrorToast('Network connection problem. Please check your internet connection.');
    } else if (error.status === 404) {
      showErrorToast('The requested data was not found.');
    } else if (error.isServerError) {
      showErrorToast('Server error. Please try again later.');
    } else if (error.isClientError) {
      showErrorToast('Invalid request. Please refresh the page and try again.');
    } else {
      showErrorToast('An unexpected error occurred. Please try again.');
    }
  } else if (error instanceof Error) {
    // Handle other errors
    errorLogger.logError(error, { type: 'query_error' });
    showErrorToast('An error occurred while loading data.');
  } else {
    // Handle unknown errors
    errorLogger.logError(new Error(String(error)), { type: 'unknown_query_error' });
    showErrorToast('An unexpected error occurred.');
  }
}

/**
 * Configure React Query client with error handling
 */
export function configureQueryClientErrorHandling(queryClient: QueryClient) {
  // Note: onError has been removed from React Query v5
  // Error handling is now done at the component level using error boundaries
  queryClient.setDefaultOptions({
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof ApiError && error.isClientError) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  });
}

/**
 * Show error toast notification
 */
function showErrorToast(message: string) {
  // In a real app, this would integrate with a toast library like react-hot-toast
  if (import.meta.env.DEV) {
    console.error('[Toast]', message);
  }

  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-sm';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);

  // Add click to dismiss
  toast.addEventListener('click', () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  });
}

/**
 * Error retry utilities
 */
export const errorRetryUtils = {
  /**
   * Exponential backoff retry
   */
  exponentialBackoff: (attempt: number, baseDelay = 1000, maxDelay = 30000) => {
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  },

  /**
   * Linear backoff retry
   */
  linearBackoff: (attempt: number, baseDelay = 1000, maxDelay = 10000) => {
    return Math.min(baseDelay * (attempt + 1), maxDelay);
  },

  /**
   * Check if error is retryable
   */
  isRetryableError: (error: unknown): boolean => {
    if (error instanceof ApiError) {
      // Don't retry client errors (4xx)
      if (error.isClientError) return false;
      // Don't retry certain server errors
      if (error.status === 501 || error.status === 505) return false;
      // Retry network errors and other server errors
      return error.isNetworkError || error.isServerError;
    }
    // Retry other errors
    return true;
  },

  /**
   * Get retry delay based on error type
   */
  getRetryDelay: (error: unknown, attempt: number): number => {
    if (error instanceof ApiError) {
      if (error.status === 429) {
        // Rate limited - use longer delay
        return errorRetryUtils.exponentialBackoff(attempt, 2000, 60000);
      }
      if (error.isNetworkError) {
        // Network error - use shorter delay
        return errorRetryUtils.linearBackoff(attempt, 500, 5000);
      }
    }
    // Default exponential backoff
    return errorRetryUtils.exponentialBackoff(attempt);
  },
};