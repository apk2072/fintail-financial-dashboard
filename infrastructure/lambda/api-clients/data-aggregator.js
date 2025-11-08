"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataAggregator = void 0;
const alpha_vantage_1 = require("./alpha-vantage");
const financial_modeling_prep_1 = require("./financial-modeling-prep");
const yahoo_finance_1 = require("./yahoo-finance");
class DataAggregator {
    alphaVantageClient;
    fmpClient;
    yahooClient;
    config;
    constructor(config) {
        this.config = config;
        if (config.alphaVantage?.apiKey) {
            this.alphaVantageClient = new alpha_vantage_1.AlphaVantageClient(config.alphaVantage);
        }
        if (config.financialModelingPrep?.apiKey) {
            this.fmpClient = new financial_modeling_prep_1.FinancialModelingPrepClient(config.financialModelingPrep);
        }
        this.yahooClient = new yahoo_finance_1.YahooFinanceClient(config.yahooFinance);
    }
    async getCompanyFinancials(symbol) {
        const sources = [];
        const timestamp = new Date().toISOString();
        // Try each data source with error handling
        const results = await Promise.allSettled([
            this.tryAlphaVantage(symbol),
            this.tryFinancialModelingPrep(symbol),
            this.tryYahooFinance(symbol),
        ]);
        // Process results
        results.forEach((result, index) => {
            const sourceName = ['alpha-vantage', 'financial-modeling-prep', 'yahoo-finance'][index];
            if (result.status === 'fulfilled' && result.value) {
                sources.push({
                    source: sourceName,
                    success: true,
                    data: result.value,
                    timestamp,
                });
            }
            else {
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
    async tryAlphaVantage(symbol) {
        if (!this.alphaVantageClient)
            return null;
        try {
            return await this.retryOperation(() => this.alphaVantageClient.getCompanyFinancials(symbol));
        }
        catch (error) {
            console.warn(`Alpha Vantage failed for ${symbol}:`, error);
            return null;
        }
    }
    async tryFinancialModelingPrep(symbol) {
        if (!this.fmpClient)
            return null;
        try {
            return await this.retryOperation(() => this.fmpClient.getCompanyFinancials(symbol));
        }
        catch (error) {
            console.warn(`Financial Modeling Prep failed for ${symbol}:`, error);
            return null;
        }
    }
    async tryYahooFinance(symbol) {
        try {
            return await this.retryOperation(() => this.yahooClient.getCompanyFinancials(symbol));
        }
        catch (error) {
            console.warn(`Yahoo Finance failed for ${symbol}:`, error);
            return null;
        }
    }
    async retryOperation(operation) {
        const maxAttempts = this.config.retryAttempts || 3;
        const delay = this.config.retryDelay || 1000;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
        throw new Error('All retry attempts failed');
    }
    mergeDataSources(sources) {
        const successfulSources = sources.filter(s => s.success && s.data && s.data.length > 0);
        if (successfulSources.length === 0) {
            return { mergedData: [], primarySource: 'none' };
        }
        // Priority order: Financial Modeling Prep > Alpha Vantage > Yahoo Finance
        const priorityOrder = ['financial-modeling-prep', 'alpha-vantage', 'yahoo-finance'];
        let primarySource = successfulSources[0];
        for (const priority of priorityOrder) {
            const found = successfulSources.find(s => s.source === priority);
            if (found) {
                primarySource = found;
                break;
            }
        }
        const primaryData = primarySource.data;
        const otherSources = successfulSources.filter(s => s.source !== primarySource.source);
        // Merge data by quarter
        const mergedData = [];
        for (const primaryQuarter of primaryData) {
            if (!primaryQuarter.quarter)
                continue;
            const merged = {
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
                    if (!merged.netSales && matchingQuarter.netSales)
                        merged.netSales = matchingQuarter.netSales;
                    if (!merged.totalRevenue && matchingQuarter.totalRevenue)
                        merged.totalRevenue = matchingQuarter.totalRevenue;
                    if (!merged.netIncome && matchingQuarter.netIncome)
                        merged.netIncome = matchingQuarter.netIncome;
                    if (!merged.eps && matchingQuarter.eps)
                        merged.eps = matchingQuarter.eps;
                    if (!merged.operatingIncome && matchingQuarter.operatingIncome)
                        merged.operatingIncome = matchingQuarter.operatingIncome;
                    if (!merged.freeCashFlow && matchingQuarter.freeCashFlow)
                        merged.freeCashFlow = matchingQuarter.freeCashFlow;
                    if (!merged.totalAssets && matchingQuarter.totalAssets)
                        merged.totalAssets = matchingQuarter.totalAssets;
                    if (!merged.totalDebt && matchingQuarter.totalDebt)
                        merged.totalDebt = matchingQuarter.totalDebt;
                    if (!merged.shareholderEquity && matchingQuarter.shareholderEquity)
                        merged.shareholderEquity = matchingQuarter.shareholderEquity;
                    if (!merged.sharesOutstanding && matchingQuarter.sharesOutstanding)
                        merged.sharesOutstanding = matchingQuarter.sharesOutstanding;
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
    isValidQuarterlyData(data) {
        // Must have basic financial metrics
        return !!(data.quarter &&
            data.reportDate &&
            (data.totalRevenue > 0 || data.netSales > 0));
    }
    getAvailableSources() {
        const sources = [];
        if (this.alphaVantageClient)
            sources.push('alpha-vantage');
        if (this.fmpClient)
            sources.push('financial-modeling-prep');
        sources.push('yahoo-finance'); // Always available
        return sources;
    }
}
exports.DataAggregator = DataAggregator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS1hZ2dyZWdhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGF0YS1hZ2dyZWdhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLG1EQUF5RTtBQUN6RSx1RUFBcUc7QUFDckcsbURBQXlFO0FBMkJ6RSxNQUFhLGNBQWM7SUFDakIsa0JBQWtCLENBQXNCO0lBQ3hDLFNBQVMsQ0FBK0I7SUFDeEMsV0FBVyxDQUFxQjtJQUNoQyxNQUFNLENBQXVCO0lBRXJDLFlBQVksTUFBNEI7UUFDdEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFckIsSUFBSSxNQUFNLENBQUMsWUFBWSxFQUFFLE1BQU0sRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLGtDQUFrQixDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBRUQsSUFBSSxNQUFNLENBQUMscUJBQXFCLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDekMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLHFEQUEyQixDQUFDLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7UUFFRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksa0NBQWtCLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxLQUFLLENBQUMsb0JBQW9CLENBQUMsTUFBYztRQUN2QyxNQUFNLE9BQU8sR0FBdUIsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sU0FBUyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsMkNBQTJDO1FBQzNDLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLFVBQVUsQ0FBQztZQUN2QyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQztZQUM1QixJQUFJLENBQUMsd0JBQXdCLENBQUMsTUFBTSxDQUFDO1lBQ3JDLElBQUksQ0FBQyxlQUFl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QUFPLENBQUMsQ0FBQyxDQUNQLElBQUksQ0FBQyxPQUFPO1lBQ1osSUFBSSxDQUFDLFVBQVU7WUFDZixDQUFDLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQzdDLENBQUM7SUFDSixDQUFDO0lBRUQsbUJBQW1CO1FBQ2pCLE1BQU0sT0FBTyxHQUFhLEVBQUUsQ0FBQztRQUU3QixJQUFJLElBQUksQ0FBQyxrQkFBa0I7WUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzNELElBQUksSUFBSSxDQUFDLFNBQVM7WUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDNUQsT0FBTyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLG1CQUFtQjtRQUVsRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0NBQ0Y7QUEvTUQsd0NBK01DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUXVhcnRlcmx5RmluYW5jaWFscyB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEFscGhhVmFudGFnZUNsaWVudCwgQWxwaGFWYW50YWdlQ29uZmlnIH0gZnJvbSAnLi9hbHBoYS12YW50YWdlJztcbmltcG9ydCB7IEZpbmFuY2lhbE1vZGVsaW5nUHJlcENsaWVudCwgRmluYW5jaWFsTW9kZWxpbmdQcmVwQ29uZmlnIH0gZnJvbSAnLi9maW5hbmNpYWwtbW9kZWxpbmctcHJlcCc7XG5pbXBvcnQgeyBZYWhvb0ZpbmFuY2VDbGllbnQsIFlhaG9vRmluYW5jZUNvbmZpZyB9IGZyb20gJy4veWFob28tZmluYW5jZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YUFnZ3JlZ2F0b3JDb25maWcge1xuICBhbHBoYVZhbnRhZ2U/OiBBbHBoYVZhbnRhZ2VDb25maWc7XG4gIGZpbmFuY2lhbE1vZGVsaW5nUHJlcD86IEZpbmFuY2lhbE1vZGVsaW5nUHJlcENvbmZpZztcbiAgeWFob29GaW5hbmNlPzogWWFob29GaW5hbmNlQ29uZmlnO1xuICByZXRyeUF0dGVtcHRzPzogbnVtYmVyO1xuICByZXRyeURlbGF5PzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERhdGFTb3VyY2VSZXN1bHQge1xuICBzb3VyY2U6ICdhbHBoYS12YW50YWdlJyB8ICdmaW5hbmNpYWwtbW9kZWxpbmctcHJlcCcgfCAneWFob28tZmluYW5jZSc7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGRhdGE/OiBQYXJ0aWFsPFF1YXJ0ZXJseUZpbmFuY2lhbHM+W107XG4gIGVycm9yPzogc3RyaW5nO1xuICB0aW1lc3RhbXA6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBZ2dyZWdhdGVkUmVzdWx0IHtcbiAgc3ltYm9sOiBzdHJpbmc7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGRhdGE6IFF1YXJ0ZXJseUZpbmFuY2lhbHNbXTtcbiAgc291cmNlczogRGF0YVNvdXJjZVJlc3VsdFtdO1xuICBwcmltYXJ5U291cmNlOiBzdHJpbmc7XG4gIHRpbWVzdGFtcDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRGF0YUFnZ3JlZ2F0b3Ige1xuICBwcml2YXRlIGFscGhhVmFudGFnZUNsaWVudD86IEFscGhhVmFudGFnZUNsaWVudDtcbiAgcHJpdmF0ZSBmbXBDbGllbnQ/OiBGaW5hbmNpYWxNb2RlbGluZ1ByZXBDbGllbnQ7XG4gIHByaXZhdGUgeWFob29DbGllbnQ6IFlhaG9vRmluYW5jZUNsaWVudDtcbiAgcHJpdmF0ZSBjb25maWc6IERhdGFBZ2dyZWdhdG9yQ29uZmlnO1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogRGF0YUFnZ3JlZ2F0b3JDb25maWcpIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcblxuICAgIGlmIChjb25maWcuYWxwaGFWYW50YWdlPy5hcGlLZXkpIHtcbiAgICAgIHRoaXMuYWxwaGFWYW50YWdlQ2xpZW50ID0gbmV3IEFscGhhVmFudGFnZUNsaWVudChjb25maWcuYWxwaGFWYW50YWdlKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmZpbmFuY2lhbE1vZGVsaW5nUHJlcD8uYXBpS2V5KSB7XG4gICAgICB0aGlzLmZtcENsaWVudCA9IG5ldyBGaW5hbmNpYWxNb2RlbGluZ1ByZXBDbGllbnQoY29uZmlnLmZpbmFuY2lhbE1vZGVsaW5nUHJlcCk7XG4gICAgfVxuXG4gICAgdGhpcy55YWhvb0NsaWVudCA9IG5ldyBZYWhvb0ZpbmFuY2VDbGllbnQoY29uZmlnLnlhaG9vRmluYW5jZSk7XG4gIH1cblxuICBhc3luYyBnZXRDb21wYW55RmluYW5jaWFscyhzeW1ib2w6IHN0cmluZyk6IFByb21pc2U8QWdncmVnYXRlZFJlc3VsdD4ge1xuICAgIGNvbnN0IHNvdXJjZXM6IERhdGFTb3VyY2VSZXN1bHRbXSA9IFtdO1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgIC8vIFRyeSBlYWNoIGRhdGEgc291cmNlIHdpdGggZXJyb3IgaGFuZGxpbmdcbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcbiAgICAgIHRoaXMudHJ5QWxwaGFWYW50YWdlKHN5bWJvbCksXG4gICAgICB0aGlzLnRyeUZpbmFuY2lhbE1vZGVsaW5nUHJlcChzeW1ib2wpLFxuICAgICAgdGhpcy50cnlZYWhvb0ZpbmFuY2Uoc3ltYm9sKSxcbiAgICBdKTtcblxuICAgIC8vIFByb2Nlc3MgcmVzdWx0c1xuICAgIHJlc3VsdHMuZm9yRWFjaCgocmVzdWx0LCBpbmRleCkgPT4ge1xuICAgICAgY29uc3Qgc291cmNlTmFtZSA9IFsnYWxwaGEtdmFudGFnZScsICdmaW5hbmNpYWwtbW9kZWxpbmctcHJlcCcsICd5YWhvby1maW5hbmNlJ11baW5kZXhdIGFzIERhdGFTb3VyY2VSZXN1bHRbJ3NvdXJjZSddO1xuICAgICAgXG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgcmVzdWx0LnZhbHVlKSB7XG4gICAgICAgIHNvdXJjZXMucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBzb3VyY2VOYW1lLFxuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgZGF0YTogcmVzdWx0LnZhbHVlLFxuICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzb3VyY2VzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogc291cmNlTmFtZSxcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBlcnJvcjogcmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJyA/IHJlc3VsdC5yZWFzb24/Lm1lc3NhZ2UgfHwgJ1Vua25vd24gZXJyb3InIDogJ05vIGRhdGEgcmV0dXJuZWQnLFxuICAgICAgICAgIHRpbWVzdGFtcCxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBEZXRlcm1pbmUgcHJpbWFyeSBzb3VyY2UgYW5kIG1lcmdlIGRhdGFcbiAgICBjb25zdCB7IG1lcmdlZERhdGEsIHByaW1hcnlTb3VyY2UgfSA9IHRoaXMubWVyZ2VEYXRhU291cmNlcyhzb3VyY2VzKTtcblxuICAgIHJldHVybiB7XG4gICAgICBzeW1ib2wsXG4gICAgICBzdWNjZXNzOiBtZXJnZWREYXRhLmxlbmd0aCA+IDAsXG4gICAgICBkYXRhOiBtZXJnZWREYXRhLFxuICAgICAgc291cmNlcyxcbiAgICAgIHByaW1hcnlTb3VyY2UsXG4gICAgICB0aW1lc3RhbXAsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgdHJ5QWxwaGFWYW50YWdlKHN5bWJvbDogc3RyaW5nKTogUHJvbWlzZTxQYXJ0aWFsPFF1YXJ0ZXJseUZpbmFuY2lhbHM+W10gfCBudWxsPiB7XG4gICAgaWYgKCF0aGlzLmFscGhhVmFudGFnZUNsaWVudCkgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJldHJ5T3BlcmF0aW9uKCgpID0+IHRoaXMuYWxwaGFWYW50YWdlQ2xpZW50IS5nZXRDb21wYW55RmluYW5jaWFscyhzeW1ib2wpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGBBbHBoYSBWYW50YWdlIGZhaWxlZCBmb3IgJHtzeW1ib2x9OmAsIGVycm9yKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgdHJ5RmluYW5jaWFsTW9kZWxpbmdQcmVwKHN5bWJvbDogc3RyaW5nKTogUHJvbWlzZTxQYXJ0aWFsPFF1YXJ0ZXJseUZpbmFuY2lhbHM+W10gfCBudWxsPiB7XG4gICAgaWYgKCF0aGlzLmZtcENsaWVudCkgcmV0dXJuIG51bGw7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnJldHJ5T3BlcmF0aW9uKCgpID0+IHRoaXMuZm1wQ2xpZW50IS5nZXRDb21wYW55RmluYW5jaWFscyhzeW1ib2wpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGBGaW5hbmNpYWwgTW9kZWxpbmcgUHJlcCBmYWlsZWQgZm9yICR7c3ltYm9sfTpgLCBlcnJvcik7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHRyeVlhaG9vRmluYW5jZShzeW1ib2w6IHN0cmluZyk6IFByb21pc2U8UGFydGlhbDxRdWFydGVybHlGaW5hbmNpYWxzPltdIHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5yZXRyeU9wZXJhdGlvbigoKSA9PiB0aGlzLnlhaG9vQ2xpZW50LmdldENvbXBhbnlGaW5hbmNpYWxzKHN5bWJvbCkpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFlhaG9vIEZpbmFuY2UgZmFpbGVkIGZvciAke3N5bWJvbH06YCwgZXJyb3IpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXRyeU9wZXJhdGlvbjxUPihvcGVyYXRpb246ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgICBjb25zdCBtYXhBdHRlbXB0cyA9IHRoaXMuY29uZmlnLnJldHJ5QXR0ZW1wdHMgfHwgMztcbiAgICBjb25zdCBkZWxheSA9IHRoaXMuY29uZmlnLnJldHJ5RGVsYXkgfHwgMTAwMDtcblxuICAgIGZvciAobGV0IGF0dGVtcHQgPSAxOyBhdHRlbXB0IDw9IG1heEF0dGVtcHRzOyBhdHRlbXB0KyspIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBvcGVyYXRpb24oKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGlmIChhdHRlbXB0ID09PSBtYXhBdHRlbXB0cykge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZyhgQXR0ZW1wdCAke2F0dGVtcHR9IGZhaWxlZCwgcmV0cnlpbmcgaW4gJHtkZWxheX1tcy4uLmApO1xuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgZGVsYXkgKiBhdHRlbXB0KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgcmV0cnkgYXR0ZW1wdHMgZmFpbGVkJyk7XG4gIH1cblxuICBwcml2YXRlIG1lcmdlRGF0YVNvdXJjZXMoc291cmNlczogRGF0YVNvdXJjZVJlc3VsdFtdKTogeyBtZXJnZWREYXRhOiBRdWFydGVybHlGaW5hbmNpYWxzW107IHByaW1hcnlTb3VyY2U6IHN0cmluZyB9IHtcbiAgICBjb25zdCBzdWNjZXNzZnVsU291cmNlcyA9IHNvdXJjZXMuZmlsdGVyKHMgPT4gcy5zdWNjZXNzICYmIHMuZGF0YSAmJiBzLmRhdGEubGVuZ3RoID4gMCk7XG4gICAgXG4gICAgaWYgKHN1Y2Nlc3NmdWxTb3VyY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHsgbWVyZ2VkRGF0YTogW10sIHByaW1hcnlTb3VyY2U6ICdub25lJyB9O1xuICAgIH1cblxuICAgIC8vIFByaW9yaXR5IG9yZGVyOiBGaW5hbmNpYWwgTW9kZWxpbmcgUHJlcCA+IEFscGhhIFZhbnRhZ2UgPiBZYWhvbyBGaW5hbmNlXG4gICAgY29uc3QgcHJpb3JpdHlPcmRlcjogRGF0YVNvdXJjZVJlc3VsdFsnc291cmNlJ11bXSA9IFsnZmluYW5jaWFsLW1vZGVsaW5nLXByZXAnLCAnYWxwaGEtdmFudGFnZScsICd5YWhvby1maW5hbmNlJ107XG4gICAgXG4gICAgbGV0IHByaW1hcnlTb3VyY2UgPSBzdWNjZXNzZnVsU291cmNlc1swXTtcbiAgICBmb3IgKGNvbnN0IHByaW9yaXR5IG9mIHByaW9yaXR5T3JkZXIpIHtcbiAgICAgIGNvbnN0IGZvdW5kID0gc3VjY2Vzc2Z1bFNvdXJjZXMuZmluZChzID0+IHMuc291cmNlID09PSBwcmlvcml0eSk7XG4gICAgICBpZiAoZm91bmQpIHtcbiAgICAgICAgcHJpbWFyeVNvdXJjZSA9IGZvdW5kO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBwcmltYXJ5RGF0YSA9IHByaW1hcnlTb3VyY2UuZGF0YSE7XG4gICAgY29uc3Qgb3RoZXJTb3VyY2VzID0gc3VjY2Vzc2Z1bFNvdXJjZXMuZmlsdGVyKHMgPT4gcy5zb3VyY2UgIT09IHByaW1hcnlTb3VyY2Uuc291cmNlKTtcblxuICAgIC8vIE1lcmdlIGRhdGEgYnkgcXVhcnRlclxuICAgIGNvbnN0IG1lcmdlZERhdGE6IFF1YXJ0ZXJseUZpbmFuY2lhbHNbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgcHJpbWFyeVF1YXJ0ZXIgb2YgcHJpbWFyeURhdGEpIHtcbiAgICAgIGlmICghcHJpbWFyeVF1YXJ0ZXIucXVhcnRlcikgY29udGludWU7XG5cbiAgICAgIGNvbnN0IG1lcmdlZDogUXVhcnRlcmx5RmluYW5jaWFscyA9IHtcbiAgICAgICAgcXVhcnRlcjogcHJpbWFyeVF1YXJ0ZXIucXVhcnRlcixcbiAgICAgICAgcmVwb3J0RGF0ZTogcHJpbWFyeVF1YXJ0ZXIucmVwb3J0RGF0ZSB8fCAnJyxcbiAgICAgICAgbmV0U2FsZXM6IHByaW1hcnlRdWFydGVyLm5ldFNhbGVzIHx8IDAsXG4gICAgICAgIHRvdGFsUmV2ZW51ZTogcHJpbWFyeVF1YXJ0ZXIudG90YWxSZXZlbnVlIHx8IHByaW1hcnlRdWFydGVyLm5ldFNhbGVzIHx8IDAsXG4gICAgICAgIG5ldEluY29tZTogcHJpbWFyeVF1YXJ0ZXIubmV0SW5jb21lIHx8IDAsXG4gICAgICAgIGVwczogcHJpbWFyeVF1YXJ0ZXIuZXBzIHx8IDAsXG4gICAgICAgIG9wZXJhdGluZ0luY29tZTogcHJpbWFyeVF1YXJ0ZXIub3BlcmF0aW5nSW5jb21lIHx8IDAsXG4gICAgICAgIGZyZWVDYXNoRmxvdzogcHJpbWFyeVF1YXJ0ZXIuZnJlZUNhc2hGbG93IHx8IDAsXG4gICAgICAgIHRvdGFsQXNzZXRzOiBwcmltYXJ5UXVhcnRlci50b3RhbEFzc2V0cyxcbiAgICAgICAgdG90YWxEZWJ0OiBwcmltYXJ5UXVhcnRlci50b3RhbERlYnQsXG4gICAgICAgIHNoYXJlaG9sZGVyRXF1aXR5OiBwcmltYXJ5UXVhcnRlci5zaGFyZWhvbGRlckVxdWl0eSxcbiAgICAgICAgc2hhcmVzT3V0c3RhbmRpbmc6IHByaW1hcnlRdWFydGVyLnNoYXJlc091dHN0YW5kaW5nLFxuICAgICAgfTtcblxuICAgICAgLy8gRmlsbCBpbiBtaXNzaW5nIGRhdGEgZnJvbSBvdGhlciBzb3VyY2VzXG4gICAgICBmb3IgKGNvbnN0IG90aGVyU291cmNlIG9mIG90aGVyU291cmNlcykge1xuICAgICAgICBjb25zdCBtYXRjaGluZ1F1YXJ0ZXIgPSBvdGhlclNvdXJjZS5kYXRhPy5maW5kKHEgPT4gcS5xdWFydGVyID09PSBwcmltYXJ5UXVhcnRlci5xdWFydGVyKTtcbiAgICAgICAgaWYgKG1hdGNoaW5nUXVhcnRlcikge1xuICAgICAgICAgIC8vIEZpbGwgaW4gbWlzc2luZyBmaWVsZHNcbiAgICAgICAgICBpZiAoIW1lcmdlZC5uZXRTYWxlcyAmJiBtYXRjaGluZ1F1YXJ0ZXIubmV0U2FsZXMpIG1lcmdlZC5uZXRTYWxlcyA9IG1hdGNoaW5nUXVhcnRlci5uZXRTYWxlcztcbiAgICAgICAgICBpZiAoIW1lcmdlZC50b3RhbFJldmVudWUgJiYgbWF0Y2hpbmdRdWFydGVyLnRvdGFsUmV2ZW51ZSkgbWVyZ2VkLnRvdGFsUmV2ZW51ZSA9IG1hdGNoaW5nUXVhcnRlci50b3RhbFJldmVudWU7XG4gICAgICAgICAgaWYgKCFtZXJnZWQubmV0SW5jb21lICYmIG1hdGNoaW5nUXVhcnRlci5uZXRJbmNvbWUpIG1lcmdlZC5uZXRJbmNvbWUgPSBtYXRjaGluZ1F1YXJ0ZXIubmV0SW5jb21lO1xuICAgICAgICAgIGlmICghbWVyZ2VkLmVwcyAmJiBtYXRjaGluZ1F1YXJ0ZXIuZXBzKSBtZXJnZWQuZXBzID0gbWF0Y2hpbmdRdWFydGVyLmVwcztcbiAgICAgICAgICBpZiAoIW1lcmdlZC5vcGVyYXRpbmdJbmNvbWUgJiYgbWF0Y2hpbmdRdWFydGVyLm9wZXJhdGluZ0luY29tZSkgbWVyZ2VkLm9wZXJhdGluZ0luY29tZSA9IG1hdGNoaW5nUXVhcnRlci5vcGVyYXRpbmdJbmNvbWU7XG4gICAgICAgICAgaWYgKCFtZXJnZWQuZnJlZUNhc2hGbG93ICYmIG1hdGNoaW5nUXVhcnRlci5mcmVlQ2FzaEZsb3cpIG1lcmdlZC5mcmVlQ2FzaEZsb3cgPSBtYXRjaGluZ1F1YXJ0ZXIuZnJlZUNhc2hGbG93O1xuICAgICAgICAgIGlmICghbWVyZ2VkLnRvdGFsQXNzZXRzICYmIG1hdGNoaW5nUXVhcnRlci50b3RhbEFzc2V0cykgbWVyZ2VkLnRvdGFsQXNzZXRzID0gbWF0Y2hpbmdRdWFydGVyLnRvdGFsQXNzZXRzO1xuICAgICAgICAgIGlmICghbWVyZ2VkLnRvdGFsRGVidCAmJiBtYXRjaGluZ1F1YXJ0ZXIudG90YWxEZWJ0KSBtZXJnZWQudG90YWxEZWJ0ID0gbWF0Y2hpbmdRdWFydGVyLnRvdGFsRGVidDtcbiAgICAgICAgICBpZiAoIW1lcmdlZC5zaGFyZWhvbGRlckVxdWl0eSAmJiBtYXRjaGluZ1F1YXJ0ZXIuc2hhcmVob2xkZXJFcXVpdHkpIG1lcmdlZC5zaGFyZWhvbGRlckVxdWl0eSA9IG1hdGNoaW5nUXVhcnRlci5zaGFyZWhvbGRlckVxdWl0eTtcbiAgICAgICAgICBpZiAoIW1lcmdlZC5zaGFyZXNPdXRzdGFuZGluZyAmJiBtYXRjaGluZ1F1YXJ0ZXIuc2hhcmVzT3V0c3RhbmRpbmcpIG1lcmdlZC5zaGFyZXNPdXRzdGFuZGluZyA9IG1hdGNoaW5nUXVhcnRlci5zaGFyZXNPdXRzdGFuZGluZztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBWYWxpZGF0ZSBhbmQgY2xlYW4gdGhlIGRhdGFcbiAgICAgIGlmICh0aGlzLmlzVmFsaWRRdWFydGVybHlEYXRhKG1lcmdlZCkpIHtcbiAgICAgICAgbWVyZ2VkRGF0YS5wdXNoKG1lcmdlZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lcmdlZERhdGE6IG1lcmdlZERhdGEuc2xpY2UoMCwgOCksIC8vIFJldHVybiBsYXN0IDggcXVhcnRlcnNcbiAgICAgIHByaW1hcnlTb3VyY2U6IHByaW1hcnlTb3VyY2Uuc291cmNlLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGlzVmFsaWRRdWFydGVybHlEYXRhKGRhdGE6IFF1YXJ0ZXJseUZpbmFuY2lhbHMpOiBib29sZWFuIHtcbiAgICAvLyBNdXN0IGhhdmUgYmFzaWMgZmluYW5jaWFsIG1ldHJpY3NcbiAgICByZXR1cm4gISEoXG4gICAgICBkYXRhLnF1YXJ0ZXIgJiZcbiAgICAgIGRhdGEucmVwb3J0RGF0ZSAmJlxuICAgICAgKGRhdGEudG90YWxSZXZlbnVlID4gMCB8fCBkYXRhLm5ldFNhbGVzID4gMClcbiAgICApO1xuICB9XG5cbiAgZ2V0QXZhaWxhYmxlU291cmNlcygpOiBzdHJpbmdbXSB7XG4gICAgY29uc3Qgc291cmNlczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBpZiAodGhpcy5hbHBoYVZhbnRhZ2VDbGllbnQpIHNvdXJjZXMucHVzaCgnYWxwaGEtdmFudGFnZScpO1xuICAgIGlmICh0aGlzLmZtcENsaWVudCkgc291cmNlcy5wdXNoKCdmaW5hbmNpYWwtbW9kZWxpbmctcHJlcCcpO1xuICAgIHNvdXJjZXMucHVzaCgneWFob28tZmluYW5jZScpOyAvLyBBbHdheXMgYXZhaWxhYmxlXG4gICAgXG4gICAgcmV0dXJuIHNvdXJjZXM7XG4gIH1cbn0iXX0=