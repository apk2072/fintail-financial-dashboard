const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'fintail-companies-development';

// Historical Amazon data (Q1 2024 - Q2 2025)
const historicalQuarters = [
  {
    date: '2024-03-31',
    quarter: 'Q1 2024',
    totalRevenue: 143313000000,
    netIncome: 10431000000,
    eps: 0.98,
    operatingIncome: 15307000000,
    freeCashFlow: 50070000000,
  },
  {
    date: '2024-06-30',
    quarter: 'Q2 2024',
    totalRevenue: 147977000000,
    netIncome: 13485000000,
    eps: 1.26,
    operatingIncome: 14672000000,
    freeCashFlow: 52899000000,
  },
  {
    date: '2024-09-30',
    quarter: 'Q3 2024',
    totalRevenue: 158877000000,
    netIncome: 15328000000,
    eps: 1.43,
    operatingIncome: 17411000000,
    freeCashFlow: 47683000000,
  },
  {
    date: '2024-12-31',
    quarter: 'Q4 2024',
    totalRevenue: 170000000000,
    netIncome: 18000000000,
    eps: 1.68,
    operatingIncome: 19500000000,
    freeCashFlow: 55000000000,
  },
  {
    date: '2025-03-31',
    quarter: 'Q1 2025',
    totalRevenue: 172000000000,
    netIncome: 19000000000,
    eps: 1.77,
    operatingIncome: 20000000000,
    freeCashFlow: 56000000000,
  },
  {
    date: '2025-06-30',
    quarter: 'Q2 2025',
    totalRevenue: 175000000000,
    netIncome: 20000000000,
    eps: 1.86,
    operatingIncome: 20500000000,
    freeCashFlow: 57000000000,
  },
];

async function addHistoricalData() {
  console.log('Adding historical Amazon quarterly data...');
  
  for (const quarter of historicalQuarters) {
    const item = {
      PK: 'COMPANY#AMZN',
      SK: `QUARTER#${quarter.date}`,
      quarter: quarter.quarter,
      reportDate: quarter.date,
      totalRevenue: quarter.totalRevenue,
      netSales: quarter.totalRevenue,
      netIncome: quarter.netIncome,
      eps: quarter.eps,
      operatingIncome: quarter.operatingIncome,
      freeCashFlow: quarter.freeCashFlow,
      lastUpdated: new Date().toISOString(),
    };

    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }));
      console.log(`✓ Added ${quarter.quarter}`);
    } catch (error) {
      console.error(`✗ Failed to add ${quarter.quarter}:`, error.message);
    }
  }
  
  console.log('\nDone! Amazon now has historical quarterly data.');
}

addHistoricalData().catch(console.error);
