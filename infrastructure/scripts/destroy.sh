#!/bin/bash

# Fintail Infrastructure Destroy Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
PROFILE=""
FORCE=false

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
    echo "  -f, --force             Skip confirmation prompt"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e development"
    echo "  $0 --environment staging --force"
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
        -f|--force)
            FORCE=true
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

print_warning "About to destroy infrastructure for environment: $ENVIRONMENT"
print_warning "Account: $ACCOUNT_ID"
print_warning "Region: $REGION"

# Confirmation prompt
if [[ "$FORCE" == false ]]; then
    echo ""
    print_warning "This action will permanently delete all resources in the $ENVIRONMENT environment!"
    print_warning "This includes:"
    echo "  - DynamoDB tables and all data"
    echo "  - Lambda functions"
    echo "  - API Gateway"
    echo "  - S3 buckets and website content"
    echo "  - CloudFront distribution"
    echo "  - CloudWatch logs and alarms"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        print_status "Destruction cancelled"
        exit 0
    fi
fi

# Navigate to infrastructure directory
cd "$(dirname "$0")/.."

print_status "Starting infrastructure destruction..."

# Empty S3 buckets first (required before stack deletion)
if [[ -f "outputs-$ENVIRONMENT.json" ]]; then
    BUCKET_NAME=$(cat "outputs-$ENVIRONMENT.json" | jq -r '.["FintailInfrastructureStack-'$ENVIRONMENT'"].S3BucketName')
    
    if [[ "$BUCKET_NAME" != "null" && -n "$BUCKET_NAME" ]]; then
        print_status "Emptying S3 bucket: $BUCKET_NAME"
        aws s3 rm "s3://$BUCKET_NAME" --recursive || true
    fi
fi

# Destroy the CDK stack
print_status "Destroying CDK stack..."
npx cdk destroy \
    --context environment="$ENVIRONMENT" \
    --force

if [[ $? -ne 0 ]]; then
    print_error "Stack destruction failed"
    exit 1
fi

# Clean up output files
if [[ -f "outputs-$ENVIRONMENT.json" ]]; then
    rm "outputs-$ENVIRONMENT.json"
fi

print_success "Infrastructure destroyed successfully!"
print_status "Environment $ENVIRONMENT has been completely removed"