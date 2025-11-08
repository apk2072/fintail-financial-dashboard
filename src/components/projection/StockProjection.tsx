import React, { useEffect, useState } from 'react';
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface PriceProjection {
  targetPrice: number;
  percentageChange: number;
  range: {
    low: number;
    high: number;
  };
}

interface ProjectionData {
  ticker: string;
  currentPrice: number;
  projections: {
    threeMonth: PriceProjection;
    sixMonth: PriceProjection;
    twelveMonth: PriceProjection;
  };
  analysis: {
    summary: string;
    keyDrivers: string[];
    risks: string[];
    confidence: 'High' | 'Medium' | 'Low';
  };
  generatedAt: string;
  dataAsOf: string;
}

interface StockProjectionProps {
  ticker: string;
}

export const StockProjection: React.FC<StockProjectionProps> = ({ ticker }) => {
  const [projection, setProjection] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    const fetchProjection = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(
          `https://9468zcsjg8.execute-api.us-east-1.amazonaws.com/prod/companies/${ticker}/projection`
        );
        
        const data = await response.json();
        
        if (data.success) {
          setProjection(data.data);
        } else {
          setError(data.error || 'Failed to load projection');
        }
      } catch (err) {
        console.error('Error fetching projection:', err);
        setError('Failed to load stock projection');
      } finally {
        setLoading(false);
      }
    };

    if (ticker) {
      fetchProjection();
    }
  }, [ticker]);

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  
  const formatPercentage = (pct: number) => {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center text-red-600">
          <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!projection) {
    return null;
  }

  const projections = [
    { label: '3 Month', data: projection.projections.threeMonth },
    { label: '6 Month', data: projection.projections.sixMonth },
    { label: '12 Month', data: projection.projections.twelveMonth },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <SparklesIcon className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900">AI Price Projections</h2>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(projection.analysis.confidence)}`}>
          {projection.analysis.confidence} Confidence
        </span>
      </div>

      {/* AI Price Projection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {projections.map(({ label, data }) => (
          <div
            key={label}
            className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
          >
            <p className="text-sm font-medium text-gray-600 mb-2">{label} Target</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {formatPrice(data.targetPrice)}
            </p>
            <div className="flex items-center mb-3">
              {data.percentageChange >= 0 ? (
                <ArrowTrendingUpIcon className="h-4 w-4 text-green-600 mr-1" />
              ) : (
                <ArrowTrendingDownIcon className="h-4 w-4 text-red-600 mr-1" />
              )}
              <span className={`text-sm font-medium ${data.percentageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(data.percentageChange)}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              <p>Range: {formatPrice(data.range.low)} - {formatPrice(data.range.high)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analysis Summary */}
      <div className="bg-purple-50 rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-700 leading-relaxed">{projection.analysis.summary}</p>
      </div>

      {/* Toggle Analysis Button */}
      <button
        onClick={() => setShowAnalysis(!showAnalysis)}
        className="w-full text-center text-sm font-medium text-purple-600 hover:text-purple-700 py-2"
      >
        {showAnalysis ? 'Hide' : 'Show'} Detailed Analysis
      </button>

      {/* Detailed Analysis */}
      {showAnalysis && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Drivers */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <ArrowTrendingUpIcon className="h-4 w-4 text-green-600 mr-2" />
                Key Growth Drivers
              </h3>
              <ul className="space-y-2">
                {projection.analysis.keyDrivers.map((driver, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-600 mr-2" />
                Risk Factors
              </h3>
              <ul className="space-y-2">
                {projection.analysis.risks.map((risk, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="text-red-600 mr-2">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-start text-xs text-gray-500">
          <InformationCircleIcon className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
          <p>
            Current price from Yahoo Finance. Projections are AI-generated based on historical financial data (as of {new Date(projection.dataAsOf).toLocaleDateString()}) 
            and should not be considered as investment advice. Past performance does not guarantee future results. 
            Always conduct your own research and consult with a financial advisor before making investment decisions.
          </p>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Projections generated: {new Date(projection.generatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
};
