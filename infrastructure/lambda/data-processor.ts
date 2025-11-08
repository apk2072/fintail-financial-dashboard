import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { QuarterlyFinancials, Company, CompanyRecord, QuarterlyFinancialsRecord } from './types';
import { DataAggregator, AggregatedResult } from './api-clients/data-aggregator';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleanedData?: QuarterlyFinancials;
}

export interface StorageResult {
  success: boolean;
  recordsStored: number;
  errors: string[];
  duplicatesSkipped: number;
}

export interface DataQualityMetrics {
  completeness: number; // 0-1 score
  consistency: number; // 0-1 score
  accuracy: number; // 0-1 score
  timeliness: number; // 0-1 score
  overall: number; // 0-1 score
}

export class DataProcessor {
  private tableName: string;
  private dataAggregator: DataAggregator;

  constructor(tableName: string, dataAggregator: DataAggregator) {
    this.tableName = tableName;
    this.dataAggregator = dataAggregator;
  }

  async processCompanyData(symbol: string, companyInfo?: Partial<Company>): Promise<{
    aggregationResult: AggregatedResult;
    validationResults: ValidationResult[];
    storageResult: StorageResult;
    qualityMetrics: DataQualityMetrics;
  }> {
    console.log(`Processing data for company: ${symbol}`);

    // Step 1: Aggregate data from external APIs
    const aggregationResult = await this.dataAggregator.getCompanyFinancials(symbol);

    if (!aggregationResult.success || aggregationResult.data.length === 0) {
      throw new Error(`Failed to aggregate data for ${symbol}: No valid data found`);
    }

    // Step 2: Validate each quarter's data
    const validationResults: ValidationResult[] = [];
    const validQuarters: QuarterlyFinancials[] = [];

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

  validateQuarterlyData(data: QuarterlyFinancials): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!data.quarter) {
      errors.push('Quarter is required');
    } else if (!/^\d{4}-Q[1-4]$/.test(data.quarter)) {
      errors.push('Quarter must be in format YYYY-QN (e.g., 2024-Q1)');
    }

    if (!data.reportDate) {
      errors.push('Report date is required');
    } else {
      const reportDate = new Date(data.reportDate);
      if (isNaN(reportDate.getTime())) {
        errors.push('Report date must be a valid date');
      } else if (reportDate > new Date()) {
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
    const missingRequired = requiredFields.filter(field => !data[field as keyof QuarterlyFinancials]);
    if (missingRequired.length > 0) {
      errors.push(`Missing required fields: ${missingRequired.join(', ')}`);
    }

    // Clean and normalize data
    const cleanedData: QuarterlyFinancials = {
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

  private calculateDataQuality(quarters: QuarterlyFinancials[], aggregationResult: AggregatedResult): DataQualityMetrics {
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
        if (quarter[field as keyof QuarterlyFinancials] !== undefined && quarter[field as keyof QuarterlyFinancials] !== 0) {
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

  private async storeCompanyData(
    symbol: string,
    quarters: QuarterlyFinancials[],
    companyInfo?: Partial<Company>
  ): Promise<StorageResult> {
    const errors: string[] = [];
    let recordsStored = 0;
    let duplicatesSkipped = 0;

    try {
      // Check for existing data to avoid duplicates
      const existingQuarters = await this.getExistingQuarters(symbol);
      const existingQuarterSet = new Set(existingQuarters);

      // Prepare company metadata record
      if (companyInfo) {
        const companyRecord: CompanyRecord = {
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

        await docClient.send(new PutCommand({
          TableName: this.tableName,
          Item: companyRecord,
        }));

        recordsStored++;
      }

      // Prepare quarterly financial records
      const quarterlyRecords: QuarterlyFinancialsRecord[] = [];

      for (const quarter of quarters) {
        if (existingQuarterSet.has(quarter.quarter)) {
          duplicatesSkipped++;
          continue;
        }

        const record: QuarterlyFinancialsRecord = {
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
          
          await docClient.send(new BatchWriteCommand({
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

    } catch (error) {
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

  private async getExistingQuarters(symbol: string): Promise<string[]> {
    try {
      const command = new QueryCommand({
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
    } catch (error) {
      console.warn('Error checking existing quarters:', error);
      return [];
    }
  }
}