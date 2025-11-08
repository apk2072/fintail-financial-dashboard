"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const data_aggregator_1 = require("./api-clients/data-aggregator");
const data_processor_1 = require("./data-processor");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;
// Transform DynamoDB item to clean Company object
function transformCompanyItem(item) {
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
const handler = async (event) => {
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
                    return await getCompanySegmentData(pathParameters.ticker, pathParameters.segment, headers);
                }
                else if (pathParameters?.ticker) {
                    // Get specific company with financial data
                    return await getCompanyWithFinancials(pathParameters.ticker, headers);
                }
                else {
                    // List companies
                    return await listCompanies(queryStringParameters || {}, headers);
                }
            case 'POST':
                // Add or update company data
                if (pathParameters?.ticker) {
                    return await updateCompanyData(pathParameters.ticker, body, headers);
                }
                else {
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
    }
    catch (error) {
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
exports.handler = handler;
async function getCompanyWithFinancials(ticker, headers) {
    try {
        // Get company metadata
        const companyCommand = new lib_dynamodb_1.GetCommand({
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
        const financialsCommand = new lib_dynamodb_1.QueryCommand({
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
    }
    catch (error) {
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
async function listCompanies(queryParams, headers) {
    try {
        const { sector, limit = '20', page = '1', sortBy = 'name', sortOrder = 'asc' } = queryParams;
        const pageSize = Math.min(parseInt(limit), 100);
        const pageNumber = Math.max(parseInt(page), 1);
        let command;
        let result;
        if (sector) {
            // Query by sector using GSI1
            command = new lib_dynamodb_1.QueryCommand({
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
        }
        else {
            // Scan for all companies with METADATA SK
            const scanCommand = new lib_dynamodb_1.ScanCommand({
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
    }
    catch (error) {
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
async function createCompany(body, headers) {
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
        const aggregatorConfig = {
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
        const dataAggregator = new data_aggregator_1.DataAggregator(aggregatorConfig);
        const dataProcessor = new data_processor_1.DataProcessor(TABLE_NAME, dataAggregator);
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
    }
    catch (error) {
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
async function updateCompanyData(ticker, body, headers) {
    try {
        // Initialize data aggregator and processor
        const aggregatorConfig = {
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
        const dataAggregator = new data_aggregator_1.DataAggregator(aggregatorConfig);
        const dataProcessor = new data_processor_1.DataProcessor(TABLE_NAME, dataAggregator);
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
    }
    catch (error) {
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
async function updateCompany(ticker, body, headers) {
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
async function deleteCompany(ticker, headers) {
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
async function getCompanySegmentData(ticker, segment, headers) {
    try {
        const upperTicker = ticker.toUpperCase();
        const upperSegment = segment.toUpperCase();
        console.log(`Fetching ${upperSegment} segment data for ${upperTicker}`);
        // Query for segment data
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
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
    }
    catch (error) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcGFuaWVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tcGFuaWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDhEQUEwRDtBQUMxRCx3REFBc0c7QUFDdEcsbUVBQXFGO0FBQ3JGLHFEQUFpRDtBQUVqRCxNQUFNLE1BQU0sR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdEMsTUFBTSxTQUFTLEdBQUcscUNBQXNCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRXRELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVyxDQUFDO0FBQzNDLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQztBQUNoRSxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQztBQUU1QyxrREFBa0Q7QUFDbEQsU0FBUyxvQkFBb0IsQ0FBQyxJQUFTO0lBQ3JDLE9BQU87UUFDTCxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU07UUFDZixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07UUFDbkIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1FBQ25CLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtRQUN2QixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7UUFDekIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO1FBQ3pCLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztRQUNyQixZQUFZLEVBQUUsSUFBSSxDQUFDLFlBQVk7UUFDL0IsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO1FBQ3JCLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztRQUM3QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7S0FDOUIsQ0FBQztBQUNKLENBQUM7QUFFTSxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQzFCLEtBQTJC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SUFBSTtnQkFDYixJQUFJLEVBQUUsV0FBVztnQkFDakIsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO2FBQ3BDLENBQUM7U0FDSCxDQUFDO0lBQ0osQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxNQUFNLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNuRSxPQUFPO1lBQ0wsVUFBVSxFQUFFLEdBQUc7WUFDZixPQUFPO1lBQ1AsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLE9BQU8sRUFBRSxLQUFLO2dCQUNkLEtBQUssRUFBRSw4QkFBOEI7Z0JBQ3JDLE9BQU8sRUFBRSxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxlQUFlO2dCQUNqRSxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7YUFDcEMsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tICdhd3MtbGFtYmRhJztcbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFF1ZXJ5Q29tbWFuZCwgR2V0Q29tbWFuZCwgU2NhbkNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuaW1wb3J0IHsgRGF0YUFnZ3JlZ2F0b3IsIERhdGFBZ2dyZWdhdG9yQ29uZmlnIH0gZnJvbSAnLi9hcGktY2xpZW50cy9kYXRhLWFnZ3JlZ2F0b3InO1xuaW1wb3J0IHsgRGF0YVByb2Nlc3NvciB9IGZyb20gJy4vZGF0YS1wcm9jZXNzb3InO1xuXG5jb25zdCBjbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xuY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGNsaWVudCk7XG5cbmNvbnN0IFRBQkxFX05BTUUgPSBwcm9jZXNzLmVudi5UQUJMRV9OQU1FITtcbmNvbnN0IEFMUEhBX1ZBTlRBR0VfQVBJX0tFWSA9IHByb2Nlc3MuZW52LkFMUEhBX1ZBTlRBR0VfQVBJX0tFWTtcbmNvbnN0IEZNUF9BUElfS0VZID0gcHJvY2Vzcy5lbnYuRk1QX0FQSV9LRVk7XG5cbi8vIFRyYW5zZm9ybSBEeW5hbW9EQiBpdGVtIHRvIGNsZWFuIENvbXBhbnkgb2JqZWN0XG5mdW5jdGlvbiB0cmFuc2Zvcm1Db21wYW55SXRlbShpdGVtOiBhbnkpIHtcbiAgcmV0dXJuIHtcbiAgICBpZDogaXRlbS50aWNrZXIsXG4gICAgdGlja2VyOiBpdGVtLnRpY2tlcixcbiAgICBuYW1lOiBpdGVtLm5hbWUsXG4gICAgc2VjdG9yOiBpdGVtLnNlY3RvcixcbiAgICBpbmR1c3RyeTogaXRlbS5pbmR1c3RyeSxcbiAgICBtYXJrZXRDYXA6IGl0ZW0ubWFya2V0Q2FwLFxuICAgIGVtcGxveWVlczogaXRlbS5lbXBsb3llZXMsXG4gICAgZm91bmRlZDogaXRlbS5mb3VuZGVkLFxuICAgIGhlYWRxdWFydGVyczogaXRlbS5oZWFkcXVhcnRlcnMsXG4gICAgd2Vic2l0ZTogaXRlbS53ZWJzaXRlLFxuICAgIGRlc2NyaXB0aW9uOiBpdGVtLmRlc2NyaXB0aW9uLFxuICAgIGxhc3RVcGRhdGVkOiBpdGVtLmxhc3RVcGRhdGVkLFxuICB9O1xufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcbiAgZXZlbnQ6IEFQSUdhdGV3YXlQcm94eUV2ZW50XG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xuICBjb25zdCBoZWFkZXJzID0ge1xuICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUnLFxuICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJ09QVElPTlMsUE9TVCxHRVQsUFVULERFTEVURScsXG4gIH07XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB7IGh0dHBNZXRob2QsIHBhdGhQYXJhbWV0ZXJzLCBxdWVyeVN0cmluZ1BhcmFtZXRlcnMsIGJvZHkgfSA9IGV2ZW50O1xuXG4gICAgc3dpdGNoIChodHRwTWV0aG9kKSB7XG4gICAgICBjYXNlICdHRVQnOlxuICAgICAgICAvLyBDaGVjayBmb3Igc2VnbWVudCBmaXJzdCAobW9yZSBzcGVjaWZpYyByb3V0ZSlcbiAgICAgICAgaWYgKHBhdGhQYXJhbWV0ZXJzPy5zZWdtZW50KSB7XG4gICAgICAgICAgLy8gR2V0IHNlZ21lbnQgZGF0YSBmb3IgYSBjb21wYW55XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IGdldENvbXBhbnlTZWdtZW50RGF0YShwYXRoUGFyYW1ldGVycy50aWNrZXIhLCBwYXRoUGFyYW1ldGVycy5zZWdtZW50LCBoZWFkZXJzKTtcbiAgICAgICAgfSBlbHNlIGlmIChwYXRoUGFyYW1ldGVycz8udGlja2VyKSB7XG4gICAgICAgICAgLy8gR2V0IHNwZWNpZmljIGNvbXBhbnkgd2l0aCBmaW5hbmNpYWwgZGF0YVxuICAgICAgICAgIHJldHVybiBhd2FpdCBnZXRDb21wYW55V2l0aEZpbmFuY2lhbHMocGF0aFBhcmFtZXRlcnMudGlja2VyLCBoZWFkZXJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBMaXN0IGNvbXBhbmllc1xuICAgICAgICAgIHJldHVybiBhd2FpdCBsaXN0Q29tcGFuaWVzKHF1ZXJ5U3RyaW5nUGFyYW1ldGVycyBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHx8IHt9LCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgY2FzZSAnUE9TVCc6XG4gICAgICAgIC8vIEFkZCBvciB1cGRhdGUgY29tcGFueSBkYXRhXG4gICAgICAgIGlmIChwYXRoUGFyYW1ldGVycz8udGlja2VyKSB7XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IHVwZGF0ZUNvbXBhbnlEYXRhKHBhdGhQYXJhbWV0ZXJzLnRpY2tlciwgYm9keSwgaGVhZGVycyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IGNyZWF0ZUNvbXBhbnkoYm9keSwgaGVhZGVycyk7XG4gICAgICAgIH1cbiAgICAgIGNhc2UgJ1BVVCc6XG4gICAgICAgIC8vIFVwZGF0ZSBjb21wYW55XG4gICAgICAgIGlmIChwYXRoUGFyYW1ldGVycz8udGlja2VyKSB7XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IHVwZGF0ZUNvbXBhbnkocGF0aFBhcmFtZXRlcnMudGlja2VyLCBib2R5LCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ0RFTEVURSc6XG4gICAgICAgIC8vIERlbGV0ZSBjb21wYW55XG4gICAgICAgIGlmIChwYXRoUGFyYW1ldGVycz8udGlja2VyKSB7XG4gICAgICAgICAgcmV0dXJuIGF3YWl0IGRlbGV0ZUNvbXBhbnkocGF0aFBhcmFtZXRlcnMudGlja2VyLCBoZWFkZXJzKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogNDA1LFxuICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01ldGhvZCBub3QgYWxsb3dlZCcgfSksXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgIGhlYWRlcnMsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW52YWxpZCByZXF1ZXN0JyB9KSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yOicsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgaGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcidcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGdldENvbXBhbnlXaXRoRmluYW5jaWFscyh0aWNrZXI6IHN0cmluZywgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPikge1xuICB0cnkge1xuICAgIC8vIEdldCBjb21wYW55IG1ldGFkYXRhXG4gICAgY29uc3QgY29tcGFueUNvbW1hbmQgPSBuZXcgR2V0Q29tbWFuZCh7XG4gICAgICBUYWJsZU5hbWU6IFRBQkxFX05BTUUsXG4gICAgICBLZXk6IHtcbiAgICAgICAgUEs6IGBDT01QQU5ZIyR7dGlja2VyLnRvVXBwZXJDYXNlKCl9YCxcbiAgICAgICAgU0s6ICdNRVRBREFUQScsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgY29tcGFueVJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbXBhbnlDb21tYW5kKTtcblxuICAgIGlmICghY29tcGFueVJlc3VsdC5JdGVtKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgICAgIGhlYWRlcnMsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgZXJyb3I6ICdDb21wYW55IG5vdCBmb3VuZCcsXG4gICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBHZXQgcXVhcnRlcmx5IGZpbmFuY2lhbCBkYXRhXG4gICAgY29uc3QgZmluYW5jaWFsc0NvbW1hbmQgPSBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogVEFCTEVfTkFNRSxcbiAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICdQSyA9IDpwayBBTkQgYmVnaW5zX3dpdGgoU0ssIDpzayknLFxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAnOnBrJzogYENPTVBBTlkjJHt0aWNrZXIudG9VcHBlckNhc2UoKX1gLFxuICAgICAgICAnOnNrJzogJ1FVQVJURVIjJyxcbiAgICAgIH0sXG4gICAgICBTY2FuSW5kZXhGb3J3YXJkOiBmYWxzZSwgLy8gTW9zdCByZWNlbnQgZmlyc3RcbiAgICAgIExpbWl0OiA4LCAvLyBMYXN0IDggcXVhcnRlcnNcbiAgICB9KTtcblxuICAgIGNvbnN0IGZpbmFuY2lhbHNSZXN1bHQgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChmaW5hbmNpYWxzQ29tbWFuZCk7XG5cbiAgICBjb25zdCBjb21wYW55ID0ge1xuICAgICAgLi4uY29tcGFueVJlc3VsdC5JdGVtLFxuICAgICAgcXVhcnRlcmx5RGF0YTogZmluYW5jaWFsc1Jlc3VsdC5JdGVtcyB8fCBbXSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnMsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IGNvbXBhbnksXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSksXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKGBFcnJvciBnZXR0aW5nIGNvbXBhbnkgJHt0aWNrZXJ9OmAsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgaGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogJ0ZhaWxlZCB0byByZXRyaWV2ZSBjb21wYW55IGRhdGEnLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gbGlzdENvbXBhbmllcyhcbiAgcXVlcnlQYXJhbXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sXG4gIGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz5cbikge1xuICB0cnkge1xuICAgIGNvbnN0IHsgc2VjdG9yLCBsaW1pdCA9ICcyMCcsIHBhZ2UgPSAnMScsIHNvcnRCeSA9ICduYW1lJywgc29ydE9yZGVyID0gJ2FzYycgfSA9IHF1ZXJ5UGFyYW1zO1xuICAgIGNvbnN0IHBhZ2VTaXplID0gTWF0aC5taW4ocGFyc2VJbnQobGltaXQpLCAxMDApO1xuICAgIGNvbnN0IHBhZ2VOdW1iZXIgPSBNYXRoLm1heChwYXJzZUludChwYWdlKSwgMSk7XG5cbiAgICBsZXQgY29tbWFuZDtcblxuICAgIGxldCByZXN1bHQ7XG4gICAgXG4gICAgaWYgKHNlY3Rvcikge1xuICAgICAgLy8gUXVlcnkgYnkgc2VjdG9yIHVzaW5nIEdTSTFcbiAgICAgIGNvbW1hbmQgPSBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBUQUJMRV9OQU1FLFxuICAgICAgICBJbmRleE5hbWU6ICdHU0kxJyxcbiAgICAgICAgS2V5Q29uZGl0aW9uRXhwcmVzc2lvbjogJ0dTSTFQSyA9IDpzZWN0b3InLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpzZWN0b3InOiBgU0VDVE9SIyR7c2VjdG9yfWAsXG4gICAgICAgIH0sXG4gICAgICAgIExpbWl0OiBwYWdlU2l6ZSxcbiAgICAgICAgU2NhbkluZGV4Rm9yd2FyZDogc29ydE9yZGVyID09PSAnYXNjJyxcbiAgICAgIH0pO1xuICAgICAgcmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNjYW4gZm9yIGFsbCBjb21wYW5pZXMgd2l0aCBNRVRBREFUQSBTS1xuICAgICAgY29uc3Qgc2NhbkNvbW1hbmQgPSBuZXcgU2NhbkNvbW1hbmQoe1xuICAgICAgICBUYWJsZU5hbWU6IFRBQkxFX05BTUUsXG4gICAgICAgIEZpbHRlckV4cHJlc3Npb246ICdTSyA9IDpzaycsXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAnOnNrJzogJ01FVEFEQVRBJyxcbiAgICAgICAgfSxcbiAgICAgICAgTGltaXQ6IDEwMCwgLy8gR2V0IHVwIHRvIDEwMCBjb21wYW5pZXNcbiAgICAgIH0pO1xuICAgICAgcmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoc2NhbkNvbW1hbmQpO1xuICAgIH1cbiAgICBsZXQgaXRlbXMgPSByZXN1bHQuSXRlbXMgfHwgW107XG5cbiAgICAvLyBTb3J0IGl0ZW1zIGlmIG5lZWRlZCAoZm9yIHNjYW4gcmVzdWx0cylcbiAgICBpZiAoIXNlY3RvciAmJiBzb3J0QnkpIHtcbiAgICAgIGl0ZW1zID0gaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhVmFsID0gYVtzb3J0QnldIHx8ICcnO1xuICAgICAgICBjb25zdCBiVmFsID0gYltzb3J0QnldIHx8ICcnO1xuICAgICAgICBcbiAgICAgICAgaWYgKHR5cGVvZiBhVmFsID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgYlZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gc29ydE9yZGVyID09PSAnYXNjJyBcbiAgICAgICAgICAgID8gYVZhbC5sb2NhbGVDb21wYXJlKGJWYWwpXG4gICAgICAgICAgICA6IGJWYWwubG9jYWxlQ29tcGFyZShhVmFsKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHR5cGVvZiBhVmFsID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgYlZhbCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICByZXR1cm4gc29ydE9yZGVyID09PSAnYXNjJyA/IGFWYWwgLSBiVmFsIDogYlZhbCAtIGFWYWw7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiAwO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gVHJhbnNmb3JtIGl0ZW1zIHRvIGNsZWFuIENvbXBhbnkgb2JqZWN0c1xuICAgIGNvbnN0IHRyYW5zZm9ybWVkSXRlbXMgPSBpdGVtcy5tYXAodHJhbnNmb3JtQ29tcGFueUl0ZW0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnMsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBpdGVtczogdHJhbnNmb3JtZWRJdGVtcyxcbiAgICAgICAgICB0b3RhbDogcmVzdWx0LkNvdW50IHx8IDAsXG4gICAgICAgICAgcGFnZTogcGFnZU51bWJlcixcbiAgICAgICAgICBsaW1pdDogcGFnZVNpemUsXG4gICAgICAgICAgaGFzTmV4dDogISFyZXN1bHQuTGFzdEV2YWx1YXRlZEtleSxcbiAgICAgICAgICBoYXNQcmV2OiBwYWdlTnVtYmVyID4gMSxcbiAgICAgICAgfSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICB9KSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxpc3RpbmcgY29tcGFuaWVzOicsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgaGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogJ0ZhaWxlZCB0byBsaXN0IGNvbXBhbmllcycsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjcmVhdGVDb21wYW55KGJvZHk6IHN0cmluZyB8IG51bGwsIGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pIHtcbiAgdHJ5IHtcbiAgICBpZiAoIWJvZHkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogJ1JlcXVlc3QgYm9keSBpcyByZXF1aXJlZCcsXG4gICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBjb21wYW55RGF0YSA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgXG4gICAgaWYgKCFjb21wYW55RGF0YS50aWNrZXIgfHwgIWNvbXBhbnlEYXRhLm5hbWUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogJ1RpY2tlciBhbmQgbmFtZSBhcmUgcmVxdWlyZWQnLFxuICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICB9KSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gSW5pdGlhbGl6ZSBkYXRhIGFnZ3JlZ2F0b3IgYW5kIHByb2Nlc3NvclxuICAgIGNvbnN0IGFnZ3JlZ2F0b3JDb25maWc6IERhdGFBZ2dyZWdhdG9yQ29uZmlnID0ge1xuICAgICAgcmV0cnlBdHRlbXB0czogMixcbiAgICAgIHJldHJ5RGVsYXk6IDEwMDAsXG4gICAgfTtcblxuICAgIGlmIChBTFBIQV9WQU5UQUdFX0FQSV9LRVkpIHtcbiAgICAgIGFnZ3JlZ2F0b3JDb25maWcuYWxwaGFWYW50YWdlID0geyBhcGlLZXk6IEFMUEhBX1ZBTlRBR0VfQVBJX0tFWSB9O1xuICAgIH1cblxuICAgIGlmIChGTVBfQVBJX0tFWSkge1xuICAgICAgYWdncmVnYXRvckNvbmZpZy5maW5hbmNpYWxNb2RlbGluZ1ByZXAgPSB7IGFwaUtleTogRk1QX0FQSV9LRVkgfTtcbiAgICB9XG5cbiAgICBhZ2dyZWdhdG9yQ29uZmlnLnlhaG9vRmluYW5jZSA9IHt9O1xuXG4gICAgY29uc3QgZGF0YUFnZ3JlZ2F0b3IgPSBuZXcgRGF0YUFnZ3JlZ2F0b3IoYWdncmVnYXRvckNvbmZpZyk7XG4gICAgY29uc3QgZGF0YVByb2Nlc3NvciA9IG5ldyBEYXRhUHJvY2Vzc29yKFRBQkxFX05BTUUsIGRhdGFBZ2dyZWdhdG9yKTtcblxuICAgIC8vIFByb2Nlc3MgY29tcGFueSBkYXRhXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZGF0YVByb2Nlc3Nvci5wcm9jZXNzQ29tcGFueURhdGEoY29tcGFueURhdGEudGlja2VyLCBjb21wYW55RGF0YSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAxLFxuICAgICAgaGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIHRpY2tlcjogY29tcGFueURhdGEudGlja2VyLFxuICAgICAgICAgIHJlY29yZHNTdG9yZWQ6IHJlc3VsdC5zdG9yYWdlUmVzdWx0LnJlY29yZHNTdG9yZWQsXG4gICAgICAgICAgcXVhbGl0eVNjb3JlOiByZXN1bHQucXVhbGl0eU1ldHJpY3Mub3ZlcmFsbCxcbiAgICAgICAgfSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICB9KSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIGNvbXBhbnk6JywgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBoZWFkZXJzLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIGVycm9yOiAnRmFpbGVkIHRvIGNyZWF0ZSBjb21wYW55JyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcicsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVDb21wYW55RGF0YSh0aWNrZXI6IHN0cmluZywgYm9keTogc3RyaW5nIHwgbnVsbCwgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPikge1xuICB0cnkge1xuICAgIC8vIEluaXRpYWxpemUgZGF0YSBhZ2dyZWdhdG9yIGFuZCBwcm9jZXNzb3JcbiAgICBjb25zdCBhZ2dyZWdhdG9yQ29uZmlnOiBEYXRhQWdncmVnYXRvckNvbmZpZyA9IHtcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IDIsXG4gICAgICByZXRyeURlbGF5OiAxMDAwLFxuICAgIH07XG5cbiAgICBpZiAoQUxQSEFfVkFOVEFHRV9BUElfS0VZKSB7XG4gICAgICBhZ2dyZWdhdG9yQ29uZmlnLmFscGhhVmFudGFnZSA9IHsgYXBpS2V5OiBBTFBIQV9WQU5UQUdFX0FQSV9LRVkgfTtcbiAgICB9XG5cbiAgICBpZiAoRk1QX0FQSV9LRVkpIHtcbiAgICAgIGFnZ3JlZ2F0b3JDb25maWcuZmluYW5jaWFsTW9kZWxpbmdQcmVwID0geyBhcGlLZXk6IEZNUF9BUElfS0VZIH07XG4gICAgfVxuXG4gICAgYWdncmVnYXRvckNvbmZpZy55YWhvb0ZpbmFuY2UgPSB7fTtcblxuICAgIGNvbnN0IGRhdGFBZ2dyZWdhdG9yID0gbmV3IERhdGFBZ2dyZWdhdG9yKGFnZ3JlZ2F0b3JDb25maWcpO1xuICAgIGNvbnN0IGRhdGFQcm9jZXNzb3IgPSBuZXcgRGF0YVByb2Nlc3NvcihUQUJMRV9OQU1FLCBkYXRhQWdncmVnYXRvcik7XG5cbiAgICAvLyBHZXQgZXhpc3RpbmcgY29tcGFueSBpbmZvIGlmIGF2YWlsYWJsZVxuICAgIGxldCBjb21wYW55SW5mbyA9IHt9O1xuICAgIGlmIChib2R5KSB7XG4gICAgICBjb21wYW55SW5mbyA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgfVxuXG4gICAgLy8gUHJvY2VzcyBjb21wYW55IGRhdGFcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkYXRhUHJvY2Vzc29yLnByb2Nlc3NDb21wYW55RGF0YSh0aWNrZXIsIGNvbXBhbnlJbmZvKTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgdGlja2VyOiB0aWNrZXIudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICByZWNvcmRzVXBkYXRlZDogcmVzdWx0LnN0b3JhZ2VSZXN1bHQucmVjb3Jkc1N0b3JlZCxcbiAgICAgICAgICBxdWFsaXR5U2NvcmU6IHJlc3VsdC5xdWFsaXR5TWV0cmljcy5vdmVyYWxsLFxuICAgICAgICAgIHNvdXJjZXM6IHJlc3VsdC5hZ2dyZWdhdGlvblJlc3VsdC5zb3VyY2VzLm1hcChzID0+ICh7XG4gICAgICAgICAgICBzb3VyY2U6IHMuc291cmNlLFxuICAgICAgICAgICAgc3VjY2Vzczogcy5zdWNjZXNzLFxuICAgICAgICAgIH0pKSxcbiAgICAgICAgfSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICB9KSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIHVwZGF0aW5nIGNvbXBhbnkgZGF0YSBmb3IgJHt0aWNrZXJ9OmAsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgaGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogJ0ZhaWxlZCB0byB1cGRhdGUgY29tcGFueSBkYXRhJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcicsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVDb21wYW55KHRpY2tlcjogc3RyaW5nLCBib2R5OiBzdHJpbmcgfCBudWxsLCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KSB7XG4gIC8vIFRoaXMgd291bGQgdXBkYXRlIGNvbXBhbnkgbWV0YWRhdGEgb25seSAobm90IGZpbmFuY2lhbCBkYXRhKVxuICAvLyBJbXBsZW1lbnRhdGlvbiB3b3VsZCBiZSBzaW1pbGFyIHRvIGNyZWF0ZUNvbXBhbnkgYnV0IGZvciB1cGRhdGVzXG4gIHJldHVybiB7XG4gICAgc3RhdHVzQ29kZTogNTAxLFxuICAgIGhlYWRlcnMsXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgZXJyb3I6ICdDb21wYW55IG1ldGFkYXRhIHVwZGF0ZSBub3QgaW1wbGVtZW50ZWQgeWV0JyxcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH0pLFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBkZWxldGVDb21wYW55KHRpY2tlcjogc3RyaW5nLCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KSB7XG4gIC8vIFRoaXMgd291bGQgZGVsZXRlIGNvbXBhbnkgYW5kIGFsbCBhc3NvY2lhdGVkIGRhdGFcbiAgLy8gSW1wbGVtZW50YXRpb24gd291bGQgcmVxdWlyZSBjYXJlZnVsIGNhc2NhZGUgZGVsZXRpb25cbiAgcmV0dXJuIHtcbiAgICBzdGF0dXNDb2RlOiA1MDEsXG4gICAgaGVhZGVycyxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogJ0NvbXBhbnkgZGVsZXRpb24gbm90IGltcGxlbWVudGVkIHlldCcsXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICB9KSxcbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0Q29tcGFueVNlZ21lbnREYXRhKHRpY2tlcjogc3RyaW5nLCBzZWdtZW50OiBzdHJpbmcsIGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1cHBlclRpY2tlciA9IHRpY2tlci50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IHVwcGVyU2VnbWVudCA9IHNlZ21lbnQudG9VcHBlckNhc2UoKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhgRmV0Y2hpbmcgJHt1cHBlclNlZ21lbnR9IHNlZ21lbnQgZGF0YSBmb3IgJHt1cHBlclRpY2tlcn1gKTtcbiAgICBcbiAgICAvLyBRdWVyeSBmb3Igc2VnbWVudCBkYXRhXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICBUYWJsZU5hbWU6IFRBQkxFX05BTUUsXG4gICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAnUEsgPSA6cGsgQU5EIGJlZ2luc193aXRoKFNLLCA6c2spJyxcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgJzpwayc6IGBDT01QQU5ZIyR7dXBwZXJUaWNrZXJ9YCxcbiAgICAgICAgJzpzayc6IGBTRUdNRU5UIyR7dXBwZXJTZWdtZW50fSNgLFxuICAgICAgfSxcbiAgICAgIFNjYW5JbmRleEZvcndhcmQ6IGZhbHNlLCAvLyBNb3N0IHJlY2VudCBmaXJzdFxuICAgIH0pKTtcblxuICAgIGlmICghcmVzdWx0Lkl0ZW1zIHx8IHJlc3VsdC5JdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgaGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGVycm9yOiBgTm8gJHtzZWdtZW50fSBzZWdtZW50IGRhdGEgZm91bmQgZm9yICR7dGlja2VyfWAsXG4gICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBUcmFuc2Zvcm0gc2VnbWVudCBkYXRhXG4gICAgY29uc3Qgc2VnbWVudERhdGEgPSByZXN1bHQuSXRlbXMubWFwKGl0ZW0gPT4gKHtcbiAgICAgIHF1YXJ0ZXI6IGl0ZW0ucXVhcnRlcixcbiAgICAgIHJlcG9ydERhdGU6IGl0ZW0ucmVwb3J0RGF0ZSxcbiAgICAgIHNlZ21lbnROYW1lOiBpdGVtLnNlZ21lbnROYW1lLFxuICAgICAgcmV2ZW51ZTogaXRlbS5yZXZlbnVlLFxuICAgICAgb3BlcmF0aW5nSW5jb21lOiBpdGVtLm9wZXJhdGluZ0luY29tZSxcbiAgICAgIG9wZXJhdGluZ01hcmdpbjogaXRlbS5vcGVyYXRpbmdNYXJnaW4sXG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnMsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHNlZ21lbnREYXRhLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIH0pLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihgRXJyb3IgZmV0Y2hpbmcgc2VnbWVudCBkYXRhIGZvciAke3RpY2tlcn06YCwgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBoZWFkZXJzLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6ICdGYWlsZWQgdG8gZmV0Y2ggc2VnbWVudCBkYXRhJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcicsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxufVxuIl19