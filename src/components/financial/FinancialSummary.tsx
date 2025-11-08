import React from 'react';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { formatFinancialNumber, formatPercentage, calculateGrowth } from '../../utils';

interface FinancialSummaryProps {
  revenue: number;
  netIncome: number;
  previousRevenue?: number;
  previousNetIncome?: number;
  quarter: string;
  marketCap?: number;
  currentPrice?: number;
  className?: string;
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({
  revenue,
  netIncome,
  previousRevenue,
  previousNetIncome,
  quarter,
  marketCap,
  currentPrice,
  className = '',
}) => {
  const revenueGrowth = previousRevenue ? calculateGrowth(revenue, previousRevenue) : null;
  const incomeGrowth = previousNetIncome ? calculateGrowth(netIncome, previousNetIncome) : null;
  const profitMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0;

  const formatQuarter = (q: string) => {
    if (!q) return 'Latest Quarter';
    
    // Remove "undefined" from the string if present
    let cleaned = q.replace(/undefined\s*/gi, '').trim();
    if (!cleaned) return 'Latest Quarter';
    
    // If already in "Q1 2024" format, return as-is
    if (cleaned.match(/^Q\d \d{4}$/)) return cleaned;
    
    // If in "2024-Q1" format, convert to "Q1 2024"
    const parts = cleaned.split('-');
    if (parts.length === 2) {
      const [year, quarter] = parts;
      if (year && quarter) return `${quarter} ${year}`;
    }
    
    // Fallback: return cleaned string or default
    return cleaned || 'Latest Quarter';
  };

  const getTrendIcon = (growth: { value: number } | null) => {
    if (!growth) return <MinusIcon className="h-5 w-5 text-gray-400" />;
    if (growth.value > 0.01) return <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />;
    if (growth.value < -0.01) return <ArrowTrendingDownIcon className="h-5 w-5 text-red-600" />;
    return <MinusIcon className="h-5 w-5 text-gray-400" />;
  };

  const getTrendColor = (growth: { value: number } | null) => {
    if (!growth) return 'text-gray-400';
    if (growth.value > 0.01) return 'text-green-600';
    if (growth.value < -0.01) return 'text-red-600';
    return 'text-gray-400';
  };

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-6 border border-blue-200 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Financial Summary</h3>
          <p className="text-blue-700 font-medium">{formatQuarter(quarter)}</p>
        </div>
        <div className="bg-white/50 p-2 rounded-lg">
          <InformationCircleIcon className="h-6 w-6 text-blue-600" />
        </div>
      </div>

      {/* Market Cap and Current Price */}
      {(marketCap || currentPrice) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {marketCap && (
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600">Market Cap</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatFinancialNumber(marketCap)}</p>
            </div>
          )}
          {currentPrice && (
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4">
              <span className="text-sm font-medium text-gray-600">Current Price</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">${currentPrice.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue */}
        <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Revenue</span>
            {revenueGrowth && (
              <div className="flex items-center space-x-1">
                {getTrendIcon(revenueGrowth)}
                <span className={`text-sm font-medium ${getTrendColor(revenueGrowth)}`}>
                  {revenueGrowth.formatted}
                </span>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatFinancialNumber(revenue)}</p>
        </div>

        {/* Net Income */}
        <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Net Income</span>
            {incomeGrowth && (
              <div className="flex items-center space-x-1">
                {getTrendIcon(incomeGrowth)}
                <span className={`text-sm font-medium ${getTrendColor(incomeGrowth)}`}>
                  {incomeGrowth.formatted}
                </span>
              </div>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatFinancialNumber(netIncome)}</p>
        </div>
      </div>

      {/* Profit Margin */}
      <div className="mt-6 bg-white/70 backdrop-blur-sm rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Profit Margin</span>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            profitMargin > 20 
              ? 'bg-green-100 text-green-800'
              : profitMargin > 10
              ? 'bg-yellow-100 text-yellow-800'
              : profitMargin > 0
              ? 'bg-orange-100 text-orange-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {profitMargin > 20 ? 'Excellent' : profitMargin > 10 ? 'Good' : profitMargin > 0 ? 'Fair' : 'Poor'}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <p className="text-xl font-bold text-gray-900">{formatPercentage(profitMargin / 100)}</p>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                profitMargin > 20
                  ? 'bg-green-500'
                  : profitMargin > 10
                  ? 'bg-yellow-500'
                  : profitMargin > 0
                  ? 'bg-orange-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(Math.max(profitMargin, 0), 50) * 2}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};