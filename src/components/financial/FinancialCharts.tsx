import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { formatFinancialNumber, formatQuarter } from '../../utils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface QuarterlyData {
  quarter: string;
  totalRevenue: number;
  netIncome: number;
  operatingIncome: number;
  freeCashFlow: number;
  eps: number;
}

interface FinancialChartsProps {
  data: QuarterlyData[];
  chartType?: 'line' | 'bar';
  showMetrics?: ('revenue' | 'income' | 'operating' | 'cashFlow' | 'eps')[];
  height?: number;
  className?: string;
}

interface ChartConfig {
  label: string;
  dataKey: keyof QuarterlyData;
  color: string;
  backgroundColor: string;
  format: 'currency' | 'eps';
}

const CHART_CONFIGS: Record<string, ChartConfig> = {
  revenue: {
    label: 'Total Revenue',
    dataKey: 'totalRevenue',
    color: 'rgb(59, 130, 246)', // blue-500
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    format: 'currency',
  },
  income: {
    label: 'Net Income',
    dataKey: 'netIncome',
    color: 'rgb(34, 197, 94)', // green-500
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    format: 'currency',
  },
  operating: {
    label: 'Operating Income',
    dataKey: 'operatingIncome',
    color: 'rgb(249, 115, 22)', // orange-500
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    format: 'currency',
  },
  cashFlow: {
    label: 'Free Cash Flow',
    dataKey: 'freeCashFlow',
    color: 'rgb(168, 85, 247)', // purple-500
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    format: 'currency',
  },
  eps: {
    label: 'Earnings Per Share',
    dataKey: 'eps',
    color: 'rgb(236, 72, 153)', // pink-500
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    format: 'eps',
  },
};

export const FinancialCharts: React.FC<FinancialChartsProps> = ({
  data,
  chartType = 'line',
  showMetrics = ['revenue', 'income', 'operating', 'cashFlow'],
  height = 400,
  className = '',
}) => {
  const chartData = useMemo(() => {
    const labels = data.map((item) => formatQuarter(item.quarter));
    
    const datasets = showMetrics.map((metric) => {
      const config = CHART_CONFIGS[metric];
      const values = data.map((item) => item[config.dataKey] as number);

      return {
        label: config.label,
        data: values,
        borderColor: config.color,
        backgroundColor: chartType === 'line' ? config.backgroundColor : config.color,
        borderWidth: 2,
        fill: chartType === 'line',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: config.color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      };
    });

    return { labels, datasets };
  }, [data, showMetrics, chartType]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: 500,
          },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const config = CHART_CONFIGS[showMetrics[context.datasetIndex]];
            const value = context.parsed.y;
            const formattedValue = config.format === 'eps' 
              ? `$${value.toFixed(2)}`
              : formatFinancialNumber(value);
            return `${context.dataset.label}: ${formattedValue}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
            weight: 500,
          },
          color: '#6b7280', // gray-500
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          font: {
            size: 11,
            weight: 500,
          },
          color: '#6b7280', // gray-500
          callback: function(value: any) {
            // Format y-axis labels based on the first metric's format
            const firstMetric = showMetrics[0];
            const config = CHART_CONFIGS[firstMetric];
            
            if (config.format === 'eps') {
              return `$${value.toFixed(1)}`;
            }
            
            // For currency values, show abbreviated format
            if (value >= 1e9) {
              return `$${(value / 1e9).toFixed(1)}B`;
            } else if (value >= 1e6) {
              return `$${(value / 1e6).toFixed(1)}M`;
            } else if (value >= 1e3) {
              return `$${(value / 1e3).toFixed(1)}K`;
            }
            return `$${value}`;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    elements: {
      point: {
        hoverRadius: 8,
      },
    },
  }), [showMetrics]);

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-8 text-center ${className}`}>
        <div className="text-gray-500">
          <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm">Financial data will appear here when available</p>
        </div>
      </div>
    );
  }

  const ChartComponent = chartType === 'line' ? Line : Bar;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Financial Trends</h3>
        <p className="text-sm text-gray-600">Quarterly performance over time</p>
      </div>
      <div style={{ height: `${height}px` }}>
        <ChartComponent data={chartData} options={options} />
      </div>
    </div>
  );
};

// Specialized chart components for specific metrics
export const RevenueChart: React.FC<Omit<FinancialChartsProps, 'showMetrics'>> = (props) => (
  <FinancialCharts {...props} showMetrics={['revenue']} />
);

export const ProfitabilityChart: React.FC<Omit<FinancialChartsProps, 'showMetrics'>> = (props) => (
  <FinancialCharts {...props} showMetrics={['income', 'operating']} />
);

export const CashFlowChart: React.FC<Omit<FinancialChartsProps, 'showMetrics'>> = (props) => (
  <FinancialCharts {...props} showMetrics={['cashFlow']} />
);

export const EPSChart: React.FC<Omit<FinancialChartsProps, 'showMetrics'>> = (props) => (
  <FinancialCharts {...props} showMetrics={['eps']} />
);

// Chart selector component for interactive metric selection
interface ChartSelectorProps extends Omit<FinancialChartsProps, 'showMetrics'> {
  onMetricsChange?: (metrics: string[]) => void;
  selectedMetrics?: string[];
}

export const InteractiveFinancialChart: React.FC<ChartSelectorProps> = ({
  onMetricsChange,
  selectedMetrics = ['revenue', 'income'],
  ...props
}) => {
  const handleMetricToggle = (metric: string) => {
    const newMetrics = selectedMetrics.includes(metric)
      ? selectedMetrics.filter(m => m !== metric)
      : [...selectedMetrics, metric];
    
    onMetricsChange?.(newMetrics);
  };

  return (
    <div className={props.className}>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Financial Performance</h3>
            <p className="text-sm text-gray-600">Select metrics to compare</p>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
            {Object.entries(CHART_CONFIGS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleMetricToggle(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedMetrics.includes(key)
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>
        
        <FinancialCharts 
          {...props} 
          showMetrics={selectedMetrics as any}
          className=""
        />
      </div>
    </div>
  );
};