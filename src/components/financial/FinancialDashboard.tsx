import React, { useState } from 'react';
import { FinancialMetrics, type FinancialData } from './FinancialMetrics';
import { FinancialSummary } from './FinancialSummary';
import { FinancialCharts, InteractiveFinancialChart, type QuarterlyData } from './FinancialCharts';
import {
  ChartBarIcon,
  TableCellsIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

interface FinancialDashboardProps {
  currentQuarter: FinancialData;
  previousQuarter?: FinancialData;
  quarterlyHistory: QuarterlyData[];
  quarter: string;
  companyName?: string;
  marketCap?: number;
  currentPrice?: number;
  className?: string;
}

type ViewMode = 'overview' | 'detailed' | 'charts';
type ChartType = 'line' | 'bar';

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  currentQuarter,
  previousQuarter,
  quarterlyHistory,
  quarter,
  companyName,
  marketCap,
  currentPrice,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['revenue', 'income']);

  const renderViewModeSelector = () => (
    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setViewMode('overview')}
        className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
          viewMode === 'overview'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <TableCellsIcon className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
        <span className="hidden sm:inline">Overview</span>
        <span className="sm:hidden">Over</span>
      </button>
      <button
        onClick={() => setViewMode('detailed')}
        className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
          viewMode === 'detailed'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <ArrowsRightLeftIcon className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
        <span className="hidden sm:inline">Detailed</span>
        <span className="sm:hidden">Detail</span>
      </button>
      <button
        onClick={() => setViewMode('charts')}
        className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
          viewMode === 'charts'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <ChartBarIcon className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
        Charts
      </button>
    </div>
  );

  const renderChartTypeSelector = () => (
    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setChartType('line')}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          chartType === 'line'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Line
      </button>
      <button
        onClick={() => setChartType('bar')}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          chartType === 'bar'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Bar
      </button>
    </div>
  );

  const renderOverviewMode = () => (
    <div className="space-y-6">
      {/* Financial Summary */}
      <FinancialSummary
        revenue={currentQuarter.totalRevenue}
        netIncome={currentQuarter.netIncome}
        previousRevenue={previousQuarter?.totalRevenue}
        previousNetIncome={previousQuarter?.netIncome}
        quarter={quarter}
        marketCap={marketCap}
        currentPrice={currentPrice}
      />

      {/* Key Metrics Cards */}
      <FinancialMetrics
        data={currentQuarter}
        previousData={previousQuarter}
        format="card"
        showGrowth={!!previousQuarter}
      />

      {/* Mini Chart */}
      {quarterlyHistory.length > 1 && (
        <FinancialCharts
          data={quarterlyHistory}
          chartType="line"
          showMetrics={['revenue', 'income']}
          height={250}
        />
      )}
    </div>
  );

  const renderDetailedMode = () => (
    <div className="space-y-6">
      {/* Comprehensive Metrics Table */}
      <FinancialMetrics
        data={currentQuarter}
        previousData={previousQuarter}
        format="table"
        showGrowth={!!previousQuarter}
      />

      {/* Additional Financial Ratios */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Ratios</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600">Profit Margin</p>
            <p className="text-xl font-bold text-gray-900">
              {currentQuarter.totalRevenue > 0
                ? `${((currentQuarter.netIncome / currentQuarter.totalRevenue) * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600">Operating Margin</p>
            <p className="text-xl font-bold text-gray-900">
              {currentQuarter.totalRevenue > 0
                ? `${((currentQuarter.operatingIncome / currentQuarter.totalRevenue) * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600">FCF Margin</p>
            <p className="text-xl font-bold text-gray-900">
              {currentQuarter.totalRevenue > 0
                ? `${((currentQuarter.freeCashFlow / currentQuarter.totalRevenue) * 100).toFixed(1)}%`
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Compact Metrics */}
      <FinancialMetrics
        data={currentQuarter}
        previousData={previousQuarter}
        format="compact"
        showGrowth={false}
      />
    </div>
  );

  const renderChartsMode = () => (
    <div className="space-y-6">
      {quarterlyHistory.length > 1 ? (
        <>
          {/* Interactive Chart */}
          <InteractiveFinancialChart
            data={quarterlyHistory}
            chartType={chartType}
            selectedMetrics={selectedMetrics}
            onMetricsChange={setSelectedMetrics}
            height={400}
          />

          {/* Individual Metric Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FinancialCharts
              data={quarterlyHistory}
              chartType={chartType}
              showMetrics={['revenue']}
              height={300}
            />
            <FinancialCharts
              data={quarterlyHistory}
              chartType={chartType}
              showMetrics={['income', 'operating']}
              height={300}
            />
            <FinancialCharts
              data={quarterlyHistory}
              chartType={chartType}
              showMetrics={['cashFlow']}
              height={300}
            />
            <FinancialCharts
              data={quarterlyHistory}
              chartType={chartType}
              showMetrics={['eps']}
              height={300}
            />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Insufficient Data</h3>
          <p className="text-gray-600">
            Charts require at least 2 quarters of data. More historical data will enable trend analysis.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className={`space-y-4 sm:space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {companyName ? `${companyName} Financials` : 'Financial Dashboard'}
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            {quarter} • {quarterlyHistory.length} quarters of data
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          {viewMode === 'charts' && (
            <div className="order-2 sm:order-1">
              {renderChartTypeSelector()}
            </div>
          )}
          <div className="order-1 sm:order-2">
            {renderViewModeSelector()}
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'overview' && renderOverviewMode()}
      {viewMode === 'detailed' && renderDetailedMode()}
      {viewMode === 'charts' && renderChartsMode()}
    </div>
  );
};