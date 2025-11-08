"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataProcessor = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
class DataProcessor {
    tableName;
    dataAggregator;
    constructor(tableName, dataAggregator) {
        this.tableName = tableName;
        this.dataAggregator = dataAggregator;
    }
    async processCompanyData(symbol, companyInfo) {
        console.log(`Processing data for company: ${symbol}`);
        // Step 1: Aggregate data from external APIs
        const aggregationResult = await this.dataAggregator.getCompanyFinancials(symbol);
        if (!aggregationResult.success || aggregationResult.data.length === 0) {
            throw new Error(`Failed to aggregate data for ${symbol}: No valid data found`);
        }
        // Step 2: Validate each quarter's data
        const validationResults = [];
        const validQuarters = [];
        for (const quarterData of aggregationResult.data) {
            const validation = this.validateQuarterlyData(quarterData);
            validationResults.push(validation);
            if (validation.isValid && validation.cleanedData) {
                validQuarters.push(validation.cleanedData);
            }
        }
        // Step 3: Calculate data quality metrics
        const qualityMetrics = this.calculateDataQuality(validQuarters, aggregationResult);
        // Step 4: Store validated data
        const storageResult = await this.storeCompanyData(symbol, validQuarters, companyInfo);
        return {
            aggregationResult,
            validationResults,
            storageResult,
            qualityMetrics,
        };
    }
    validateQuarterlyData(data) {
        const errors = [];
        const warnings = [];
        // Required field validation
        if (!data.quarter) {
            errors.push('Quarter is required');
        }
        else if (!/^\d{4}-Q[1-4]$/.test(data.quarter)) {
            errors.push('Quarter must be in format YYYY-QN (e.g., 2024-Q1)');
        }
        if (!data.reportDate) {
            errors.push('Report date is required');
        }
        else {
            const reportDate = new Date(data.reportDate);
            if (isNaN(reportDate.getTime())) {
                errors.push('Report date must be a valid date');
            }
            else if (reportDate > new Date()) {
                warnings.push('Report date is in the future');
            }
        }
        // Financial data validation
        if (data.totalRevenue < 0) {
            errors.push('Total revenue cannot be negative');
        }
        if (data.netSales < 0) {
            errors.push('Net sales cannot be negative');
        }
        if (data.totalRevenue > 0 && data.netSales > 0 && data.netSales > data.totalRevenue * 1.1) {
            warnings.push('Net sales significantly exceeds total revenue');
        }
        // EPS validation
        if (data.eps !== undefined && data.netIncome !== undefined && data.sharesOutstanding !== undefined) {
            const calculatedEps = data.sharesOutstanding > 0 ? data.netIncome / data.sharesOutstanding : 0;
            if (Math.abs(calculatedEps - data.eps) > Math.abs(data.eps * 0.1)) {
                warnings.push('EPS calculation inconsistency detected');
            }
        }
        // Balance sheet validation
        if (data.totalAssets !== undefined && data.totalAssets < 0) {
            errors.push('Total assets cannot be negative');
        }
        if (data.totalDebt !== undefined && data.totalDebt < 0) {
            errors.push('Total debt cannot be negative');
        }
        if (data.shareholderEquity !== undefined && data.totalAssets !== undefined && data.totalDebt !== undefined) {
            const impliedEquity = data.totalAssets - data.totalDebt;
            if (Math.abs(impliedEquity - data.shareholderEquity) > Math.abs(data.shareholderEquity * 0.2)) {
                warnings.push('Balance sheet equation inconsistency detected');
            }
        }
        // Data completeness check
        const requiredFields = ['quarter', 'reportDate', 'totalRevenue', 'netIncome'];
        const missingRequired = requiredFields.filter(field => !data[field]);
        if (missingRequired.length > 0) {
            errors.push(`Missing required fields: ${missingRequired.join(', ')}`);
        }
        // Clean and normalize data
        const cleanedData = {
            quarter: data.quarter,
            reportDate: data.reportDate,
            netSales: Math.max(0, data.netSales || 0),
            totalRevenue: Math.max(0, data.totalRevenue || 0),
            netIncome: data.netIncome || 0,
            eps: data.eps || 0,
            operatingIncome: data.operatingIncome || 0,
            freeCashFlow: data.freeCashFlow || 0,
            totalAssets: data.totalAssets && data.totalAssets > 0 ? data.totalAssets : undefined,
            totalDebt: data.totalDebt && data.totalDebt > 0 ? data.totalDebt : undefined,
            shareholderEquity: data.shareholderEquity,
            sharesOutstanding: data.sharesOutstanding && data.sharesOutstanding > 0 ? data.sharesOutstanding : undefined,
        };
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            cleanedData: errors.length === 0 ? cleanedData : undefined,
        };
    }
    calculateDataQuality(quarters, aggregationResult) {
        if (quarters.length === 0) {
            return { completeness: 0, consistency: 0, accuracy: 0, timeliness: 0, overall: 0 };
        }
        // Completeness: percentage of expected fields that are populated
        const expectedFields = ['totalRevenue', 'netIncome', 'eps', 'operatingIncome', 'freeCashFlow'];
        let totalFields = 0;
        let populatedFields = 0;
        quarters.forEach(quarter => {
            expectedFields.forEach(field => {
                totalFields++;
                if (quarter[field] !== undefined && quarter[field] !== 0) {
                    populatedFields++;
                }
            });
        });
        const completeness = totalFields > 0 ? populatedFields / totalFields : 0;
        // Consistency: check for logical relationships between fields
        let consistencyChecks = 0;
        let passedChecks = 0;
        quarters.forEach(quarter => {
            // Revenue consistency
            if (quarter.totalRevenue > 0 && quarter.netSales > 0) {
                consistencyChecks++;
                if (quarter.netSales <= quarter.totalRevenue * 1.1) {
                    passedChecks++;
                }
            }
            // Profitability consistency
            if (quarter.totalRevenue > 0 && quarter.netIncome !== undefined) {
                consistencyChecks++;
                const margin = quarter.netIncome / quarter.totalRevenue;
                if (margin >= -1 && margin <= 1) { // Reasonable profit margin range
                    passedChecks++;
                }
            }
        });
        const consistency = consistencyChecks > 0 ? passedChecks / consistencyChecks : 1;
        // Accuracy: based on successful data source aggregation
        const successfulSources = aggregationResult.sources.filter(s => s.success).length;
        const totalSources = aggregationResult.sources.length;
        const accuracy = totalSources > 0 ? successfulSources / totalSources : 0;
        // Timeliness: based on how recent the data is
        const latestQuarter = quarters.reduce((latest, quarter) => {
            return new Date(quarter.reportDate) > new Date(latest.reportDate) ? quarter : latest;
        });
        const daysSinceLatest = Math.floor((Date.now() - new Date(latestQuarter.reportDate).getTime()) / (1000 * 60 * 60 * 24));
        const timeliness = Math.max(0, 1 - daysSinceLatest / 365); // Decay over a year
        // Overall score (weighted average)
        const overall = (completeness * 0.3 + consistency * 0.25 + accuracy * 0.25 + timeliness * 0.2);
        return {
            completeness: Math.round(completeness * 100) / 100,
            consistency: Math.round(consistency * 100) / 100,
            accuracy: Math.round(accuracy * 100) / 100,
            timeliness: Math.round(timeliness * 100) / 100,
            overall: Math.round(overall * 100) / 100,
        };
    }
    async storeCompanyData(symbol, quarters, companyInfo) {
        const errors = [];
        let recordsStored = 0;
        let duplicatesSkipped = 0;
        try {
            // Check for existing data to avoid duplicates
            const existingQuarters = await this.getExistingQuarters(symbol);
            const existingQuarterSet = new Set(existingQuarters);
            // Prepare company metadata record
            if (companyInfo) {
                const companyRecord = {
                    PK: `COMPANY#${symbol.toUpperCase()}`,
                    SK: 'METADATA',
                    name: companyInfo.name || symbol,
                    ticker: symbol.toUpperCase(),
                    sector: companyInfo.sector || 'Unknown',
                    industry: companyInfo.industry,
                    marketCap: companyInfo.marketCap || 0,
                    employees: companyInfo.employees,
                    founded: companyInfo.founded,
                    headquarters: companyInfo.headquarters,
                    website: companyInfo.website,
                    description: companyInfo.description,
                    lastUpdated: new Date().toISOString(),
                    GSI1PK: `SECTOR#${companyInfo.sector || 'Unknown'}`,
                    GSI1SK: `COMPANY#${companyInfo.name || symbol}`,
                };
                await docClient.send(new lib_dynamodb_1.PutCommand({
                    TableName: this.tableName,
                    Item: companyRecord,
                }));
                recordsStored++;
            }
            // Prepare quarterly financial records
            const quarterlyRecords = [];
            for (const quarter of quarters) {
                if (existingQuarterSet.has(quarter.quarter)) {
                    duplicatesSkipped++;
                    continue;
                }
                const record = {
                    PK: `COMPANY#${symbol.toUpperCase()}`,
                    SK: `QUARTER#${quarter.quarter}`,
                    ...quarter,
                };
                quarterlyRecords.push(record);
            }
            // Batch write quarterly records
            if (quarterlyRecords.length > 0) {
                const batchSize = 25; // DynamoDB batch write limit
                for (let i = 0; i < quarterlyRecords.length; i += batchSize) {
                    const batch = quarterlyRecords.slice(i, i + batchSize);
                    await docClient.send(new lib_dynamodb_1.BatchWriteCommand({
                        RequestItems: {
                            [this.tableName]: batch.map(record => ({
                                PutRequest: { Item: record }
                            }))
                        }
                    }));
                    recordsStored += batch.length;
                }
            }
            return {
                success: true,
                recordsStored,
                errors,
                duplicatesSkipped,
            };
        }
        catch (error) {
            console.error('Error storing company data:', error);
            errors.push(`Storage error: ${error}`);
            return {
                success: false,
                recordsStored,
                errors,
                duplicatesSkipped,
            };
        }
    }
    async getExistingQuarters(symbol) {
        try {
            const command = new lib_dynamodb_1.QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `COMPANY#${symbol.toUpperCase()}`,
                    ':sk': 'QUARTER#',
                },
                ProjectionExpression: 'quarter',
            });
            const result = await docClient.send(command);
            return (result.Items || []).map(item => item.quarter).filter(Boolean);
        }
        catch (error) {
            console.warn('Error checking existing quarters:', error);
            return [];
        }
    }
}
exports.DataProcessor = DataProcessor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1wcm9jZXNzb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhLXByb2Nlc3Nvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw4REFBMEQ7QUFDMUQsd0RBQTRHO0FBSTVHLE1BQU0sTUFBTSxHQUFHLElBQUksZ0NBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN0QyxNQUFNLFNBQVMsR0FBRyxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUF3QnRELE1BQWEsYUFBYTtJQUNoQixTQUFTLENBQVM7SUFDbEIsY0FBYyxDQUFpQjtJQUV2QyxZQUFZLFNBQWlCLEVBQUUsY0FBOEI7UUFDM0QsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7SUFDdkMsQ0FBQztJQUVELEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxNQUFjLEVBQUUsV0FBOEI7UUFNckUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUV0RCw0Q0FBNEM7UUFDNUMsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFakYsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3RFLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLE1BQU0sdUJBQXVCLENBQUMsQ0FBQztRQUNqRixDQUFDO1FBRUQsdUNBQXVDO1FBQ3ZDLE1BQU0saUJBQWlCLEdBQXVCLEVBQUUsQ0FBQztRQUNqRCxNQUFNLGFBQWEsR0FBMEIsRUFBRSxDQUFDO1FBRWhELEtBQUssTUFBTSxXQUFXLElBQUksaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDakQsTUFBTSxVQUFVLEdBQUcsSUFB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QUNsQixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFTyxLQUFLLENBQUMsbUJBQW1CLENBQUMsTUFBYztRQUM5QyxJQUFJLENBQUM7WUFDSCxNQUFNLE9BQU8sR0FBRyxJQUFJLDJCQUFZLENBQUM7Z0JBQy9CLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztnQkFDekIsc0JBQXNCLEVBQUUsbUNBQW1DO2dCQUMzRCx5QkFBeUIsRUFBRTtvQkFDekIsS0FBSyxFQUFFLFdBQVcsTUFBTSxDQUFDLFdBQVcsRUFBRSxFQUFFO29CQUN4QyxLQUFLLEVBQUUsVUFBVTtpQkFDbEI7Z0JBQ0Qsb0JBQW9CLEVBQUUsU0FBUzthQUNoQyxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDN0MsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUNBQW1DLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDekQsT0FBTyxFQUFFLENBQUM7UUFDWixDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBelVELHNDQXlVQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFB1dENvbW1hbmQsIEJhdGNoV3JpdGVDb21tYW5kLCBRdWVyeUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuaW1wb3J0IHsgUXVhcnRlcmx5RmluYW5jaWFscywgQ29tcGFueSwgQ29tcGFueVJlY29yZCwgUXVhcnRlcmx5RmluYW5jaWFsc1JlY29yZCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgRGF0YUFnZ3JlZ2F0b3IsIEFnZ3JlZ2F0ZWRSZXN1bHQgfSBmcm9tICcuL2FwaS1jbGllbnRzL2RhdGEtYWdncmVnYXRvcic7XG5cbmNvbnN0IGNsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7fSk7XG5jb25zdCBkb2NDbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oY2xpZW50KTtcblxuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0aW9uUmVzdWx0IHtcbiAgaXNWYWxpZDogYm9vbGVhbjtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgd2FybmluZ3M6IHN0cmluZ1tdO1xuICBjbGVhbmVkRGF0YT86IFF1YXJ0ZXJseUZpbmFuY2lhbHM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RvcmFnZVJlc3VsdCB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIHJlY29yZHNTdG9yZWQ6IG51bWJlcjtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgZHVwbGljYXRlc1NraXBwZWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEYXRhUXVhbGl0eU1ldHJpY3Mge1xuICBjb21wbGV0ZW5lc3M6IG51bWJlcjsgLy8gMC0xIHNjb3JlXG4gIGNvbnNpc3RlbmN5OiBudW1iZXI7IC8vIDAtMSBzY29yZVxuICBhY2N1cmFjeTogbnVtYmVyOyAvLyAwLTEgc2NvcmVcbiAgdGltZWxpbmVzczogbnVtYmVyOyAvLyAwLTEgc2NvcmVcbiAgb3ZlcmFsbDogbnVtYmVyOyAvLyAwLTEgc2NvcmVcbn1cblxuZXhwb3J0IGNsYXNzIERhdGFQcm9jZXNzb3Ige1xuICBwcml2YXRlIHRhYmxlTmFtZTogc3RyaW5nO1xuICBwcml2YXRlIGRhdGFBZ2dyZWdhdG9yOiBEYXRhQWdncmVnYXRvcjtcblxuICBjb25zdHJ1Y3Rvcih0YWJsZU5hbWU6IHN0cmluZywgZGF0YUFnZ3JlZ2F0b3I6IERhdGFBZ2dyZWdhdG9yKSB7XG4gICAgdGhpcy50YWJsZU5hbWUgPSB0YWJsZU5hbWU7XG4gICAgdGhpcy5kYXRhQWdncmVnYXRvciA9IGRhdGFBZ2dyZWdhdG9yO1xuICB9XG5cbiAgYXN5bmMgcHJvY2Vzc0NvbXBhbnlEYXRhKHN5bWJvbDogc3RyaW5nLCBjb21wYW55SW5mbz86IFBhcnRpYWw8Q29tcGFueT4pOiBQcm9taXNlPHtcbiAgICBhZ2dyZWdhdGlvblJlc3VsdDogQWdncmVnYXRlZFJlc3VsdDtcbiAgICB2YWxpZGF0aW9uUmVzdWx0czogVmFsaWRhdGlvblJlc3VsdFtdO1xuICAgIHN0b3JhZ2VSZXN1bHQ6IFN0b3JhZ2VSZXN1bHQ7XG4gICAgcXVhbGl0eU1ldHJpY3M6IERhdGFRdWFsaXR5TWV0cmljcztcbiAgfT4ge1xuICAgIGNvbnNvbGUubG9nKGBQcm9jZXNzaW5nIGRhdGEgZm9yIGNvbXBhbnk6ICR7c3ltYm9sfWApO1xuXG4gICAgLy8gU3RlcCAxOiBBZ2dyZWdhdGUgZGF0YSBmcm9tIGV4dGVybmFsIEFQSXNcbiAgICBjb25zdCBhZ2dyZWdhdGlvblJlc3VsdCA9IGF3YWl0IHRoaXMuZGF0YUFnZ3JlZ2F0b3IuZ2V0Q29tcGFueUZpbmFuY2lhbHMoc3ltYm9sKTtcblxuICAgIGlmICghYWdncmVnYXRpb25SZXN1bHQuc3VjY2VzcyB8fCBhZ2dyZWdhdGlvblJlc3VsdC5kYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gYWdncmVnYXRlIGRhdGEgZm9yICR7c3ltYm9sfTogTm8gdmFsaWQgZGF0YSBmb3VuZGApO1xuICAgIH1cblxuICAgIC8vIFN0ZXAgMjogVmFsaWRhdGUgZWFjaCBxdWFydGVyJ3MgZGF0YVxuICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHRzOiBWYWxpZGF0aW9uUmVzdWx0W10gPSBbXTtcbiAgICBjb25zdCB2YWxpZFF1YXJ0ZXJzOiBRdWFydGVybHlGaW5hbmNpYWxzW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgcXVhcnRlckRhdGEgb2YgYWdncmVnYXRpb25SZXN1bHQuZGF0YSkge1xuICAgICAgY29uc3QgdmFsaWRhdGlvbiA9IHRoaXMudmFsaWRhdGVRdWFydGVybHlEYXRhKHF1YXJ0ZXJEYXRhKTtcbiAgICAgIHZhbGlkYXRpb25SZXN1bHRzLnB1c2godmFsaWRhdGlvbik7XG5cbiAgICAgIGlmICh2YWxpZGF0aW9uLmlzVmFsaWQgJiYgdmFsaWRhdGlvbi5jbGVhbmVkRGF0YSkge1xuICAgICAgICB2YWxpZFF1YXJ0ZXJzLnB1c2godmFsaWRhdGlvbi5jbGVhbmVkRGF0YSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU3RlcCAzOiBDYWxjdWxhdGUgZGF0YSBxdWFsaXR5IG1ldHJpY3NcbiAgICBjb25zdCBxdWFsaXR5TWV0cmljcyA9IHRoaXMuY2FsY3VsYXRlRGF0YVF1YWxpdHkodmFsaWRRdWFydGVycywgYWdncmVnYXRpb25SZXN1bHQpO1xuXG4gICAgLy8gU3RlcCA0OiBTdG9yZSB2YWxpZGF0ZWQgZGF0YVxuICAgIGNvbnN0IHN0b3JhZ2VSZXN1bHQgPSBhd2FpdCB0aGlzLnN0b3JlQ29tcGFueURhdGEoc3ltYm9sLCB2YWxpZFF1YXJ0ZXJzLCBjb21wYW55SW5mbyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWdncmVnYXRpb25SZXN1bHQsXG4gICAgICB2YWxpZGF0aW9uUmVzdWx0cyxcbiAgICAgIHN0b3JhZ2VSZXN1bHQsXG4gICAgICBxdWFsaXR5TWV0cmljcyxcbiAgICB9O1xuICB9XG5cbiAgdmFsaWRhdGVRdWFydGVybHlEYXRhKGRhdGE6IFF1YXJ0ZXJseUZpbmFuY2lhbHMpOiBWYWxpZGF0aW9uUmVzdWx0IHtcbiAgICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyBSZXF1aXJlZCBmaWVsZCB2YWxpZGF0aW9uXG4gICAgaWYgKCFkYXRhLnF1YXJ0ZXIpIHtcbiAgICAgIGVycm9ycy5wdXNoKCdRdWFydGVyIGlzIHJlcXVpcmVkJyk7XG4gICAgfSBlbHNlIGlmICghL15cXGR7NH0tUVsxLTRdJC8udGVzdChkYXRhLnF1YXJ0ZXIpKSB7XG4gICAgICBlcnJvcnMucHVzaCgnUXVhcnRlciBtdXN0IGJlIGluIGZvcm1hdCBZWVlZLVFOIChlLmcuLCAyMDI0LVExKScpO1xuICAgIH1cblxuICAgIGlmICghZGF0YS5yZXBvcnREYXRlKSB7XG4gICAgICBlcnJvcnMucHVzaCgnUmVwb3J0IGRhdGUgaXMgcmVxdWlyZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVwb3J0RGF0ZSA9IG5ldyBEYXRlKGRhdGEucmVwb3J0RGF0ZSk7XG4gICAgICBpZiAoaXNOYU4ocmVwb3J0RGF0ZS5nZXRUaW1lKCkpKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdSZXBvcnQgZGF0ZSBtdXN0IGJlIGEgdmFsaWQgZGF0ZScpO1xuICAgICAgfSBlbHNlIGlmIChyZXBvcnREYXRlID4gbmV3IERhdGUoKSkge1xuICAgICAgICB3YXJuaW5ncy5wdXNoKCdSZXBvcnQgZGF0ZSBpcyBpbiB0aGUgZnV0dXJlJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmluYW5jaWFsIGRhdGEgdmFsaWRhdGlvblxuICAgIGlmIChkYXRhLnRvdGFsUmV2ZW51ZSA8IDApIHtcbiAgICAgIGVycm9ycy5wdXNoKCdUb3RhbCByZXZlbnVlIGNhbm5vdCBiZSBuZWdhdGl2ZScpO1xuICAgIH1cblxuICAgIGlmIChkYXRhLm5ldFNhbGVzIDwgMCkge1xuICAgICAgZXJyb3JzLnB1c2goJ05ldCBzYWxlcyBjYW5ub3QgYmUgbmVnYXRpdmUnKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS50b3RhbFJldmVudWUgPiAwICYmIGRhdGEubmV0U2FsZXMgPiAwICYmIGRhdGEubmV0U2FsZXMgPiBkYXRhLnRvdGFsUmV2ZW51ZSAqIDEuMSkge1xuICAgICAgd2FybmluZ3MucHVzaCgnTmV0IHNhbGVzIHNpZ25pZmljYW50bHkgZXhjZWVkcyB0b3RhbCByZXZlbnVlJyk7XG4gICAgfVxuXG4gICAgLy8gRVBTIHZhbGlkYXRpb25cbiAgICBpZiAoZGF0YS5lcHMgIT09IHVuZGVmaW5lZCAmJiBkYXRhLm5ldEluY29tZSAhPT0gdW5kZWZpbmVkICYmIGRhdGEuc2hhcmVzT3V0c3RhbmRpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgY2FsY3VsYXRlZEVwcyA9IGRhdGEuc2hhcmVzT3V0c3RhbmRpbmcgPiAwID8gZGF0YS5uZXRJbmNvbWUgLyBkYXRhLnNoYXJlc091dHN0YW5kaW5nIDogMDtcbiAgICAgIGlmIChNYXRoLmFicyhjYWxjdWxhdGVkRXBzIC0gZGF0YS5lcHMpID4gTWF0aC5hYnMoZGF0YS5lcHMgKiAwLjEpKSB7XG4gICAgICAgIHdhcm5pbmdzLnB1c2goJ0VQUyBjYWxjdWxhdGlvbiBpbmNvbnNpc3RlbmN5IGRldGVjdGVkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQmFsYW5jZSBzaGVldCB2YWxpZGF0aW9uXG4gICAgaWYgKGRhdGEudG90YWxBc3NldHMgIT09IHVuZGVmaW5lZCAmJiBkYXRhLnRvdGFsQXNzZXRzIDwgMCkge1xuICAgICAgZXJyb3JzLnB1c2goJ1RvdGFsIGFzc2V0cyBjYW5ub3QgYmUgbmVnYXRpdmUnKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS50b3RhbERlYnQgIT09IHVuZGVmaW5lZCAmJiBkYXRhLnRvdGFsRGVidCA8IDApIHtcbiAgICAgIGVycm9ycy5wdXNoKCdUb3RhbCBkZWJ0IGNhbm5vdCBiZSBuZWdhdGl2ZScpO1xuICAgIH1cblxuICAgIGlmIChkYXRhLnNoYXJlaG9sZGVyRXF1aXR5ICE9PSB1bmRlZmluZWQgJiYgZGF0YS50b3RhbEFzc2V0cyAhPT0gdW5kZWZpbmVkICYmIGRhdGEudG90YWxEZWJ0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGltcGxpZWRFcXVpdHkgPSBkYXRhLnRvdGFsQXNzZXRzIC0gZGF0YS50b3RhbERlYnQ7XG4gICAgICBpZiAoTWF0aC5hYnMoaW1wbGllZEVxdWl0eSAtIGRhdGEuc2hhcmVob2xkZXJFcXVpdHkpID4gTWF0aC5hYnMoZGF0YS5zaGFyZWhvbGRlckVxdWl0eSAqIDAuMikpIHtcbiAgICAgICAgd2FybmluZ3MucHVzaCgnQmFsYW5jZSBzaGVldCBlcXVhdGlvbiBpbmNvbnNpc3RlbmN5IGRldGVjdGVkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRGF0YSBjb21wbGV0ZW5lc3MgY2hlY2tcbiAgICBjb25zdCByZXF1aXJlZEZpZWxkcyA9IFsncXVhcnRlcicsICdyZXBvcnREYXRlJywgJ3RvdGFsUmV2ZW51ZScsICduZXRJbmNvbWUnXTtcbiAgICBjb25zdCBtaXNzaW5nUmVxdWlyZWQgPSByZXF1aXJlZEZpZWxkcy5maWx0ZXIoZmllbGQgPT4gIWRhdGFbZmllbGQgYXMga2V5b2YgUXVhcnRlcmx5RmluYW5jaWFsc10pO1xuICAgIGlmIChtaXNzaW5nUmVxdWlyZWQubGVuZ3RoID4gMCkge1xuICAgICAgZXJyb3JzLnB1c2goYE1pc3NpbmcgcmVxdWlyZWQgZmllbGRzOiAke21pc3NpbmdSZXF1aXJlZC5qb2luKCcsICcpfWApO1xuICAgIH1cblxuICAgIC8vIENsZWFuIGFuZCBub3JtYWxpemUgZGF0YVxuICAgIGNvbnN0IGNsZWFuZWREYXRhOiBRdWFydGVybHlGaW5hbmNpYWxzID0ge1xuICAgICAgcXVhcnRlcjogZGF0YS5xdWFydGVyLFxuICAgICAgcmVwb3J0RGF0ZTogZGF0YS5yZXBvcnREYXRlLFxuICAgICAgbmV0U2FsZXM6IE1hdGgubWF4KDAsIGRhdGEubmV0U2FsZXMgfHwgMCksXG4gICAgICB0b3RhbFJldmVudWU6IE1hdGgubWF4KDAsIGRhdGEudG90YWxSZXZlbnVlIHx8IDApLFxuICAgICAgbmV0SW5jb21lOiBkYXRhLm5ldEluY29tZSB8fCAwLFxuICAgICAgZXBzOiBkYXRhLmVwcyB8fCAwLFxuICAgICAgb3BlcmF0aW5nSW5jb21lOiBkYXRhLm9wZXJhdGluZ0luY29tZSB8fCAwLFxuICAgICAgZnJlZUNhc2hGbG93OiBkYXRhLmZyZWVDYXNoRmxvdyB8fCAwLFxuICAgICAgdG90YWxBc3NldHM6IGRhdGEudG90YWxBc3NldHMgJiYgZGF0YS50b3RhbEFzc2V0cyA+IDAgPyBkYXRhLnRvdGFsQXNzZXRzIDogdW5kZWZpbmVkLFxuICAgICAgdG90YWxEZWJ0OiBkYXRhLnRvdGFsRGVidCAmJiBkYXRhLnRvdGFsRGVidCA+IDAgPyBkYXRhLnRvdGFsRGVidCA6IHVuZGVmaW5lZCxcbiAgICAgIHNoYXJlaG9sZGVyRXF1aXR5OiBkYXRhLnNoYXJlaG9sZGVyRXF1aXR5LFxuICAgICAgc2hhcmVzT3V0c3RhbmRpbmc6IGRhdGEuc2hhcmVzT3V0c3RhbmRpbmcgJiYgZGF0YS5zaGFyZXNPdXRzdGFuZGluZyA+IDAgPyBkYXRhLnNoYXJlc091dHN0YW5kaW5nIDogdW5kZWZpbmVkLFxuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNWYWxpZDogZXJyb3JzLmxlbmd0aCA9PT0gMCxcbiAgICAgIGVycm9ycyxcbiAgICAgIHdhcm5pbmdzLFxuICAgICAgY2xlYW5lZERhdGE6IGVycm9ycy5sZW5ndGggPT09IDAgPyBjbGVhbmVkRGF0YSA6IHVuZGVmaW5lZCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGVEYXRhUXVhbGl0eShxdWFydGVyczogUXVhcnRlcmx5RmluYW5jaWFsc1tdLCBhZ2dyZWdhdGlvblJlc3VsdDogQWdncmVnYXRlZFJlc3VsdCk6IERhdGFRdWFsaXR5TWV0cmljcyB7XG4gICAgaWYgKHF1YXJ0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHsgY29tcGxldGVuZXNzOiAwLCBjb25zaXN0ZW5jeTogMCwgYWNjdXJhY3k6IDAsIHRpbWVsaW5lc3M6IDAsIG92ZXJhbGw6IDAgfTtcbiAgICB9XG5cbiAgICAvLyBDb21wbGV0ZW5lc3M6IHBlcmNlbnRhZ2Ugb2YgZXhwZWN0ZWQgZmllbGRzIHRoYXQgYXJlIHBvcHVsYXRlZFxuICAgIGNvbnN0IGV4cGVjdGVkRmllbGRzID0gWyd0b3RhbFJldmVudWUnLCAnbmV0SW5jb21lJywgJ2VwcycsICdvcGVyYXRpbmdJbmNvbWUnLCAnZnJlZUNhc2hGbG93J107XG4gICAgbGV0IHRvdGFsRmllbGRzID0gMDtcbiAgICBsZXQgcG9wdWxhdGVkRmllbGRzID0gMDtcblxuICAgIHF1YXJ0ZXJzLmZvckVhY2gocXVhcnRlciA9PiB7XG4gICAgICBleHBlY3RlZEZpZWxkcy5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICAgICAgdG90YWxGaWVsZHMrKztcbiAgICAgICAgaWYgKHF1YXJ0ZXJbZmllbGQgYXMga2V5b2YgUXVhcnRlcmx5RmluYW5jaWFsc10gIT09IHVuZGVmaW5lZCAmJiBxdWFydGVyW2ZpZWxkIGFzIGtleW9mIFF1YXJ0ZXJseUZpbmFuY2lhbHNdICE9PSAwKSB7XG4gICAgICAgICAgcG9wdWxhdGVkRmllbGRzKys7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgY29tcGxldGVuZXNzID0gdG90YWxGaWVsZHMgPiAwID8gcG9wdWxhdGVkRmllbGRzIC8gdG90YWxGaWVsZHMgOiAwO1xuXG4gICAgLy8gQ29uc2lzdGVuY3k6IGNoZWNrIGZvciBsb2dpY2FsIHJlbGF0aW9uc2hpcHMgYmV0d2VlbiBmaWVsZHNcbiAgICBsZXQgY29uc2lzdGVuY3lDaGVja3MgPSAwO1xuICAgIGxldCBwYXNzZWRDaGVja3MgPSAwO1xuXG4gICAgcXVhcnRlcnMuZm9yRWFjaChxdWFydGVyID0+IHtcbiAgICAgIC8vIFJldmVudWUgY29uc2lzdGVuY3lcbiAgICAgIGlmIChxdWFydGVyLnRvdGFsUmV2ZW51ZSA+IDAgJiYgcXVhcnRlci5uZXRTYWxlcyA+IDApIHtcbiAgICAgICAgY29uc2lzdGVuY3lDaGVja3MrKztcbiAgICAgICAgaWYgKHF1YXJ0ZXIubmV0U2FsZXMgPD0gcXVhcnRlci50b3RhbFJldmVudWUgKiAxLjEpIHtcbiAgICAgICAgICBwYXNzZWRDaGVja3MrKztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBQcm9maXRhYmlsaXR5IGNvbnNpc3RlbmN5XG4gICAgICBpZiAocXVhcnRlci50b3RhbFJldmVudWUgPiAwICYmIHF1YXJ0ZXIubmV0SW5jb21lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc2lzdGVuY3lDaGVja3MrKztcbiAgICAgICAgY29uc3QgbWFyZ2luID0gcXVhcnRlci5uZXRJbmNvbWUgLyBxdWFydGVyLnRvdGFsUmV2ZW51ZTtcbiAgICAgICAgaWYgKG1hcmdpbiA+PSAtMSAmJiBtYXJnaW4gPD0gMSkgeyAvLyBSZWFzb25hYmxlIHByb2ZpdCBtYXJnaW4gcmFuZ2VcbiAgICAgICAgICBwYXNzZWRDaGVja3MrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgY29uc2lzdGVuY3kgPSBjb25zaXN0ZW5jeUNoZWNrcyA+IDAgPyBwYXNzZWRDaGVja3MgLyBjb25zaXN0ZW5jeUNoZWNrcyA6IDE7XG5cbiAgICAvLyBBY2N1cmFjeTogYmFzZWQgb24gc3VjY2Vzc2Z1bCBkYXRhIHNvdXJjZSBhZ2dyZWdhdGlvblxuICAgIGNvbnN0IHN1Y2Nlc3NmdWxTb3VyY2VzID0gYWdncmVnYXRpb25SZXN1bHQuc291cmNlcy5maWx0ZXIocyA9PiBzLnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICBjb25zdCB0b3RhbFNvdXJjZXMgPSBhZ2dyZWdhdGlvblJlc3VsdC5zb3VyY2VzLmxlbmd0aDtcbiAgICBjb25zdCBhY2N1cmFjeSA9IHRvdGFsU291cmNlcyA+IDAgPyBzdWNjZXNzZnVsU291cmNlcyAvIHRvdGFsU291cmNlcyA6IDA7XG5cbiAgICAvLyBUaW1lbGluZXNzOiBiYXNlZCBvbiBob3cgcmVjZW50IHRoZSBkYXRhIGlzXG4gICAgY29uc3QgbGF0ZXN0UXVhcnRlciA9IHF1YXJ0ZXJzLnJlZHVjZSgobGF0ZXN0LCBxdWFydGVyKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IERhdGUocXVhcnRlci5yZXBvcnREYXRlKSA+IG5ldyBEYXRlKGxhdGVzdC5yZXBvcnREYXRlKSA/IHF1YXJ0ZXIgOiBsYXRlc3Q7XG4gICAgfSk7XG5cbiAgICBjb25zdCBkYXlzU2luY2VMYXRlc3QgPSBNYXRoLmZsb29yKChEYXRlLm5vdygpIC0gbmV3IERhdGUobGF0ZXN0UXVhcnRlci5yZXBvcnREYXRlKS5nZXRUaW1lKCkpIC8gKDEwMDAgKiA2MCAqIDYwICogMjQpKTtcbiAgICBjb25zdCB0aW1lbGluZXNzID0gTWF0aC5tYXgoMCwgMSAtIGRheXNTaW5jZUxhdGVzdCAvIDM2NSk7IC8vIERlY2F5IG92ZXIgYSB5ZWFyXG5cbiAgICAvLyBPdmVyYWxsIHNjb3JlICh3ZWlnaHRlZCBhdmVyYWdlKVxuICAgIGNvbnN0IG92ZXJhbGwgPSAoY29tcGxldGVuZXNzICogMC4zICsgY29uc2lzdGVuY3kgKiAwLjI1ICsgYWNjdXJhY3kgKiAwLjI1ICsgdGltZWxpbmVzcyAqIDAuMik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29tcGxldGVuZXNzOiBNYXRoLnJvdW5kKGNvbXBsZXRlbmVzcyAqIDEwMCkgLyAxMDAsXG4gICAgICBjb25zaXN0ZW5jeTogTWF0aC5yb3VuZChjb25zaXN0ZW5jeSAqIDEwMCkgLyAxMDAsXG4gICAgICBhY2N1cmFjeTogTWF0aC5yb3VuZChhY2N1cmFjeSAqIDEwMCkgLyAxMDAsXG4gICAgICB0aW1lbGluZXNzOiBNYXRoLnJvdW5kKHRpbWVsaW5lc3MgKiAxMDApIC8gMTAwLFxuICAgICAgb3ZlcmFsbDogTWF0aC5yb3VuZChvdmVyYWxsICogMTAwKSAvIDEwMCxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBzdG9yZUNvbXBhbnlEYXRhKFxuICAgIHN5bWJvbDogc3RyaW5nLFxuICAgIHF1YXJ0ZXJzOiBRdWFydGVybHlGaW5hbmNpYWxzW10sXG4gICAgY29tcGFueUluZm8/OiBQYXJ0aWFsPENvbXBhbnk+XG4gICk6IFByb21pc2U8U3RvcmFnZVJlc3VsdD4ge1xuICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgcmVjb3Jkc1N0b3JlZCA9IDA7XG4gICAgbGV0IGR1cGxpY2F0ZXNTa2lwcGVkID0gMDtcblxuICAgIHRyeSB7XG4gICAgICAvLyBDaGVjayBmb3IgZXhpc3RpbmcgZGF0YSB0byBhdm9pZCBkdXBsaWNhdGVzXG4gICAgICBjb25zdCBleGlzdGluZ1F1YXJ0ZXJzID0gYXdhaXQgdGhpcy5nZXRFeGlzdGluZ1F1YXJ0ZXJzKHN5bWJvbCk7XG4gICAgICBjb25zdCBleGlzdGluZ1F1YXJ0ZXJTZXQgPSBuZXcgU2V0KGV4aXN0aW5nUXVhcnRlcnMpO1xuXG4gICAgICAvLyBQcmVwYXJlIGNvbXBhbnkgbWV0YWRhdGEgcmVjb3JkXG4gICAgICBpZiAoY29tcGFueUluZm8pIHtcbiAgICAgICAgY29uc3QgY29tcGFueVJlY29yZDogQ29tcGFueVJlY29yZCA9IHtcbiAgICAgICAgICBQSzogYENPTVBBTlkjJHtzeW1ib2wudG9VcHBlckNhc2UoKX1gLFxuICAgICAgICAgIFNLOiAnTUVUQURBVEEnLFxuICAgICAgICAgIG5hbWU6IGNvbXBhbnlJbmZvLm5hbWUgfHwgc3ltYm9sLFxuICAgICAgICAgIHRpY2tlcjogc3ltYm9sLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgc2VjdG9yOiBjb21wYW55SW5mby5zZWN0b3IgfHwgJ1Vua25vd24nLFxuICAgICAgICAgIGluZHVzdHJ5OiBjb21wYW55SW5mby5pbmR1c3RyeSxcbiAgICAgICAgICBtYXJrZXRDYXA6IGNvbXBhbnlJbmZvLm1hcmtldENhcCB8fCAwLFxuICAgICAgICAgIGVtcGxveWVlczogY29tcGFueUluZm8uZW1wbG95ZWVzLFxuICAgICAgICAgIGZvdW5kZWQ6IGNvbXBhbnlJbmZvLmZvdW5kZWQsXG4gICAgICAgICAgaGVhZHF1YXJ0ZXJzOiBjb21wYW55SW5mby5oZWFkcXVhcnRlcnMsXG4gICAgICAgICAgd2Vic2l0ZTogY29tcGFueUluZm8ud2Vic2l0ZSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogY29tcGFueUluZm8uZGVzY3JpcHRpb24sXG4gICAgICAgICAgbGFzdFVwZGF0ZWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICBHU0kxUEs6IGBTRUNUT1IjJHtjb21wYW55SW5mby5zZWN0b3IgfHwgJ1Vua25vd24nfWAsXG4gICAgICAgICAgR1NJMVNLOiBgQ09NUEFOWSMke2NvbXBhbnlJbmZvLm5hbWUgfHwgc3ltYm9sfWAsXG4gICAgICAgIH07XG5cbiAgICAgICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IFB1dENvbW1hbmQoe1xuICAgICAgICAgIFRhYmxlTmFtZTogdGhpcy50YWJsZU5hbWUsXG4gICAgICAgICAgSXRlbTogY29tcGFueVJlY29yZCxcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIHJlY29yZHNTdG9yZWQrKztcbiAgICAgIH1cblxuICAgICAgLy8gUHJlcGFyZSBxdWFydGVybHkgZmluYW5jaWFsIHJlY29yZHNcbiAgICAgIGNvbnN0IHF1YXJ0ZXJseVJlY29yZHM6IFF1YXJ0ZXJseUZpbmFuY2lhbHNSZWNvcmRbXSA9IFtdO1xuXG4gICAgICBmb3IgKGNvbnN0IHF1YXJ0ZXIgb2YgcXVhcnRlcnMpIHtcbiAgICAgICAgaWYgKGV4aXN0aW5nUXVhcnRlclNldC5oYXMocXVhcnRlci5xdWFydGVyKSkge1xuICAgICAgICAgIGR1cGxpY2F0ZXNTa2lwcGVkKys7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZWNvcmQ6IFF1YXJ0ZXJseUZpbmFuY2lhbHNSZWNvcmQgPSB7XG4gICAgICAgICAgUEs6IGBDT01QQU5ZIyR7c3ltYm9sLnRvVXBwZXJDYXNlKCl9YCxcbiAgICAgICAgICBTSzogYFFVQVJURVIjJHtxdWFydGVyLnF1YXJ0ZXJ9YCxcbiAgICAgICAgICAuLi5xdWFydGVyLFxuICAgICAgICB9O1xuXG4gICAgICAgIHF1YXJ0ZXJseVJlY29yZHMucHVzaChyZWNvcmQpO1xuICAgICAgfVxuXG4gICAgICAvLyBCYXRjaCB3cml0ZSBxdWFydGVybHkgcmVjb3Jkc1xuICAgICAgaWYgKHF1YXJ0ZXJseVJlY29yZHMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBiYXRjaFNpemUgPSAyNTsgLy8gRHluYW1vREIgYmF0Y2ggd3JpdGUgbGltaXRcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWFydGVybHlSZWNvcmRzLmxlbmd0aDsgaSArPSBiYXRjaFNpemUpIHtcbiAgICAgICAgICBjb25zdCBiYXRjaCA9IHF1YXJ0ZXJseVJlY29yZHMuc2xpY2UoaSwgaSArIGJhdGNoU2l6ZSk7XG4gICAgICAgICAgXG4gICAgICAgICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IEJhdGNoV3JpdGVDb21tYW5kKHtcbiAgICAgICAgICAgIFJlcXVlc3RJdGVtczoge1xuICAgICAgICAgICAgICBbdGhpcy50YWJsZU5hbWVdOiBiYXRjaC5tYXAocmVjb3JkID0+ICh7XG4gICAgICAgICAgICAgICAgUHV0UmVxdWVzdDogeyBJdGVtOiByZWNvcmQgfVxuICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICByZWNvcmRzU3RvcmVkICs9IGJhdGNoLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICByZWNvcmRzU3RvcmVkLFxuICAgICAgICBlcnJvcnMsXG4gICAgICAgIGR1cGxpY2F0ZXNTa2lwcGVkLFxuICAgICAgfTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzdG9yaW5nIGNvbXBhbnkgZGF0YTonLCBlcnJvcik7XG4gICAgICBlcnJvcnMucHVzaChgU3RvcmFnZSBlcnJvcjogJHtlcnJvcn1gKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIHJlY29yZHNTdG9yZWQsXG4gICAgICAgIGVycm9ycyxcbiAgICAgICAgZHVwbGljYXRlc1NraXBwZWQsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZ2V0RXhpc3RpbmdRdWFydGVycyhzeW1ib2w6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29tbWFuZCA9IG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgICBUYWJsZU5hbWU6IHRoaXMudGFibGVOYW1lLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAnUEsgPSA6cGsgQU5EIGJlZ2luc193aXRoKFNLLCA6c2spJyxcbiAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICc6cGsnOiBgQ09NUEFOWSMke3N5bWJvbC50b1VwcGVyQ2FzZSgpfWAsXG4gICAgICAgICAgJzpzayc6ICdRVUFSVEVSIycsXG4gICAgICAgIH0sXG4gICAgICAgIFByb2plY3Rpb25FeHByZXNzaW9uOiAncXVhcnRlcicsXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICByZXR1cm4gKHJlc3VsdC5JdGVtcyB8fCBbXSkubWFwKGl0ZW0gPT4gaXRlbS5xdWFydGVyKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2FybignRXJyb3IgY2hlY2tpbmcgZXhpc3RpbmcgcXVhcnRlcnM6JywgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufSJdfQ==