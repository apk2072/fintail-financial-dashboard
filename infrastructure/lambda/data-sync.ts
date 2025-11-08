import { EventBridgeEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DataAggregator, DataAggregatorConfig } from './api-clients/data-aggregator';
import { DataProcessor } from './data-processor';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;

interface SyncJobResult {
  symbol: string;
  success: boolean;
  recordsUpdated: number;
  errors: string[];
  qualityScore: number;
  processingTime: number;
}

interface SyncSummary {
  totalCompanies: number;
  successfulUpdates: number;
  failedUpdates: number;
  totalRecordsUpdated: number;
  averageQualityScore: number;
  totalProcessingTime: number;
  errors: string[];
}

export const handler = async (
  event: EventBridgeEvent<'Scheduled Event', any>,
  context: Context
): Promise<SyncSummary> => {
  console.log('Starting scheduled data sync...', { event, context });

  const startTime = Date.now();
  const results: SyncJobResult[] = [];
  const errors: string[] = [];

  try {
    // Initialize data aggregator
    const aggregatorConfig: DataAggregatorConfig = {
      retryAttempts: 3,
      retryDelay: 2000,
    };

    if (ALPHA_VANTAGE_API_KEY) {
      aggregatorConfig.alphaVantage = {
        apiKey: ALPHA_VANTAGE_API_KEY,
        timeout: 15000,
      };
    }

    if (FMP_API_KEY) {
      aggregatorConfig.financialModelingPrep = {
        apiKey: FMP_API_KEY,
        timeout: 15000,
      };
    }

    aggregatorConfig.yahooFinance = {
      timeout: 10000,
    };

    const dataAggregator = new DataAggregator(aggregatorConfig);
    const dataProcessor = new DataProcessor(TABLE_NAME, dataAggregator);

    // Get list of companies to update
    const companies = await getCompaniesToUpdate();
    console.log(`Found ${companies.length} companies to update`);

    // Process companies in batches to avoid overwhelming APIs
    const batchSize = 5; // Process 5 companies at a time
    const batches = [];
    
    for (let i = 0; i < companies.length; i += batchSize) {
      batches.push(companies.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (company) => {
        const jobStartTime = Date.now();
        
        try {
          console.log(`Processing ${company.ticker}...`);
          
          const result = await dataProcessor.processCompanyData(company.ticker, {
            name: company.name,
            sector: company.sector,
            marketCap: company.marketCap,
          });

          const processingTime = Date.now() - jobStartTime;

          const jobResult: SyncJobResult = {
            symbol: company.ticker,
            success: result.storageResult.success,
            recordsUpdated: result.storageResult.recordsStored,
            errors: [
              ...result.storageResult.errors,
              ...result.validationResults.flatMap(v => v.errors),
            ],
            qualityScore: result.qualityMetrics.overall,
            processingTime,
          };

          // Update company's last sync timestamp
          await updateLastSyncTime(company.ticker);

          return jobResult;

        } catch (error) {
          console.error(`Error processing ${company.ticker}:`, error);
          
          return {
            symbol: company.ticker,
            success: false,
            recordsUpdated: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            qualityScore: 0,
            processingTime: Date.now() - jobStartTime,
          };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to respect API rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      }
    }

    // Generate summary
    const summary: SyncSummary = {
      totalCompanies: companies.length,
      successfulUpdates: results.filter(r => r.success).length,
      failedUpdates: results.filter(r => !r.success).length,
      totalRecordsUpdated: results.reduce((sum, r) => sum + r.recordsUpdated, 0),
      averageQualityScore: results.length > 0 
        ? results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length 
        : 0,
      totalProcessingTime: Date.now() - startTime,
      errors: results.flatMap(r => r.errors),
    };

    // Log summary
    console.log('Data sync completed:', summary);

    // Store sync metrics for monitoring
    await storeSyncMetrics(summary, results);

    return summary;

  } catch (error) {
    console.error('Fatal error during data sync:', error);
    
    const errorSummary: SyncSummary = {
      totalCompanies: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      totalRecordsUpdated: 0,
      averageQualityScore: 0,
      totalProcessingTime: Date.now() - startTime,
      errors: [error instanceof Error ? error.message : 'Unknown fatal error'],
    };

    await storeSyncMetrics(errorSummary, []);
    throw error;
  }
};

async function getCompaniesToUpdate(): Promise<Array<{ ticker: string; name: string; sector: string; marketCap: number; lastUpdated?: string }>> {
  try {
    // Get all companies from DynamoDB
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
      },
      ProjectionExpression: 'ticker, #name, sector, marketCap, lastUpdated',
      ExpressionAttributeNames: {
        '#name': 'name', // 'name' is a reserved word in DynamoDB
      },
    });

    const result = await docClient.send(command);
    const companies = (result.Items || []).map(item => ({
      ticker: item.ticker,
      name: item.name || item.ticker,
      sector: item.sector || 'Unknown',
      marketCap: item.marketCap || 0,
      lastUpdated: item.lastUpdated,
    }));

    // If no companies exist, return a default list of popular companies
    if (companies.length === 0) {
      return getDefaultCompanies();
    }

    // Sort by last updated (oldest first) and market cap (largest first)
    return companies.sort((a, b) => {
      const aLastUpdated = new Date(a.lastUpdated || '1970-01-01').getTime();
      const bLastUpdated = new Date(b.lastUpdated || '1970-01-01').getTime();
      
      if (aLastUpdated !== bLastUpdated) {
        return aLastUpdated - bLastUpdated; // Oldest first
      }
      
      return b.marketCap - a.marketCap; // Largest market cap first
    });

  } catch (error) {
    console.error('Error getting companies to update:', error);
    return getDefaultCompanies();
  }
}

function getDefaultCompanies(): Array<{ ticker: string; name: string; sector: string; marketCap: number }> {
  return [
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: 3000000000000 },
    { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', marketCap: 2800000000000 },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: 1700000000000 },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', marketCap: 1500000000000 },
    { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', marketCap: 800000000000 },
    { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', marketCap: 750000000000 },
    { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', marketCap: 1800000000000 },
    { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', marketCap: 500000000000 },
    { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', marketCap: 450000000000 },
    { ticker: 'V', name: 'Visa Inc.', sector: 'Financial Services', marketCap: 500000000000 },
  ];
}

async function updateLastSyncTime(ticker: string): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COMPANY#${ticker.toUpperCase()}`,
        SK: 'SYNC_METADATA',
        lastSyncTime: new Date().toISOString(),
        ticker: ticker.toUpperCase(),
      },
    }));
  } catch (error) {
    console.warn(`Failed to update sync time for ${ticker}:`, error);
  }
}

async function storeSyncMetrics(summary: SyncSummary, results: SyncJobResult[]): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];

    // Store daily summary
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: 'SYNC_METRICS',
        SK: `DAILY#${date}`,
        timestamp,
        ...summary,
      },
    }));

    // Store individual job results for detailed analysis
    const batchSize = 25;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      const putRequests = batch.map((result, index) => ({
        PutRequest: {
          Item: {
            PK: 'SYNC_METRICS',
            SK: `JOB#${date}#${String(i + index).padStart(4, '0')}`,
            timestamp,
            ...result,
          },
        },
      }));

      if (putRequests.length > 0) {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: putRequests,
          },
        }));
      }
    }

  } catch (error) {
    console.error('Error storing sync metrics:', error);
  }
}