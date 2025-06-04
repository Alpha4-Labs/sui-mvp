import { useState, useEffect, useCallback } from 'react';
import { useSuiClient, useCurrentWallet } from '@mysten/dapp-kit';
import { ALL_PACKAGE_IDS } from '../config/contract';
import { requestCache } from '../utils/cache';
import { rateLimitedRequest } from '../utils/globalRateLimiter';
import { microUSDCToUSD } from '../utils/conversionUtils';

export interface PerkDefinition {
  id: string;
  name: string;
  description: string;
  creator_partner_cap_id: string;
  perk_type: string;
  usdc_price: number; // Normalized to USD for display
  current_alpha_points_price: number; // Raw Alpha Points value
  last_price_update_timestamp_ms: number;
  partner_share_percentage: number;
  platform_share_percentage: number;
  max_claims?: number;
  total_claims_count: number;
  is_active: boolean;
  generates_unique_claim_metadata: boolean;
  max_uses_per_claim?: number;
  expiration_timestamp_ms?: number;
  tags: string[];
  icon?: string; // User-chosen icon emoji
  packageId: string;
}

export interface ClaimedPerk {
  id: string;
  perk_definition_id: string;
  owner: string;
  claim_timestamp_ms: number;
  status: string;
  remaining_uses?: number;
  packageId: string;
}

// Optimized batch processing
const BATCH_SIZE = 5; // REDUCED from 10 to 5 for faster response
const CACHE_DURATION = 60000; // INCREASED to 60 seconds for better caching
const MAX_CONCURRENT_BATCHES = 3; // Limit concurrent processing

export function usePerkData() {
  const { currentWallet } = useCurrentWallet();
  const client = useSuiClient();
  const [partnerPerks, setPartnerPerks] = useState<PerkDefinition[]>([]);
  const [userClaimedPerks, setUserClaimedPerks] = useState<ClaimedPerk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * HEAVILY OPTIMIZED: Much faster batch processing with limits and timeouts
   */
  const fetchPerkObjectsBatch = async (perkIds: string[], packageId: string): Promise<PerkDefinition[]> => {
    if (perkIds.length === 0) return [];
    
    // Only log in development and for significant batches
    if (import.meta.env.DEV && perkIds.length > 20) {
      console.log(`🔄 Processing ${perkIds.length} perk objects in batches...`);
    }
    
    // SMART BATCHING: Split into manageable batches
    const batches: string[][] = [];
    for (let i = 0; i < perkIds.length; i += BATCH_SIZE) {
      batches.push(perkIds.slice(i, i + BATCH_SIZE));
    }
    
    // CONTROLLED CONCURRENCY: Process batches with limited concurrency
    const processBatch = async (batch: string[]) => {
      const objectPromises = batch.map(id => 
        Promise.race([
          rateLimitedRequest(() => 
            client.getObject({
              id,
              options: {
                showContent: true,
                showType: true,
              },
            })
          ),
          // TIMEOUT PROTECTION: 10-second timeout per object
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]).catch(err => {
          if (err.message !== 'Timeout' && import.meta.env.DEV) {
            console.warn(`⚠️ Failed to fetch perk ${id}:`, err.message);
          }
          return null; // Return null for failed/timeout fetches
        })
      );
      
      const objects = await Promise.all(objectPromises);
      return objects.filter(obj => obj !== null); // Filter out failed fetches
    };

    // CONCURRENT BATCH PROCESSING: Process multiple batches at once
    const allObjects: any[] = [];
    for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
      const currentBatchGroup = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
      const batchPromises = currentBatchGroup.map(processBatch);
      const batchResults = await Promise.all(batchPromises);
      allObjects.push(...batchResults.flat());
    }
    
    // Parse objects into PerkDefinition format
    const perks: PerkDefinition[] = [];
    for (const perkObject of allObjects) {
      if (perkObject?.data?.content && perkObject.data.content.dataType === 'moveObject') {
        try {
          const fields = (perkObject.data.content as any).fields;
          
          // WORKAROUND: Normalize USDC price for display
          // Smart contract stores micro-USDC (1,000,000 = $1), we display as USD
          const rawUsdcPrice = parseFloat(fields.usdc_price || '0');
          const normalizedUsdcPrice = rawUsdcPrice > 1_000_000 
            ? microUSDCToUSD(rawUsdcPrice) // Convert from micro-USDC to USD
            : rawUsdcPrice; // Legacy data already in USD
          
          // Get Alpha Points price - keep as raw value
          const alphaPrice = parseFloat(fields.current_alpha_points_price || '0');

          // Parse revenue split policy
          const revenueSplit = fields.revenue_split_policy?.fields || fields.revenue_split_policy || {};
          const partnerSharePercentage = parseInt(revenueSplit.partner_share_percentage || '70');
          const platformSharePercentage = parseInt(revenueSplit.platform_share_percentage || '30');

          perks.push({
            id: perkObject.data.objectId,
            name: fields.name || 'Unknown Perk',
            description: fields.description || '',
            creator_partner_cap_id: fields.creator_partner_cap_id,
            perk_type: fields.perk_type || 'General',
            usdc_price: normalizedUsdcPrice, // Now properly normalized for display
            current_alpha_points_price: alphaPrice,
            last_price_update_timestamp_ms: parseInt(fields.last_price_update_timestamp_ms || '0'),
            partner_share_percentage: partnerSharePercentage,
            platform_share_percentage: platformSharePercentage,
            max_claims: fields.max_claims ? parseInt(fields.max_claims) : undefined,
            total_claims_count: parseInt(fields.total_claims_count || '0'),
            is_active: fields.is_active || false,
            generates_unique_claim_metadata: fields.generates_unique_claim_metadata || false,
            max_uses_per_claim: fields.max_uses_per_claim ? parseInt(fields.max_uses_per_claim) : undefined,
            expiration_timestamp_ms: fields.expiration_timestamp_ms ? parseInt(fields.expiration_timestamp_ms) : undefined,
            tags: Array.isArray(fields.tags) ? fields.tags : (fields.tags?.length > 0 ? [fields.tags] : []),
            icon: fields.icon,
            packageId,
          });
        } catch (parseErr) {
          if (import.meta.env.DEV) {
            console.warn(`⚠️ Failed to parse perk object ${perkObject.data.objectId}:`, parseErr);
          }
        }
      }
    }
    
    return perks;
  };

  /**
   * SMART CATALOG SEARCH: Single-phase parallel search using ecommerce best practices
   */
  const fetchPartnerPerks = useCallback(async (partnerCapId: string): Promise<PerkDefinition[]> => {
    if (!client || !partnerCapId) {
      return [];
    }

    const cacheKey = `partner_perks_${partnerCapId}`;
    setIsLoading(true);
    setError(null);

    try {
      const perks = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          // SMART PRIORITIZATION: Latest packages likely have most recent perks
          const prioritizedPackages = ALL_PACKAGE_IDS.filter(Boolean).reverse();
          
          // PARALLEL SEARCH: Search all packages simultaneously for speed
          const packageSearchPromises = prioritizedPackages.map(async (packageId, index) => {
            try {
              // ADAPTIVE LIMITS: More recent packages get higher limits first
              const initialLimit = index === 0 ? 200 : index === 1 ? 150 : 100;
              let allPackagePerkIds: string[] = [];
              let cursor: string | null = null;
              let hasMoreEvents = true;
              
              // EFFICIENT PAGINATION: Get events in chunks until we find all perks
              while (hasMoreEvents) {
                const queryParams: any = {
                  query: {
                    MoveEventType: `${packageId}::perk_manager::PerkDefinitionCreated`
                  },
                  order: 'descending',
                  limit: initialLimit,
                };
                
                if (cursor) {
                  queryParams.cursor = cursor;
                }

                const perkCreatedEvents = await rateLimitedRequest(() =>
                  client.queryEvents(queryParams)
                );

                // SCAN FOR PARTNER PERKS
                let foundInThisBatch = 0;
                for (const event of perkCreatedEvents.data) {
                  if (event.parsedJson && typeof event.parsedJson === 'object') {
                    const eventData = event.parsedJson as any;
                    
                    if (eventData.creator_partner_cap_id === partnerCapId) {
                      allPackagePerkIds.push(eventData.perk_definition_id);
                      foundInThisBatch++;
                    }
                  }
                }

                // SMART CONTINUATION: Continue if we found perks and there are more pages
                if (perkCreatedEvents.hasNextPage && (foundInThisBatch > 0 || allPackagePerkIds.length === 0)) {
                  cursor = perkCreatedEvents.nextCursor;
                } else {
                  hasMoreEvents = false;
                }

                // PERFORMANCE LIMIT: Don't scan indefinitely
                if (allPackagePerkIds.length > 100) { // Reasonable cap per package
                  break;
                }
              }

              // BATCH FETCH: Get all perk objects for this package
              if (allPackagePerkIds.length > 0) {
                if (import.meta.env.DEV) {
                  console.log(`�� Found ${allPackagePerkIds.length} perks in package ${packageId.slice(-8)}`);
                }
                const packagePerks = await fetchPerkObjectsBatch(allPackagePerkIds, packageId);
                return packagePerks;
              }

              return [];
              
            } catch (err) {
              console.warn(`⚠️ Package ${packageId.slice(-8)} search failed:`, err);
              return []; // Don't fail entire search due to one package
            }
          });

          // CONCURRENT EXECUTION: Wait for all package searches to complete
          const allPackageResults = await Promise.all(packageSearchPromises);
          const allPerks = allPackageResults.flat();

          if (import.meta.env.DEV && allPerks.length > 0) {
            console.log(`✅ Found ${allPerks.length} total perks for partner`);
          }
          return allPerks;
        },
        CACHE_DURATION
      );
      
      setPartnerPerks(perks);
      return perks;
    } catch (err: any) {
      console.error('❌ Partner perk search failed:', err);
      setError(err.message || 'Failed to search for partner perks');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * OPTIMIZED: Fetches all perks claimed by the current user
   */
  const fetchUserClaimedPerks = useCallback(async (): Promise<ClaimedPerk[]> => {
    if (!client || !currentWallet?.accounts?.[0]?.address) {
      return [];
    }

    const userAddress = currentWallet.accounts[0].address;
    const cacheKey = `user_claimed_perks_${userAddress}`;
    setIsLoading(true);
    setError(null);

    try {
      const claimedPerks = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          // OPTIMIZATION: Process packages in parallel
          const packagePromises = ALL_PACKAGE_IDS.filter(Boolean).map(async (packageId) => {
            try {
              const claimedPerkObjects = await rateLimitedRequest(() =>
                client.getOwnedObjects({
                  owner: userAddress,
                  filter: {
                    StructType: `${packageId}::perk_manager::ClaimedPerk`
                  },
                  options: {
                    showContent: true,
                    showType: true,
                  },
                })
              );

              const packagePerks: ClaimedPerk[] = [];
              for (const obj of claimedPerkObjects.data) {
                if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
                  const fields = (obj.data.content as any).fields;
                  
                  packagePerks.push({
                    id: obj.data.objectId,
                    perk_definition_id: fields.perk_definition_id,
                    owner: fields.owner,
                    claim_timestamp_ms: parseInt(fields.claim_timestamp_ms || '0'),
                    status: fields.status || 'ACTIVE',
                    remaining_uses: fields.remaining_uses ? parseInt(fields.remaining_uses) : undefined,
                    packageId,
                  });
                }
              }
              
              return packagePerks;
            } catch (err) {
              console.error(`❌ Error fetching claimed perks from package ${packageId}:`, err);
              return []; // Return empty array on error
            }
          });

          const allPackageResults = await Promise.all(packagePromises);
          const allClaimedPerks = allPackageResults.flat();

          return allClaimedPerks;
        },
        CACHE_DURATION // Increased cache duration
      );
      
      setUserClaimedPerks(claimedPerks);
      return claimedPerks;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user claimed perks');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [client, currentWallet]);

  /**
   * HEAVILY OPTIMIZED: Much faster marketplace loading for better UX
   */
  const fetchAllMarketplacePerks = useCallback(async (): Promise<PerkDefinition[]> => {
    if (!client) {
      return [];
    }

    const cacheKey = 'marketplace_perks_all';
    setIsLoading(true);
    setError(null);

    try {
      const perks = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          // OPTIMIZATION 1: Only process first 2 packages for speed
          const prioritizedPackages = ALL_PACKAGE_IDS.filter(Boolean).slice(-2); // Latest 2 packages
          
          const packagePromises = prioritizedPackages.map(async (packageId) => {
            try {
              // OPTIMIZATION 2: DRASTICALLY reduced event limit for speed
              const perkCreatedEvents = await rateLimitedRequest(() =>
                client.queryEvents({
                  query: {
                    MoveEventType: `${packageId}::perk_manager::PerkDefinitionCreated`
                  },
                  order: 'descending',
                  limit: 50, // DRASTICALLY reduced from 200 to 50
                })
              );

              // OPTIMIZATION 3: Extract only first 30 perk IDs for speed
              const allPerkIds: string[] = [];
              for (const event of perkCreatedEvents.data.slice(0, 30)) {
                if (event.parsedJson && typeof event.parsedJson === 'object') {
                  const eventData = event.parsedJson as any;
                  allPerkIds.push(eventData.perk_definition_id);
                }
              }

              // OPTIMIZATION 4: Faster batch fetch with limits
              const packagePerks = await fetchPerkObjectsBatch(allPerkIds, packageId);
              
              // OPTIMIZATION 5: Return active perks only
              return packagePerks.filter(perk => perk.is_active);
              
            } catch (err) {
              console.warn(`⚠️ Error querying marketplace package ${packageId}:`, err);
              return [];
            }
          });

          const allPackageResults = await Promise.all(packagePromises);
          const allPerks = allPackageResults.flat();

          return allPerks;
        },
        120000 // INCREASED to 2 minutes cache for marketplace
      );
      
      return perks;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch marketplace perks');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Refreshes all perk data (clears cache)
   */
  const refreshPerkData = useCallback(() => {
    requestCache.clear();
    setPartnerPerks([]);
    setUserClaimedPerks([]);
    setError(null);
  }, []);

  /**
   * OPTIMIZATION: Preload perk data in the background
   */
  const preloadPartnerPerks = useCallback(async (partnerCapId: string): Promise<void> => {
    if (!client || !partnerCapId) return;
    
    // Start fetching in background without showing loading state
    try {
      await fetchPartnerPerks(partnerCapId);
    } catch (err) {
      // Don't set error state for preload failures
    }
  }, [client, fetchPartnerPerks]);

  /**
   * Performance monitoring helper
   */
  const getPerformanceMetrics = useCallback(() => {
    const cacheStats = requestCache.getStats();
    return {
      cacheHitRate: cacheStats.hits / Math.max(cacheStats.requests, 1),
      cacheSize: cacheStats.size,
      lastFetchTime: cacheStats.lastFetchTime,
      partnerPerksCount: partnerPerks.length,
      userClaimedPerksCount: userClaimedPerks.length,
    };
  }, [partnerPerks.length, userClaimedPerks.length]);

  /**
   * Gets a specific perk by ID
   */
  const getPerkById = useCallback((perkId: string): PerkDefinition | undefined => {
    return partnerPerks.find(perk => perk.id === perkId);
  }, [partnerPerks]);

  /**
   * Get aggregated metrics for a specific partner
   */
  const getPartnerPerkMetrics = useCallback((partnerCapId: string) => {
    const partnerSpecificPerks = partnerPerks.filter(perk => 
      perk.creator_partner_cap_id === partnerCapId
    );

    return {
      totalPerks: partnerSpecificPerks.length,
      activePerks: partnerSpecificPerks.filter(perk => perk.is_active).length,
      pausedPerks: partnerSpecificPerks.filter(perk => !perk.is_active).length,
      totalClaims: partnerSpecificPerks.reduce((sum, perk) => sum + perk.total_claims_count, 0),
      totalRevenue: partnerSpecificPerks.reduce((sum, perk) => 
        sum + (perk.total_claims_count * perk.current_alpha_points_price * perk.partner_share_percentage / 100), 0
      ),
      averageClaimsPerPerk: partnerSpecificPerks.length > 0 
        ? partnerSpecificPerks.reduce((sum, perk) => sum + perk.total_claims_count, 0) / partnerSpecificPerks.length 
        : 0,
      averagePrice: partnerSpecificPerks.length > 0 
        ? partnerSpecificPerks.reduce((sum, perk) => sum + perk.usdc_price, 0) / partnerSpecificPerks.length 
        : 0,
    };
  }, [partnerPerks]);

  return {
    // Data
    partnerPerks,
    userClaimedPerks,
    isLoading,
    error,
    
    // Functions
    fetchPartnerPerks,
    fetchUserClaimedPerks,
    fetchAllMarketplacePerks,
    refreshPerkData,
    preloadPartnerPerks,
    getPartnerPerkMetrics,
    getPerformanceMetrics,
  };
} 