import { useState, useEffect } from 'react';
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

  /**
   * Fetches all PartnerCapFlex objects owned by the current wallet
   * Returns the caps directly instead of relying on state
   */
  const detectPartnerCaps = async (): Promise<PartnerCapInfo[]> => {
    if (!currentWallet?.accounts?.[0]?.address || !client) {
      setPartnerCaps([]);
      setError(null);
      return [];
    }

    const walletAddress = currentWallet.accounts[0].address;
    const cacheKey = `partner_caps_flex_${walletAddress}`;

    setIsLoading(true);
    setError(null);

    try {
      const caps = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          const allCaps: PartnerCapInfo[] = [];

          // OPTIMIZED APPROACH: Single comprehensive object fetch + parallel processing
          try {
            // Get ALL owned objects with pagination (max 50 per call)
            const allOwnedObjects: any[] = [];
            let cursor: string | null = null;
            let hasMore = true;
            let pageCount = 0;
            const maxPages = 20; // Safety limit

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

            // Filter for PartnerCapFlex objects and process in parallel
            const partnerCapObjects = allOwnedObjects.filter(obj => 
              obj.data?.type && obj.data.type.includes('::partner_flex::PartnerCapFlex')
            );

            if (partnerCapObjects.length === 0) {
              // Fallback: Try parallel direct package queries for known packages
              const packageQueries = ALL_PACKAGE_IDS
                .filter(Boolean)
                .map(async (packageId) => {
                  try {
                    const flexStructType = `${packageId}::partner_flex::PartnerCapFlex`;
                    const result = await client.getOwnedObjects({
                      owner: walletAddress,
                      filter: { StructType: flexStructType },
                      options: { showContent: true, showType: true },
                      limit: 50, // Max allowed by RPC
                    });
                    return result.data.map(obj => ({ ...obj, packageId }));
                  } catch {
                    return [];
                  }
                });

              // Wait for all package queries to complete in parallel
              const packageResults = await Promise.all(packageQueries);
              const flatResults = packageResults.flat();
              
              // Add to partnerCapObjects if found
              partnerCapObjects.push(...flatResults);
            }

            // Process all found objects in parallel
            const processingPromises = partnerCapObjects.map(async (obj) => {
              if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
                return null;
              }

              // 🔍 DEBUG: Log the full object structure to see ID issues
              console.log('🔍 Processing partner cap object:', {
                objectId: obj.data.objectId,
                digest: obj.data.digest,
                version: obj.data.version,
                type: obj.data.type,
                hasContent: !!obj.data.content
              });

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
                id: obj.data.objectId, // 🔍 This should be the correct object ID
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
              
              console.log('✅ Created PartnerCapInfo:', {
                id: partnerCapInfo.id,
                name: partnerCapInfo.partnerName,
                tvl: partnerCapInfo.currentEffectiveUsdcValue
              });
              
              return partnerCapInfo;
            });

            // Wait for all processing to complete in parallel
            const processedCaps = await Promise.all(processingPromises);
            
            // Filter out nulls and add to results
            allCaps.push(...processedCaps.filter((cap): cap is PartnerCapInfo => cap !== null));

          } catch (error) {
            console.error('Error in optimized PartnerCapFlex detection:', error);
          }

          // Check for package mismatches
          if (allCaps.length > 0) {
            const foundPackages = [...new Set(allCaps.map(cap => cap.packageId))];
            const knownPackages = ALL_PACKAGE_IDS.filter(Boolean);
            const missingPackages = foundPackages.filter(pkg => !knownPackages.includes(pkg));
            
            if (missingPackages.length > 0) {
              console.warn(`Found objects from packages NOT in ALL_PACKAGE_IDS:`, missingPackages);
            }
          }
          
          return allCaps;
        },
        3000 // Cache for 3 seconds
      );
      
      setPartnerCaps(caps);
      return caps;
    } catch (err: any) {
      console.error('Failed to detect partner capabilities:', err);
      setError(err.message || 'Failed to detect partner capabilities');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Force detection that bypasses cache and retries multiple times
   * Use this after creating a new PartnerCapFlex when blockchain needs time to index
   */
  const forceDetectPartnerCaps = async (maxRetries = 5, delayMs = 2000): Promise<PartnerCapInfo[]> => {
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