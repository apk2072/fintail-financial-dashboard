const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'fintail-companies-development';

// META Q3 2025 Financial Data (based on earnings report)
const metaQ3Data = {
  ticker: 'META',
  quarter: 'Q3 2025',
  reportDate: '2025-09-30',
  totalRevenue: 40589000000,  // $40.59B
  netIncome: 15688000000,      // $15.69B  
  eps: 6.20,                   // $6.20
  operatingIncome: 17351000000, // $17.35B
  freeCashFlow: 17483000000    // $17.48B
};

async function clearProjectionCache(ticker) {
  console.log(`Clearing projection cache for ${ticker}...`);
  try {
    const today = new Date().toISOString().split('T')[0];
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `PROJECTION#${ticker}`,
        SK: today
      }
    }));
    console.log(`✓ Cleared projection cache`);
  } catch (error) {
    console.log(`No cache to clear`);
  }
}

async function updateMetaData() {
  console.log('Updating META Q3 2025 financial data...\n');
  
  const item = {
    PK: `COMPANY#${metaQ3Data.ticker}`,
    SK: `QUARTER#${metaQ3Data.reportDate}`,
    quarter: metaQ3Data.quarter,
    reportDate: metaQ3Data.reportDate,
    totalRevenue: metaQ3Data.totalRevenue,
    netSales: metaQ3Data.totalRevenue,
    netIncome: metaQ3Data.netIncome,
    eps: metaQ3Data.eps,
    operatingIncome: metaQ3Data.operatingIncome,
    freeCashFlow: metaQ3Data.freeCashFlow,
    lastUpdated: new Date().toISOString()
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));

  console.log('✓ Updated META Q3 2025 data:');
  console.log(`  Revenue: $${(metaQ3Data.totalRevenue / 1e9).toFixed(2)}B`);
  console.log(`  Net Income: $${(metaQ3Data.netIncome / 1e9).toFixed(2)}B`);
  console.log(`  EPS: $${metaQ3Data.eps}`);
  console.log(`  Operating Income: $${(metaQ3Data.operatingIncome / 1e9).toFixed(2)}B`);
  console.log(`  Free Cash Flow: $${(metaQ3Data.freeCashFlow / 1e9).toFixed(2)}B`);
  console.log();
  
  // Clear projection cache so new projection will be generated
  await clearProjectionCache(metaQ3Data.ticker);
  
  console.log('\n✅ Successfully updated META Q3 2025 earnings!');
  console.log('\nView updated data and AI projections at:');
  console.log('https://dgoske3le3stp.cloudfront.net/company/META');
}

updateMetaData().catch(console.error);
