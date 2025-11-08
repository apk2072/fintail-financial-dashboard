#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FintailInfrastructureStack } from '../lib/fintail-infrastructure-stack';
import { getEnvironmentConfig } from '../config/environments';

const app = new cdk.App();

// Get environment from context or default to development
const environmentName = app.node.tryGetContext('environment') || 'development';
const environmentConfig = getEnvironmentConfig(environmentName);

// Create stack with environment-specific configuration
new FintailInfrastructureStack(app, `FintailInfrastructureStack-${environmentName}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || environmentConfig.account,
    region: environmentConfig.region,
  },
  environmentConfig,
  environmentName,
  description: `Fintail Financial Dashboard Infrastructure - ${environmentName}`,
  tags: {
    Environment: environmentName,
    Project: 'Fintail',
    ManagedBy: 'CDK',
  },
});
