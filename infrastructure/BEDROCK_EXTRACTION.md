# Bedrock Financial Data Extraction

This system uses Amazon Bedrock with Claude 4 to automatically extract financial metrics from SEC quarterly reports (10-Q).

## How It Works

1. Upload a financial report (PDF or TXT) to the S3 bucket
2. Lambda function is automatically triggered
3. Bedrock Claude 4 extracts key financial metrics
4. Data is stored in DynamoDB
5. Dashboard displays the extracted data

## Setup Instructions

### 1. Enable Bedrock Model Access

First, you need to enable access to Claude 3.5 Sonnet in your AWS account:

```bash
# Go to AWS Console → Bedrock → Model access
# Or use this direct link:
# https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess

# Request access to: anthropic.claude-3-5-sonnet-20241022-v2:0
```

### 2. Deploy the Infrastructure

```bash
cd infrastructure
npm run build
cd lambda && npm run build && cp -r node_modules dist/ && cd ..
npx cdk deploy --context environment=development
```

### 3. Get the S3 Bucket Name

```bash
aws cloudformation describe-stacks \
  --stack-name FintailInfrastructureStack-development \
  --query 'Stacks[0].Outputs[?OutputKey==`FinancialReportsBucketName`].OutputValue' \
  --output text
```

## Usage

### Upload Amazon Q3 2025 Report

1. Download Amazon's Q3 2025 10-Q from SEC EDGAR:
   - Go to: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001018724&type=10-Q
   - Find the Q3 2025 filing
   - Download as TXT or PDF

2. Upload to S3:
```bash
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name FintailInfrastructureStack-development \
  --query 'Stacks[0].Outputs[?OutputKey==`FinancialReportsBucketName`].OutputValue' \
  --output text)

aws s3 cp amazon-q3-2025-10q.txt s3://$BUCKET_NAME/AMZN/2025-Q3.txt
```

3. Monitor the Lambda execution:
```bash
aws logs tail /aws/lambda/FintailInfrastructureStack-development-BedrockDocumentProcessor --follow
```

4. Verify data was extracted:
```bash
aws dynamodb query \
  --table-name fintail-companies-development \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{":pk":{"S":"COMPANY#AMZN"},":sk":{"S":"QUARTER#2025"}}'
```

## Supported File Formats

- `.txt` - Plain text SEC filings
- `.pdf` - PDF documents (will be converted to text)

## Extracted Metrics

The system extracts:
- Total Revenue
- Net Sales
- Net Income
- Earnings Per Share (EPS)
- Operating Income
- Free Cash Flow
- Quarter (e.g., "Q3 2025")
- Report Date

## Cost Estimate

- **Bedrock Claude 3.5 Sonnet**: ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens
- **Typical 10-Q report**: ~50K tokens input, ~500 tokens output = ~$0.16 per report
- **Lambda**: Minimal cost for 5-minute execution
- **S3 Storage**: $0.023 per GB/month

**Total cost per company per quarter**: ~$0.20

## Troubleshooting

### Lambda Timeout
If processing large PDFs, increase Lambda timeout in CDK stack.

### Bedrock Access Denied
Ensure you've requested model access in the Bedrock console.

### Extraction Errors
Check CloudWatch logs for the Lambda function to see Claude's response.
