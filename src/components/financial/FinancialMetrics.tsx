import React from 'react';
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import { formatFinancialNumber, calculateGrowth } from '../../utils';

export interface FinancialData {
  totalRevenue: number;
  netIncome: number;
  eps: number;
  operatingIncome: number;
  freeCashFlow: number;
  totalAssets?: number;
  totalDebt?: number;
  shareholderEquity?: number;
  sharesOutstanding?: number;
}

interface FinancialMetricsProps {
  data: FinancialData;
  previousData?: FinancialData;
  format?: 'card' | 'table' | 'compact';
  showGrowth?: boolean;
  className?: string;
}

interface MetricCardProps {
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ReactNode;
  color: string;
  format?: 'currency' | 'number' | 'eps';
  showGrowth?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  previousValue,
  icon,
  color,
  format = 'currency',
  showGrowth = true,
}) => {
  const formatValue = (val: number) => {
    switch (format) {
      case 'eps':
        return `$${val.toFixed(2)}`;
      case 'number':
        return val.toLocaleString();
      case 'currency':
      default:
        return formatFinancialNumber(val);
    }
  };

  const growth = previousValue ? calculateGrowth(value, previousValue) : null;

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          {icon}
        </div>
        {showGrowth && growth !== null && (
          <div className="flex items-center space-x-1">
            {growth.value > 0.01 ? (
              <ArrowTrendingUpIcon className="h-4 w-4 text-green-600" />
            ) : growth.value < -0.01 ? (
              <ArrowTrendingDownIcon className="h-4 w-4 text-red-600" />
            ) : (
              <MinusIcon className="h-4 w-4 text-gray-400" />
            )}
            <span
              className={`text-sm font-medium ${
                growth.value > 0.01
                  ? 'text-green-600'
                  : growth.value < -0.01
                  ? 'text-red-600'
                  : 'text-gray-400'
              }`}
            >
              {growth.formatted}
            </span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{formatValue(value)}</p>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </div>
  );
};

export const FinancialMetrics: React.FC<FinancialMetricsProps> = ({
  data,
  previousData,
  format = 'card',
  showGrowth = true,
  className = '',
}) => {
  const metrics = [
    {
      key: 'totalRevenue',
      label: 'Total Revenue',
      value: data.totalRevenue,
      previousValue: previousData?.totalRevenue,
      icon: <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-50',
      format: 'currency' as const,
    },
    {
      key: 'netIncome',
      label: 'Net Income',
      value: data.netIncome,
      previousValue: previousData?.netIncome,
      icon: <ChartBarIcon className="h-6 w-6 text-green-600" />,
      color: 'bg-green-50',
      format: 'currency' as const,
    },
    {
      key: 'eps',
      label: 'Earnings per Share',
      value: data.eps,
      previousValue: previousData?.eps,
      icon: <span className="text-lg font-bold text-purple-600">EPS</span>,
      color: 'bg-purple-50',
      format: 'eps' as const,
    },
    {
      key: 'operatingIncome',
      label: 'Operating Income',
      value: data.operatingIncome,
      previousValue: previousData?.operatingIncome,
      icon: <ArrowTrendingUpIcon className="h-6 w-6 text-orange-600" />,
      color: 'bg-orange-50',
      format: 'currency' as const,
    },
    {
      key: 'freeCashFlow',
      label: 'Free Cash Flow',
      value: data.freeCashFlow,
      previousValue: previousData?.freeCashFlow,
      icon: <CurrencyDollarIcon className="h-6 w-6 text-indigo-600" />,
      color: 'bg-indigo-50',
      format: 'currency' as const,
    },
  ];

  if (format === 'table') {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Financial Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metric
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                {showGrowth && previousData && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Growth
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.map((metric) => {
                const growth = metric.previousValue ? calculateGrowth(metric.value, metric.previousValue) : null;
                return (
                  <tr key={metric.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg ${metric.color} mr-3`}>
                          {metric.icon}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{metric.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metric.format === 'eps'
                        ? `$${metric.value.toFixed(2)}`
                        : formatFinancialNumber(metric.value)}
                    </td>
                    {showGrowth && previousData && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {growth ? (
                          <div className="flex items-center">
                            {growth.value > 0.01 ? (
                              <ArrowTrendingUpIcon className="h-4 w-4 text-green-600 mr-1" />
                            ) : growth.value < -0.01 ? (
                              <ArrowTrendingDownIcon className="h-4 w-4 text-red-600 mr-1" />
                            ) : (
                              <MinusIcon className="h-4 w-4 text-gray-400 mr-1" />
                            )}
                            <span
                              className={
                                growth.value > 0.01
                                  ? 'text-green-600'
                                  : growth.value < -0.01
                                  ? 'text-red-600'
                                  : 'text-gray-400'
                              }
                            >
                              {growth.formatted}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (format === 'compact') {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {metrics.map((metric) => (
            <div key={metric.key} className="text-center">
              <div className={`inline-flex p-2 rounded-lg ${metric.color} mb-2`}>
                {metric.icon}
              </div>
              <p className="text-lg font-bold text-gray-900">
                {metric.format === 'eps'
                  ? `$${metric.value.toFixed(2)}`
                  : formatFinancialNumber(metric.value)}
              </p>
              <p className="text-xs text-gray-600">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default card format
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 ${className}`}>
      {metrics.map((metric) => (
        <MetricCard
          key={metric.key}
          label={metric.label}
          value={metric.value}
          previousValue={metric.previousValue}
          icon={metric.icon}
          color={metric.color}
          format={metric.format}
          showGrowth={showGrowth}
        />
      ))}
    </div>
  );
};