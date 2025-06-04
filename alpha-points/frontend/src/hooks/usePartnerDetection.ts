import { useState, useEffect, useRef } from 'react';
import { useCurrentWallet, useSuiClient } from '@mysten/dapp-kit';
import { ALL_PACKAGE_IDS } from '../config/contract';
import { requestCache } from '../utils/cache';
import { getSuiPrice } from '../utils/price';

export interface PartnerCapInfo {
  id: string;
  type: 'flex'; // Only flex now
  partnerName: string;
  partnerAddress: string;
  isPaused: boolean;
  packageId: string;
  // Flex specific fields
  currentEffectiveUsdcValue?: number;
  totalLifetimeQuotaPoints?: number;
  totalPointsMintedLifetime?: number;
  dailyMintThrottleCapPoints?: number;
  pointsMintedToday?: number;
  availableQuotaToday?: number;
  remainingLifetimeQuota?: number;
  totalPerksCreated?: number; // Number of perks created by this partner
}

export function usePartnerDetection() {
  const { currentWallet } = useCurrentWallet();
  const client = useSuiClient();
  const [partnerCaps, setPartnerCaps] = useState<PartnerCapInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // FIXED: Use useRef for request deduplication instead of global Map
  const lastRequestTime = useRef<number>(0);
  const activeRequestRef = useRef<Promise<PartnerCapInfo[]> | null>(null);

  /**
   * Fetches all PartnerCapFlex objects owned by the current wallet
   * Returns the caps directly instead of relying on state
   * OPTIMIZED: Reduced API spam, longer cache, request deduplication
   */
  const detectPartnerCaps = async (): Promise<PartnerCapInfo[]> => {
    if (!currentWallet?.accounts?.[0]?.address || !client) {
      setPartnerCaps([]);
      setError(null);
      return [];
    }

    const walletAddress = currentWallet.accounts[0].address;
    const cacheKey = `partner_caps_flex_${walletAddress}`;

    // DEBOUNCING: Prevent rapid-fire requests
    const now = Date.now();
    if (now - lastRequestTime.current < 1000) { // 1 second debounce
      const cached = requestCache.get(cacheKey);
      if (cached) return cached;
    }
    lastRequestTime.current = now;

    // REQUEST DEDUPLICATION: If same request is already in progress, wait for it
    if (activeRequestRef.current) {
      return activeRequestRef.current;
    }

    setIsLoading(true);
    setError(null);

    const requestPromise = requestCache.getOrFetch(
      cacheKey,
      async () => {
        const allCaps: PartnerCapInfo[] = [];

        try {
          // REDUCED PAGINATION: Limit to 5 pages max (250 objects) instead of 20
          const allOwnedObjects: any[] = [];
          let cursor: string | null = null;
          let hasMore = true;
          let pageCount = 0;
          const maxPages = 5; // REDUCED from 20 to prevent spam

          while (hasMore && pageCount < maxPages) {
            const queryParams: any = {
              owner: walletAddress,
              options: {
                showContent: true,
                showType: true,
              },
              limit: 50, // Max allowed by RPC
            };

            if (cursor) {
              queryParams.cursor = cursor;
            }

            const pageResult = await client.getOwnedObjects(queryParams);
            
            if (pageResult?.data && pageResult.data.length > 0) {
              allOwnedObjects.push(...pageResult.data);
              
              if (pageResult.hasNextPage && pageResult.nextCursor) {
                cursor = pageResult.nextCursor;
                pageCount++;
              } else {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
          }

          // Filter for PartnerCapFlex objects
          const partnerCapObjects = allOwnedObjects.filter(obj => 
            obj.data?.type && obj.data.type.includes('::partner_flex::PartnerCapFlex')
          );

          // REDUCED FALLBACK: Only try first 3 packages instead of all
          if (partnerCapObjects.length === 0) {
            const limitedPackageIds = ALL_PACKAGE_IDS.filter(Boolean).slice(0, 3); // REDUCED from all packages
            const packageQueries = limitedPackageIds.map(async (packageId) => {
              try {
                const flexStructType = `${packageId}::partner_flex::PartnerCapFlex`;
                const result = await client.getOwnedObjects({
                  owner: walletAddress,
                  filter: { StructType: flexStructType },
                  options: { showContent: true, showType: true },
                  limit: 50,
                });
                return result.data.map(obj => ({ ...obj, packageId }));
              } catch {
                return [];
              }
            });

            const packageResults = await Promise.all(packageQueries);
            const flatResults = packageResults.flat();
            partnerCapObjects.push(...flatResults);
          }

          // Process all found objects in parallel
          const processingPromises = partnerCapObjects.map(async (obj) => {
            if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
              return null;
            }

            // REMOVED DEBUG SPAM: Only log in development
            if (process.env.NODE_ENV === 'development') {
              console.log('🔍 Processing partner cap object:', obj.data.objectId);
            }

            const fields = (obj.data.content as any).fields;
            const packageId = obj.data.type.split('::')[0];
            
            // Process the PartnerCapFlex data
            const rawDailyThrottle = parseInt(fields.daily_throttle_points || '0');
            const rawPointsToday = parseInt(fields.points_minted_today || '0');
            const rawLifetimeQuota = parseInt(fields.total_lifetime_quota_points || '0');
            const rawLifetimeMinted = parseInt(fields.total_points_minted_lifetime || '0');
            const rawUsdcValue = parseInt(fields.current_effective_usdc_value || '0');
            
            // Convert stored USD value (8-decimal format)
            let actualUsdValue: number;
            if (rawUsdcValue > 10000000) { // > $0.10 in 8-decimal format
              actualUsdValue = rawUsdcValue / 100000000; // 8 decimals
            } else if (rawUsdcValue > 1000000) { // > $1 in micro-USDC
              actualUsdValue = rawUsdcValue / 1000000; // 6 decimals
            } else {
              actualUsdValue = rawUsdcValue; // Already in proper USD
            }
            
            // Points values scaling
            let pointsScale = 1;
            if (actualUsdValue > 0) {
              const actualRatio = rawLifetimeQuota / actualUsdValue;
              if (actualRatio > 50000) {
                pointsScale = Math.round(actualRatio / 10000);
              }
            }
            
            const lifetimeQuota = rawLifetimeQuota / pointsScale;
            const dailyThrottle = rawDailyThrottle / pointsScale;
            const pointsToday = rawPointsToday / pointsScale;
            const lifetimeMinted = rawLifetimeMinted / pointsScale;
            
            const partnerCapInfo = {
              id: obj.data.objectId,
              type: 'flex' as const,
              packageId: packageId,
              partnerName: fields.partner_name || 'Unknown',
              partnerAddress: fields.partner_address || walletAddress,
              isPaused: fields.is_yield_opted_in || false,
              currentEffectiveUsdcValue: actualUsdValue,
              totalLifetimeQuotaPoints: lifetimeQuota,
              totalPointsMintedLifetime: lifetimeMinted,
              dailyMintThrottleCapPoints: dailyThrottle,
              pointsMintedToday: pointsToday,
              availableQuotaToday: Math.max(0, dailyThrottle - pointsToday),
              remainingLifetimeQuota: Math.max(0, lifetimeQuota - lifetimeMinted),
              totalPerksCreated: parseInt(fields.total_perks_created || '0'),
            };
            
            // REDUCED LOGGING: Only in development
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Created PartnerCapInfo:', partnerCapInfo.partnerName);
            }
            
            return partnerCapInfo;
          });

          // Wait for all processing to complete in parallel
          const processedCaps = await Promise.all(processingPromises);
          
          // Filter out nulls and add to results
          allCaps.push(...processedCaps.filter((cap): cap is PartnerCapInfo => cap !== null));

        } catch (error) {
          console.error('Error in partner cap detection:', error);
        }

        return allCaps;
      },
      30000 // INCREASED cache duration from 3s to 30s to reduce spam
    );

    // Store the active request
    activeRequestRef.current = requestPromise;

    try {
      const caps = await requestPromise;
      setPartnerCaps(caps);
      return caps;
    } catch (err: any) {
      console.error('Failed to detect partner capabilities:', err);
      setError(err.message || 'Failed to detect partner capabilities');
      return [];
    } finally {
      setIsLoading(false);
      // Clean up active request
      activeRequestRef.current = null;
    }
  };

  /**
   * LESS AGGRESSIVE force detection - reduced retries and longer delays
   * Use this after creating a new PartnerCapFlex when blockchain needs time to index
   */
  const forceDetectPartnerCaps = async (maxRetries = 3, delayMs = 5000): Promise<PartnerCapInfo[]> => {
    if (!currentWallet?.accounts?.[0]?.address || !client) {
      return [];
    }

    const walletAddress = currentWallet.accounts[0].address;
    const cacheKey = `partner_caps_flex_${walletAddress}`;

    // Clear the cache first
    requestCache.delete(cacheKey);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const caps = await detectPartnerCaps();
        
        if (caps.length > 0) {
          return caps;
        }
        
        // If no caps found and not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          // Clear cache again for next attempt
          requestCache.delete(cacheKey);
        }
      } catch (error) {
        console.error(`Detection attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retrying on error
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return [];
  };

  /**
   * Get the primary partner cap (just returns the first one)
   */
  const getPrimaryPartnerCap = (): PartnerCapInfo | null => {
    const result = partnerCaps[0] || null;
    return result;
  };

  /**
   * Check if wallet has any partner capabilities
   */
  const hasPartnerCap = (): boolean => {
    const result = partnerCaps.length > 0;
    return result;
  };

  /**
   * Get formatted display information for partner caps
   */
  const getPartnerDisplayInfo = () => {
    const primary = getPrimaryPartnerCap();
    if (!primary) return null;

    return {
      name: primary.partnerName,
      type: 'PartnerCapFlex',
      status: primary.isPaused ? 'Paused' : 'Active',
      tvl: `$${(primary.currentEffectiveUsdcValue || 0).toLocaleString()}`,
      dailyQuota: `${(primary.availableQuotaToday || 0).toLocaleString()} / ${(primary.dailyMintThrottleCapPoints || 0).toLocaleString()}`,
      lifetimeQuota: `${(primary.remainingLifetimeQuota || 0).toLocaleString()} / ${(primary.totalLifetimeQuotaPoints || 0).toLocaleString()}`,
    };
  };

  return {
    partnerCaps,
    isLoading,
    error,
    detectPartnerCaps,
    getPrimaryPartnerCap,
    hasPartnerCap,
    getPartnerDisplayInfo,
    forceDetectPartnerCaps,
  };
} 