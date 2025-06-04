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

export const useTVLCalculation = () => {
  const client = useSuiClient();
  
  const [tvlData, setTvlData] = useState<TVLData>({
    totalStakedSui: 0,
    totalTVL: 0,
    stakeCount: 0,
    isLoading: true,
    error: null,
  });

  // Helper function to fetch ALL events with pagination
  const fetchAllEvents = async (packageId: string, eventType: string) => {
    const allEvents: any[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 20; // Safety limit to prevent infinite loops

    while (hasMore && pageCount < maxPages) {
      try {
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
      } catch (error) {
        console.warn(`Error fetching page ${pageCount + 1} for ${eventType}:`, error);
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

  // Calculate TVL on mount
  useEffect(() => {
    calculateTVL();
  }, []);

  return {
    ...tvlData,
    refreshTVL,
  };
}; 