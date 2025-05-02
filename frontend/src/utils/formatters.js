// src/utils/formatters.js

/**
 * Formats a Sui address with ellipsis in the middle
 * @param {string} address - The full Sui address
 * @param {number} startChars - Number of characters to show at start (default: 6)
 * @param {number} endChars - Number of characters to show at end (default: 4)
 * @returns {string} - Formatted address string
 */
export function formatAddress(address, startChars = 6, endChars = 4) {
    if (!address || typeof address !== 'string') {
      return '--';
    }
    
    if (address.length <= startChars + endChars) {
      return address;
    }
    
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }
  
  /**
   * Formats a balance value to a human-readable string with specified decimal precision
   * @param {string|number|bigint} balance - The balance value (could be BCS formatted or raw)
   * @param {number} decimals - Number of decimal places in the balance (default: 9 for Sui)
   * @param {object} options - Formatting options
   * @returns {string} - Formatted balance string
   */
  export function formatBalance(balance, decimals = 9, options = {}) {
    const {
      minimumFractionDigits = 0,
      maximumFractionDigits = 4,
      useGrouping = true
    } = options;
    
    if (balance === null || balance === undefined || balance === '') {
      return '--';
    }
    
    try {
      // Convert to number, handling different input types
      let numValue;
      if (typeof balance === 'bigint') {
        numValue = Number(balance) / Math.pow(10, decimals);
      } else if (typeof balance === 'string') {
        if (balance === '---' || balance === 'Error') {
          return balance;
        }
        numValue = Number(balance) / Math.pow(10, decimals);
      } else {
        numValue = balance / Math.pow(10, decimals);
      }
      
      // Handle NaN
      if (isNaN(numValue)) {
        return 'Error';
      }
      
      // Format with locale
      return numValue.toLocaleString(undefined, {
        minimumFractionDigits,
        maximumFractionDigits,
        useGrouping
      });
    } catch (error) {
      console.error('Error formatting balance:', error);
      return 'Error';
    }
  }
  
  /**
   * Formats a raw value to be sent to the blockchain with proper decimal precision
   * @param {string|number} value - The input value
   * @param {number} decimals - Number of decimal places (default: 9 for Sui)
   * @returns {bigint} - Formatted value as bigint
   */
  export function formatValueToChain(value, decimals = 9) {
    if (!value) return BigInt(0);
    
    try {
      // Parse as float
      const floatValue = parseFloat(value);
      if (isNaN(floatValue)) return BigInt(0);
      
      // Convert to integer with decimals
      const intValue = Math.floor(floatValue * Math.pow(10, decimals));
      return BigInt(intValue);
    } catch (error) {
      console.error('Error formatting value for chain:', error);
      return BigInt(0);
    }
  }
  
  /**
   * Formats a timestamp to a readable date string
   * @param {number} timestamp - Unix timestamp in seconds
   * @param {object} options - Date formatting options
   * @returns {string} - Formatted date string
   */
  export function formatTimestamp(timestamp, options = {}) {
    if (!timestamp) return 'N/A';
    
    const {
      dateStyle = 'medium',
      timeStyle = 'short'
    } = options;
    
    try {
      // Convert to milliseconds if in seconds
      const timestampMs = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
      const date = new Date(timestampMs);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return new Intl.DateTimeFormat(undefined, {
        dateStyle,
        timeStyle
      }).format(date);
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Error';
    }
  }
  
  /**
   * Formats a duration in seconds to a human-readable string
   * @param {number} seconds - Duration in seconds
   * @returns {string} - Formatted duration string
   */
  export function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    let result = '';
    
    if (days > 0) {
      result += `${days}d `;
    }
    
    if (hours > 0 || days > 0) {
      result += `${hours}h `;
    }
    
    if (minutes > 0 || hours > 0 || days > 0) {
      result += `${minutes}m `;
    }
    
    result += `${remainingSeconds}s`;
    
    return result.trim();
  }
  
  /**
   * Formats a points value with appropriate suffix for large numbers
   * @param {string|number} points - The points value
   * @returns {string} - Formatted points string
   */
  export function formatPoints(points) {
    if (points === null || points === undefined || points === '') {
      return '--';
    }
    
    if (points === '---' || points === 'Error' || points === '...') {
      return points;
    }
    
    try {
      const numPoints = parseFloat(points);
      if (isNaN(numPoints)) return 'Error';
      
      if (numPoints >= 1_000_000_000) {
        return `${(numPoints / 1_000_000_000).toFixed(2)}B`;
      } else if (numPoints >= 1_000_000) {
        return `${(numPoints / 1_000_000).toFixed(2)}M`;
      } else if (numPoints >= 1_000) {
        return `${(numPoints / 1_000).toFixed(2)}K`;
      } else {
        return numPoints.toLocaleString(undefined, {
          maximumFractionDigits: 2
        });
      }
    } catch (error) {
      console.error('Error formatting points:', error);
      return 'Error';
    }
  }
  
  /**
   * Calculates time remaining until a future timestamp
   * @param {number} futureTimestamp - Future timestamp in seconds
   * @returns {object} - Object with days, hours, minutes, seconds and formatted string
   */
  export function getTimeRemaining(futureTimestamp) {
    if (!futureTimestamp) return { days: 0, hours: 0, minutes: 0, seconds: 0, formatted: 'N/A' };
    
    const now = Math.floor(Date.now() / 1000);
    const futureTimeSec = futureTimestamp > 1000000000000 ? Math.floor(futureTimestamp / 1000) : futureTimestamp;
    
    if (now >= futureTimeSec) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, formatted: 'Expired' };
    }
    
    const totalSeconds = futureTimeSec - now;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    return {
      days,
      hours,
      minutes,
      seconds,
      formatted: formatDuration(totalSeconds)
    };
  }
  
  /**
   * Formats a percentage value
   * @param {number|string} value - Percentage value (e.g., 0.75 for 75%)
   * @param {boolean} multiply100 - Whether to multiply by 100 (if value is already * 100, set to false)
   * @returns {string} - Formatted percentage string
   */
  export function formatPercentage(value, multiply100 = true) {
    if (value === null || value === undefined || value === '') {
      return '--';
    }
    
    try {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return 'Error';
      
      const percentage = multiply100 ? numValue * 100 : numValue;
      return `${percentage.toFixed(2)}%`;
    } catch (error) {
      console.error('Error formatting percentage:', error);
      return 'Error';
    }
  }