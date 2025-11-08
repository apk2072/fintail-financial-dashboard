# Fintail Financial Dashboard - Infrastructure

This directory contains the AWS CDK infrastructure code for the Fintail Financial Dashboard.

## Architecture Overview

The infrastructure includes:

- **DynamoDB Table**: Stores company data and quarterly financials with GSI for efficient queries
- **Lambda Functions**: Serverless API handlers for companies and search endpoints
- **API Gateway**: REST API with CORS support and proper routing
- **S3 Bucket**: Static website hosting with security best practices
- **CloudFront Distribution**: Global CDN with custom error pages for SPA routing

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18.x or higher
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build Lambda functions:**
   ```bash
   cd lambda
   npm install
   npm run build
   cd ..
   ```

3. **Deploy infrastructure:**
   ```bash
   ./deploy.sh
   ```

## Manual Deployment

If you prefer manual deployment:

1. **Bootstrap CDK (first time only):**
   ```bash
   cdk bootstrap
   ```

2. **Deploy the stack:**
   ```bash
   cdk deploy
   ```

3. **View outputs:**
   ```bash
   cdk deploy --outputs-file outputs.json
   ```

## Infrastructure Components

### DynamoDB Table Schema

**Primary Table: `fintail-companies`**
- **PK**: Partition key (e.g., `COMPANY#AAPL`)
- **SK**: Sort key (e.g., `METADATA` or `QUARTER#2024#Q1`)

**Global Secondary Indexes:**
- **GSI1**: Sector-based queries (`GSI1PK: SECTOR#Technology`, `GSI1SK: COMPANY#Apple`)
- **SearchIndex**: Search functionality (`SearchPK: SEARCH#apple`, `SearchSK: COMPANY#AAPL`)

### API Endpoints

- `GET /companies` - List companies with optional sector filtering
- `GET /companies/{ticker}` - Get specific company details
- `GET /search?q={query}` - Search companies by name or ticker

### Lambda Functions

**Companies Function (`companies.ts`)**
- Handles company listing and detail retrieval
- Supports pagination and sector filtering
- Returns structured JSON responses

**Search Function (`search.ts`)**
- Implements company search functionality
- Supports both ticker and name-based searches
- Returns ranked search results

## Environment Variables

The Lambda functions use the following environment variables:
- `TABLE_NAME`: DynamoDB table name (automatically set by CDK)

## Security

- S3 bucket is private with CloudFront Origin Access Control
- Lambda functions have least-privilege IAM roles
- API Gateway has CORS configured for frontend access
- All communications use HTTPS

## Monitoring

The infrastructure includes:
- CloudWatch logs for Lambda functions
- DynamoDB metrics and alarms
- CloudFront access logs (can be enabled)

## Cost Optimization

- DynamoDB uses on-demand billing
- Lambda functions have appropriate timeout settings
- CloudFront uses PriceClass_100 (US, Canada, Europe)
- S3 bucket has lifecycle policies for cost management

## Cleanup

To destroy the infrastructure:

```bash
cdk destroy
```

**Note**: This will delete all data in DynamoDB and S3. Make sure to backup any important data first.

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Error**: Run `cdk bootstrap` in your target region
2. **Lambda Build Error**: Ensure TypeScript is compiled in the `lambda` directory
3. **Permission Errors**: Check AWS credentials and IAM permissions

### Useful Commands

- `cdk diff` - Compare deployed stack with current state
- `cdk synth` - Emit the synthesized CloudFormation template
- `cdk ls` - List all stacks in the app
- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile

## Development

For local development and testing:

1. Use AWS SAM CLI for local Lambda testing
2. Use DynamoDB Local for database testing
3. Use LocalStack for full AWS service emulation

## Production Considerations

Before deploying to production:

1. Change `removalPolicy` to `RETAIN` for data persistence
2. Enable CloudTrail for audit logging
3. Set up proper backup strategies
4. Configure custom domain names
5. Enable WAF for API protection
6. Set up monitoring and alerting