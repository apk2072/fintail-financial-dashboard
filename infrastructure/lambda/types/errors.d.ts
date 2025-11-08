import { z } from 'zod';
export declare const ErrorSeverity: {
    readonly LOW: "low";
    readonly MEDIUM: "medium";
    readonly HIGH: "high";
    readonly CRITICAL: "critical";
};
export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];
export declare const ErrorCategory: {
    readonly NETWORK: "network";
    readonly VALIDATION: "validation";
    readonly AUTHENTICATION: "authentication";
    readonly AUTHORIZATION: "authorization";
    readonly NOT_FOUND: "not_found";
    readonly SERVER_ERROR: "server_error";
    readonly CLIENT_ERROR: "client_error";
    readonly DATA_ERROR: "data_error";
};
export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];
export declare const AppErrorSchema: z.ZodObject<{
    id: z.ZodString;
    message: z.ZodString;
    category: z.ZodEnum<{
        network: "network";
        validation: "validation";
        authorization: "authorization";
        authentication: "authentication";
        not_found: "not_found";
        server_error: "server_error";
        client_error: "client_error";
        data_error: "data_error";
    }>;
    severity: z.ZodEnum<{
        medium: "medium";
        high: "high";
        low: "low";
        critical: "critical";
    }>;
    code: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AppError = z.infer<typeof AppErrorSchema>;
export declare const ValidationErrorSchema: z.ZodObject<{
    field: z.ZodString;
    message: z.ZodString;
    value: z.ZodOptional<z.ZodAny>;
}, z.core.$strip>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export declare const NetworkErrorSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodNumber>;
    statusText: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type NetworkError = z.infer<typeof NetworkErrorSchema>;
export type ErrorHandlerResult = {
    shouldRetry: boolean;
    retryAfter?: number;
    fallbackData?: unknown;
    userMessage: string;
};
