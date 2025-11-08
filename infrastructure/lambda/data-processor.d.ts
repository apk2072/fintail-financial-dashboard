import { QuarterlyFinancials, Company } from './types';
import { DataAggregator, AggregatedResult } from './api-clients/data-aggregator';
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
    completeness: number;
    consistency: number;
    accuracy: number;
    timeliness: number;
    overall: number;
}
export declare class DataProcessor {
    private tableName;
    private dataAggregator;
    constructor(tableName: string, dataAggregator: DataAggregator);
    processCompanyData(symbol: string, companyInfo?: Partial<Company>): Promise<{
        aggregationResult: AggregatedResult;
        validationResults: ValidationResult[];
        storageResult: StorageResult;
        qualityMetrics: DataQualityMetrics;
    }>;
    validateQuarterlyData(data: QuarterlyFinancials): ValidationResult;
    private calculateDataQuality;
    private storeCompanyData;
    private getExistingQuarters;
}
