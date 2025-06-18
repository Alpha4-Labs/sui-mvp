import { useState, useEffect, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { getSuiPrice } from '../utils/price';
import { ALL_PACKAGE_IDS } from '../config/contract';

interface TVLData {
  totalStakedSui: number;
  totalTVL: number;
  stakeCount: number;
  isLoading: boolean;
  error: string | null;
}

// Simple cache to avoid recalculating too frequently
let tvlCache: { data: TVLData; timestamp: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// Emergency rate limiter - backs off completely when 429 errors detected
class EmergencyRateLimiter {
  private static blocked = false;
  private static blockUntil = 0;
  private static consecutiveErrors = 0;

  static isBlocked(): boolean {
    if (Date.now() > this.blockUntil) {
      this.blocked = false;
      this.consecutiveErrors = 0;
      return false;
    }
    return this.blocked;
  }

  static reportError(error: any) {
    if (error?.message?.includes('429') || error?.status === 429) {
      this.consecutiveErrors++;
      const backoffMs = Math.min(60000, 5000 * Math.pow(2, this.consecutiveErrors)); // Max 1 minute
      this.blockUntil = Date.now() + backoffMs;
      this.blocked = true;
      console.warn(`Rate limit detected. Backing off for ${backoffMs}ms`);
    }
  }

  static reportSuccess() {
    this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
  }
}

export const useTVLCalculation = (autoLoad: boolean = false) => {
  const client = useSuiClient();
  
  const [tvlData, setTvlData] = useState<TVLData>({
    totalStakedSui: 0,
    totalTVL: 0,
    stakeCount: 0,
    isLoading: false, // Start as false when not auto-loading
    error: null,
  });

  // Helper function to fetch ALL events with pagination
  const fetchAllEvents = async (packageId: string, eventType: string) => {
    // Check emergency rate limiter
    if (EmergencyRateLimiter.isBlocked()) {
      console.warn('Skipping request due to rate limiting backoff');
      return [];
    }

    const allEvents: any[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 20; // Safety limit to prevent infinite loops

    while (hasMore && pageCount < maxPages) {
      try {
        // Check rate limiter before each request
        if (EmergencyRateLimiter.isBlocked()) {
          console.warn('Stopping pagination due to rate limiting');
          break;
        }

        const queryParams: any = {
          query: {
            MoveEventType: `${packageId}::${eventType}`
          },
          limit: 500, // Reasonable page size
          order: 'descending'
        };

        // Add cursor for pagination if we have one
        if (cursor) {
          queryParams.cursor = cursor;
        }

        const response = await client.queryEvents(queryParams);
        
        // Add more aggressive delay between page requests to prevent rate limiting
        if (pageCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500)); // Increased to 1.5 seconds
        }
        
        if (response?.data && response.data.length > 0) {
          allEvents.push(...response.data);
      
          // Check if there are more pages
          if (response.hasNextPage && response.nextCursor) {
            cursor = response.nextCursor;
            pageCount++;
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        
        EmergencyRateLimiter.reportSuccess();
      } catch (error) {
        console.warn(`Error fetching page ${pageCount + 1} for ${eventType}:`, error);
        EmergencyRateLimiter.reportError(error);
        hasMore = false;
      }
    }

    return allEvents;
  };

  const calculateTVL = useCallback(async () => {
    // Check cache first
    if (tvlCache && Date.now() - tvlCache.timestamp < CACHE_TTL) {
      setTvlData(tvlCache.data);
      return;
    }

    if (!client || !ALL_PACKAGE_IDS?.length) {
      setTvlData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Missing contract configuration'
      }));
      return;
    }

    try {
      setTvlData(prev => ({ ...prev, isLoading: true, error: null }));
      
      let totalStakedMist = 0;
      let totalWithdrawnMist = 0;
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      
      // Process all package versions to get comprehensive coverage
      for (const [index, packageId] of ALL_PACKAGE_IDS.entries()) {
        if (!packageId) continue;

        // Add delay between package queries to prevent rate limiting
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Fetch ALL NativeStakeStored events with pagination
        const allStakeStoredEvents = await fetchAllEvents(packageId, 'staking_manager::NativeStakeStored');
        
        let packageStakedMist = 0;
        let packageDeposits = 0;

        for (const event of allStakeStoredEvents) {
          if (event.parsedJson && typeof event.parsedJson === 'object') {
            const eventData = event.parsedJson as any;
            if (eventData.amount) {
              const amount = parseInt(eventData.amount);
              if (!isNaN(amount)) {
                packageStakedMist += amount;
                packageDeposits++;
              }
            }
          }
        }

        totalStakedMist += packageStakedMist;
        totalDeposits += packageDeposits;

        // Add small delay before withdrawal events query
        await new Promise(resolve => setTimeout(resolve, 300));

        // Fetch ALL NativeStakeWithdrawalRequested events with pagination
        const allWithdrawalEvents = await fetchAllEvents(packageId, 'staking_manager::NativeStakeWithdrawalRequested');

        let packageWithdrawnMist = 0;
        let packageWithdrawals = 0;

        for (const event of allWithdrawalEvents) {
          if (event.parsedJson && typeof event.parsedJson === 'object') {
            const eventData = event.parsedJson as any;
            if (eventData.amount) {
              const amount = parseInt(eventData.amount);
              if (!isNaN(amount)) {
                packageWithdrawnMist += amount;
                packageWithdrawals++;
              }
            }
          }
        }

        totalWithdrawnMist += packageWithdrawnMist;
        totalWithdrawals += packageWithdrawals;
      }
      
      // Calculate net TVL: Total Staked - Total Withdrawn = Current Encumbered TVL
      const netStakedMist = totalStakedMist - totalWithdrawnMist;
      const totalStakedSui = Math.max(0, netStakedMist / 1_000_000_000); // Ensure non-negative
      const stakeCount = Math.max(0, totalDeposits - totalWithdrawals); // Net active stakes

      // Get SUI price
      let suiPrice = 3.28; // Fallback price
      try {
        suiPrice = await getSuiPrice();
      } catch (priceError) {
        console.warn('Failed to fetch SUI price, using fallback:', priceError);
      }

      // Calculate total TVL
      const totalTVL = totalStakedSui * suiPrice;
      
      const finalData = {
        totalStakedSui,
        totalTVL,
        stakeCount,
        isLoading: false,
        error: null,
      };

      // Cache the results
      tvlCache = {
        data: finalData,
        timestamp: Date.now()
      };

      setTvlData(finalData);
      
    } catch (error: any) {
      console.error('Error calculating TVL:', error);
      setTvlData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to calculate TVL',
      }));
    }
  }, [client]);

  const refreshTVL = useCallback(() => {
    // Clear cache and recalculate
    tvlCache = null;
    calculateTVL();
  }, [calculateTVL]);

  // Calculate TVL on mount only if autoLoad is true
  useEffect(() => {
    if (autoLoad) {
      calculateTVL();
    }
  }, [autoLoad, calculateTVL]);

  return {
    ...tvlData,
    refreshTVL,
  };
}; 