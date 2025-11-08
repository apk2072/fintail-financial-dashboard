import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DataAggregator, DataAggregatorConfig } from './api-clients/data-aggregator';
import { DataProcessor } from './data-processor';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;

// Transform DynamoDB item to clean Company object
function transformCompanyItem(item: any) {
  return {
    id: item.ticker,
    ticker: item.ticker,
    name: item.name,
    sector: item.sector,
    industry: item.industry,
    marketCap: item.marketCap,
    employees: item.employees,
    founded: item.founded,
    headquarters: item.headquarters,
    website: item.website,
    description: item.description,
    lastUpdated: item.lastUpdated,
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
  };

  try {
    const { httpMethod, pathParameters, queryStringParameters, body } = event;

    switch (httpMethod) {
      case 'GET':
        // Check for segment first (more specific route)
        if (pathParameters?.segment) {
          // Get segment data for a company
          return await getCompanySegmentData(pathParameters.ticker!, pathParameters.segment, headers);
        } else if (pathParameters?.ticker) {
          // Get specific company with financial data
          return await getCompanyWithFinancials(pathParameters.ticker, headers);
        } else {
          // List companies
          return await listCompanies(queryStringParameters as Record<string, string> || {}, headers);
        }
      case 'POST':
        // Add or update company data
        if (pathParameters?.ticker) {
          return await updateCompanyData(pathParameters.ticker, body, headers);
        } else {
          return await createCompany(body, headers);
        }
      case 'PUT':
        // Update company
        if (pathParameters?.ticker) {
          return await updateCompany(pathParameters.ticker, body, headers);
        }
        break;
      case 'DELETE':
        // Delete company
        if (pathParameters?.ticker) {
          return await deleteCompany(pathParameters.ticker, headers);
        }
        break;
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

async function getCompanyWithFinancials(ticker: string, headers: Record<string, string>) {
  try {
    // Get company metadata
    const companyCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `COMPANY#${ticker.toUpperCase()}`,
        SK: 'METADATA',
      },
    });

    const companyResult = await docClient.send(companyCommand);

    if (!companyResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Company not found',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Get quarterly financial data
    const financialsCommand = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${ticker.toUpperCase()}`,
        ':sk': 'QUARTER#',
      },
      ScanIndexForward: false, // Most recent first
      Limit: 8, // Last 8 quarters
    });

    const financialsResult = await docClient.send(financialsCommand);

    const company = {
      ...companyResult.Item,
      quarterlyData: financialsResult.Items || [],
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: company,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error(`Error getting company ${ticker}:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to retrieve company data',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

async function listCompanies(
  queryParams: Record<string, string>,
  headers: Record<string, string>
) {
  try {
    const { sector, limit = '20', page = '1', sortBy = 'name', sortOrder = 'asc' } = queryParams;
    const pageSize = Math.min(parseInt(limit), 100);
    const pageNumber = Math.max(parseInt(page), 1);

    let command;

    let result;
    
    if (sector) {
      // Query by sector using GSI1
      command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :sector',
        ExpressionAttributeValues: {
          ':sector': `SECTOR#${sector}`,
        },
        Limit: pageSize,
        ScanIndexForward: sortOrder === 'asc',
      });
      result = await docClient.send(command);
    } else {
      // Scan for all companies with METADATA SK
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: {
          ':sk': 'METADATA',
        },
        Limit: 100, // Get up to 100 companies
      });
      result = await docClient.send(scanCommand);
    }
    let items = result.Items || [];

    // Sort items if needed (for scan results)
    if (!sector && sortBy) {
      items = items.sort((a, b) => {
        const aVal = a[sortBy] || '';
        const bVal = b[sortBy] || '';
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortOrder === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        return 0;
      });
    }

    // Transform items to clean Company objects
    const transformedItems = items.map(transformCompanyItem);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          items: transformedItems,
          total: result.Count || 0,
          page: pageNumber,
          limit: pageSize,
          hasNext: !!result.LastEvaluatedKey,
          hasPrev: pageNumber > 1,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error listing companies:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to list companies',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

async function createCompany(body: string | null, headers: Record<string, string>) {
  try {
    if (!body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Request body is required',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    const companyData = JSON.parse(body);
    
    if (!companyData.ticker || !companyData.name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Ticker and name are required',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Initialize data aggregator and processor
    const aggregatorConfig: DataAggregatorConfig = {
      retryAttempts: 2,
      retryDelay: 1000,
    };

    if (ALPHA_VANTAGE_API_KEY) {
      aggregatorConfig.alphaVantage = { apiKey: ALPHA_VANTAGE_API_KEY };
    }

    if (FMP_API_KEY) {
      aggregatorConfig.financialModelingPrep = { apiKey: FMP_API_KEY };
    }

    aggregatorConfig.yahooFinance = {};

    const dataAggregator = new DataAggregator(aggregatorConfig);
    const dataProcessor = new DataProcessor(TABLE_NAME, dataAggregator);

    // Process company data
    const result = await dataProcessor.processCompanyData(companyData.ticker, companyData);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          ticker: companyData.ticker,
          recordsStored: result.storageResult.recordsStored,
          qualityScore: result.qualityMetrics.overall,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error creating company:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create company',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

async function updateCompanyData(ticker: string, body: string | null, headers: Record<string, string>) {
  try {
    // Initialize data aggregator and processor
    const aggregatorConfig: DataAggregatorConfig = {
      retryAttempts: 2,
      retryDelay: 1000,
    };

    if (ALPHA_VANTAGE_API_KEY) {
      aggregatorConfig.alphaVantage = { apiKey: ALPHA_VANTAGE_API_KEY };
    }

    if (FMP_API_KEY) {
      aggregatorConfig.financialModelingPrep = { apiKey: FMP_API_KEY };
    }

    aggregatorConfig.yahooFinance = {};

    const dataAggregator = new DataAggregator(aggregatorConfig);
    const dataProcessor = new DataProcessor(TABLE_NAME, dataAggregator);

    // Get existing company info if available
    let companyInfo = {};
    if (body) {
      companyInfo = JSON.parse(body);
    }

    // Process company data
    const result = await dataProcessor.processCompanyData(ticker, companyInfo);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          ticker: ticker.toUpperCase(),
          recordsUpdated: result.storageResult.recordsStored,
          qualityScore: result.qualityMetrics.overall,
          sources: result.aggregationResult.sources.map(s => ({
            source: s.source,
            success: s.success,
          })),
        },
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error(`Error updating company data for ${ticker}:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to update company data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

async function updateCompany(ticker: string, body: string | null, headers: Record<string, string>) {
  // This would update company metadata only (not financial data)
  // Implementation would be similar to createCompany but for updates
  return {
    statusCode: 501,
    headers,
    body: JSON.stringify({ 
      success: false,
      error: 'Company metadata update not implemented yet',
      timestamp: new Date().toISOString(),
    }),
  };
}

async function deleteCompany(ticker: string, headers: Record<string, string>) {
  // This would delete company and all associated data
  // Implementation would require careful cascade deletion
  return {
    statusCode: 501,
    headers,
    body: JSON.stringify({ 
      success: false,
      error: 'Company deletion not implemented yet',
      timestamp: new Date().toISOString(),
    }),
  };
}

async function getCompanySegmentData(ticker: string, segment: string, headers: Record<string, string>) {
  try {
    const upperTicker = ticker.toUpperCase();
    const upperSegment = segment.toUpperCase();
    
    console.log(`Fetching ${upperSegment} segment data for ${upperTicker}`);
    
    // Query for segment data
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${upperTicker}`,
        ':sk': `SEGMENT#${upperSegment}#`,
      },
      ScanIndexForward: false, // Most recent first
    }));

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `No ${segment} segment data found for ${ticker}`,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Transform segment data
    const segmentData = result.Items.map(item => ({
      quarter: item.quarter,
      reportDate: item.reportDate,
      segmentName: item.segmentName,
      revenue: item.revenue,
      operatingIncome: item.operatingIncome,
      operatingMargin: item.operatingMargin,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: segmentData,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error(`Error fetching segment data for ${ticker}:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch segment data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}
