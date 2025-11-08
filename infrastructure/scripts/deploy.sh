#!/bin/bash

# Fintail Infrastructure Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
SKIP_BUILD=false
SKIP_FRONTEND=false
PROFILE=""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Target environment (development, staging, production)"
    echo "  -p, --profile PROFILE    AWS profile to use"
    echo "  --skip-build            Skip building Lambda functions"
    echo "  --skip-frontend         Skip building and deploying frontend"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e production -p prod-profile"
    echo "  $0 --environment staging --skip-build"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: development, staging, production"
    exit 1
fi

print_status "Starting deployment for environment: $ENVIRONMENT"

# Set AWS profile if provided
if [[ -n "$PROFILE" ]]; then
    export AWS_PROFILE="$PROFILE"
    print_status "Using AWS profile: $PROFILE"
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI is not configured or credentials are invalid"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")

print_status "Deploying to account: $ACCOUNT_ID in region: $REGION"

# Navigate to infrastructure directory
cd "$(dirname "$0")/.."

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    print_status "Installing CDK dependencies..."
    npm install
fi

# Build Lambda functions
if [[ "$SKIP_BUILD" == false ]]; then
    print_status "Building Lambda functions..."
    
    # Check if lambda directory exists
    if [[ ! -d "lambda" ]]; then
        print_warning "Lambda directory not found, creating symbolic link..."
        ln -sf ../infrastructure/lambda lambda
    fi
    
    # Build TypeScript Lambda functions
    if [[ -f "lambda/tsconfig.json" ]]; then
        cd lambda
        npm install
        npm run build
        cd ..
    fi
else
    print_warning "Skipping Lambda build"
fi

# Bootstrap CDK if needed
print_status "Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
    print_status "Bootstrapping CDK..."
    npx cdk bootstrap --context environment="$ENVIRONMENT"
fi

# Deploy infrastructure
print_status "Deploying infrastructure stack..."
npx cdk deploy \
    --context environment="$ENVIRONMENT" \
    --require-approval never \
    --outputs-file "outputs-$ENVIRONMENT.json"

if [[ $? -ne 0 ]]; then
    print_error "Infrastructure deployment failed"
    exit 1
fi

print_success "Infrastructure deployed successfully"

# Build and deploy frontend
if [[ "$SKIP_FRONTEND" == false ]]; then
    print_status "Building and deploying frontend..."
    
    # Navigate to frontend directory
    cd ..
    
    # Install frontend dependencies
    if [[ ! -d "node_modules" ]]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    
    # Build frontend for production
    print_status "Building frontend..."
    npm run build
    
    if [[ $? -ne 0 ]]; then
        print_error "Frontend build failed"
        exit 1
    fi
    
    # Get S3 bucket name from CDK outputs
    BUCKET_NAME=$(cat "infrastructure/outputs-$ENVIRONMENT.json" | jq -r '.["FintailInfrastructureStack-'$ENVIRONMENT'"].S3BucketName')
    
    if [[ "$BUCKET_NAME" == "null" || -z "$BUCKET_NAME" ]]; then
        print_error "Could not find S3 bucket name in CDK outputs"
        exit 1
    fi
    
    print_status "Deploying to S3 bucket: $BUCKET_NAME"
    
    # Sync files to S3
    aws s3 sync dist/ "s3://$BUCKET_NAME" --delete
    
    # Get CloudFront distribution ID and invalidate cache
    DISTRIBUTION_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET_NAME.s3.amazonaws.com'].Id" \
        --output text)
    
    if [[ -n "$DISTRIBUTION_ID" && "$DISTRIBUTION_ID" != "None" ]]; then
        print_status "Invalidating CloudFront cache..."
        aws cloudfront create-invalidation \
            --distribution-id "$DISTRIBUTION_ID" \
            --paths "/*" > /dev/null
        print_success "CloudFront cache invalidated"
    fi
    
    print_success "Frontend deployed successfully"
else
    print_warning "Skipping frontend deployment"
fi

# Display deployment information
print_success "Deployment completed successfully!"
echo ""
print_status "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Account: $ACCOUNT_ID"
echo "  Region: $REGION"

# Show important URLs from outputs
if [[ -f "infrastructure/outputs-$ENVIRONMENT.json" ]]; then
    WEBSITE_URL=$(cat "infrastructure/outputs-$ENVIRONMENT.json" | jq -r '.["FintailInfrastructureStack-'$ENVIRONMENT'"].WebsiteUrl')
    API_URL=$(cat "infrastructure/outputs-$ENVIRONMENT.json" | jq -r '.["FintailInfrastructureStack-'$ENVIRONMENT'"].ApiUrl')
    
    echo ""
    print_status "Important URLs:"
    echo "  Website: $WEBSITE_URL"
    echo "  API: $API_URL"
fi

print_success "Deployment script completed!"