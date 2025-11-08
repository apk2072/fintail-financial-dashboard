import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  BuildingOfficeIcon,
  CalendarIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { formatFinancialNumber } from '../utils';
import { FinancialDashboard, type QuarterlyData } from '../components/financial';
import { StockProjection } from '../components/projection/StockProjection';
import { apiClientInstance } from '../services/apiClient';

interface CompanyData {
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  description?: string;
  website?: string;
  headquarters?: string;
  employees?: number;
  lastUpdated: string;
  quarterlyData: (QuarterlyData & {
    segments?: {
      aws?: {
        revenue: number;
        operatingIncome: number;
        operatingMargin: number;
      };
    };
  })[];
}

export const CompanyDetail: React.FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [priceChange, setPriceChange] = useState<number | undefined>(undefined);
  const [priceChangePercent, setPriceChangePercent] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!ticker) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch company data from API
        const companyData = await apiClientInstance.getCompany(ticker);
        
        setCompany({
          ticker: companyData.ticker,
          name: companyData.name,
          sector: companyData.sector,
          marketCap: companyData.marketCap,
          description: companyData.description,
          website: companyData.website,
          headquarters: companyData.headquarters,
          employees: companyData.employees,
          lastUpdated: companyData.lastUpdated,
          quarterlyData: (companyData as any).quarterlyData || [],
        });
      } catch (err: any) {
        console.error('Error fetching company data:', err);
        setError(err?.message || 'Failed to load company data');
        setCompany(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyData();
  }, [ticker]);

  // Fetch current stock price and change data
  useEffect(() => {
    const fetchCurrentPrice = async () => {
      if (!ticker) return;
      
      try {
        const response = await fetch(
          `https://9468zcsjg8.execute-api.us-east-1.amazonaws.com/prod/companies/${ticker}/projection`
        );
        const data = await response.json();
        
        if (data.success && data.data?.currentPrice) {
          setCurrentPrice(data.data.currentPrice);
          setPriceChange(data.data.priceChange);
          setPriceChangePercent(data.data.priceChangePercent);
        }
      } catch (err) {
        console.error('Error fetching current price:', err);
        // Don't set error state, just log it - current price is optional
      }
    };

    fetchCurrentPrice();
  }, [ticker]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded-xl"></div>
              <div className="h-96 bg-gray-200 rounded-xl"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200 rounded-xl"></div>
              <div className="h-32 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {error ? 'Error loading company' : 'Company not found'}
          </h3>
          <p className="text-gray-600 mb-4">
            {error || `We couldn't find data for ticker symbol "${ticker?.toUpperCase()}".`}
          </p>
          <Link
            to="/search"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Search for companies →
          </Link>
        </div>
      </div>
    );
  }

  const latestQuarter = company.quarterlyData[0];
  const previousQuarter = company.quarterlyData[1];
  
  // Fallback for quarter display
  const displayQuarter = latestQuarter?.quarter || 'Latest Quarter';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
        <Link to="/" className="hover:text-gray-900">Dashboard</Link>
        <span>/</span>
        <Link to="/search" className="hover:text-gray-900">Search</Link>
        <span>/</span>
        <span className="text-gray-900">{company.ticker}</span>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 text-white">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-start space-x-3 sm:space-x-4 mb-3 sm:mb-4">
              <Link
                to="/search"
                className="bg-white/10 p-1.5 sm:p-2 rounded-lg hover:bg-white/20 transition-colors mt-1"
              >
                <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">{company.name}</h1>
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2">
                  <span className="bg-white/20 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium inline-block w-fit">
                    {company.ticker}
                  </span>
                  <span className="text-blue-100 text-sm sm:text-base mt-1 sm:mt-0">{company.sector}</span>
                </div>
              </div>
            </div>
            <p className="text-blue-100 text-sm sm:text-base max-w-2xl">
              {company.description}
            </p>
          </div>
          <div className="mt-4 lg:mt-0 lg:text-right space-y-4">
            <div>
              <p className="text-xl sm:text-2xl font-bold">
                {formatFinancialNumber(company.marketCap)}
              </p>
              <p className="text-blue-100 text-sm sm:text-base">Market Cap</p>
            </div>
            {currentPrice && (
              <div>
                <div className="flex items-baseline justify-end space-x-2">
                  <p className="text-xl sm:text-2xl font-bold">
                    ${currentPrice.toFixed(2)}
                  </p>
                  {priceChange !== undefined && priceChangePercent !== undefined && (
                    <span className={`text-sm font-medium ${
                      priceChange >= 0 ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                    </span>
                  )}
                </div>
                <p className="text-blue-100 text-sm sm:text-base">Current Price</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Stock Projection */}
      <StockProjection ticker={company.ticker} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content - Financial Dashboard */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <FinancialDashboard
            currentQuarter={{
              totalRevenue: latestQuarter.totalRevenue,
              netIncome: latestQuarter.netIncome,
              eps: latestQuarter.eps,
              operatingIncome: latestQuarter.operatingIncome,
              freeCashFlow: latestQuarter.freeCashFlow,
            }}
            previousQuarter={previousQuarter ? {
              totalRevenue: previousQuarter.totalRevenue,
              netIncome: previousQuarter.netIncome,
              eps: previousQuarter.eps,
              operatingIncome: previousQuarter.operatingIncome,
              freeCashFlow: previousQuarter.freeCashFlow,
            } : undefined}
            quarterlyHistory={company.quarterlyData}
            quarter={displayQuarter}
            companyName={company.name}
            marketCap={company.marketCap}
            currentPrice={currentPrice}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
          {/* Company Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Company Information</h3>
            <div className="space-y-3 sm:space-y-4">
              {company.headquarters && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Headquarters</p>
                  <p className="text-sm sm:text-base text-gray-900">{company.headquarters}</p>
                </div>
              )}
              {company.employees && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Employees</p>
                  <p className="text-sm sm:text-base text-gray-900">{company.employees.toLocaleString()}</p>
                </div>
              )}
              {company.website && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Website</p>
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm sm:text-base text-blue-600 hover:text-blue-700 break-all"
                  >
                    {company.website.replace('https://', '')}
                  </a>
                </div>
              )}
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Last Updated</p>
                <div className="flex items-center text-sm sm:text-base text-gray-900">
                  <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  {new Date(company.lastUpdated).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
            <div className="space-y-2 sm:space-y-3">
              <Link
                to={`/search?q=${company.sector}`}
                className="block w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm sm:text-base"
              >
                View {company.sector} Companies
              </Link>
              <button className="block w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm sm:text-base">
                Compare with Peers
              </button>
              <button className="block w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm sm:text-base">
                Export Financial Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};