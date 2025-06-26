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
   * based on the correct 1:1000 USD ratio.
   * @param apyPercentage The annual percentage yield (e.g., 5 for 5% APY).
   * @returns The estimated Alpha Points per day per 1 SUI.
   */
  export function calculateAlphaPointsPerDayPerSui(apyPercentage: number): number {
    if (apyPercentage < 0) return 0;
    
    // FIXED: Use correct 1:1000 ratio (1 USD = 1000 Alpha Points)
    const SUI_PRICE_USD = 3.28; // Current SUI price
    const ALPHA_POINTS_PER_USD = 1000; // Fixed ratio
    const ALPHA_POINTS_PER_SUI = SUI_PRICE_USD * ALPHA_POINTS_PER_USD; // 3,280 AP per SUI
    const DAYS_PER_YEAR = 365;

    // Calculate daily rewards: (SUI value in AP * APY%) / days per year
    const dailyRewardsPerSui = (ALPHA_POINTS_PER_SUI * (apyPercentage / 100)) / DAYS_PER_YEAR;
    return dailyRewardsPerSui;
  }

  /**
   * ⚠️  EMERGENCY FIX: Calculates ACTUAL blockchain rewards (not theoretical APY)
   * This reflects the current blockchain state after the emergency rate fix
   * TODO: Remove when proper APY calculation is implemented in smart contract
   * 
   * @param apyPercentage The displayed APY tier (5%, 10%, 20%, 25%)
   * @returns The ACTUAL Alpha Points per day users will receive
   */
  export function calculateActualAlphaPointsPerDayPerSui(apyPercentage: number): number {
    if (apyPercentage < 0) return 0;
    
    // CURRENT BLOCKCHAIN REALITY: Rate corresponds to APY tier
    // 5% APY → rate = 1 → 1 point per epoch per SUI
    // 10% APY → rate = 2 → 2 points per epoch per SUI
    // etc.
    const rateMapping: { [key: number]: number } = {
      5: 1,   // 5% APY tier gives 1 point/epoch
      10: 2,  // 10% APY tier gives 2 points/epoch  
      15: 3,  // 15% APY tier gives 3 points/epoch
      20: 4,  // 20% APY tier gives 4 points/epoch
      25: 5   // 25% APY tier gives 5 points/epoch
    };
    
    const pointsPerEpoch = rateMapping[apyPercentage] || Math.round(apyPercentage / 5);
    const EPOCHS_PER_DAY = 1; // Assuming 1 epoch per day for now
    
    return pointsPerEpoch * EPOCHS_PER_DAY;
  }