const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const https = require('https');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'fintail-companies-development';

async function getYahooFinanceData(ticker) {
  return new Promise((resolve, reject) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    
    https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          const quote = result.chart.result[0].meta;
          resolve({
            marketCap: quote.marketCap,
            currentPrice: quote.regularMarketPrice
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function updateMarketCap(ticker) {
  console.log(`\nFetching data for ${ticker}...`);
  
  const data = await getYahooFinanceData(ticker);
  
  console.log(`Market Cap: $${(data.marketCap / 1e9).toFixed(1)}B`);
  console.log(`Current Price: $${data.currentPrice.toFixed(2)}`);
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `COMPANY#${ticker}`,
      SK: 'METADATA'
    },
    UpdateExpression: 'SET marketCap = :mc',
    ExpressionAttributeValues: {
      ':mc': data.marketCap
    }
  }));
  
  console.log(`✅ Updated ${ticker} market cap in DynamoDB`);
}

async function main() {
  console.log('🚀 Updating market caps from Yahoo Finance...');
  
  const tickers = ['PLTR', 'AMZN', 'META'];
  
  for (const ticker of tickers) {
    try {
      await updateMarketCap(ticker);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Error updating ${ticker}:`, error.message);
    }
  }
  
  console.log('\n🎉 Market caps updated successfully!');
}

main().catch(console.error);
