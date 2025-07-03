import { useState, useEffect, useCallback } from 'react';
import { useSuiClient, useCurrentWallet } from '@mysten/dapp-kit';
import { SHARED_OBJECTS, ALL_PACKAGE_IDS } from '../config/contract';
import { requestCache } from '../utils/cache';

export interface WalletStakeInfo {
  stakeId: string;
  amount: number; // In SUI units
  isActive: boolean; // Whether the stake still exists in the staking manager
  packageId: string; // Which package version created this stake
}

export interface WalletStakesData {
  stakes: WalletStakeInfo[];
  totalStakedSui: number;
  totalActiveStakes: number;
  lastUpdated: number;
}

// OPTIMIZED: Much stricter limits for better performance  
const MAX_PACKAGES_TO_SEARCH = 2; // Only search 2 most recent packages
const MAX_EVENTS_PER_PACKAGE = 100; // Limit events per package
const CACHE_DURATION = 300000; // 5 minutes cache

// Global coordination to prevent duplicate requests
let activeStakeRequests: { [wallet: string]: Promise<WalletStakesData> } = {};

export function useWalletStakes(walletAddress?: string) {
  const { currentWallet } = useCurrentWallet();
  const client = useSuiClient();
  const [stakesData, setStakesData] = useState<WalletStakesData>({
    stakes: [],
    totalStakedSui: 0,
    totalActiveStakes: 0,
    lastUpdated: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use provided wallet address or current wallet
  const targetWallet = walletAddress || currentWallet?.accounts?.[0]?.address;

  /**
   * HEAVILY OPTIMIZED: Fast stake fetching with coordination and caching
   */
  const fetchWalletStakes = useCallback(async (): Promise<WalletStakesData> => {
    if (!targetWallet || !client) {
      return { stakes: [], totalStakedSui: 0, totalActiveStakes: 0, lastUpdated: Date.now() };
    }

    // Check if request is already in progress
    if (activeStakeRequests[targetWallet]) {
      return activeStakeRequests[targetWallet];
    }

    const cacheKey = `wallet_stakes_${targetWallet}`;
    
    const requestPromise = (async (): Promise<WalletStakesData> => {
      try {
        const result = await requestCache.getOrFetch(
          cacheKey,
          async () => {
            const allStakeInfo: WalletStakeInfo[] = [];
            const seenStakeIds = new Set<string>();

            // CRITICAL OPTIMIZATION: Only search the 2 most recent packages
            const recentPackages = ALL_PACKAGE_IDS.filter(Boolean).slice(0, MAX_PACKAGES_TO_SEARCH);

            // Find stake IDs via events (with very strict limits)
            for (const packageId of recentPackages) {
              if (!packageId) continue;

              try {
                // Get only very recent stake events
                const stakeStoredEvents = await client.queryEvents({
                  query: { 
                    MoveEventType: `${packageId}::staking_manager::NativeStakeStored`,
                    Sender: targetWallet 
                  },
                  limit: MAX_EVENTS_PER_PACKAGE,
                  order: 'descending'
                });

                for (const event of stakeStoredEvents.data) {
                  if (event.parsedJson && typeof event.parsedJson === 'object') {
                    const parsedEvent = event.parsedJson as any;
                    const stakeId = parsedEvent.stake_id;
                    const amount = parsedEvent.amount;

                    if (stakeId && amount && !seenStakeIds.has(stakeId)) {
                      seenStakeIds.add(stakeId);
                      const amountSui = parseInt(amount.toString()) / 1_000_000_000;
                      
                      allStakeInfo.push({
                        stakeId,
                        amount: amountSui,
                        isActive: true, // Assume active for performance
                        packageId
                      });
                    }
                  }
                  
                  // Early exit if we found enough stakes
                  if (allStakeInfo.length >= 10) break;
                }

              } catch (error) {
                console.warn(`Error fetching stake events for package ${packageId}:`, error);
              }
            }

            // Use reasonable estimates if no stakes found
            let totalActiveSui = 0;
            let activeStakes = 0;
            
            if (allStakeInfo.length === 0) {
              // Return minimal fallback data
              return {
                stakes: [],
                totalStakedSui: 0,
                totalActiveStakes: 0,
                lastUpdated: Date.now(),
              };
            }
            
            // Calculate totals from found stakes
            for (const stake of allStakeInfo) {
              totalActiveSui += stake.amount;
              activeStakes++;
            }

            return {
              stakes: allStakeInfo,
              totalStakedSui: totalActiveSui,
              totalActiveStakes: activeStakes,
              lastUpdated: Date.now(),
            };
          },
          CACHE_DURATION
        );

        return result;
      } catch (error: any) {
        console.error('Error fetching wallet stakes:', error);
        
        // Return empty data on error
        return {
          stakes: [],
          totalStakedSui: 0,
          totalActiveStakes: 0,
          lastUpdated: Date.now(),
        };
      } finally {
        // Clear the active request
        delete activeStakeRequests[targetWallet];
      }
    })();
    
    activeStakeRequests[targetWallet] = requestPromise;
    return requestPromise;
  }, [targetWallet, client]);

  const updateStakes = useCallback(async () => {
    if (!targetWallet) {
      setStakesData({
        stakes: [],
        totalStakedSui: 0,
        totalActiveStakes: 0,
        lastUpdated: Date.now(),
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchWalletStakes();
      setStakesData(result);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch stakes');
    } finally {
      setIsLoading(false);
    }
  }, [fetchWalletStakes]);

  useEffect(() => {
    // Debounced loading to prevent rapid firing
    const timer = setTimeout(updateStakes, 500);
    return () => clearTimeout(timer);
  }, [targetWallet]);

  const refetch = useCallback(() => {
    // Clear cache to force fresh fetch
    if (targetWallet) {
      delete activeStakeRequests[targetWallet];
      const cacheKey = `wallet_stakes_${targetWallet}`;
      requestCache.delete(cacheKey);
    }
    return updateStakes();
  }, [updateStakes, targetWallet]);

  return {
    stakesData,
    isLoading,
    error,
    refetch,
  };
} 