#!/usr/bin/env ts-node

/**
 * Script to populate DynamoDB with real financial data
 * Uses Yahoo Finance API (no API key required)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import https from 'https';

const TABLE_NAME = 'fintail-companies-development';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// List of companies to populate
const COMPANIES = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
];

interface YahooFinanceData {
  symbol: string;
  quarterlyFinancials: Array<{
    date: string;
    revenue: number;
    netIncome: number;
    eps: number;
    operatingIncome: number;
    freeCashFlow: number;
  }>;
}

async function fetchYahooFinanceData(ticker: string): Promise<YahooFinanceData | null> {
  return new Promise((resolve) => {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=incomeStatementHistoryQuarterly,cashflowStatementHistoryQuarterly,earnings`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const result = json.quoteSummary?.result?.[0];
          
          if (!result) {
            console.log(`No data found for ${ticker}`);
            resolve(null);
            return;
          }
          
          const incomeStatements = result.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];
          const cashFlowStatements = result.cashflowStatementHistoryQuarterly?.cashflowStatements || [];
          
          const quarterlyData = incomeStatements.slice(0, 8).map((statement: any, index: number) => {
            const cashFlow = cashFlowStatements[index] || {};
            const date = new Date(statement.endDate?.fmt || statement.endDate?.raw * 1000);
            const quarter = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
            
            return {
              quarter,
              reportDate: date.toISOString().split('T')[0],
              totalRevenue: statement.totalRevenue?.raw || 0,
              netSales: statement.totalRevenue?.raw || 0,
              netIncome: statement.netIncome?.raw || 0,
              eps: statement.netIncome?.raw / (statement.shares?.raw || 1),
              operatingIncome: statement.operatingIncome?.raw || 0,
              freeCashFlow: cashFlow.freeCashFlow?.raw || 0,
              totalAssets: statement.totalAssets?.raw,
              sharesOutstanding: statement.shares?.raw,
            };
          });
          
          resolve({
            symbol: ticker,
            quarterlyFinancials: quarterlyData as any,
          });
        } catch (error) {
          console.error(`Error parsing data for ${ticker}:`, error);
          resolve(null);
        }
      });
    }).on('error', (error) => {
      console.error(`Error fetching data for ${ticker}:`, error);
      resolve(null);
    });
  });
}

async function storeCompanyData(company: typeof COMPANIES[0], financialData: YahooFinanceData | null) {
  try {
    // Store company metadata
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${company.ticker}`,
        SK: 'METADATA',
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        lastUpdated: new Date().toISOString(),
        GSI1PK: `SECTOR#${company.sector}`,
        GSI1SK: company.name,
        SearchPK: 'COMPANY',
        SearchSK: `${company.name.toLowerCase()}#${company.ticker.toLowerCase()}`,
      },
    }));
    
    console.log(`✓ Stored metadata for ${company.ticker}`);
    
    // Store quarterly financial data
    if (financialData && financialData.quarterlyFinancials) {
      for (const quarter of financialData.quarterlyFinancials) {
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `COMPANY#${company.ticker}`,
            SK: `QUARTER#${quarter.reportDate}`,
            ticker: company.ticker,
            ...quarter,
          },
        }));
      }
      
      console.log(`✓ Stored ${financialData.quarterlyFinancials.length} quarters for ${company.ticker}`);
    }
  } catch (error) {
    console.error(`✗ Error storing data for ${company.ticker}:`, error);
  }
}

async function main() {
  console.log('Starting data population...\n');
  
  for (const company of COMPANIES) {
    console.log(`Fetching data for ${company.ticker} (${company.name})...`);
    
    const financialData = await fetchYahooFinanceData(company.ticker);
    await storeCompanyData(company, financialData);
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('');
  }
  
  console.log('Data population completed!');
}

main().catch(console.error);
