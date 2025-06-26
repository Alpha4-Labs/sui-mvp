/**
 * Format Alpha Points for display
 * @param points - Points value as string, number, or bigint
 * @returns Formatted string with commas
 */
export const formatPoints = (points: string | number | bigint): string => {
  if (!points) return '0';
  
  const num = typeof points === 'bigint' ? Number(points) : Number(points);
  
  if (isNaN(num)) return '0';
  
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Format Alpha Points with suffix (K, M, B)
 * @param points - Points value
 * @returns Formatted string with suffix
 */
export const formatPointsCompact = (points: string | number | bigint): string => {
  const num = typeof points === 'bigint' ? Number(points) : Number(points);
  
  if (isNaN(num) || num === 0) return '0';
  
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  
  return formatPoints(num);
};

/**
 * Format USD value from Alpha Points
 * @param points - Alpha Points value
 * @param rate - Conversion rate (default: 1000 points = $1)
 * @returns Formatted USD string
 */
export const formatPointsToUSD = (points: string | number | bigint, rate = 1000): string => {
  const num = typeof points === 'bigint' ? Number(points) : Number(points);
  
  if (isNaN(num) || num === 0) return '$0.00';
  
  const usdValue = num / rate;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdValue);
};

/**
 * Format wallet address for display
 * @param address - Full wallet address
 * @param startChars - Characters to show at start (default: 6)
 * @param endChars - Characters to show at end (default: 4)
 * @returns Formatted address with ellipsis
 */
export const formatAddress = (address: string, startChars = 6, endChars = 4): string => {
  if (!address || address.length <= startChars + endChars) {
    return address || '';
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Format timestamp to relative time
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2 hours ago")
 */
export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
};

/**
 * Format percentage value
 * @param value - Decimal value (e.g., 0.15 for 15%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals = 1): string => {
  if (isNaN(value)) return '0%';
  
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Format large numbers with appropriate suffixes
 * @param num - Number to format
 * @returns Formatted string with suffix
 */
export const formatNumber = (num: number): string => {
  if (isNaN(num) || num === 0) return '0';
  
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  
  return num.toLocaleString();
}; 