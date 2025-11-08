import { QuarterlyFinancials } from '../types';

export interface FinancialModelingPrepConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface FMPIncomeStatementResponse {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  researchAndDevelopmentExpenses: number;
  generalAndAdministrativeExpenses: number;
  sellingAndMarketingExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  otherExpenses: number;
  operatingExpenses: number;
  costAndExpenses: number;
  interestIncome: number;
  interestExpense: number;
  depreciationAndAmortization: number;
  ebitda: number;
  ebitdaratio: number;
  operatingIncome: number;
  operatingIncomeRatio: number;
  totalOtherIncomeExpensesNet: number;
  incomeBeforeTax: number;
  incomeBeforeTaxRatio: number;
  incomeTaxExpense: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  epsdiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
}

export interface FMPBalanceSheetResponse {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  cashAndShortTermInvestments: number;
  netReceivables: number;
  inventory: number;
  otherCurrentAssets: number;
  totalCurrentAssets: number;
  propertyPlantEquipmentNet: number;
  goodwill: number;
  intangibleAssets: number;
  goodwillAndIntangibleAssets: number;
  longTermInvestments: number;
  taxAssets: number;
  otherNonCurrentAssets: number;
  totalNonCurrentAssets: number;
  otherAssets: number;
  totalAssets: number;
  accountPayables: number;
  shortTermDebt: number;
  taxPayables: number;
  deferredRevenue: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  longTermDebt: number;
  deferredRevenueNonCurrent: number;
  deferredTaxLiabilitiesNonCurrent: number;
  otherNonCurrentLiabilities: number;
  totalNonCurrentLiabilities: number;
  otherLiabilities: number;
  capitalLeaseObligations: number;
  totalLiabilities: number;
  preferredStock: number;
  commonStock: number;
  retainedEarnings: number;
  accumulatedOtherComprehensiveIncomeLoss: number;
  othertotalStockholdersEquity: number;
  totalStockholdersEquity: number;
  totalEquity: number;
  totalLiabilitiesAndStockholdersEquity: number;
  minorityInterest: number;
  totalLiabilitiesAndTotalEquity: number;
  totalInvestments: number;
  totalDebt: number;
  netDebt: number;
}

export interface FMPCashFlowResponse {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  netIncome: number;
  depreciationAndAmortization: number;
  deferredIncomeTax: number;
  stockBasedCompensation: number;
  changeInWorkingCapital: number;
  accountsReceivables: number;
  inventory: number;
  accountsPayables: number;
  otherWorkingCapital: number;
  otherNonCashItems: number;
  netCashProvidedByOperatingActivities: number;
  investmentsInPropertyPlantAndEquipment: number;
  acquisitionsNet: number;
  purchasesOfInvestments: number;
  salesMaturitiesOfInvestments: number;
  otherInvestingActivites: number;
  netCashUsedForInvestingActivites: number;
  debtRepayment: number;
  commonStockIssued: number;
  commonStockRepurchased: number;
  dividendsPaid: number;
  otherFinancingActivites: number;
  netCashUsedProvidedByFinancingActivities: number;
  effectOfForexChangesOnCash: number;
  netChangeInCash: number;
  cashAtEndOfPeriod: number;
  cashAtBeginningOfPeriod: number;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
}

export class FinancialModelingPrepClient {
  private config: FinancialModelingPrepConfig;
  private baseUrl: string;

  constructor(config: FinancialModelingPrepConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://financialmodelingprep.com/api/v3';
  }

  async getIncomeStatement(symbol: string, period: 'quarter' | 'annual' = 'quarter'): Promise<FMPIncomeStatementResponse[]> {
    const url = `${this.baseUrl}/income-statement/${symbol}?period=${period}&apikey=${this.config.apiKey}`;
    return this.makeRequest(url);
  }

  async getBalanceSheet(symbol: string, period: 'quarter' | 'annual' = 'quarter'): Promise<FMPBalanceSheetResponse[]> {
    const url = `${this.baseUrl}/balance-sheet-statement/${symbol}?period=${period}&apikey=${this.config.apiKey}`;
    return this.makeRequest(url);
  }

  async getCashFlow(symbol: string, period: 'quarter' | 'annual' = 'quarter'): Promise<FMPCashFlowResponse[]> {
    const url = `${this.baseUrl}/cash-flow-statement/${symbol}?period=${period}&apikey=${this.config.apiKey}`;
    return this.makeRequest(url);
  }

  async getCompanyFinancials(symbol: string): Promise<Partial<QuarterlyFinancials>[]> {
    try {
      const [incomeStatements, balanceSheets, cashFlows] = await Promise.all([
        this.getIncomeStatement(symbol),
        this.getBalanceSheet(symbol),
        this.getCashFlow(symbol),
      ]);

      return this.mergeFinancialData(incomeStatements, balanceSheets, cashFlows);
    } catch (error) {
      console.error(`Error fetching FMP data for ${symbol}:`, error);
      throw new Error(`Failed to fetch financial data from Financial Modeling Prep: ${error}`);
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
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(`FMP API Error: ${(data as any).error}`);
      }

      if (Array.isArray(data) && data.length === 0) {
        throw new Error('No data available for this symbol');
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
    incomeStatements: FMPIncomeStatementResponse[],
    balanceSheets: FMPBalanceSheetResponse[],
    cashFlows: FMPCashFlowResponse[]
  ): Partial<QuarterlyFinancials>[] {
    const financials: Partial<QuarterlyFinancials>[] = [];

    // Create a map for quick lookups
    const balanceMap = new Map(balanceSheets.map(item => [item.date, item]));
    const cashFlowMap = new Map(cashFlows.map(item => [item.date, item]));

    for (const income of incomeStatements.slice(0, 8)) { // Last 8 quarters
      const balance = balanceMap.get(income.date);
      const cashFlow = cashFlowMap.get(income.date);

      const financial: Partial<QuarterlyFinancials> = {
        quarter: this.dateToQuarter(income.date),
        reportDate: income.date,
        totalRevenue: income.revenue || 0,
        netSales: income.revenue || 0,
        netIncome: income.netIncome || 0,
        operatingIncome: income.operatingIncome || 0,
        eps: income.eps || 0,
        sharesOutstanding: income.weightedAverageShsOut || 0,
      };

      if (balance) {
        financial.totalAssets = balance.totalAssets || 0;
        financial.totalDebt = balance.totalDebt || 0;
        financial.shareholderEquity = balance.totalStockholdersEquity || 0;
      }

      if (cashFlow) {
        financial.freeCashFlow = cashFlow.freeCashFlow || 0;
      }

      financials.push(financial);
    }

    return financials;
  }

  private dateToQuarter(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }
}