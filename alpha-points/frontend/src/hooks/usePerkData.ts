import { useState, useEffect, useCallback } from 'react';
import { useSuiClient, useCurrentWallet } from '@mysten/dapp-kit';
import { ALL_PACKAGE_IDS } from '../config/contract';
import { requestCache } from '../utils/cache';

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

// OPTIMIZED: Reduced limits for better performance
const BATCH_SIZE = 10; // Reasonable batch size
const CACHE_DURATION = 120000; // 2 minutes cache for better performance
const MAX_PACKAGES_TO_SEARCH = 20; // INCREASED: Search more packages to find all perks
const MAX_EVENTS_PER_PACKAGE = 500; // INCREASED: More events per package to ensure we find all perks

export function usePerkData() {
  const { currentWallet } = useCurrentWallet();
  const client = useSuiClient();
  const [partnerPerks, setPartnerPerks] = useState<PerkDefinition[]>([]);
  const [userClaimedPerks, setUserClaimedPerks] = useState<ClaimedPerk[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * OPTIMIZED: Fast batch processing with strict limits
   */
  const fetchPerkObjectsBatch = async (perkIds: string[], packageId: string): Promise<PerkDefinition[]> => {
    if (perkIds.length === 0) return [];
    
    // Limit the number of perks we fetch to avoid throttling
    const limitedPerkIds = perkIds.slice(0, 20); // MAX 20 perks per batch
    
    try {
      // Use multiGetObjects for better efficiency
      const allObjects = await client.multiGetObjects({
        ids: limitedPerkIds,
        options: {
          showContent: true,
          showType: true,
        },
      });
      
      // Parse objects into PerkDefinition format
      const perks: PerkDefinition[] = [];
      for (const perkObject of allObjects) {
        if (perkObject?.data?.content && perkObject.data.content.dataType === 'moveObject') {
          try {
            const fields = (perkObject.data.content as any).fields;
            
            // Parse USDC price correctly
            const rawUsdcPrice = parseFloat(fields.usdc_price || '0');
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
              usdc_price: rawUsdcPrice,
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
            // Skip invalid perks
          }
        }
      }
      
      return perks;
    } catch (error) {
      console.error('Error fetching perk objects batch:', error);
      return [];
    }
  };

  /**
   * HEAVILY OPTIMIZED: Only search recent packages to avoid excessive RPC calls
   */
  const fetchPartnerPerks = useCallback(async (partnerCapId: string): Promise<PerkDefinition[]> => {
    if (!client || !partnerCapId) {
      console.log(`[usePerkData] No client or partnerCapId provided`);
      return [];
    }

    const cacheKey = `partner_perks_${partnerCapId}`;
    setIsLoading(true);
    setError(null);
    
    console.log(`[usePerkData] Fetching perks for partner: ${partnerCapId}`);

    try {
      const perks = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          // EXPANDED SEARCH: Search more packages to find all perks
          const recentPackages = ALL_PACKAGE_IDS.filter(Boolean).slice(0, MAX_PACKAGES_TO_SEARCH);
          console.log(`[usePerkData] Searching ${recentPackages.length} packages:`, recentPackages);
          
          let allPerks: PerkDefinition[] = [];
          
          // Search packages sequentially to avoid overwhelming the RPC
          for (const packageId of recentPackages) {
            try {
              console.log(`[usePerkData] Searching package: ${packageId}`);
              
              // Get recent perk creation events for this partner
              const perkCreatedEvents = await client.queryEvents({
                query: {
                  MoveEventType: `${packageId}::perk_manager::PerkDefinitionCreated`
                },
                order: 'descending',
                limit: MAX_EVENTS_PER_PACKAGE, // Expanded limit
              });

              console.log(`[usePerkData] Found ${perkCreatedEvents.data.length} perk creation events in ${packageId}`);

              // Filter for this partner's perks
              const partnerPerkIds: string[] = [];
              let totalEventsChecked = 0;
              for (const event of perkCreatedEvents.data) {
                totalEventsChecked++;
                if (event.parsedJson && typeof event.parsedJson === 'object') {
                  const eventData = event.parsedJson as any;
                  
                  if (eventData.creator_partner_cap_id === partnerCapId) {
                    console.log(`[usePerkData] Found matching perk for partner: ${eventData.perk_definition_id}`);
                    partnerPerkIds.push(eventData.perk_definition_id);
                  }
                }
                
                // Stop if we have enough perks
                if (partnerPerkIds.length >= 25) break; // Increased limit
              }

              console.log(`[usePerkData] Package ${packageId}: Found ${partnerPerkIds.length} perks for partner (checked ${totalEventsChecked} events)`);

              if (partnerPerkIds.length > 0) {
                const packagePerks = await fetchPerkObjectsBatch(partnerPerkIds, packageId);
                console.log(`[usePerkData] Successfully fetched ${packagePerks.length} perk objects from ${packageId}`);
                allPerks.push(...packagePerks);
              }
              
            } catch (error) {
              console.warn(`[usePerkData] Error searching package ${packageId}:`, error);
            }
          }

          console.log(`[usePerkData] Total perks found for partner ${partnerCapId}: ${allPerks.length}`);
          return allPerks;
        },
        CACHE_DURATION
      );

      setPartnerPerks(perks);
      console.log(`[usePerkData] Final result for partner ${partnerCapId}: ${perks.length} perks`);
      return perks;
    } catch (error: any) {
      console.error('[usePerkData] Error fetching partner perks:', error);
      setError(error.message || 'Failed to fetch partner perks');
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
              const claimedPerkObjects = await client.getOwnedObjects({
                owner: userAddress,
                filter: {
                  StructType: `${packageId}::perk_manager::ClaimedPerk`
                },
                options: {
                  showContent: true,
                  showType: true,
                },
              });

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
                  // COMPREHENSIVE SEARCH: Query ALL packages to find all perks from all companies
        const prioritizedPackages = ALL_PACKAGE_IDS.filter(Boolean); // Query ALL packages to ensure we find all perks
          
          console.log('🔍 Searching packages for perks:', {
            totalPackages: prioritizedPackages.length,
            packages: prioritizedPackages.slice(0, 5).map(p => p?.substring(0, 10) + '...')
          });
          
          const packagePromises = prioritizedPackages.map(async (packageId, packageIndex) => {
            try {
              
              // COMPREHENSIVE SEARCH: Increase event limit to find all perks
              const perkCreatedEvents = await client.queryEvents({
                query: {
                  MoveEventType: `${packageId}::perk_manager::PerkDefinitionCreated`
                },
                order: 'descending',
                limit: 200, // Increased to find more perks
              });


              
              // COMPREHENSIVE SEARCH: Extract more perk IDs to find all perks
              const allPerkIds: string[] = [];
              for (const event of perkCreatedEvents.data.slice(0, 150)) {
                if (event.parsedJson && typeof event.parsedJson === 'object') {
                  const eventData = event.parsedJson as any;
                  allPerkIds.push(eventData.perk_definition_id);
                }
              }
              


              // OPTIMIZATION 4: Faster batch fetch with limits
              const packagePerks = await fetchPerkObjectsBatch(allPerkIds, packageId);
              
              // OPTIMIZATION 5: Return active perks only
              const activePerks = packagePerks.filter(perk => perk.is_active);
              
              console.log(`📦 Package ${packageId.substring(0, 10)}... found ${activePerks.length} active perks (${packagePerks.length} total)`);
              
              return activePerks;
              
            } catch (err) {
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