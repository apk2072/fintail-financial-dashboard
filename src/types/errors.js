"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkErrorSchema = exports.ValidationErrorSchema = exports.AppErrorSchema = exports.ErrorCategory = exports.ErrorSeverity = void 0;
const zod_1 = require("zod");
// Error severity levels
exports.ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};
// Error categories
exports.ErrorCategory = {
    NETWORK: 'network',
    VALIDATION: 'validation',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    NOT_FOUND: 'not_found',
    SERVER_ERROR: 'server_error',
    CLIENT_ERROR: 'client_error',
    DATA_ERROR: 'data_error',
};
// Application error interface
exports.AppErrorSchema = zod_1.z.object({
    id: zod_1.z.string(),
    message: zod_1.z.string(),
    category: zod_1.z.enum([
        'network',
        'validation',
        'authentication',
        'authorization',
        'not_found',
        'server_error',
        'client_error',
        'data_error',
    ]),
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    code: zod_1.z.string().optional(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string(),
    stack: zod_1.z.string().optional(),
});
// Validation error details
exports.ValidationErrorSchema = zod_1.z.object({
    field: zod_1.z.string(),
    message: zod_1.z.string(),
    value: zod_1.z.any().optional(),
});
// Network error details
exports.NetworkErrorSchema = zod_1.z.object({
    status: zod_1.z.number().optional(),
    statusText: zod_1.z.string().optional(),
    url: zod_1.z.string().optional(),
    method: zod_1.z.string().optional(),
});
