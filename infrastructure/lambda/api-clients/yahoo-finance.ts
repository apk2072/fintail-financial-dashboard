import { QuarterlyFinancials } from '../types';

export interface YahooFinanceConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface YahooQuoteSummaryResponse {
  quoteSummary: {
    result: Array<{
      financialData?: {
        totalRevenue?: { raw: number; fmt: string };
        netIncomeToCommon?: { raw: number; fmt: string };
        operatingCashflow?: { raw: number; fmt: string };
        freeCashflow?: { raw: number; fmt: string };
        totalCash?: { raw: number; fmt: string };
        totalDebt?: { raw: number; fmt: string };
        ebitda?: { raw: number; fmt: string };
        grossMargins?: { raw: number; fmt: string };
        operatingMargins?: { raw: number; fmt: string };
        profitMargins?: { raw: number; fmt: string };
      };
      defaultKeyStatistics?: {
        sharesOutstanding?: { raw: number; fmt: string };
        enterpriseValue?: { raw: number; fmt: string };
        trailingEps?: { raw: number; fmt: string };
        forwardEps?: { raw: number; fmt: string };
        pegRatio?: { raw: number; fmt: string };
        priceToBook?: { raw: number; fmt: string };
      };
      summaryDetail?: {
        marketCap?: { raw: number; fmt: string };
        trailingPE?: { raw: number; fmt: string };
        forwardPE?: { raw: number; fmt: string };
        dividendYield?: { raw: number; fmt: string };
      };
      balanceSheetHistory?: {
        balanceSheetStatements: Array<{
          endDate: { raw: number; fmt: string };
          totalAssets?: { raw: number; fmt: string };
          totalLiab?: { raw: number; fmt: string };
          totalStockholderEquity?: { raw: number; fmt: string };
          cash?: { raw: number; fmt: string };
          shortLongTermDebt?: { raw: number; fmt: string };
        }>;
      };
      incomeStatementHistory?: {
        incomeStatementHistory: Array<{
          endDate: { raw: number; fmt: string };
          totalRevenue?: { raw: number; fmt: string };
          netIncome?: { raw: number; fmt: string };
          operatingIncome?: { raw: number; fmt: string };
          grossProfit?: { raw: number; fmt: string };
        }>;
      };
      cashflowStatementHistory?: {
        cashflowStatements: Array<{
          endDate: { raw: number; fmt: string };
          operatingCashflow?: { raw: number; fmt: string };
          freeCashflow?: { raw: number; fmt: string };
          capitalExpenditures?: { raw: number; fmt: string };
        }>;
      };
    }>;
    error?: {
      code: string;
      description: string;
    };
  };
}

export class YahooFinanceClient {
  private config: YahooFinanceConfig;
  private baseUrl: string;

  constructor(config: YahooFinanceConfig = {}) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://query1.finance.yahoo.com/v10/finance';
  }

  async getQuoteSummary(symbol: string): Promise<YahooQuoteSummaryResponse> {
    const modules = [
      'financialData',
      'defaultKeyStatistics',
      'summaryDetail',
      'balanceSheetHistory',
      'incomeStatementHistory',
      'cashflowStatementHistory',
    ].join(',');

    const url = `${this.baseUrl}/quoteSummary/${symbol}?modules=${modules}`;
    return this.makeRequest(url);
  }

  async getCompanyFinancials(symbol: string): Promise<Partial<QuarterlyFinancials>[]> {
    try {
      const quoteSummary = await this.getQuoteSummary(symbol);
      
      if (quoteSummary.quoteSummary.error) {
        throw new Error(`Yahoo Finance API Error: ${quoteSummary.quoteSummary.error.description}`);
      }

      return this.extractFinancialData(quoteSummary);
    } catch (error) {
      console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error);
      throw new Error(`Failed to fetch financial data from Yahoo Finance: ${error}`);
    }
  }

  private async makeRequest(url: string): Promise<YahooQuoteSummaryResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as YahooQuoteSummaryResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private extractFinancialData(quoteSummary: YahooQuoteSummaryResponse): Partial<QuarterlyFinancials>[] {
    const result = quoteSummary.quoteSummary.result[0];
    if (!result) {
      return [];
    }

    const financials: Partial<QuarterlyFinancials>[] = [];

    // Get current quarter data from financialData
    if (result.financialData) {
      const currentQuarter: Partial<QuarterlyFinancials> = {
        quarter: this.getCurrentQuarter(),
        reportDate: new Date().toISOString().split('T')[0],
        totalRevenue: this.extractValue(result.financialData.totalRevenue),
        netSales: this.extractValue(result.financialData.totalRevenue),
        netIncome: this.extractValue(result.financialData.netIncomeToCommon),
        freeCashFlow: this.extractValue(result.financialData.freeCashflow),
      };

      if (result.defaultKeyStatistics) {
        currentQuarter.eps = this.extractValue(result.defaultKeyStatistics.trailingEps);
        currentQuarter.sharesOutstanding = this.extractValue(result.defaultKeyStatistics.sharesOutstanding);
      }

      financials.push(currentQuarter);
    }

    // Extract historical data from income statements
    if (result.incomeStatementHistory?.incomeStatementHistory) {
      for (const statement of result.incomeStatementHistory.incomeStatementHistory.slice(0, 4)) {
        const date = new Date(statement.endDate.raw * 1000);
        const quarter: Partial<QuarterlyFinancials> = {
          quarter: this.dateToQuarter(date),
          reportDate: date.toISOString().split('T')[0],
          totalRevenue: this.extractValue(statement.totalRevenue),
          netSales: this.extractValue(statement.totalRevenue),
          netIncome: this.extractValue(statement.netIncome),
          operatingIncome: this.extractValue(statement.operatingIncome),
        };

        financials.push(quarter);
      }
    }

    // Merge with balance sheet data
    if (result.balanceSheetHistory?.balanceSheetStatements) {
      const balanceMap = new Map(
        result.balanceSheetHistory.balanceSheetStatements.map(statement => [
          statement.endDate.raw,
          statement,
        ])
      );

      financials.forEach(financial => {
        if (financial.reportDate) {
          const timestamp = Math.floor(new Date(financial.reportDate).getTime() / 1000);
          const balanceSheet = balanceMap.get(timestamp);
          
          if (balanceSheet) {
            financial.totalAssets = this.extractValue(balanceSheet.totalAssets);
            financial.totalDebt = this.extractValue(balanceSheet.shortLongTermDebt);
            financial.shareholderEquity = this.extractValue(balanceSheet.totalStockholderEquity);
          }
        }
      });
    }

    // Merge with cash flow data
    if (result.cashflowStatementHistory?.cashflowStatements) {
      const cashFlowMap = new Map(
        result.cashflowStatementHistory.cashflowStatements.map(statement => [
          statement.endDate.raw,
          statement,
        ])
      );

      financials.forEach(financial => {
        if (financial.reportDate) {
          const timestamp = Math.floor(new Date(financial.reportDate).getTime() / 1000);
          const cashFlow = cashFlowMap.get(timestamp);
          
          if (cashFlow) {
            financial.freeCashFlow = this.extractValue(cashFlow.freeCashflow);
          }
        }
      });
    }

    return financials.filter(f => f.totalRevenue && f.totalRevenue > 0).slice(0, 8);
  }

  private extractValue(field: { raw: number; fmt: string } | undefined): number {
    return field?.raw || 0;
  }

  private getCurrentQuarter(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }

  private dateToQuarter(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }
}