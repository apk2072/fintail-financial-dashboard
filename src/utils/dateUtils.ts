/**
 * Parse quarter string and return date components
 */
export function parseQuarter(quarter: string): {
  year: number;
  quarter: number;
  startDate: Date;
  endDate: Date;
} {
  const [yearStr, quarterStr] = quarter.split('-');
  const year = parseInt(yearStr, 10);
  const quarterNum = parseInt(quarterStr.replace('Q', ''), 10);

  // Calculate start and end dates for the quarter
  const startMonth = (quarterNum - 1) * 3;
  const endMonth = startMonth + 2;

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0); // Last day of the quarter

  return {
    year,
    quarter: quarterNum,
    startDate,
    endDate,
  };
}

/**
 * Get the previous quarter string
 */
export function getPreviousQuarter(quarter: string): string {
  const { year, quarter: quarterNum } = parseQuarter(quarter);

  if (quarterNum === 1) {
    return `${year - 1}-Q4`;
  } else {
    return `${year}-Q${quarterNum - 1}`;
  }
}

/**
 * Get the next quarter string
 */
export function getNextQuarter(quarter: string): string {
  const { year, quarter: quarterNum } = parseQuarter(quarter);

  if (quarterNum === 4) {
    return `${year + 1}-Q1`;
  } else {
    return `${year}-Q${quarterNum + 1}`;
  }
}

/**
 * Get current quarter string
 */
export function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Get quarter from date
 */
export function getQuarterFromDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Generate array of quarters for a given range
 */
export function getQuarterRange(
  startQuarter: string,
  endQuarter: string
): string[] {
  const quarters: string[] = [];
  let current = startQuarter;

  while (current <= endQuarter) {
    quarters.push(current);
    current = getNextQuarter(current);

    // Safety check to prevent infinite loops
    if (quarters.length > 100) break;
  }

  return quarters;
}

/**
 * Get the last N quarters from a given quarter
 */
export function getLastNQuarters(fromQuarter: string, count: number): string[] {
  const quarters: string[] = [];
  let current = fromQuarter;

  for (let i = 0; i < count; i++) {
    quarters.unshift(current);
    current = getPreviousQuarter(current);
  }

  return quarters;
}

/**
 * Check if a quarter is valid
 */
export function isValidQuarter(quarter: string): boolean {
  const quarterRegex = /^\d{4}-Q[1-4]$/;
  if (!quarterRegex.test(quarter)) return false;

  const [yearStr, quarterStr] = quarter.split('-');
  const year = parseInt(yearStr, 10);
  const quarterNum = parseInt(quarterStr.replace('Q', ''), 10);

  // Basic validation
  return year >= 1900 && year <= 2100 && quarterNum >= 1 && quarterNum <= 4;
}

/**
 * Sort quarters chronologically
 */
export function sortQuarters(
  quarters: string[],
  ascending: boolean = true
): string[] {
  return quarters.sort((a, b) => {
    const comparison = a.localeCompare(b);
    return ascending ? comparison : -comparison;
  });
}

/**
 * Get fiscal year from quarter (assuming calendar year)
 */
export function getFiscalYear(quarter: string): number {
  const { year } = parseQuarter(quarter);
  return year;
}

/**
 * Convert quarter to display format
 */
export function quarterToDisplayFormat(quarter: string): string {
  const { year, quarter: quarterNum } = parseQuarter(quarter);
  return `Q${quarterNum} ${year}`;
}
