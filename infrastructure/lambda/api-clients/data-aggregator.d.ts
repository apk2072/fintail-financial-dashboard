import { QuarterlyFinancials } from '../types';
import { AlphaVantageConfig } from './alpha-vantage';
import { FinancialModelingPrepConfig } from './financial-modeling-prep';
import { YahooFinanceConfig } from './yahoo-finance';
export interface DataAggregatorConfig {
    alphaVantage?: AlphaVantageConfig;
    financialModelingPrep?: FinancialModelingPrepConfig;
    yahooFinance?: YahooFinanceConfig;
    retryAttempts?: number;
    retryDelay?: number;
}
export interface DataSourceResult {
    source: 'alpha-vantage' | 'financial-modeling-prep' | 'yahoo-finance';
    success: boolean;
    data?: Partial<QuarterlyFinancials>[];
    error?: string;
    timestamp: string;
}
export interface AggregatedResult {
    symbol: string;
    success: boolean;
    data: QuarterlyFinancials[];
    sources: DataSourceResult[];
    primarySource: string;
    timestamp: string;
}
export declare class DataAggregator {
    private alphaVantageClient?;
    private fmpClient?;
    private yahooClient;
    private config;
    constructor(config: DataAggregatorConfig);
    getCompanyFinancials(symbol: string): Promise<AggregatedResult>;
    private tryAlphaVantage;
    private tryFinancialModelingPrep;
    private tryYahooFinance;
    private retryOperation;
    private mergeDataSources;
    private isValidQuarterlyData;
    getAvailableSources(): string[];
}
