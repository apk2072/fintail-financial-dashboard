import { QuarterlyFinancials } from '../types';
export interface YahooFinanceConfig {
    baseUrl?: string;
    timeout?: number;
}
export interface YahooQuoteSummaryResponse {
    quoteSummary: {
        result: Array<{
            financialData?: {
                totalRevenue?: {
                    raw: number;
                    fmt: string;
                };
                netIncomeToCommon?: {
                    raw: number;
                    fmt: string;
                };
                operatingCashflow?: {
                    raw: number;
                    fmt: string;
                };
                freeCashflow?: {
                    raw: number;
                    fmt: string;
                };
                totalCash?: {
                    raw: number;
                    fmt: string;
                };
                totalDebt?: {
                    raw: number;
                    fmt: string;
                };
                ebitda?: {
                    raw: number;
                    fmt: string;
                };
                grossMargins?: {
                    raw: number;
                    fmt: string;
                };
                operatingMargins?: {
                    raw: number;
                    fmt: string;
                };
                profitMargins?: {
                    raw: number;
                    fmt: string;
                };
            };
            defaultKeyStatistics?: {
                sharesOutstanding?: {
                    raw: number;
                    fmt: string;
                };
                enterpriseValue?: {
                    raw: number;
                    fmt: string;
                };
                trailingEps?: {
                    raw: number;
                    fmt: string;
                };
                forwardEps?: {
                    raw: number;
                    fmt: string;
                };
                pegRatio?: {
                    raw: number;
                    fmt: string;
                };
                priceToBook?: {
                    raw: number;
                    fmt: string;
                };
            };
            summaryDetail?: {
                marketCap?: {
                    raw: number;
                    fmt: string;
                };
                trailingPE?: {
                    raw: number;
                    fmt: string;
                };
                forwardPE?: {
                    raw: number;
                    fmt: string;
                };
                dividendYield?: {
                    raw: number;
                    fmt: string;
                };
            };
            balanceSheetHistory?: {
                balanceSheetStatements: Array<{
                    endDate: {
                        raw: number;
                        fmt: string;
                    };
                    totalAssets?: {
                        raw: number;
                        fmt: string;
                    };
                    totalLiab?: {
                        raw: number;
                        fmt: string;
                    };
                    totalStockholderEquity?: {
                        raw: number;
                        fmt: string;
                    };
                    cash?: {
                        raw: number;
                        fmt: string;
                    };
                    shortLongTermDebt?: {
                        raw: number;
                        fmt: string;
                    };
                }>;
            };
            incomeStatementHistory?: {
                incomeStatementHistory: Array<{
                    endDate: {
                        raw: number;
                        fmt: string;
                    };
                    totalRevenue?: {
                        raw: number;
                        fmt: string;
                    };
                    netIncome?: {
                        raw: number;
                        fmt: string;
                    };
                    operatingIncome?: {
                        raw: number;
                        fmt: string;
                    };
                    grossProfit?: {
                        raw: number;
                        fmt: string;
                    };
                }>;
            };
            cashflowStatementHistory?: {
                cashflowStatements: Array<{
                    endDate: {
                        raw: number;
                        fmt: string;
                    };
                    operatingCashflow?: {
                        raw: number;
                        fmt: string;
                    };
                    freeCashflow?: {
                        raw: number;
                        fmt: string;
                    };
                    capitalExpenditures?: {
                        raw: number;
                        fmt: string;
                    };
                }>;
            };
        }>;
        error?: {
            code: string;
            description: string;
        };
    };
}
export declare class YahooFinanceClient {
    private config;
    private baseUrl;
    constructor(config?: YahooFinanceConfig);
    getQuoteSummary(symbol: string): Promise<YahooQuoteSummaryResponse>;
    getCompanyFinancials(symbol: string): Promise<Partial<QuarterlyFinancials>[]>;
    private makeRequest;
    private extractFinancialData;
    private extractValue;
    private getCurrentQuarter;
    private dateToQuarter;
}
