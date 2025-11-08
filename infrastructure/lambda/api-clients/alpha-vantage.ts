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
      // Add more fields as needed
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
      // Add more fields as needed
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
      // Add more fields as needed
    };
  };
}

export class AlphaVantageClient {
  private config: AlphaVantageConfig;
  private baseUrl: string;

  constructor(config: AlphaVantageConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://www.alphavantage.co/query';
  }

  async getIncomeStatement(symbol: string): Promise<AlphaVantageQuarterlyResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('function', 'INCOME_STATEMENT');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', this.config.apiKey);

    const response = await this.makeRequest(url.toString());
    return response as AlphaVantageQuarterlyResponse;
  }

  async getBalanceSheet(symbol: string): Promise<AlphaVantageBalanceSheetResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('function', 'BALANCE_SHEET');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', this.config.apiKey);

    const response = await this.makeRequest(url.toString());
    return response as AlphaVantageBalanceSheetResponse;
  }

  async getCashFlow(symbol: string): Promise<AlphaVantageCashFlowResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('function', 'CASH_FLOW');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('apikey', this.config.apiKey);

    const response = await this.makeRequest(url.toString());
    return response as AlphaVantageCashFlowResponse;
  }

  async getCompanyFinancials(symbol: string): Promise<Partial<QuarterlyFinancials>[]> {
    try {
      const [incomeStatement, balanceSheet, cashFlow] = await Promise.all([
        this.getIncomeStatement(symbol),
        this.getBalanceSheet(symbol),
        this.getCashFlow(symbol),
      ]);

      return this.mergeFinancialData(incomeStatement, balanceSheet, cashFlow);
    } catch (error) {
      console.error(`Error fetching Alpha Vantage data for ${symbol}:`, error);
      throw new Error(`Failed to fetch financial data from Alpha Vantage: ${error}`);
    }
  }

  private async makeRequest(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Fintail-Financial-Dashboard/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Check for API error responses
      if (data && typeof data === 'object' && 'Error Message' in data) {
        throw new Error(`Alpha Vantage API Error: ${(data as any)['Error Message']}`);
      }

      if (data && typeof data === 'object' && 'Note' in data) {
        throw new Error(`Alpha Vantage API Limit: ${(data as any)['Note']}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private mergeFinancialData(
    incomeStatement: AlphaVantageQuarterlyResponse,
    balanceSheet: AlphaVantageBalanceSheetResponse,
    cashFlow: AlphaVantageCashFlowResponse
  ): Partial<QuarterlyFinancials>[] {
    const financials: Partial<QuarterlyFinancials>[] = [];
    const incomeData = incomeStatement['Quarterly Income Statements'] || {};
    const balanceData = balanceSheet['Quarterly Balance Sheets'] || {};
    const cashFlowData = cashFlow['Quarterly Cash Flow'] || {};

    // Get all unique dates
    const allDates = new Set([
      ...Object.keys(incomeData),
      ...Object.keys(balanceData),
      ...Object.keys(cashFlowData),
    ]);

    for (const date of Array.from(allDates).sort().reverse()) {
      const income = incomeData[date];
      const balance = balanceData[date];
      const cash = cashFlowData[date];

      const financial: Partial<QuarterlyFinancials> = {
        quarter: this.dateToQuarter(date),
        reportDate: date,
      };

      // Income statement data
      if (income) {
        financial.totalRevenue = this.parseNumber(income.totalRevenue);
        financial.netSales = this.parseNumber(income.totalRevenue); // Assuming same as revenue
        financial.netIncome = this.parseNumber(income.netIncome);
        financial.operatingIncome = this.parseNumber(income.operatingIncome);
        financial.eps = this.parseNumber(income.eps);
      }

      // Balance sheet data
      if (balance) {
        financial.totalAssets = this.parseNumber(balance.totalAssets);
        financial.totalDebt = this.parseNumber(balance.totalLiabilities);
        financial.shareholderEquity = this.parseNumber(balance.totalShareholderEquity);
      }

      // Cash flow data
      if (cash) {
        financial.freeCashFlow = this.parseNumber(cash.operatingCashflow);
      }

      financials.push(financial);
    }

    return financials.slice(0, 8); // Return last 8 quarters
  }

  private parseNumber(value: string | undefined): number {
    if (!value || value === 'None' || value === 'null') return 0;
    return parseFloat(value.replace(/,/g, '')) || 0;
  }

  private dateToQuarter(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }
}