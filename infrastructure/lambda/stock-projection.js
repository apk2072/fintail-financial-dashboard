"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: 'us-west-2' });
const TABLE_NAME = process.env.TABLE_NAME;
const BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const YAHOO_FINANCE_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance';
const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
    };
    try {
        // Handle OPTIONS request for CORS
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: '',
            };
        }
        const ticker = event.pathParameters?.ticker?.toUpperCase();
        if (!ticker) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Ticker symbol is required',
                    timestamp: new Date().toISOString(),
                }),
            };
        }
        console.log(`Generating projection for ${ticker}`);
        // Check cache first
        const cachedProjection = await getCachedProjection(ticker);
        if (cachedProjection) {
            console.log(`Cache hit for ${ticker}, updating current price`);
            // Always fetch real-time current price and change data from Yahoo Finance
            const priceData = await getStockPriceData(ticker);
            if (priceData) {
                // Update the cached projection with real-time price and change data
                cachedProjection.currentPrice = priceData.currentPrice;
                cachedProjection.priceChange = priceData.change;
                cachedProjection.priceChangePercent = priceData.changePercent;
                // Recalculate percentage changes with new current price
                cachedProjection.projections.threeMonth.percentageChange =
                    ((cachedProjection.projections.threeMonth.targetPrice - priceData.currentPrice) / priceData.currentPrice) * 100;
                cachedProjection.projections.sixMonth.percentageChange =
                    ((cachedProjection.projections.sixMonth.targetPrice - priceData.currentPrice) / priceData.currentPrice) * 100;
                cachedProjection.projections.twelveMonth.percentageChange =
                    ((cachedProjection.projections.twelveMonth.targetPrice - priceData.currentPrice) / priceData.currentPrice) * 100;
            }
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: cachedProjection,
                    cached: true,
                    timestamp: new Date().toISOString(),
                }),
            };
        }
        console.log(`Cache miss for ${ticker}, generating new projection`);
        // Fetch company data and quarterly financials
        const companyData = await getCompanyData(ticker);
        if (!companyData) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Company ${ticker} not found`,
                    timestamp: new Date().toISOString(),
                }),
            };
        }
        const quarterlyData = await getQuarterlyData(ticker);
        if (quarterlyData.length < 4) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Insufficient quarterly data for projection (minimum 4 quarters required)',
                    timestamp: new Date().toISOString(),
                }),
            };
        }
        // Generate projection using Bedrock
        const projection = await generateProjection(ticker, companyData.name, companyData.marketCap, quarterlyData);
        // Cache the projection
        await cacheProjection(ticker, projection);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: projection,
                cached: false,
                timestamp: new Date().toISOString(),
            }),
        };
    }
    catch (error) {
        console.error('Error generating projection:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to generate stock projection',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            }),
        };
    }
};
exports.handler = handler;
async function getCachedProjection(ticker) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `PROJECTION#${ticker}`,
                SK: today,
            },
        }));
        if (result.Item && result.Item.projectionData) {
            return result.Item.projectionData;
        }
        return null;
    }
    catch (error) {
        console.error('Error fetching cached projection:', error);
        return null;
    }
}
async function getCompanyData(ticker) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `COMPANY#${ticker}`,
                SK: 'METADATA',
            },
        }));
        return result.Item;
    }
    catch (error) {
        console.error(`Error fetching company data for ${ticker}:`, error);
        return null;
    }
}
async function getQuarterlyData(ticker) {
    try {
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': `COMPANY#${ticker}`,
                ':sk': 'QUARTER#',
            },
            ScanIndexForward: false, // Most recent first
            Limit: 8, // Get last 8 quarters
        }));
        return (result.Items || []);
    }
    catch (error) {
        console.error(`Error fetching quarterly data for ${ticker}:`, error);
        return [];
    }
}
async function getStockPriceData(ticker) {
    try {
        console.log(`Fetching price data for ${ticker} from Yahoo Finance...`);
        const url = `${YAHOO_FINANCE_BASE_URL}/chart/${ticker}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            console.error(`Yahoo Finance API returned ${response.status}`);
            return null;
        }
        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        const currentPrice = meta?.regularMarketPrice;
        const previousClose = meta?.chartPreviousClose || meta?.previousClose;
        if (currentPrice && typeof currentPrice === 'number' && previousClose && typeof previousClose === 'number') {
            const change = currentPrice - previousClose;
            const changePercent = (change / previousClose) * 100;
            console.log(`Price data for ${ticker}: current=${currentPrice.toFixed(2)}, prev=${previousClose.toFixed(2)}, change=${change.toFixed(2)} (${changePercent.toFixed(2)}%)`);
            return {
                currentPrice,
                previousClose,
                change,
                changePercent,
            };
        }
        console.error('Unable to extract price data from Yahoo Finance response');
        return null;
    }
    catch (error) {
        console.error(`Error fetching price data from Yahoo Finance:`, error);
        return null;
    }
}
async function getCurrentStockPrice(ticker) {
    const priceData = await getStockPriceData(ticker);
    return priceData?.currentPrice || null;
}
async function _oldGetCurrentStockPrice(ticker) {
    try {
        console.log(`Fetching current price for ${ticker} from Yahoo Finance...`);
        const url = `${YAHOO_FINANCE_BASE_URL}/chart/${ticker}?interval=1d&range=1d`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
        });
        if (!response.ok) {
            console.error(`Yahoo Finance API returned ${response.status}`);
            return null;
        }
        const data = await response.json();
        const quote = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (quote && typeof quote === 'number') {
            console.log(`Current price for ${ticker}: $${quote.toFixed(2)}`);
            return quote;
        }
        console.error('Unable to extract price from Yahoo Finance response');
        return null;
    }
    catch (error) {
        console.error(`Error fetching current price from Yahoo Finance:`, error);
        return null;
    }
}
async function generateProjection(ticker, companyName, marketCap, quarterlyData) {
    // Try to get current price from Yahoo Finance first
    let currentPrice = await getCurrentStockPrice(ticker);
    // Fallback: Calculate from market cap if Yahoo Finance fails
    if (!currentPrice) {
        console.log(`Falling back to market cap calculation for ${ticker}`);
        const sharesOutstandingMap = {
            'META': 2580000000,
            'AAPL': 15440000000,
            'GOOGL': 12440000000,
            'AMZN': 10470000000,
            'MSFT': 7430000000,
        };
        const sharesOutstanding = sharesOutstandingMap[ticker] || 10000000000;
        currentPrice = marketCap / sharesOutstanding;
    }
    // Format quarterly data for Claude
    const formattedData = quarterlyData.map(q => ({
        quarter: q.quarter,
        date: q.reportDate,
        revenue: `$${(q.totalRevenue / 1e9).toFixed(2)}B`,
        netIncome: `$${(q.netIncome / 1e9).toFixed(2)}B`,
        eps: `$${q.eps.toFixed(2)}`,
        operatingIncome: `$${(q.operatingIncome / 1e9).toFixed(2)}B`,
        freeCashFlow: `$${(q.freeCashFlow / 1e9).toFixed(2)}B`,
    }));
    const prompt = `You are a financial analyst. Analyze the following quarterly financial data for ${companyName} (${ticker}) and provide stock price projections.

Historical Quarterly Data (most recent first):
${JSON.stringify(formattedData, null, 2)}

Current Market Cap: $${(marketCap / 1e9).toFixed(2)}B
Estimated Current Stock Price: $${currentPrice.toFixed(2)}

Provide a detailed analysis with:
1. Price targets for 3, 6, and 12 months with realistic ranges (low/high)
2. Key growth drivers (3-5 specific factors)
3. Risk factors (3-5 specific concerns)
4. Confidence level (High/Medium/Low) based on data quality and trend consistency
5. Brief analysis summary (2-3 sentences)

Format your response as JSON matching this exact structure:
{
  "threeMonth": {
    "targetPrice": number,
    "low": number,
    "high": number
  },
  "sixMonth": {
    "targetPrice": number,
    "low": number,
    "high": number
  },
  "twelveMonth": {
    "targetPrice": number,
    "low": number,
    "high": number
  },
  "summary": "string",
  "keyDrivers": ["string", "string", "string"],
  "risks": ["string", "string", "string"],
  "confidence": "High" | "Medium" | "Low"
}

Respond ONLY with valid JSON, no additional text.`;
    try {
        const response = await invokeBedrockWithRetry(prompt);
        const analysis = JSON.parse(response);
        // Calculate percentage changes
        const projectionData = {
            ticker,
            currentPrice,
            projections: {
                threeMonth: {
                    targetPrice: analysis.threeMonth.targetPrice,
                    percentageChange: ((analysis.threeMonth.targetPrice - currentPrice) / currentPrice) * 100,
                    range: {
                        low: analysis.threeMonth.low,
                        high: analysis.threeMonth.high,
                    },
                },
                sixMonth: {
                    targetPrice: analysis.sixMonth.targetPrice,
                    percentageChange: ((analysis.sixMonth.targetPrice - currentPrice) / currentPrice) * 100,
                    range: {
                        low: analysis.sixMonth.low,
                        high: analysis.sixMonth.high,
                    },
                },
                twelveMonth: {
                    targetPrice: analysis.twelveMonth.targetPrice,
                    percentageChange: ((analysis.twelveMonth.targetPrice - currentPrice) / currentPrice) * 100,
                    range: {
                        low: analysis.twelveMonth.low,
                        high: analysis.twelveMonth.high,
                    },
                },
            },
            analysis: {
                summary: analysis.summary,
                keyDrivers: analysis.keyDrivers,
                risks: analysis.risks,
                confidence: analysis.confidence,
            },
            generatedAt: new Date().toISOString(),
            dataAsOf: quarterlyData[0]?.reportDate || new Date().toISOString(),
        };
        return projectionData;
    }
    catch (error) {
        console.error('Error generating projection with Bedrock:', error);
        throw new Error('Failed to generate AI projection');
    }
}
async function invokeBedrockWithRetry(prompt, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const payload = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.3,
            };
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: BEDROCK_MODEL_ID,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(payload),
            });
            const response = await bedrockClient.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            return responseBody.content[0].text;
        }
        catch (error) {
            console.error(`Bedrock API attempt ${attempt} failed:`, error);
            if (attempt === maxRetries) {
                throw error;
            }
            // Exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Failed to invoke Bedrock after retries');
}
async function cacheProjection(ticker, projection) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `PROJECTION#${ticker}`,
                SK: today,
                projectionData: projection,
                ttl,
                createdAt: new Date().toISOString(),
            },
        }));
        console.log(`Cached projection for ${ticker}`);
    }
    catch (error) {
        console.error('Error caching projection:', error);
        // Don't throw - caching failure shouldn't break the response
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvY2stcHJvamVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0b2NrLXByb2plY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsOERBQTBEO0FBQzFELHdEQUFxRztBQUNyRyw0RUFBMkY7QUFFM0YsTUFBTSxZQUFZLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sU0FBUyxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM1RCxNQUFNLGFBQWEsR0FBRyxJQUFJLDZDQUFvQixDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFFeEUsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFXLENBQUM7QUFDM0MsTUFBTSxnQkFBZ0IsR0FBRywyQ0FBMkMsQ0FBQztBQUNyRSxNQUFNLHNCQUFzQixHQUFHLDZDQUE2QyxDQUFDO0FBdUR0RSxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQzFCLEtBQTJCLEVBQ0ssRUFBRTtJQUNsQyxNQUFNLE9BQU8sR0FBRztRQUNkLGNBQWMsRUFBRSxrQkFBa0I7UUFDbEMsNkJBQTZCLEVBQUUsR0FBRztRQUNsQyw4QkFBOEIsRUFBRSxjQUFjO1FBQzlDLDhCQUE4QixFQUFFLGFBQWE7S0FDOUMsQ0FBQztJQUVGLElBQUksQ0FBQztRQUNILGtDQUFrQztRQUNsQyxJQUFJLEtBQUssQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDbkMsT0FBTztnQkFDTCxVQUFVLEVBQUUsR0FBRztnQkFDZixPQUFPO2dCQUNQLElBQUksRUFBRSxFQUFFO2FBQ1QsQ0FBQztRQUNKLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsY0FBYyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQztRQUUzRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDWixPQUFPO2dCQUNM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RyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxvQkFBb0I7UUFFaEYsTUFBTSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUkseUJBQVUsQ0FBQztZQUNsQyxTQUFTLEVBQUUsVUFBVTtZQUNyQixJQUFJLEVBQUU7Z0JBQ0osRUFBRSxFQUFFLGNBQWMsTUFBTSxFQUFFO2dCQUMxQixFQUFFLEVBQUUsS0FBSztnQkFDVCxjQUFjLEVBQUUsVUFBVTtnQkFDMUIsR0FBRztnQkFDSCxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7YUFDcEM7U0FDRixDQUFDLENBQUMsQ0FBQztRQUVKLE9BQU8sQ0FBQyxHQUFHLENBQUMseUJBQXlCLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDJCQUEyQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xELDZEQUE2RDtJQUMvRCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tICdhd3MtbGFtYmRhJztcbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFF1ZXJ5Q29tbWFuZCwgR2V0Q29tbWFuZCwgUHV0Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYic7XG5pbXBvcnQgeyBCZWRyb2NrUnVudGltZUNsaWVudCwgSW52b2tlTW9kZWxDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWJlZHJvY2stcnVudGltZSc7XG5cbmNvbnN0IGR5bmFtb0NsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7fSk7XG5jb25zdCBkb2NDbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oZHluYW1vQ2xpZW50KTtcbmNvbnN0IGJlZHJvY2tDbGllbnQgPSBuZXcgQmVkcm9ja1J1bnRpbWVDbGllbnQoeyByZWdpb246ICd1cy13ZXN0LTInIH0pO1xuXG5jb25zdCBUQUJMRV9OQU1FID0gcHJvY2Vzcy5lbnYuVEFCTEVfTkFNRSE7XG5jb25zdCBCRURST0NLX01PREVMX0lEID0gJ2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MTAyMi12MjowJztcbmNvbnN0IFlBSE9PX0ZJTkFOQ0VfQkFTRV9VUkwgPSAnaHR0cHM6Ly9xdWVyeTEuZmluYW5jZS55YWhvby5jb20vdjgvZmluYW5jZSc7XG5cbmludGVyZmFjZSBRdWFydGVybHlEYXRhIHtcbiAgcXVhcnRlcjogc3RyaW5nO1xuICByZXBvcnREYXRlOiBzdHJpbmc7XG4gIHRvdGFsUmV2ZW51ZTogbnVtYmVyO1xuICBuZXRJbmNvbWU6IG51bWJlcjtcbiAgZXBzOiBudW1iZXI7XG4gIG9wZXJhdGluZ0luY29tZTogbnVtYmVyO1xuICBmcmVlQ2FzaEZsb3c6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFByaWNlUHJvamVjdGlvbiB7XG4gIHRhcmdldFByaWNlOiBudW1iZXI7XG4gIHBlcmNlbnRhZ2VDaGFuZ2U6IG51bWJlcjtcbiAgcmFuZ2U6IHtcbiAgICBsb3c6IG51bWJlcjtcbiAgICBoaWdoOiBudW1iZXI7XG4gIH07XG59XG5cbmludGVyZmFjZSBQcm9qZWN0aW9uRGF0YSB7XG4gIHRpY2tlcjogc3RyaW5nO1xuICBjdXJyZW50UHJpY2U6IG51bWJlcjtcbiAgcHJpY2VDaGFuZ2U/OiBudW1iZXI7XG4gIHByaWNlQ2hhbmdlUGVyY2VudD86IG51bWJlcjtcbiAgcHJvamVjdGlvbnM6IHtcbiAgICB0aHJlZU1vbnRoOiBQcmljZVByb2plY3Rpb247XG4gICAgc2l4TW9udGg6IFByaWNlUHJvamVjdGlvbjtcbiAgICB0d2VsdmVNb250aDogUHJpY2VQcm9qZWN0aW9uO1xuICB9O1xuICBhbmFseXNpczoge1xuICAgIHN1bW1hcnk6IHN0cmluZztcbiAgICBrZXlEcml2ZXJzOiBzdHJpbmdbXTtcbiAgICByaXNrczogc3RyaW5nW107XG4gICAgY29uZmlkZW5jZTogJ0hpZ2gnIHwgJ01lZGl1bScgfCAnTG93JztcbiAgfTtcbiAgZ2VuZXJhdGVkQXQ6IHN0cmluZztcbiAgZGF0YUFzT2Y6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFN0b2NrUHJpY2VEYXRhIHtcbiAgY3VycmVudFByaWNlOiBudW1iZXI7XG4gIHByZXZpb3VzQ2xvc2U6IG51bWJlcjtcbiAgY2hhbmdlOiBudW1iZXI7XG4gIGNoYW5nZVBlcmNlbnQ6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFN0b2NrUHJpY2VEYXRhIHtcbiAgY3VycmVudFByaWNlOiBudW1iZXI7XG4gIHByZXZpb3VzQ2xvc2U6IG51bWJlcjtcbiAgY2hhbmdlOiBudW1iZXI7XG4gIGNoYW5nZVBlcmNlbnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxuKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcbiAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlJyxcbiAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdPUFRJT05TLEdFVCcsXG4gIH07XG5cbiAgdHJ5IHtcbiAgICAvLyBIYW5kbGUgT1BUSU9OUyByZXF1ZXN0IGZvciBDT1JTXG4gICAgaWYgKGV2ZW50Lmh0dHBNZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgICBib2R5OiAnJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgdGlja2VyID0gZXZlbnQucGF0aFBhcmFtZXRlcnM/LnRpY2tlcj8udG9VcHBlckNhc2UoKTtcbiAgICBcbiAgICBpZiAoIXRpY2tlcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyb3I6ICdUaWNrZXIgc3ltYm9sIGlzIHJlcXVpcmVkJyxcbiAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBHZW5lcmF0aW5nIHByb2plY3Rpb24gZm9yICR7dGlja2VyfWApO1xuXG4gICAgLy8gQ2hlY2sgY2FjaGUgZmlyc3RcbiAgICBjb25zdCBjYWNoZWRQcm9qZWN0aW9uID0gYXdhaXQgZ2V0Q2FjaGVkUHJvamVjdGlvbih0aWNrZXIpO1xuICAgIGlmIChjYWNoZWRQcm9qZWN0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZyhgQ2FjaGUgaGl0IGZvciAke3RpY2tlcn0sIHVwZGF0aW5nIGN1cnJlbnQgcHJpY2VgKTtcbiAgICAgIFxuICAgICAgLy8gQWx3YXlzIGZldGNoIHJlYWwtdGltZSBjdXJyZW50IHByaWNlIGFuZCBjaGFuZ2UgZGF0YSBmcm9tIFlhaG9vIEZpbmFuY2VcbiAgICAgIGNvbnN0IHByaWNlRGF0YSA9IGF3YWl0IGdldFN0b2NrUHJpY2VEYXRhKHRpY2tlcik7XG4gICAgICBpZiAocHJpY2VEYXRhKSB7XG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgY2FjaGVkIHByb2plY3Rpb24gd2l0aCByZWFsLXRpbWUgcHJpY2UgYW5kIGNoYW5nZSBkYXRhXG4gICAgICAgIGNhY2hlZFByb2plY3Rpb24uY3VycmVudFByaWNlID0gcHJpY2VEYXRhLmN1cnJlbnRQcmljZTtcbiAgICAgICAgY2FjaGVkUHJvamVjdGlvbi5wcmljZUNoYW5nZSA9IHByaWNlRGF0YS5jaGFuZ2U7XG4gICAgICAgIGNhY2hlZFByb2plY3Rpb24ucHJpY2VDaGFuZ2VQZXJjZW50ID0gcHJpY2VEYXRhLmNoYW5nZVBlcmNlbnQ7XG4gICAgICAgIFxuICAgICAgICAvLyBSZWNhbGN1bGF0ZSBwZXJjZW50YWdlIGNoYW5nZXMgd2l0aCBuZXcgY3VycmVudCBwcmljZVxuICAgICAgICBjYWNoZWRQcm9qZWN0aW9uLnByb2plY3Rpb25zLnRocmVlTW9udGgucGVyY2VudGFnZUNoYW5nZSA9IFxuICAgICAgICAgICgoY2FjaGVkUHJvamVjdGlvbi5wcm9qZWN0aW9ucy50aHJlZU1vbnRoLnRhcmdldFByaWNlIC0gcHJpY2VEYXRhLmN1cnJlbnRQcmljZSkgLyBwcmljZURhdGEuY3VycmVudFByaWNlKSAqIDEwMDtcbiAgICAgICAgY2FjaGVkUHJvamVjdGlvbi5wcm9qZWN0aW9ucy5zaXhNb250aC5wZXJjZW50YWdlQ2hhbmdlID0gXG4gICAgICAgICAgKChjYWNoZWRQcm9qZWN0aW9uLnByb2plY3Rpb25zLnNpeE1vbnRoLnRhcmdldFByaWNlIC0gcHJpY2VEYXRhLmN1cnJlbnRQcmljZSkgLyBwcmljZURhdGEuY3VycmVudFByaWNlKSAqIDEwMDtcbiAgICAgICAgY2FjaGVkUHJvamVjdGlvbi5wcm9qZWN0aW9ucy50d2VsdmVNb250aC5wZXJjZW50YWdlQ2hhbmdlID0gXG4gICAgICAgICAgKChjYWNoZWRQcm9qZWN0aW9uLnByb2plY3Rpb25zLnR3ZWx2ZU1vbnRoLnRhcmdldFByaWNlIC0gcHJpY2VEYXRhLmN1cnJlbnRQcmljZSkgLyBwcmljZURhdGEuY3VycmVudFByaWNlKSAqIDEwMDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICBkYXRhOiBjYWNoZWRQcm9qZWN0aW9uLFxuICAgICAgICAgIGNhY2hlZDogdHJ1ZSxcbiAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBDYWNoZSBtaXNzIGZvciAke3RpY2tlcn0sIGdlbmVyYXRpbmcgbmV3IHByb2plY3Rpb25gKTtcblxuICAgIC8vIEZldGNoIGNvbXBhbnkgZGF0YSBhbmQgcXVhcnRlcmx5IGZpbmFuY2lhbHNcbiAgICBjb25zdCBjb21wYW55RGF0YSA9IGF3YWl0IGdldENvbXBhbnlEYXRhKHRpY2tlcik7XG4gICAgaWYgKCFjb21wYW55RGF0YSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDA0LFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyb3I6IGBDb21wYW55ICR7dGlja2VyfSBub3QgZm91bmRgLFxuICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICB9KSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgcXVhcnRlcmx5RGF0YSA9IGF3YWl0IGdldFF1YXJ0ZXJseURhdGEodGlja2VyKTtcbiAgICBpZiAocXVhcnRlcmx5RGF0YS5sZW5ndGggPCA0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogJ0luc3VmZmljaWVudCBxdWFydGVybHkgZGF0YSBmb3IgcHJvamVjdGlvbiAobWluaW11bSA0IHF1YXJ0ZXJzIHJlcXVpcmVkKScsXG4gICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBwcm9qZWN0aW9uIHVzaW5nIEJlZHJvY2tcbiAgICBjb25zdCBwcm9qZWN0aW9uID0gYXdhaXQgZ2VuZXJhdGVQcm9qZWN0aW9uKFxuICAgICAgdGlja2VyLFxuICAgICAgY29tcGFueURhdGEubmFtZSxcbiAgICAgIGNvbXBhbnlEYXRhLm1hcmtldENhcCxcbiAgICAgIHF1YXJ0ZXJseURhdGFcbiAgICApO1xuXG4gICAgLy8gQ2FjaGUgdGhlIHByb2plY3Rpb25cbiAgICBhd2FpdCBjYWNoZVByb2plY3Rpb24odGlja2VyLCBwcm9qZWN0aW9uKTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiBwcm9qZWN0aW9uLFxuICAgICAgICBjYWNoZWQ6IGZhbHNlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2VuZXJhdGluZyBwcm9qZWN0aW9uOicsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgaGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yOiAnRmFpbGVkIHRvIGdlbmVyYXRlIHN0b2NrIHByb2plY3Rpb24nLFxuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJyxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG59O1xuXG5hc3luYyBmdW5jdGlvbiBnZXRDYWNoZWRQcm9qZWN0aW9uKHRpY2tlcjogc3RyaW5nKTogUHJvbWlzZTxQcm9qZWN0aW9uRGF0YSB8IG51bGw+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBHZXRDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogVEFCTEVfTkFNRSxcbiAgICAgIEtleToge1xuICAgICAgICBQSzogYFBST0pFQ1RJT04jJHt0aWNrZXJ9YCxcbiAgICAgICAgU0s6IHRvZGF5LFxuICAgICAgfSxcbiAgICB9KSk7XG5cbiAgICBpZiAocmVzdWx0Lkl0ZW0gJiYgcmVzdWx0Lkl0ZW0ucHJvamVjdGlvbkRhdGEpIHtcbiAgICAgIHJldHVybiByZXN1bHQuSXRlbS5wcm9qZWN0aW9uRGF0YSBhcyBQcm9qZWN0aW9uRGF0YTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBjYWNoZWQgcHJvamVjdGlvbjonLCBlcnJvcik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0Q29tcGFueURhdGEodGlja2VyOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgR2V0Q29tbWFuZCh7XG4gICAgICBUYWJsZU5hbWU6IFRBQkxFX05BTUUsXG4gICAgICBLZXk6IHtcbiAgICAgICAgUEs6IGBDT01QQU5ZIyR7dGlja2VyfWAsXG4gICAgICAgIFNLOiAnTUVUQURBVEEnLFxuICAgICAgfSxcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcmVzdWx0Lkl0ZW07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihgRXJyb3IgZmV0Y2hpbmcgY29tcGFueSBkYXRhIGZvciAke3RpY2tlcn06YCwgZXJyb3IpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFF1YXJ0ZXJseURhdGEodGlja2VyOiBzdHJpbmcpOiBQcm9taXNlPFF1YXJ0ZXJseURhdGFbXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBUQUJMRV9OQU1FLFxuICAgICAgS2V5Q29uZGl0aW9uRXhwcmVzc2lvbjogJ1BLID0gOnBrIEFORCBiZWdpbnNfd2l0aChTSywgOnNrKScsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6cGsnOiBgQ09NUEFOWSMke3RpY2tlcn1gLFxuICAgICAgICAnOnNrJzogJ1FVQVJURVIjJyxcbiAgICAgIH0sXG4gICAgICBTY2FuSW5kZXhGb3J3YXJkOiBmYWxzZSwgLy8gTW9zdCByZWNlbnQgZmlyc3RcbiAgICAgIExpbWl0OiA4LCAvLyBHZXQgbGFzdCA4IHF1YXJ0ZXJzXG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIChyZXN1bHQuSXRlbXMgfHwgW10pIGFzIFF1YXJ0ZXJseURhdGFbXTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKGBFcnJvciBmZXRjaGluZyBxdWFydGVybHkgZGF0YSBmb3IgJHt0aWNrZXJ9OmAsIGVycm9yKTtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0U3RvY2tQcmljZURhdGEodGlja2VyOiBzdHJpbmcpOiBQcm9taXNlPFN0b2NrUHJpY2VEYXRhIHwgbnVsbD4ge1xuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKGBGZXRjaGluZyBwcmljZSBkYXRhIGZvciAke3RpY2tlcn0gZnJvbSBZYWhvbyBGaW5hbmNlLi4uYCk7XG4gICAgY29uc3QgdXJsID0gYCR7WUFIT09fRklOQU5DRV9CQVNFX1VSTH0vY2hhcnQvJHt0aWNrZXJ9P2ludGVydmFsPTFkJnJhbmdlPTFkYDtcbiAgICBcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnVXNlci1BZ2VudCc6ICdNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYnLFxuICAgICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYFlhaG9vIEZpbmFuY2UgQVBJIHJldHVybmVkICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGF0YTogYW55ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIGNvbnN0IG1ldGEgPSBkYXRhPy5jaGFydD8ucmVzdWx0Py5bMF0/Lm1ldGE7XG4gICAgXG4gICAgY29uc3QgY3VycmVudFByaWNlID0gbWV0YT8ucmVndWxhck1hcmtldFByaWNlO1xuICAgIGNvbnN0IHByZXZpb3VzQ2xvc2UgPSBtZXRhPy5jaGFydFByZXZpb3VzQ2xvc2UgfHwgbWV0YT8ucHJldmlvdXNDbG9zZTtcbiAgICBcbiAgICBpZiAoY3VycmVudFByaWNlICYmIHR5cGVvZiBjdXJyZW50UHJpY2UgPT09ICdudW1iZXInICYmIHByZXZpb3VzQ2xvc2UgJiYgdHlwZW9mIHByZXZpb3VzQ2xvc2UgPT09ICdudW1iZXInKSB7XG4gICAgICBjb25zdCBjaGFuZ2UgPSBjdXJyZW50UHJpY2UgLSBwcmV2aW91c0Nsb3NlO1xuICAgICAgY29uc3QgY2hhbmdlUGVyY2VudCA9IChjaGFuZ2UgLyBwcmV2aW91c0Nsb3NlKSAqIDEwMDtcbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYFByaWNlIGRhdGEgZm9yICR7dGlja2VyfTogY3VycmVudD0ke2N1cnJlbnRQcmljZS50b0ZpeGVkKDIpfSwgcHJldj0ke3ByZXZpb3VzQ2xvc2UudG9GaXhlZCgyKX0sIGNoYW5nZT0ke2NoYW5nZS50b0ZpeGVkKDIpfSAoJHtjaGFuZ2VQZXJjZW50LnRvRml4ZWQoMil9JSlgKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY3VycmVudFByaWNlLFxuICAgICAgICBwcmV2aW91c0Nsb3NlLFxuICAgICAgICBjaGFuZ2UsXG4gICAgICAgIGNoYW5nZVBlcmNlbnQsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBleHRyYWN0IHByaWNlIGRhdGEgZnJvbSBZYWhvbyBGaW5hbmNlIHJlc3BvbnNlJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihgRXJyb3IgZmV0Y2hpbmcgcHJpY2UgZGF0YSBmcm9tIFlhaG9vIEZpbmFuY2U6YCwgZXJyb3IpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEN1cnJlbnRTdG9ja1ByaWNlKHRpY2tlcjogc3RyaW5nKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gIGNvbnN0IHByaWNlRGF0YSA9IGF3YWl0IGdldFN0b2NrUHJpY2VEYXRhKHRpY2tlcik7XG4gIHJldHVybiBwcmljZURhdGE/LmN1cnJlbnRQcmljZSB8fCBudWxsO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfb2xkR2V0Q3VycmVudFN0b2NrUHJpY2UodGlja2VyOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZyhgRmV0Y2hpbmcgY3VycmVudCBwcmljZSBmb3IgJHt0aWNrZXJ9IGZyb20gWWFob28gRmluYW5jZS4uLmApO1xuICAgIGNvbnN0IHVybCA9IGAke1lBSE9PX0ZJTkFOQ0VfQkFTRV9VUkx9L2NoYXJ0LyR7dGlja2VyfT9pbnRlcnZhbD0xZCZyYW5nZT0xZGA7XG4gICAgXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ1VzZXItQWdlbnQnOiAnTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2JyxcbiAgICAgICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBZYWhvbyBGaW5hbmNlIEFQSSByZXR1cm5lZCAke3Jlc3BvbnNlLnN0YXR1c31gKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGE6IGFueSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICBjb25zdCBxdW90ZSA9IGRhdGE/LmNoYXJ0Py5yZXN1bHQ/LlswXT8ubWV0YT8ucmVndWxhck1hcmtldFByaWNlO1xuICAgIFxuICAgIGlmIChxdW90ZSAmJiB0eXBlb2YgcXVvdGUgPT09ICdudW1iZXInKSB7XG4gICAgICBjb25zb2xlLmxvZyhgQ3VycmVudCBwcmljZSBmb3IgJHt0aWNrZXJ9OiAkJHtxdW90ZS50b0ZpeGVkKDIpfWApO1xuICAgICAgcmV0dXJuIHF1b3RlO1xuICAgIH1cblxuICAgIGNvbnNvbGUuZXJyb3IoJ1VuYWJsZSB0byBleHRyYWN0IHByaWNlIGZyb20gWWFob28gRmluYW5jZSByZXNwb25zZScpO1xuICAgIHJldHVybiBudWxsO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGZldGNoaW5nIGN1cnJlbnQgcHJpY2UgZnJvbSBZYWhvbyBGaW5hbmNlOmAsIGVycm9yKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZVByb2plY3Rpb24oXG4gIHRpY2tlcjogc3RyaW5nLFxuICBjb21wYW55TmFtZTogc3RyaW5nLFxuICBtYXJrZXRDYXA6IG51bWJlcixcbiAgcXVhcnRlcmx5RGF0YTogUXVhcnRlcmx5RGF0YVtdXG4pOiBQcm9taXNlPFByb2plY3Rpb25EYXRhPiB7XG4gIC8vIFRyeSB0byBnZXQgY3VycmVudCBwcmljZSBmcm9tIFlhaG9vIEZpbmFuY2UgZmlyc3RcbiAgbGV0IGN1cnJlbnRQcmljZSA9IGF3YWl0IGdldEN1cnJlbnRTdG9ja1ByaWNlKHRpY2tlcik7XG4gIFxuICAvLyBGYWxsYmFjazogQ2FsY3VsYXRlIGZyb20gbWFya2V0IGNhcCBpZiBZYWhvbyBGaW5hbmNlIGZhaWxzXG4gIGlmICghY3VycmVudFByaWNlKSB7XG4gICAgY29uc29sZS5sb2coYEZhbGxpbmcgYmFjayB0byBtYXJrZXQgY2FwIGNhbGN1bGF0aW9uIGZvciAke3RpY2tlcn1gKTtcbiAgICBjb25zdCBzaGFyZXNPdXRzdGFuZGluZ01hcDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHtcbiAgICAgICdNRVRBJzogMjU4MDAwMDAwMCxcbiAgICAgICdBQVBMJzogMTU0NDAwMDAwMDAsXG4gICAgICAnR09PR0wnOiAxMjQ0MDAwMDAwMCxcbiAgICAgICdBTVpOJzogMTA0NzAwMDAwMDAsXG4gICAgICAnTVNGVCc6IDc0MzAwMDAwMDAsXG4gICAgfTtcbiAgICBcbiAgICBjb25zdCBzaGFyZXNPdXRzdGFuZGluZyA9IHNoYXJlc091dHN0YW5kaW5nTWFwW3RpY2tlcl0gfHwgMTAwMDAwMDAwMDA7XG4gICAgY3VycmVudFByaWNlID0gbWFya2V0Q2FwIC8gc2hhcmVzT3V0c3RhbmRpbmc7XG4gIH1cblxuICAvLyBGb3JtYXQgcXVhcnRlcmx5IGRhdGEgZm9yIENsYXVkZVxuICBjb25zdCBmb3JtYXR0ZWREYXRhID0gcXVhcnRlcmx5RGF0YS5tYXAocSA9PiAoe1xuICAgIHF1YXJ0ZXI6IHEucXVhcnRlcixcbiAgICBkYXRlOiBxLnJlcG9ydERhdGUsXG4gICAgcmV2ZW51ZTogYCQkeyhxLnRvdGFsUmV2ZW51ZSAvIDFlOSkudG9GaXhlZCgyKX1CYCxcbiAgICBuZXRJbmNvbWU6IGAkJHsocS5uZXRJbmNvbWUgLyAxZTkpLnRvRml4ZWQoMil9QmAsXG4gICAgZXBzOiBgJCR7cS5lcHMudG9GaXhlZCgyKX1gLFxuICAgIG9wZXJhdGluZ0luY29tZTogYCQkeyhxLm9wZXJhdGluZ0luY29tZSAvIDFlOSkudG9GaXhlZCgyKX1CYCxcbiAgICBmcmVlQ2FzaEZsb3c6IGAkJHsocS5mcmVlQ2FzaEZsb3cgLyAxZTkpLnRvRml4ZWQoMil9QmAsXG4gIH0pKTtcblxuICBjb25zdCBwcm9tcHQgPSBgWW91IGFyZSBhIGZpbmFuY2lhbCBhbmFseXN0LiBBbmFseXplIHRoZSBmb2xsb3dpbmcgcXVhcnRlcmx5IGZpbmFuY2lhbCBkYXRhIGZvciAke2NvbXBhbnlOYW1lfSAoJHt0aWNrZXJ9KSBhbmQgcHJvdmlkZSBzdG9jayBwcmljZSBwcm9qZWN0aW9ucy5cblxuSGlzdG9yaWNhbCBRdWFydGVybHkgRGF0YSAobW9zdCByZWNlbnQgZmlyc3QpOlxuJHtKU09OLnN0cmluZ2lmeShmb3JtYXR0ZWREYXRhLCBudWxsLCAyKX1cblxuQ3VycmVudCBNYXJrZXQgQ2FwOiAkJHsobWFya2V0Q2FwIC8gMWU5KS50b0ZpeGVkKDIpfUJcbkVzdGltYXRlZCBDdXJyZW50IFN0b2NrIFByaWNlOiAkJHtjdXJyZW50UHJpY2UudG9GaXhlZCgyKX1cblxuUHJvdmlkZSBhIGRldGFpbGVkIGFuYWx5c2lzIHdpdGg6XG4xLiBQcmljZSB0YXJnZXRzIGZvciAzLCA2LCBhbmQgMTIgbW9udGhzIHdpdGggcmVhbGlzdGljIHJhbmdlcyAobG93L2hpZ2gpXG4yLiBLZXkgZ3Jvd3RoIGRyaXZlcnMgKDMtNSBzcGVjaWZpYyBmYWN0b3JzKVxuMy4gUmlzayBmYWN0b3JzICgzLTUgc3BlY2lmaWMgY29uY2VybnMpXG40LiBDb25maWRlbmNlIGxldmVsIChIaWdoL01lZGl1bS9Mb3cpIGJhc2VkIG9uIGRhdGEgcXVhbGl0eSBhbmQgdHJlbmQgY29uc2lzdGVuY3lcbjUuIEJyaWVmIGFuYWx5c2lzIHN1bW1hcnkgKDItMyBzZW50ZW5jZXMpXG5cbkZvcm1hdCB5b3VyIHJlc3BvbnNlIGFzIEpTT04gbWF0Y2hpbmcgdGhpcyBleGFjdCBzdHJ1Y3R1cmU6XG57XG4gIFwidGhyZWVNb250aFwiOiB7XG4gICAgXCJ0YXJnZXRQcmljZVwiOiBudW1iZXIsXG4gICAgXCJsb3dcIjogbnVtYmVyLFxuICAgIFwiaGlnaFwiOiBudW1iZXJcbiAgfSxcbiAgXCJzaXhNb250aFwiOiB7XG4gICAgXCJ0YXJnZXRQcmljZVwiOiBudW1iZXIsXG4gICAgXCJsb3dcIjogbnVtYmVyLFxuICAgIFwiaGlnaFwiOiBudW1iZXJcbiAgfSxcbiAgXCJ0d2VsdmVNb250aFwiOiB7XG4gICAgXCJ0YXJnZXRQcmljZVwiOiBudW1iZXIsXG4gICAgXCJsb3dcIjogbnVtYmVyLFxuICAgIFwiaGlnaFwiOiBudW1iZXJcbiAgfSxcbiAgXCJzdW1tYXJ5XCI6IFwic3RyaW5nXCIsXG4gIFwia2V5RHJpdmVyc1wiOiBbXCJzdHJpbmdcIiwgXCJzdHJpbmdcIiwgXCJzdHJpbmdcIl0sXG4gIFwicmlza3NcIjogW1wic3RyaW5nXCIsIFwic3RyaW5nXCIsIFwic3RyaW5nXCJdLFxuICBcImNvbmZpZGVuY2VcIjogXCJIaWdoXCIgfCBcIk1lZGl1bVwiIHwgXCJMb3dcIlxufVxuXG5SZXNwb25kIE9OTFkgd2l0aCB2YWxpZCBKU09OLCBubyBhZGRpdGlvbmFsIHRleHQuYDtcblxuICB0cnkge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgaW52b2tlQmVkcm9ja1dpdGhSZXRyeShwcm9tcHQpO1xuICAgIGNvbnN0IGFuYWx5c2lzID0gSlNPTi5wYXJzZShyZXNwb25zZSk7XG5cbiAgICAvLyBDYWxjdWxhdGUgcGVyY2VudGFnZSBjaGFuZ2VzXG4gICAgY29uc3QgcHJvamVjdGlvbkRhdGE6IFByb2plY3Rpb25EYXRhID0ge1xuICAgICAgdGlja2VyLFxuICAgICAgY3VycmVudFByaWNlLFxuICAgICAgcHJvamVjdGlvbnM6IHtcbiAgICAgICAgdGhyZWVNb250aDoge1xuICAgICAgICAgIHRhcmdldFByaWNlOiBhbmFseXNpcy50aHJlZU1vbnRoLnRhcmdldFByaWNlLFxuICAgICAgICAgIHBlcmNlbnRhZ2VDaGFuZ2U6ICgoYW5hbHlzaXMudGhyZWVNb250aC50YXJnZXRQcmljZSAtIGN1cnJlbnRQcmljZSkgLyBjdXJyZW50UHJpY2UpICogMTAwLFxuICAgICAgICAgIHJhbmdlOiB7XG4gICAgICAgICAgICBsb3c6IGFuYWx5c2lzLnRocmVlTW9udGgubG93LFxuICAgICAgICAgICAgaGlnaDogYW5hbHlzaXMudGhyZWVNb250aC5oaWdoLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHNpeE1vbnRoOiB7XG4gICAgICAgICAgdGFyZ2V0UHJpY2U6IGFuYWx5c2lzLnNpeE1vbnRoLnRhcmdldFByaWNlLFxuICAgICAgICAgIHBlcmNlbnRhZ2VDaGFuZ2U6ICgoYW5hbHlzaXMuc2l4TW9udGgudGFyZ2V0UHJpY2UgLSBjdXJyZW50UHJpY2UpIC8gY3VycmVudFByaWNlKSAqIDEwMCxcbiAgICAgICAgICByYW5nZToge1xuICAgICAgICAgICAgbG93OiBhbmFseXNpcy5zaXhNb250aC5sb3csXG4gICAgICAgICAgICBoaWdoOiBhbmFseXNpcy5zaXhNb250aC5oaWdoLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHR3ZWx2ZU1vbnRoOiB7XG4gICAgICAgICAgdGFyZ2V0UHJpY2U6IGFuYWx5c2lzLnR3ZWx2ZU1vbnRoLnRhcmdldFByaWNlLFxuICAgICAgICAgIHBlcmNlbnRhZ2VDaGFuZ2U6ICgoYW5hbHlzaXMudHdlbHZlTW9udGgudGFyZ2V0UHJpY2UgLSBjdXJyZW50UHJpY2UpIC8gY3VycmVudFByaWNlKSAqIDEwMCxcbiAgICAgICAgICByYW5nZToge1xuICAgICAgICAgICAgbG93OiBhbmFseXNpcy50d2VsdmVNb250aC5sb3csXG4gICAgICAgICAgICBoaWdoOiBhbmFseXNpcy50d2VsdmVNb250aC5oaWdoLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYW5hbHlzaXM6IHtcbiAgICAgICAgc3VtbWFyeTogYW5hbHlzaXMuc3VtbWFyeSxcbiAgICAgICAga2V5RHJpdmVyczogYW5hbHlzaXMua2V5RHJpdmVycyxcbiAgICAgICAgcmlza3M6IGFuYWx5c2lzLnJpc2tzLFxuICAgICAgICBjb25maWRlbmNlOiBhbmFseXNpcy5jb25maWRlbmNlLFxuICAgICAgfSxcbiAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBkYXRhQXNPZjogcXVhcnRlcmx5RGF0YVswXT8ucmVwb3J0RGF0ZSB8fCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgfTtcblxuICAgIHJldHVybiBwcm9qZWN0aW9uRGF0YTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZW5lcmF0aW5nIHByb2plY3Rpb24gd2l0aCBCZWRyb2NrOicsIGVycm9yKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBnZW5lcmF0ZSBBSSBwcm9qZWN0aW9uJyk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gaW52b2tlQmVkcm9ja1dpdGhSZXRyeShwcm9tcHQ6IHN0cmluZywgbWF4UmV0cmllcyA9IDMpOiBQcm9taXNlPHN0cmluZz4ge1xuICBmb3IgKGxldCBhdHRlbXB0ID0gMTsgYXR0ZW1wdCA8PSBtYXhSZXRyaWVzOyBhdHRlbXB0KyspIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGF5bG9hZCA9IHtcbiAgICAgICAgYW50aHJvcGljX3ZlcnNpb246ICdiZWRyb2NrLTIwMjMtMDUtMzEnLFxuICAgICAgICBtYXhfdG9rZW5zOiAyMDAwLFxuICAgICAgICBtZXNzYWdlczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6ICd1c2VyJyxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHByb21wdCxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB0ZW1wZXJhdHVyZTogMC4zLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgY29tbWFuZCA9IG5ldyBJbnZva2VNb2RlbENvbW1hbmQoe1xuICAgICAgICBtb2RlbElkOiBCRURST0NLX01PREVMX0lELFxuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBhY2NlcHQ6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocGF5bG9hZCksXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBiZWRyb2NrQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICBjb25zdCByZXNwb25zZUJvZHkgPSBKU09OLnBhcnNlKG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShyZXNwb25zZS5ib2R5KSk7XG4gICAgICBcbiAgICAgIHJldHVybiByZXNwb25zZUJvZHkuY29udGVudFswXS50ZXh0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBCZWRyb2NrIEFQSSBhdHRlbXB0ICR7YXR0ZW1wdH0gZmFpbGVkOmAsIGVycm9yKTtcbiAgICAgIFxuICAgICAgaWYgKGF0dGVtcHQgPT09IG1heFJldHJpZXMpIHtcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEV4cG9uZW50aWFsIGJhY2tvZmZcbiAgICAgIGNvbnN0IGRlbGF5ID0gTWF0aC5wb3coMiwgYXR0ZW1wdCkgKiAxMDAwO1xuICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIGRlbGF5KSk7XG4gICAgfVxuICB9XG4gIFxuICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBpbnZva2UgQmVkcm9jayBhZnRlciByZXRyaWVzJyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNhY2hlUHJvamVjdGlvbih0aWNrZXI6IHN0cmluZywgcHJvamVjdGlvbjogUHJvamVjdGlvbkRhdGEpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdO1xuICAgIGNvbnN0IHR0bCA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgKDI0ICogNjAgKiA2MCk7IC8vIDI0IGhvdXJzIGZyb20gbm93XG5cbiAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICBUYWJsZU5hbWU6IFRBQkxFX05BTUUsXG4gICAgICBJdGVtOiB7XG4gICAgICAgIFBLOiBgUFJPSkVDVElPTiMke3RpY2tlcn1gLFxuICAgICAgICBTSzogdG9kYXksXG4gICAgICAgIHByb2plY3Rpb25EYXRhOiBwcm9qZWN0aW9uLFxuICAgICAgICB0dGwsXG4gICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSxcbiAgICB9KSk7XG5cbiAgICBjb25zb2xlLmxvZyhgQ2FjaGVkIHByb2plY3Rpb24gZm9yICR7dGlja2VyfWApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNhY2hpbmcgcHJvamVjdGlvbjonLCBlcnJvcik7XG4gICAgLy8gRG9uJ3QgdGhyb3cgLSBjYWNoaW5nIGZhaWx1cmUgc2hvdWxkbid0IGJyZWFrIHRoZSByZXNwb25zZVxuICB9XG59XG4iXX0=