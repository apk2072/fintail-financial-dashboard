import { z } from 'zod';

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

// Error categories
export const ErrorCategory = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  SERVER_ERROR: 'server_error',
  CLIENT_ERROR: 'client_error',
  DATA_ERROR: 'data_error',
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

// Application error interface
export const AppErrorSchema = z.object({
  id: z.string(),
  message: z.string(),
  category: z.enum([
    'network',
    'validation',
    'authentication',
    'authorization',
    'not_found',
    'server_error',
    'client_error',
    'data_error',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
  stack: z.string().optional(),
});

export type AppError = z.infer<typeof AppErrorSchema>;

// Validation error details
export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  value: z.any().optional(),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

// Network error details
export const NetworkErrorSchema = z.object({
  status: z.number().optional(),
  statusText: z.string().optional(),
  url: z.string().optional(),
  method: z.string().optional(),
});

export type NetworkError = z.infer<typeof NetworkErrorSchema>;

// Error handler result
export type ErrorHandlerResult = {
  shouldRetry: boolean;
  retryAfter?: number;
  fallbackData?: unknown;
  userMessage: string;
};
