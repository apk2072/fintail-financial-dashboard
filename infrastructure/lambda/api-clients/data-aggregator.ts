import { QuarterlyFinancials } from '../types';
import { AlphaVantageClient, AlphaVantageConfig } from './alpha-vantage';
import { FinancialModelingPrepClient, FinancialModelingPrepConfig } from './financial-modeling-prep';
import { YahooFinanceClient, YahooFinanceConfig } from './yahoo-finance';

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

export class DataAggregator {
  private alphaVantageClient?: AlphaVantageClient;
  private fmpClient?: FinancialModelingPrepClient;
  private yahooClient: YahooFinanceClient;
  private config: DataAggregatorConfig;

  constructor(config: DataAggregatorConfig) {
    this.config = config;

    if (config.alphaVantage?.apiKey) {
      this.alphaVantageClient = new AlphaVantageClient(config.alphaVantage);
    }

    if (config.financialModelingPrep?.apiKey) {
      this.fmpClient = new FinancialModelingPrepClient(config.financialModelingPrep);
    }

    this.yahooClient = new YahooFinanceClient(config.yahooFinance);
  }

  async getCompanyFinancials(symbol: string): Promise<AggregatedResult> {
    const sources: DataSourceResult[] = [];
    const timestamp = new Date().toISOString();

    // Try each data source with error handling
    const results = await Promise.allSettled([
      this.tryAlphaVantage(symbol),
      this.tryFinancialModelingPrep(symbol),
      this.tryYahooFinance(symbol),
    ]);

    // Process results
    results.forEach((result, index) => {
      const sourceName = ['alpha-vantage', 'financial-modeling-prep', 'yahoo-finance'][index] as DataSourceResult['source'];
      
      if (result.status === 'fulfilled' && result.value) {
        sources.push({
          source: sourceName,
          success: true,
          data: result.value,
          timestamp,
        });
      } else {
        sources.push({
          source: sourceName,
          success: false,
          error: result.status === 'rejected' ? result.reason?.message || 'Unknown error' : 'No data returned',
          timestamp,
        });
      }
    });

    // Determine primary source and merge data
    const { mergedData, primarySource } = this.mergeDataSources(sources);

    return {
      symbol,
      success: mergedData.length > 0,
      data: mergedData,
      sources,
      primarySource,
      timestamp,
    };
  }

  private async tryAlphaVantage(symbol: string): Promise<Partial<QuarterlyFinancials>[] | null> {
    if (!this.alphaVantageClient) return null;
    
    try {
      return await this.retryOperation(() => this.alphaVantageClient!.getCompanyFinancials(symbol));
    } catch (error) {
      console.warn(`Alpha Vantage failed for ${symbol}:`, error);
      return null;
    }
  }

  private async tryFinancialModelingPrep(symbol: string): Promise<Partial<QuarterlyFinancials>[] | null> {
    if (!this.fmpClient) return null;
    
    try {
      return await this.retryOperation(() => this.fmpClient!.getCompanyFinancials(symbol));
    } catch (error) {
      console.warn(`Financial Modeling Prep failed for ${symbol}:`, error);
      return null;
    }
  }

  private async tryYahooFinance(symbol: string): Promise<Partial<QuarterlyFinancials>[] | null> {
    try {
      return await this.retryOperation(() => this.yahooClient.getCompanyFinancials(symbol));
    } catch (error) {
      console.warn(`Yahoo Finance failed for ${symbol}:`, error);
      return null;
    }
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = this.config.retryAttempts || 3;
    const delay = this.config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }

    throw new Error('All retry attempts failed');
  }

  private mergeDataSources(sources: DataSourceResult[]): { mergedData: QuarterlyFinancials[]; primarySource: string } {
    const successfulSources = sources.filter(s => s.success && s.data && s.data.length > 0);
    
    if (successfulSources.length === 0) {
      return { mergedData: [], primarySource: 'none' };
    }

    // Priority order: Financial Modeling Prep > Alpha Vantage > Yahoo Finance
    const priorityOrder: DataSourceResult['source'][] = ['financial-modeling-prep', 'alpha-vantage', 'yahoo-finance'];
    
    let primarySource = successfulSources[0];
    for (const priority of priorityOrder) {
      const found = successfulSources.find(s => s.source === priority);
      if (found) {
        primarySource = found;
        break;
      }
    }

    const primaryData = primarySource.data!;
    const otherSources = successfulSources.filter(s => s.source !== primarySource.source);

    // Merge data by quarter
    const mergedData: QuarterlyFinancials[] = [];
    
    for (const primaryQuarter of primaryData) {
      if (!primaryQuarter.quarter) continue;

      const merged: QuarterlyFinancials = {
        quarter: primaryQuarter.quarter,
        reportDate: primaryQuarter.reportDate || '',
        netSales: primaryQuarter.netSales || 0,
        totalRevenue: primaryQuarter.totalRevenue || primaryQuarter.netSales || 0,
        netIncome: primaryQuarter.netIncome || 0,
        eps: primaryQuarter.eps || 0,
        operatingIncome: primaryQuarter.operatingIncome || 0,
        freeCashFlow: primaryQuarter.freeCashFlow || 0,
        totalAssets: primaryQuarter.totalAssets,
        totalDebt: primaryQuarter.totalDebt,
        shareholderEquity: primaryQuarter.shareholderEquity,
        sharesOutstanding: primaryQuarter.sharesOutstanding,
      };

      // Fill in missing data from other sources
      for (const otherSource of otherSources) {
        const matchingQuarter = otherSource.data?.find(q => q.quarter === primaryQuarter.quarter);
        if (matchingQuarter) {
          // Fill in missing fields
          if (!merged.netSales && matchingQuarter.netSales) merged.netSales = matchingQuarter.netSales;
          if (!merged.totalRevenue && matchingQuarter.totalRevenue) merged.totalRevenue = matchingQuarter.totalRevenue;
          if (!merged.netIncome && matchingQuarter.netIncome) merged.netIncome = matchingQuarter.netIncome;
          if (!merged.eps && matchingQuarter.eps) merged.eps = matchingQuarter.eps;
          if (!merged.operatingIncome && matchingQuarter.operatingIncome) merged.operatingIncome = matchingQuarter.operatingIncome;
          if (!merged.freeCashFlow && matchingQuarter.freeCashFlow) merged.freeCashFlow = matchingQuarter.freeCashFlow;
          if (!merged.totalAssets && matchingQuarter.totalAssets) merged.totalAssets = matchingQuarter.totalAssets;
          if (!merged.totalDebt && matchingQuarter.totalDebt) merged.totalDebt = matchingQuarter.totalDebt;
          if (!merged.shareholderEquity && matchingQuarter.shareholderEquity) merged.shareholderEquity = matchingQuarter.shareholderEquity;
          if (!merged.sharesOutstanding && matchingQuarter.sharesOutstanding) merged.sharesOutstanding = matchingQuarter.sharesOutstanding;
        }
      }

      // Validate and clean the data
      if (this.isValidQuarterlyData(merged)) {
        mergedData.push(merged);
      }
    }

    return {
      mergedData: mergedData.slice(0, 8), // Return last 8 quarters
      primarySource: primarySource.source,
    };
  }

  private isValidQuarterlyData(data: QuarterlyFinancials): boolean {
    // Must have basic financial metrics
    return !!(
      data.quarter &&
      data.reportDate &&
      (data.totalRevenue > 0 || data.netSales > 0)
    );
  }

  getAvailableSources(): string[] {
    const sources: string[] = [];
    
    if (this.alphaVantageClient) sources.push('alpha-vantage');
    if (this.fmpClient) sources.push('financial-modeling-prep');
    sources.push('yahoo-finance'); // Always available
    
    return sources;
  }
}