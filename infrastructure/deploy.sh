#!/bin/bash

# Fintail Financial Dashboard - Infrastructure Deployment Script

set -e

echo "🚀 Deploying Fintail Financial Dashboard Infrastructure..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Build Lambda functions
echo "📦 Building Lambda functions..."
cd lambda
npm install
npm run build
cd ..

# Bootstrap CDK if needed (only needs to be done once per account/region)
echo "🔧 Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
    echo "🔧 Bootstrapping CDK..."
    cdk bootstrap
else
    echo "✅ CDK already bootstrapped"
fi

# Deploy the stack
echo "🏗️  Deploying infrastructure stack..."
cdk deploy --require-approval never

echo "✅ Infrastructure deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Build the frontend: cd .. && npm run build"
echo "2. Deploy to S3: aws s3 sync dist/ s3://\$(aws cloudformation describe-stacks --stack-name FintailInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==\`S3BucketName\`].OutputValue' --output text)"
echo "3. Invalidate CloudFront cache: aws cloudfront create-invalidation --distribution-id \$(aws cloudformation describe-stacks --stack-name FintailInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==\`WebsiteUrl\`].OutputValue' --output text | sed 's/https:\/\///' | sed 's/\.cloudfront\.net//')"
echo ""
echo "🌐 Your API will be available at:"
aws cloudformation describe-stacks --stack-name FintailInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "Deploy the stack first to see the API URL"
echo ""
echo "🌐 Your website will be available at:"
aws cloudformation describe-stacks --stack-name FintailInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' --output text 2>/dev/null || echo "Deploy the stack first to see the website URL"