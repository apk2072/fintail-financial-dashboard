/**
 * Format large numbers for financial display (millions, billions, etc.)
 */
export function formatFinancialNumber(
  value: number,
  options: {
    decimals?: number;
    currency?: boolean;
    compact?: boolean;
  } = {}
): string {
  const { decimals = 2, currency = true, compact = true } = options;

  if (value === 0) return currency ? '$0' : '0';

  const absValue = Math.abs(value);
  const isNegative = value < 0;

  let formattedValue: string;
  let suffix = '';

  if (compact) {
    if (absValue >= 1e12) {
      formattedValue = (absValue / 1e12).toFixed(decimals);
      suffix = 'T';
    } else if (absValue >= 1e9) {
      formattedValue = (absValue / 1e9).toFixed(decimals);
      suffix = 'B';
    } else if (absValue >= 1e6) {
      formattedValue = (absValue / 1e6).toFixed(decimals);
      suffix = 'M';
    } else if (absValue >= 1e3) {
      formattedValue = (absValue / 1e3).toFixed(decimals);
      suffix = 'K';
    } else {
      formattedValue = absValue.toFixed(decimals);
    }
  } else {
    formattedValue = absValue.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  // Remove trailing zeros after decimal point
  if (decimals > 0) {
    formattedValue = formattedValue.replace(/\.?0+$/, '');
  }

  const sign = isNegative ? '-' : '';
  const currencySymbol = currency ? '$' : '';

  return `${sign}${currencySymbol}${formattedValue}${suffix}`;
}

/**
 * Format percentage values
 */
export function formatPercentage(
  value: number,
  options: {
    decimals?: number;
    showSign?: boolean;
  } = {}
): string {
  const { decimals = 2, showSign = false } = options;

  const formatted = (value * 100).toFixed(decimals);
  const sign = showSign && value > 0 ? '+' : '';

  return `${sign}${formatted}%`;
}

/**
 * Format EPS (Earnings Per Share)
 */
export function formatEPS(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}`;
}

/**
 * Format market cap
 */
export function formatMarketCap(value: number): string {
  return formatFinancialNumber(value, {
    currency: true,
    compact: true,
    decimals: 1,
  });
}

/**
 * Format date for display
 */
export function formatDate(
  dateString: string,
  options: {
    format?: 'short' | 'medium' | 'long';
    includeTime?: boolean;
  } = {}
): string {
  const { format = 'medium', includeTime = false } = options;

  const date = new Date(dateString);

  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month:
      format === 'short' ? 'short' : format === 'medium' ? 'short' : 'long',
    day: 'numeric',
  };

  if (includeTime) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', dateOptions);
}

/**
 * Format quarter string for display
 */
export function formatQuarter(quarter: string): string {
  if (!quarter) return 'Latest Quarter';
  
  // Remove "undefined" from the string if present
  let cleaned = quarter.replace(/undefined\s*/gi, '').trim();
  if (!cleaned) return 'Latest Quarter';
  
  // If already in "Q1 2024" format, return as-is
  if (cleaned.match(/^Q\d \d{4}$/)) return cleaned;
  
  // Convert "2024-Q1" to "Q1 2024"
  const parts = cleaned.split('-');
  if (parts.length === 2) {
    const [year, q] = parts;
    if (year && q) return `${q} ${year}`;
  }
  
  // Fallback: return cleaned string or default
  return cleaned || 'Latest Quarter';
}

/**
 * Calculate and format growth percentage
 */
export function calculateGrowth(
  current: number,
  previous: number
): {
  value: number;
  formatted: string;
  isPositive: boolean;
} {
  if (previous === 0) {
    return {
      value: 0,
      formatted: 'N/A',
      isPositive: false,
    };
  }

  const growth = (current - previous) / previous;
  const isPositive = growth > 0;

  return {
    value: growth,
    formatted: formatPercentage(growth, { showSign: true }),
    isPositive,
  };
}

/**
 * Format financial metric with appropriate units
 */
export function formatMetric(
  value: number,
  metric:
    | 'revenue'
    | 'income'
    | 'cashFlow'
    | 'eps'
    | 'marketCap'
    | 'assets'
    | 'debt'
): string {
  switch (metric) {
    case 'eps':
      return formatEPS(value);
    case 'marketCap':
      return formatMarketCap(value);
    case 'revenue':
    case 'income':
    case 'cashFlow':
    case 'assets':
    case 'debt':
      return formatFinancialNumber(value);
    default:
      return formatFinancialNumber(value);
  }
}

/**
 * Get trend indicator (up/down arrow) based on growth
 */
export function getTrendIndicator(growth: number): {
  symbol: string;
  color: string;
  direction: 'up' | 'down' | 'neutral';
} {
  if (growth > 0.01) {
    // > 1% growth
    return { symbol: '↗', color: 'text-green-600', direction: 'up' };
  } else if (growth < -0.01) {
    // < -1% decline
    return { symbol: '↘', color: 'text-red-600', direction: 'down' };
  } else {
    return { symbol: '→', color: 'text-gray-600', direction: 'neutral' };
  }
}