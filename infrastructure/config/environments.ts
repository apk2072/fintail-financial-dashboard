// Environment-specific configurations for CDK deployment

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

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    region: 'us-east-1',
    enablePointInTimeRecovery: false,
    removalPolicy: 'DESTROY',
    logRetentionDays: 7,
    apiThrottling: {
      rateLimit: 100,
      burstLimit: 200,
    },
    lambdaConfig: {
      timeout: 30,
      memorySize: 512,
    },
    monitoring: {
      enableXRay: false,
      enableDetailedMetrics: false,
    },
  },
  
  staging: {
    region: 'us-east-1',
    domainName: 'staging.fintail.me',
    enablePointInTimeRecovery: true,
    removalPolicy: 'RETAIN',
    logRetentionDays: 30,
    apiThrottling: {
      rateLimit: 500,
      burstLimit: 1000,
    },
    lambdaConfig: {
      timeout: 30,
      memorySize: 1024,
      reservedConcurrency: 10,
    },
    monitoring: {
      enableXRay: true,
      enableDetailedMetrics: true,
    },
  },
  
  production: {
    region: 'us-east-1',
    domainName: 'www.fintail.me',
    enablePointInTimeRecovery: true,
    removalPolicy: 'RETAIN',
    logRetentionDays: 90,
    apiThrottling: {
      rateLimit: 2000,
      burstLimit: 5000,
    },
    lambdaConfig: {
      timeout: 30,
      memorySize: 1024,
      reservedConcurrency: 50,
    },
    monitoring: {
      enableXRay: true,
      enableDetailedMetrics: true,
      alarmEmail: 'alerts@fintail.me',
    },
  },
};

export function getEnvironmentConfig(env: string): EnvironmentConfig {
  const config = environments[env];
  if (!config) {
    throw new Error(`Unknown environment: ${env}. Available environments: ${Object.keys(environments).join(', ')}`);
  }
  return config;
}