# Fintail Financial Dashboard

A modern, responsive web application that provides real-time access to quarterly financial data for popular public companies.

## Project Structure

```
fintail-financial-dashboard/
├── src/                    # React frontend source code
├── infrastructure/         # AWS CDK infrastructure code
├── public/                 # Static assets
└── README.md
```

## Frontend Setup

### Prerequisites

- Node.js 18.x or higher
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Type check
npm run type-check
```

## Infrastructure Setup

### Prerequisites

- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)

### Installation

```bash
cd infrastructure
npm install
```

### CDK Commands

```bash
# Synthesize CloudFormation template
npm run synth

# Deploy infrastructure
npm run deploy

# Show differences
npm run diff

# Destroy infrastructure
npm run destroy
```

### Environment Variables

For production deployments with custom domains, set these environment variables:

```bash
# ACM Certificate ARN (required for HTTPS)
export ACM_CERTIFICATE_ARN="arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"

# CloudFront domain (from CDK outputs)
export CLOUDFRONT_DOMAIN="xxxxx.cloudfront.net"

# Route53 Hosted Zone ID
export HOSTED_ZONE_ID="ZXXXXXXXXXXXXX"
```

Then run the domain setup script:

```bash
./infrastructure/scripts/setup-domain.sh
```

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- ESLint and Prettier for code quality

### Infrastructure
- AWS CDK for Infrastructure as Code
- TypeScript for type safety

## Requirements

This project implements the following key requirements:
- Display quarterly financial highlights for popular companies (Req 1)
- Search functionality for companies by name or ticker (Req 2)
- Automated data aggregation from financial APIs (Req 3)
- Responsive design for mobile devices (Req 4)
- Secure AWS infrastructure hosting (Req 5)

## License

ISC
