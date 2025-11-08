export interface EnvironmentConfig {
    account?: string;
    region: string;
    domainName?: string;
    certificateArn?: string;
    enablePointInTimeRecovery: boolean;
    removalPolicy: 'DESTROY' | 'RETAIN';
    logRetentionDays: number;
    apiThrottling: {
        rateLimit: number;
        burstLimit: number;
    };
    lambdaConfig: {
        timeout: number;
        memorySize: number;
        reservedConcurrency?: number;
    };
    monitoring: {
        enableXRay: boolean;
        enableDetailedMetrics: boolean;
        alarmEmail?: string;
    };
}
export declare const environments: Record<string, EnvironmentConfig>;
export declare function getEnvironmentConfig(env: string): EnvironmentConfig;
