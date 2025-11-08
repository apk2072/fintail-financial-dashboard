import { QuarterlyFinancials } from '../types';
export interface AlphaVantageConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}
export interface AlphaVantageQuarterlyResponse {
    'Meta Data': {
        '1. Information': string;
        '2. Symbol': string;
        '3. Last Refreshed': string;
        '4. Time Zone': string;
    };
    'Quarterly Income Statements': {
        [date: string]: {
            totalRevenue: string;
            netIncome: string;
            operatingIncome: string;
            eps: string;
        };
    };
}
export interface AlphaVantageBalanceSheetResponse {
    'Meta Data': {
        '1. Information': string;
        '2. Symbol': string;
        '3. Last Refreshed': string;
        '4. Time Zone': string;
    };
    'Quarterly Balance Sheets': {
        [date: string]: {
            totalAssets: string;
            totalLiabilities: string;
            totalShareholderEquity: string;
        };
    };
}
export interface AlphaVantageCashFlowResponse {
    'Meta Data': {
        '1. Information': string;
        '2. Symbol': string;
        '3. Last Refreshed': string;
        '4. Time Zone': string;
    };
    'Quarterly Cash Flow': {
        [date: string]: {
            operatingCashflow: string;
            cashflowFromInvestment: string;
            cashflowFromFinancing: string;
        };
    };
}
export declare class AlphaVantageClient {
    private config;
    private baseUrl;
    constructor(config: AlphaVantageConfig);
    getIncomeStatement(symbol: string): Promise<AlphaVantageQuarterlyResponse>;
    getBalanceSheet(symbol: string): Promise<AlphaVantageBalanceSheetResponse>;
    getCashFlow(symbol: string): Promise<AlphaVantageCashFlowResponse>;
    getCompanyFinancials(symbol: string): Promise<Partial<QuarterlyFinancials>[]>;
    private makeRequest;
    private mergeFinancialData;
    private parseNumber;
    private dateToQuarter;
}
