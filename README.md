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
