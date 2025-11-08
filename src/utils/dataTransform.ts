import type { QuarterlyFinancials } from '../types';

// External API response interfaces (simplified examples)
export interface AlphaVantageResponse {
  'Global Quote': {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
}

export interface FinancialModelingPrepResponse {
  symbol: string;
  date: string;
  revenue: number;
  netIncome: number;
  eps: number;
  operatingIncome: number;
  freeCashFlow: number;
  totalAssets: number;
  totalDebt: number;
  shareholderEquity: number;
}

export interface YahooFinanceResponse {
  quoteSummary: {
    result: Array<{
      financialData: {
        totalRevenue: { raw: number };
        netIncomeToCommon: { raw: number };
        operatingCashFlow: { raw: number };
        freeCashflow: { raw: number };
      };
      defaultKeyStatistics: {
        sharesOutstanding: { raw: number };
        enterpriseValue: { raw: number };
      };
    }>;
  };
}

/**
 * Normalize financial data from Alpha Vantage API
 */
export function normalizeAlphaVantageData(
  response: AlphaVantageResponse
): Partial<QuarterlyFinancials> {
  const quote = response['Global Quote'];

  return {
    quarter: getCurrentQuarter(),
    reportDate: quote['07. latest trading day'],
    totalRevenue:
      parseFloat(quote['05. price']) * parseFloat(quote['06. volume']),
    netSales: parseFloat(quote['05. price']) * parseFloat(quote['06. volume']),
    // Note: Alpha Vantage doesn't provide all financial metrics in quote endpoint
    // This is a simplified transformation for demonstration
    netIncome: 0,
    eps: 0,
    operatingIncome: 0,
    freeCashFlow: 0,
  };
}

/**
 * Normalize financial data from Financial Modeling Prep API
 */
export function normalizeFinancialModelingPrepData(
  response: FinancialModelingPrepResponse
): QuarterlyFinancials {
  return {
    quarter: getQuarterFromDate(response.date),
    reportDate: response.date,
    netSales: response.revenue,
    totalRevenue: response.revenue,
    netIncome: response.netIncome,
    eps: response.eps,
    operatingIncome: response.operatingIncome,
    freeCashFlow: response.freeCashFlow,
    totalAssets: response.totalAssets,
    totalDebt: response.totalDebt,
    shareholderEquity: response.shareholderEquity,
  };
}

/**
 * Normalize financial data from Yahoo Finance API
 */
export function normalizeYahooFinanceData(
  response: YahooFinanceResponse
): Partial<QuarterlyFinancials> {
  const result = response.quoteSummary.result[0];
  const financialData = result.financialData;
  const keyStats = result.defaultKeyStatistics;

  return {
    quarter: getCurrentQuarter(),
    reportDate: new Date().toISOString().split('T')[0],
    totalRevenue: financialData.totalRevenue.raw,
    netSales: financialData.totalRevenue.raw,
    netIncome: financialData.netIncomeToCommon.raw,
    operatingIncome: financialData.operatingCashFlow.raw,
    freeCashFlow: financialData.freeCashflow.raw,
    sharesOutstanding: keyStats.sharesOutstanding.raw,
    eps: financialData.netIncomeToCommon.raw / keyStats.sharesOutstanding.raw,
  };
}

/**
 * Merge financial data from multiple sources with priority
 */
export function mergeFinancialData(
  primary: Partial<QuarterlyFinancials>,
  secondary: Partial<QuarterlyFinancials>,
  tertiary?: Partial<QuarterlyFinancials>
): QuarterlyFinancials {
  const merged = { ...tertiary, ...secondary, ...primary };

  // Ensure required fields have default values
  return {
    quarter: merged.quarter || getCurrentQuarter(),
    reportDate: merged.reportDate || new Date().toISOString().split('T')[0],
    netSales: merged.netSales || 0,
    totalRevenue: merged.totalRevenue || merged.netSales || 0,
    netIncome: merged.netIncome || 0,
    eps: merged.eps || 0,
    operatingIncome: merged.operatingIncome || 0,
    freeCashFlow: merged.freeCashFlow || 0,
    totalAssets: merged.totalAssets,
    totalDebt: merged.totalDebt,
    shareholderEquity: merged.shareholderEquity,
    sharesOutstanding: merged.sharesOutstanding,
  };
}

/**
 * Validate and clean financial data
 */
export function validateFinancialData(data: Partial<QuarterlyFinancials>): {
  isValid: boolean;
  errors: string[];
  cleanedData: QuarterlyFinancials | null;
} {
  const errors: string[] = [];

  // Check required fields
  if (!data.quarter) errors.push('Quarter is required');
  if (!data.reportDate) errors.push('Report date is required');
  if (data.netSales === undefined || data.netSales < 0)
    errors.push('Net sales must be non-negative');
  if (data.totalRevenue === undefined || data.totalRevenue < 0)
    errors.push('Total revenue must be non-negative');

  // Check data consistency
  if (data.netSales && data.totalRevenue && data.netSales > data.totalRevenue) {
    errors.push('Net sales cannot exceed total revenue');
  }

  if (data.eps && data.netIncome && data.sharesOutstanding) {
    const calculatedEps = data.netIncome / data.sharesOutstanding;
    if (Math.abs(calculatedEps - data.eps) > 0.01) {
      errors.push('EPS calculation inconsistency detected');
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors, cleanedData: null };
  }

  // Return cleaned data with defaults
  const cleanedData: QuarterlyFinancials = {
    quarter: data.quarter!,
    reportDate: data.reportDate!,
    netSales: data.netSales || 0,
    totalRevenue: data.totalRevenue || data.netSales || 0,
    netIncome: data.netIncome || 0,
    eps: data.eps || 0,
    operatingIncome: data.operatingIncome || 0,
    freeCashFlow: data.freeCashFlow || 0,
    totalAssets: data.totalAssets,
    totalDebt: data.totalDebt,
    shareholderEquity: data.shareholderEquity,
    sharesOutstanding: data.sharesOutstanding,
  };

  return { isValid: true, errors: [], cleanedData };
}

/**
 * Get current quarter string (e.g., "2024-Q1")
 */
function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Convert date string to quarter format
 */
function getQuarterFromDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}
