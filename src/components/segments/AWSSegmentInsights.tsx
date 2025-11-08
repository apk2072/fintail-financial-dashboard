import React from 'react';
import { CloudIcon, ArrowTrendingUpIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatFinancialNumber } from '../../utils/formatters';

interface AWSSegmentData {
  quarter: string;
  reportDate: string;
  revenue: number;
  operatingIncome: number;
  operatingMargin: number;
}

interface AWSSegmentInsightsProps {
  data: AWSSegmentData[];
  totalRevenue?: number;
}

export const AWSSegmentInsights: React.FC<AWSSegmentInsightsProps> = ({ data, totalRevenue }) => {
  if (!data || data.length === 0) {
    return null;
  }

  const latestQuarter = data[0];
  const previousQuarter = data[1];
  
  // Calculate growth metrics
  const revenueGrowth = previousQuarter 
    ? ((latestQuarter.revenue - previousQuarter.revenue) / previousQuarter.revenue) * 100
    : null;
  
  const incomeGrowth = previousQuarter
    ? ((latestQuarter.operatingIncome - previousQuarter.operatingIncome) / previousQuarter.operatingIncome) * 100
    : null;
  
  // Calculate AWS contribution to total revenue
  const revenueContribution = totalRevenue
    ? (latestQuarter.revenue / totalRevenue) * 100
    : null;

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border border-orange-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-500 rounded-lg">
          <CloudIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">AWS Segment Performance</h2>
          <p className="text-sm text-gray-600">Amazon Web Services - {latestQuarter.quarter}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Revenue */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">AWS Revenue</span>
            <CurrencyDollarIcon className="h-5 w-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatFinancialNumber(latestQuarter.revenue)}
          </div>
          {revenueGrowth !== null && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <ArrowTrendingUpIcon className="h-4 w-4" />
              <span>{revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}% QoQ</span>
            </div>
          )}
          {revenueContribution !== null && (
            <div className="text-xs text-gray-500 mt-1">
              {revenueContribution.toFixed(1)}% of total revenue
            </div>
          )}
        </div>

        {/* Operating Income */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Operating Income</span>
            <CurrencyDollarIcon className="h-5 w-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatFinancialNumber(latestQuarter.operatingIncome)}
          </div>
          {incomeGrowth !== null && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${incomeGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <ArrowTrendingUpIcon className="h-4 w-4" />
              <span>{incomeGrowth >= 0 ? '+' : ''}{incomeGrowth.toFixed(1)}% QoQ</span>
            </div>
          )}
        </div>

        {/* Operating Margin */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Operating Margin</span>
            <ArrowTrendingUpIcon className="h-5 w-5 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {latestQuarter.operatingMargin.toFixed(1)}%
          </div>
          {previousQuarter && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              latestQuarter.operatingMargin >= previousQuarter.operatingMargin ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>
                {latestQuarter.operatingMargin >= previousQuarter.operatingMargin ? '+' : ''}
                {(latestQuarter.operatingMargin - previousQuarter.operatingMargin).toFixed(1)}pp
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quarterly Trend */}
      {data.length > 1 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Quarterly Revenue Trend</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {data.slice(0, 4).reverse().map((quarter) => {
              const maxRevenue = Math.max(...data.slice(0, 4).map(q => q.revenue));
              const height = (quarter.revenue / maxRevenue) * 100;
              
              return (
                <div key={quarter.reportDate} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs font-medium text-gray-900 mb-1">
                      {formatFinancialNumber(quarter.revenue)}
                    </span>
                    <div 
                      className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t transition-all duration-300 hover:from-orange-600 hover:to-orange-500"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">{quarter.quarter}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
        <p className="text-xs text-gray-700">
          <span className="font-semibold">Key Insight:</span> AWS continues to be Amazon's most profitable segment, 
          generating {latestQuarter.operatingMargin.toFixed(1)}% operating margins while contributing 
          {revenueContribution ? ` ${revenueContribution.toFixed(1)}%` : ''} to total company revenue.
        </p>
      </div>
    </div>
  );
};
