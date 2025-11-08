import React from 'react';
import { 
  ExclamationTriangleIcon, 
  WifiIcon, 
  ServerIcon,
  ClockIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  retry?: () => void;
}

// Network error fallback
export const NetworkErrorFallback: React.FC<ErrorFallbackProps> = ({ resetError, retry }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
    <WifiIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      Connection Problem
    </h3>
    <p className="text-gray-600 mb-4">
      Unable to connect to our servers. Please check your internet connection and try again.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={retry}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        <ArrowPathIcon className="h-4 w-4 inline mr-2" />
        Try Again
      </button>
      <button
        onClick={resetError}
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Dismiss
      </button>
    </div>
  </div>
);

// API error fallback
export const APIErrorFallback: React.FC<ErrorFallbackProps & { status?: number }> = ({ 
  error, 
  resetError, 
  retry,
  status 
}) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
    <ServerIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      {status === 404 ? 'Not Found' : 'Server Error'}
    </h3>
    <p className="text-gray-600 mb-4">
      {status === 404 
        ? 'The requested data could not be found.'
        : 'Our servers are experiencing issues. Please try again later.'
      }
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={retry}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
      <button
        onClick={resetError}
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Dismiss
      </button>
    </div>
    {import.meta.env.DEV && error && (
      <details className="mt-4 text-left">
        <summary className="text-sm text-gray-500 cursor-pointer">Error Details</summary>
        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
          {error.message}
        </pre>
      </details>
    )}
  </div>
);

// Timeout error fallback
export const TimeoutErrorFallback: React.FC<ErrorFallbackProps> = ({ resetError, retry }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
    <ClockIcon className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      Request Timeout
    </h3>
    <p className="text-gray-600 mb-4">
      The request is taking longer than expected. This might be due to slow network or server issues.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={retry}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
      <button
        onClick={resetError}
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Continue Anyway
      </button>
    </div>
  </div>
);

// Generic error fallback
export const GenericErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError }) => (
  <div className="bg-white rounded-lg border border-red-200 p-6 text-center">
    <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      Something went wrong
    </h3>
    <p className="text-gray-600 mb-4">
      An unexpected error occurred. Please try refreshing the page.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button
        onClick={() => window.location.reload()}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Refresh Page
      </button>
      <button
        onClick={resetError}
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Dismiss
      </button>
    </div>
    {import.meta.env.DEV && error && (
      <details className="mt-4 text-left">
        <summary className="text-sm text-gray-500 cursor-pointer">Error Details</summary>
        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
          {error.stack}
        </pre>
      </details>
    )}
  </div>
);

// Inline error for small components
export const InlineError: React.FC<{ message: string; onRetry?: () => void }> = ({ 
  message, 
  onRetry 
}) => (
  <div className="bg-red-50 border border-red-200 rounded-md p-3">
    <div className="flex items-center">
      <ExclamationTriangleIcon className="h-4 w-4 text-red-400 mr-2" />
      <span className="text-sm text-red-700">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto text-sm text-red-600 hover:text-red-500 underline"
        >
          Retry
        </button>
      )}
    </div>
  </div>
);

// No data fallback
export const NoDataFallback: React.FC<{ message?: string; onRefresh?: () => void }> = ({ 
  message = 'No data available',
  onRefresh 
}) => (
  <div className="bg-gray-50 rounded-lg p-8 text-center">
    <div className="text-gray-400 mb-4">
      <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No Data</h3>
    <p className="text-gray-600 mb-4">{message}</p>
    {onRefresh && (
      <button
        onClick={onRefresh}
        className="text-blue-600 hover:text-blue-700 font-medium"
      >
        Refresh Data
      </button>
    )}
  </div>
);