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

    }
    
    // AGGRESSIVE RATE LIMITING: Much smaller batches to avoid 429 errors
    const RATE_LIMITED_BATCH_SIZE = 3; // Reduce from 10 to 3
    const MAX_RATE_LIMITED_CONCURRENT = 1; // Only 1 batch at a time
    const INTER_REQUEST_DELAY = 200; // 200ms between individual requests
    const INTER_BATCH_DELAY = 1000; // 1 second between batches
    
    // Split into very small batches
    const batches: string[][] = [];
    for (let i = 0; i < perkIds.length; i += RATE_LIMITED_BATCH_SIZE) {
      batches.push(perkIds.slice(i, i + RATE_LIMITED_BATCH_SIZE));
    }
    
    // Process batches sequentially with delays to avoid rate limits
    const processBatchWithRetry = async (batch: string[], batchIndex: number) => {
      const objects: any[] = [];
      
      for (let i = 0; i < batch.length; i++) {
        const id = batch[i];
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            // Add delay between requests
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, INTER_REQUEST_DELAY));
            }
            
            const result = await Promise.race([
              rateLimitedRequest(() => 
                client.getObject({
                  id,
                  options: {
                    showContent: true,
                    showType: true,
                  },
                })
              ),
              // Longer timeout for rate-limited requests
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 15000)
              )
            ]);
            
            objects.push(result);
            break; // Success, exit retry loop
            
          } catch (err: any) {
            retryCount++;
            
            if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
              // Exponential backoff for rate limits
              const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 8000);
              console.warn(`⚠️ Rate limited fetching ${id}, retrying in ${backoffDelay}ms (attempt ${retryCount}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else {
              // Non-rate-limit error, don't retry
              if (import.meta.env.DEV && err.message !== 'Timeout') {
                console.warn(`⚠️ Failed to fetch perk ${id}:`, err.message);
              }
              break;
            }
          }
        }
      }
      
      return objects.filter(obj => obj !== null);
    };

    // Process batches sequentially with delays
    const allObjects: any[] = [];
    for (let i = 0; i < batches.length; i++) {
      // Add delay between batches
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY));
      }
      
      const batchResults = await processBatchWithRetry(batches[i], i);
      allObjects.push(...batchResults);
      
      // Progress logging for large batches
      if (import.meta.env.DEV && batches.length > 5) {

      }
    }
    
    // Parse objects into PerkDefinition format
    const perks: PerkDefinition[] = [];
    for (const perkObject of allObjects) {
      if (perkObject?.data?.content && perkObject.data.content.dataType === 'moveObject') {
        try {
          const fields = (perkObject.data.content as any).fields;
          
          // 🚨 WORKAROUND: Parse USDC price correctly accounting for contract format
          // Smart contract stores centi-dollars (100 = $1.00), not micro-USDC
          // For perks created with the pricing workaround, usdc_price contains transformed values
          // We should NOT convert this - it's already transformed for contract compatibility
          const rawUsdcPrice = parseFloat(fields.usdc_price || '0');
          
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
            usdc_price: rawUsdcPrice, // Keep raw value - display logic will handle conversion
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

          // DEDUPLICATION: Remove duplicate perks by ID (can happen across packages)
          const uniquePerks = allPerks.filter((perk, index, arr) => 
            arr.findIndex(p => p.id === perk.id) === index
          );


          return uniquePerks;
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
          // OPTIMIZATION 1: Process latest 3 packages for better perk discovery, but with reduced limits
          const prioritizedPackages = ALL_PACKAGE_IDS.filter(Boolean).slice(-3); // Latest 3 packages
          
          const packagePromises = prioritizedPackages.map(async (packageId, packageIndex) => {
            // Add delay between package queries to avoid rate limits
            if (packageIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between packages
            }
            try {
              // RATE LIMIT PROTECTION: Small event limit but slightly increased for better discovery
              const perkCreatedEvents = await rateLimitedRequest(() =>
                client.queryEvents({
                  query: {
                    MoveEventType: `${packageId}::perk_manager::PerkDefinitionCreated`
                  },
                  order: 'descending',
                  limit: 25, // Slightly increased from 20 for better perk discovery
                })
              );

              // RATE LIMIT PROTECTION: Extract only first 20 perk IDs (increased from 15)
              const allPerkIds: string[] = [];
              for (const event of perkCreatedEvents.data.slice(0, 20)) {
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

          // DEDUPLICATION: Remove duplicate perks by ID (can happen across packages)
          const uniquePerks = allPerks.filter((perk, index, arr) => 
            arr.findIndex(p => p.id === perk.id) === index
          );



          return uniquePerks;
        },
        300000 // INCREASED to 5 minutes cache to reduce API calls
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