#!/bin/bash

# Fintail Deployment Status Checker
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
    echo "  -h, --help              Show this help message"
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

STACK_NAME="FintailInfrastructureStack-$ENVIRONMENT"

print_status "Checking deployment status for environment: $ENVIRONMENT"

# Check if stack exists
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" > /dev/null 2>&1; then
    print_error "Stack $STACK_NAME does not exist"
    exit 1
fi

# Get stack status
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackStatus' \
    --output text)

print_status "Stack Status: $STACK_STATUS"

# Check if stack is in a good state
case $STACK_STATUS in
    "CREATE_COMPLETE"|"UPDATE_COMPLETE")
        print_success "Stack is deployed successfully"
        ;;
    "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS")
        print_warning "Stack deployment is in progress"
        ;;
    "CREATE_FAILED"|"UPDATE_FAILED"|"ROLLBACK_COMPLETE"|"ROLLBACK_FAILED")
        print_error "Stack deployment failed"
        exit 1
        ;;
    *)
        print_warning "Stack is in an unknown state: $STACK_STATUS"
        ;;
esac

# Get stack outputs
print_status "Stack Outputs:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue,Description]' \
    --output table

# Get important URLs
WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' \
    --output text)

API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

if [[ -n "$WEBSITE_URL" && "$WEBSITE_URL" != "None" ]]; then
    print_status "Testing website accessibility..."
    if curl -f -s "$WEBSITE_URL" > /dev/null; then
        print_success "Website is accessible: $WEBSITE_URL"
    else
        print_error "Website is not accessible: $WEBSITE_URL"
    fi
fi

if [[ -n "$API_URL" && "$API_URL" != "None" ]]; then
    print_status "Testing API accessibility..."
    if curl -f -s "${API_URL}health" > /dev/null 2>&1; then
        print_success "API is accessible: $API_URL"
    else
        print_warning "API health check failed or endpoint not available: $API_URL"
    fi
fi

# Check Lambda functions
print_status "Checking Lambda functions..."
FUNCTIONS=$(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'FintailInfrastructureStack-$ENVIRONMENT')].FunctionName" \
    --output text)

if [[ -n "$FUNCTIONS" ]]; then
    for FUNCTION in $FUNCTIONS; do
        STATUS=$(aws lambda get-function \
            --function-name "$FUNCTION" \
            --query 'Configuration.State' \
            --output text)
        
        if [[ "$STATUS" == "Active" ]]; then
            print_success "Lambda function $FUNCTION is active"
        else
            print_warning "Lambda function $FUNCTION status: $STATUS"
        fi
    done
else
    print_warning "No Lambda functions found"
fi

# Check DynamoDB table
TABLE_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CompanyTableName`].OutputValue' \
    --output text)

if [[ -n "$TABLE_NAME" && "$TABLE_NAME" != "None" ]]; then
    TABLE_STATUS=$(aws dynamodb describe-table \
        --table-name "$TABLE_NAME" \
        --query 'Table.TableStatus' \
        --output text)
    
    if [[ "$TABLE_STATUS" == "ACTIVE" ]]; then
        print_success "DynamoDB table $TABLE_NAME is active"
    else
        print_warning "DynamoDB table $TABLE_NAME status: $TABLE_STATUS"
    fi
fi

print_success "Deployment status check completed!"