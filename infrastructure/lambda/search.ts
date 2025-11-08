import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
  };

  try {
    const { httpMethod, queryStringParameters } = event;

    if (httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const { 
      q: query, 
      limit = '10', 
      sector,
      minMarketCap,
      maxMarketCap 
    } = (queryStringParameters as Record<string, string>) || {};

    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Query parameter "q" is required',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    const searchOptions = {
      limit: Math.min(parseInt(limit), 50),
      sector,
      minMarketCap: minMarketCap ? parseFloat(minMarketCap) : undefined,
      maxMarketCap: maxMarketCap ? parseFloat(maxMarketCap) : undefined,
    };

    const results = await searchCompanies(query, searchOptions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: results,
        query,
        filters: searchOptions,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

interface SearchOptions {
  limit: number;
  sector?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
}

async function searchCompanies(query: string, options: SearchOptions) {
  const normalizedQuery = query.toLowerCase().trim();
  const results: any[] = [];
  
  try {
    // Strategy 1: Exact ticker match
    const exactMatch = await searchByTicker(query.toUpperCase());
    if (exactMatch) {
      results.push({ ...exactMatch, relevanceScore: 1.0, matchType: 'exact_ticker' });
    }

    // Strategy 2: Fuzzy name search using scan (not ideal for production)
    if (results.length < options.limit) {
      const nameMatches = await searchByName(normalizedQuery, options.limit - results.length);
      results.push(...nameMatches.map(item => ({ ...item, matchType: 'name_match' })));
    }

    // Strategy 3: Sector-based search if sector filter is provided
    if (options.sector && results.length < options.limit) {
      const sectorMatches = await searchBySector(options.sector, options.limit - results.length);
      results.push(...sectorMatches.map(item => ({ ...item, matchType: 'sector_match' })));
    }

    // Apply filters
    let filteredResults = results;
    
    if (options.minMarketCap || options.maxMarketCap) {
      filteredResults = results.filter(item => {
        const marketCap = item.marketCap || 0;
        if (options.minMarketCap && marketCap < options.minMarketCap) return false;
        if (options.maxMarketCap && marketCap > options.maxMarketCap) return false;
        return true;
      });
    }

    if (options.sector) {
      filteredResults = filteredResults.filter(item => 
        item.sector?.toLowerCase().includes(options.sector!.toLowerCase())
      );
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(
      new Map(filteredResults.map(item => [item.ticker, item])).values()
    );

    return uniqueResults
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, options.limit);

  } catch (error) {
    console.error('Error in searchCompanies:', error);
    return [];
  }
}

async function searchByTicker(ticker: string) {
  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${ticker}`,
        ':sk': 'METADATA',
      },
      Limit: 1,
    });

    const result = await docClient.send(command);
    
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      return {
        id: item.ticker,
        name: item.name,
        ticker: item.ticker,
        sector: item.sector,
        marketCap: item.marketCap,
        description: item.description,
        lastUpdated: item.lastUpdated,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error in searchByTicker:', error);
    return null;
  }
}

async function searchByName(query: string, limit: number) {
  try {
    // Use scan with filter for name search (not ideal for production)
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk AND (contains(#name, :query) OR contains(ticker, :upperQuery))',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':sk': 'METADATA',
        ':query': query,
        ':upperQuery': query.toUpperCase(),
      },
      Limit: limit * 2, // Get more to account for filtering
    });

    const result = await docClient.send(command);
    
    return (result.Items || []).map(item => {
      // Calculate relevance score based on match quality
      const name = (item.name || '').toLowerCase();
      const ticker = (item.ticker || '').toLowerCase();
      
      let relevanceScore = 0;
      
      if (ticker === query) {
        relevanceScore = 0.9;
      } else if (ticker.includes(query)) {
        relevanceScore = 0.8;
      } else if (name.startsWith(query)) {
        relevanceScore = 0.7;
      } else if (name.includes(query)) {
        relevanceScore = 0.6;
      } else {
        relevanceScore = 0.3;
      }

      return {
        id: item.ticker,
        name: item.name,
        ticker: item.ticker,
        sector: item.sector,
        marketCap: item.marketCap,
        description: item.description,
        lastUpdated: item.lastUpdated,
        relevanceScore,
      };
    }).slice(0, limit);
  } catch (error) {
    console.error('Error in searchByName:', error);
    return [];
  }
}

async function searchBySector(sector: string, limit: number) {
  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :sector',
      ExpressionAttributeValues: {
        ':sector': `SECTOR#${sector}`,
      },
      Limit: limit,
    });

    const result = await docClient.send(command);
    
    return (result.Items || []).map(item => ({
      id: item.ticker,
      name: item.name,
      ticker: item.ticker,
      sector: item.sector,
      marketCap: item.marketCap,
      description: item.description,
      lastUpdated: item.lastUpdated,
      relevanceScore: 0.4, // Lower relevance for sector matches
    }));
  } catch (error) {
    console.error('Error in searchBySector:', error);
    return [];
  }
}