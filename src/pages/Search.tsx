import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  MagnifyingGlassIcon, 
  BuildingOfficeIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

interface SearchResult {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  marketCap: number;
  description?: string;
  relevanceScore?: number;
  matchType?: string;
}

export const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    sector: '',
    minMarketCap: '',
    maxMarketCap: '',
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mock search function - will be replaced with real API call
  const mockSearch = async (searchQuery: string): Promise<SearchResult[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const mockData: SearchResult[] = [
      {
        id: 'AAPL',
        name: 'Apple Inc.',
        ticker: 'AAPL',
        sector: 'Technology',
        marketCap: 3000000000000,
        description: 'Designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.',
        relevanceScore: 0.95,
        matchType: 'exact_ticker'
      },
      {
        id: 'MSFT',
        name: 'Microsoft Corporation',
        ticker: 'MSFT',
        sector: 'Technology',
        marketCap: 2800000000000,
        description: 'Develops, licenses, and supports software, services, devices, and solutions worldwide.',
        relevanceScore: 0.85,
        matchType: 'name_match'
      },
      {
        id: 'GOOGL',
        name: 'Alphabet Inc.',
        ticker: 'GOOGL',
        sector: 'Technology',
        marketCap: 1700000000000,
        description: 'Provides online advertising services and cloud computing services.',
        relevanceScore: 0.75,
        matchType: 'name_match'
      },
    ];

    // Filter based on query
    return mockData.filter(company => 
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.ticker.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await mockSearch(searchQuery);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
      handleSearch(query.trim());
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearchParams({});
    searchInputRef.current?.focus();
  };

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  // Search on initial load if query param exists
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setQuery(initialQuery);
      handleSearch(initialQuery);
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Search Companies</h1>
        <p className="text-gray-600">
          Find companies by name, ticker symbol, or explore by sector and market cap.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by company name or ticker (e.g., Apple, AAPL)..."
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sector
                </label>
                <select
                  value={filters.sector}
                  onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Sectors</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Financial Services">Financial Services</option>
                  <option value="Consumer Discretionary">Consumer Discretionary</option>
                  <option value="Energy">Energy</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Market Cap
                </label>
                <input
                  type="text"
                  value={filters.minMarketCap}
                  onChange={(e) => setFilters({ ...filters, minMarketCap: e.target.value })}
                  placeholder="e.g., 1B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Market Cap
                </label>
                <input
                  type="text"
                  value={filters.maxMarketCap}
                  onChange={(e) => setFilters({ ...filters, maxMarketCap: e.target.value })}
                  placeholder="e.g., 100B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Results */}
      {query && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Search Results for "{query}"
            </h2>
            {results.length > 0 && (
              <p className="text-gray-600 mt-1">
                Found {results.length} {results.length === 1 ? 'company' : 'companies'}
              </p>
            )}
          </div>

          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Searching...</p>
              </div>
            ) : results.length > 0 ? (
              results.map((company) => (
                <Link
                  key={company.id}
                  to={`/company/${company.ticker}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {company.name}
                          </h3>
                          <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-medium">
                            {company.ticker}
                          </span>
                          {company.matchType && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              company.matchType === 'exact_ticker' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {company.matchType === 'exact_ticker' ? 'Exact Match' : 'Name Match'}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mb-2">{company.sector}</p>
                        {company.description && (
                          <p className="text-gray-500 text-sm line-clamp-2">
                            {company.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatMarketCap(company.marketCap)}
                      </p>
                      <p className="text-sm text-gray-500">Market Cap</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center">
                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
                <p className="text-gray-600">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popular Searches */}
      {!query && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular Searches</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM'].map((ticker) => (
              <button
                key={ticker}
                onClick={() => {
                  setQuery(ticker);
                  setSearchParams({ q: ticker });
                  handleSearch(ticker);
                }}
                className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{ticker}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};