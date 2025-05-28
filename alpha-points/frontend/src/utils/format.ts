/**
 * Formatting utility functions
 */

// Format SUI balance with proper decimals (9)
export const formatSui = (amount: string | number, decimals = 2): string => {
    if (typeof amount === 'string') {
      amount = parseInt(amount);
    }
    return (amount / 1_000_000_000).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };
  
  // Format Alpha Points
  export const formatPoints = (points: number | string, decimals = 1): string => {
    if (typeof points === 'string') {
      points = parseFloat(points);
    }
    return points.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };
  
  // Format address with ellipsis
  export const formatAddress = (address: string, start = 6, end = 4): string => {
    if (!address) return '';
    if (address.length < start + end) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  };
  
  // Format time ago (e.g., "5 minutes ago")
  export const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };
  
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
      }
    }
    
    return 'just now';
  };
  
  // Format percentage
  export const formatPercentage = (value: number, decimals = 2): string => {
    return `${value.toFixed(decimals)}%`;
  };

  export const formatTimestamp = (date: Date | number | string | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
    if (!date) return 'N/A';
    try {
      const dateObj = typeof date === 'object' ? date : new Date(date);
      // Check if date conversion resulted in a valid date
      if (isNaN(dateObj.getTime())) {
         console.warn("Invalid date provided to formatTimestamp:", date);
         return 'Invalid Date';
      }
  
      const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        // Optional: Add time if needed
        // hour: '2-digit',
        // minute: '2-digit',
        // timeZoneName: 'short' // Consider adding timezone
      };
      // Use 'en-CA' for Canadian date format preference, or keep 'en-US' / undefined for default
      return new Intl.DateTimeFormat('en-CA', { ...defaultOptions, ...options }).format(dateObj);
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return 'Error'; // Or handle error appropriately
    }
  };
  
  // Duration for display (e.g., "30 days")
  export const formatDuration = (days: number): string => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      if (remainingDays === 0) {
        return `${years} year${years > 1 ? 's' : ''}`;
      }
      return `${years} year${years > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    
    if (days >= 30) {
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      if (remainingDays === 0) {
        return `${months} month${months > 1 ? 's' : ''}`;
      }
      return `${months} month${months > 1 ? 's' : ''} ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
    }
    
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  /**
   * Calculates the estimated Alpha Points earned per day for each SUI staked,
   * based on the on-chain APY to Points formula.
   * @param apyPercentage The annual percentage yield (e.g., 5 for 5% APY).
   * @returns The estimated Alpha Points per day per 1 SUI.
   */
  export function calculateAlphaPointsPerDayPerSui(apyPercentage: number): number {
    if (apyPercentage < 0) return 0;
    const APY_BPS_FACTOR = 100; // To convert percentage to basis points
    const APY_POINT_SCALING_FACTOR = 25; // From Move code
    const EPOCHS_PER_YEAR = 365; // From Move code (assuming 1 epoch = 1 day for this rate)

    const apyBps = apyPercentage * APY_BPS_FACTOR;
    const points = (apyBps * APY_POINT_SCALING_FACTOR) / EPOCHS_PER_YEAR;
    return points;
  }