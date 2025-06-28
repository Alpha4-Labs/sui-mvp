import { useState, useEffect, useMemo } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui/client';
import { toast } from 'react-hot-toast';
import { BRAND_CONFIG, shouldDisplayPerk } from '../config/brand';
import { SUI_CONFIG } from '../config/sui';

import type { PerkDefinition } from '../types/index';

// Cache configuration
const CACHE_KEY = 'curated_marketplace_perks';
const CACHE_EXPIRY_KEY = 'curated_marketplace_perks_expiry';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const getLocalStorageCache = (): PerkDefinition[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    
    if (cached && expiry) {
      const expiryTime = parseInt(expiry);
      if (Date.now() < expiryTime) {
        return JSON.parse(cached) as PerkDefinition[];
      } else {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
      }
    }
  } catch (err) {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
  }
  return null;
};

const setLocalStorageCache = (perks: PerkDefinition[]) => {
  try {
    const expiryTime = Date.now() + CACHE_DURATION_MS;
    localStorage.setItem(CACHE_KEY, JSON.stringify(perks));
    localStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toString());
  } catch (err) {
    console.warn('Failed to cache perks:', err);
  }
};

export const usePerkMarketplace = () => {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  
  const [perks, setPerks] = useState<PerkDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerNames, setPartnerNames] = useState<Map<string, string>>(new Map());
  const [claimedPerks, setClaimedPerks] = useState<Set<string>>(new Set());
  const [userAlphaPoints, setUserAlphaPoints] = useState(0);

  // Fetch all marketplace perks
  const fetchMarketplacePerks = async (): Promise<PerkDefinition[]> => {
    if (!suiClient) return [];
    
    try {
      // Use all known package IDs like the main frontend does
      const ALL_PACKAGE_IDS = [
        SUI_CONFIG.packageIds.perkManager, // Current package
        '0xf933e69aeeeebb9d1fc50b6324070d8f2bdc2595162b0616142a509c90e3cd16', // Known package with perks
        '0xfd761a2a5979db53f7f3176c0778695f6abafbb7c0eec8ce03136ae10dc2b47d', // Another known package
      ].filter(Boolean);
      
      console.log('🔍 Fetching perks from', ALL_PACKAGE_IDS.length, 'package IDs:', ALL_PACKAGE_IDS);
      
      const allPerkIds: string[] = [];
      
      // Query each package for perk creation events
      for (const packageId of ALL_PACKAGE_IDS) {
        try {
          console.log('📦 Checking package:', packageId);
          
          const perkCreatedEvents = await suiClient.queryEvents({
            query: {
              MoveEventType: `${packageId}::perk_manager::PerkDefinitionCreated`
            },
            order: 'descending',
            limit: 50,
          });

          console.log(`📊 Found ${perkCreatedEvents.data.length} perk creation events in package ${packageId.slice(0, 8)}...`);
          
          for (const event of perkCreatedEvents.data) {
            if (event.parsedJson && typeof event.parsedJson === 'object') {
              const eventData = event.parsedJson as any;
              allPerkIds.push(eventData.perk_definition_id);
            }
          }
        } catch (packageError) {
          console.warn(`⚠️ Failed to query package ${packageId.slice(0, 8)}...:`, packageError);
        }
      }
      
      console.log('🎯 Total extracted perk IDs:', allPerkIds.length);
      if (allPerkIds.length === 0) {
        console.warn('⚠️ No perk IDs found in any package');
        return [];
      }

      // Fetch perk details
      const fetchedPerks: PerkDefinition[] = [];
      const batchSize = 5; // Small batches for reliability
      
      for (let i = 0; i < allPerkIds.length; i += batchSize) {
        const batch = allPerkIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (id) => {
          try {
            const result = await suiClient.getObject({
              id,
              options: { showContent: true, showType: true },
            });

            if (result?.data?.content && result.data.content.dataType === 'moveObject') {
              const fields = (result.data.content as any).fields;
              const revenueSplit = fields.revenue_split_policy?.fields || fields.revenue_split_policy || {};
              
              return {
                // Core identification (both formats)
                id: result.data.objectId,
                objectId: result.data.objectId,
                
                // Basic info
                name: fields.name || 'Unknown Perk',
                description: fields.description || '',
                
                // Creator and type (both formats)
                creator_partner_cap_id: fields.creator_partner_cap_id,
                creatorPartnerCapId: fields.creator_partner_cap_id,
                perk_type: fields.perk_type || 'General',
                perkType: fields.perk_type || 'General',
                
                // Pricing (both formats)
                usdc_price: parseFloat(fields.usdc_price || '0'),
                usdcPrice: parseFloat(fields.usdc_price || '0'),
                current_alpha_points_price: parseFloat(fields.current_alpha_points_price || '0'),
                currentAlphaPointsPrice: parseFloat(fields.current_alpha_points_price || '0'),
                
                // Metadata (both formats)
                last_price_update_timestamp_ms: parseInt(fields.last_price_update_timestamp_ms || '0'),
                lastPriceUpdateTimestamp: parseInt(fields.last_price_update_timestamp_ms || '0'),
                
                // Claims and limits (both formats)
                max_claims: fields.max_claims ? parseInt(fields.max_claims) : undefined,
                maxClaims: fields.max_claims ? parseInt(fields.max_claims) : undefined,
                total_claims_count: parseInt(fields.total_claims_count || '0'),
                totalClaimsCount: parseInt(fields.total_claims_count || '0'),
                
                // Status and features (both formats)
                is_active: fields.is_active || false,
                isActive: fields.is_active || false,
                generates_unique_claim_metadata: fields.generates_unique_claim_metadata || false,
                generatesUniqueClaimMetadata: fields.generates_unique_claim_metadata || false,
                
                // Usage and expiration (both formats)
                max_uses_per_claim: fields.max_uses_per_claim ? parseInt(fields.max_uses_per_claim) : undefined,
                maxUsesPerClaim: fields.max_uses_per_claim ? parseInt(fields.max_uses_per_claim) : undefined,
                expiration_timestamp_ms: fields.expiration_timestamp_ms ? parseInt(fields.expiration_timestamp_ms) : undefined,
                expirationTimestamp: fields.expiration_timestamp_ms ? parseInt(fields.expiration_timestamp_ms) : undefined,
                
                // Tags and metadata
                tags: Array.isArray(fields.tags) ? fields.tags : (fields.tags?.length > 0 ? [fields.tags] : []),
                tag_metadata_id: fields.tag_metadata_id,
                tagMetadataId: fields.tag_metadata_id,
                definition_metadata_id: fields.definition_metadata_id,
                definitionMetadataId: fields.definition_metadata_id,
                
                // Additional fields for UI
                icon: fields.icon,
                claimCount: parseInt(fields.total_claims_count || '0'),
                packageId: SUI_CONFIG.packageIds.perkManager, // Use the main package ID for transactions
                
                // Revenue sharing
                partner_share_percentage: parseInt(revenueSplit.partner_share_percentage || '70'),
                platform_share_percentage: parseInt(revenueSplit.platform_share_percentage || '30'),
              } as PerkDefinition;
            }
          } catch (err) {
            console.warn(`Failed to fetch perk ${id}:`, err);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validPerks = batchResults.filter((perk): perk is PerkDefinition => 
          perk !== null && perk.is_active
        );
        fetchedPerks.push(...validPerks);
        
        // Small delay between batches
        if (i + batchSize < allPerkIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('✅ Successfully fetched', fetchedPerks.length, 'active perks');
      return fetchedPerks;
    } catch (error) {
      console.error('❌ Failed to fetch marketplace perks:', error);
      throw error;
    }
  };

  // Fetch partner names
  const fetchPartnerNames = async (partnerCapIds: string[]) => {
    if (!suiClient || partnerCapIds.length === 0) return;

    try {
      const newNames = new Map<string, string>();
      
      for (const partnerCapId of partnerCapIds) {
        try {
          const result = await suiClient.getObject({
            id: partnerCapId,
            options: {
              showContent: true,
              showType: true,
            },
          });

          if (result?.data?.content && result.data.content.dataType === 'moveObject') {
            const fields = (result.data.content as any).fields;
            const companyName = fields.partner_name || 'Unknown Partner';
            newNames.set(partnerCapId, companyName);
          } else {
            newNames.set(partnerCapId, 'Unknown Partner');
          }
        } catch (error) {
          newNames.set(partnerCapId, 'Unknown Partner');
        }
      }
      
      setPartnerNames(prev => new Map([...prev, ...newNames]));
    } catch (error) {
      console.error('Failed to fetch partner names:', error);
    }
  };

  // Fetch user's claimed perks
  const fetchClaimedPerks = async () => {
    if (!suiClient || !currentAccount?.address) {
      setClaimedPerks(new Set());
      return;
    }

    try {
      const packageId = SUI_CONFIG.packageIds.perkManager;
      
      // Query for ClaimedPerk objects owned by the current user
      let claimedObjects = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${packageId}::perk_manager::ClaimedPerk`
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      console.log('📊 Found', claimedObjects.data.length, 'claimed perk objects using specific filter');

      // If no results, try querying all objects and filtering (fallback mechanism like main frontend)
      if (claimedObjects.data.length === 0) {
        console.log('🔄 No results with specific filter, trying fallback method...');
        const allObjects = await suiClient.getOwnedObjects({
          owner: currentAccount.address,
          options: {
            showContent: true,
            showType: true,
          },
        });
        
        // Filter for ClaimedPerk objects
        const claimedPerkObjects = allObjects.data.filter((obj: any) => {
          const objectType = obj.data?.type;
          return objectType && objectType.includes('ClaimedPerk');
        });
        
        console.log('📊 Found', claimedPerkObjects.length, 'claimed perk objects using fallback method');
        
        claimedObjects = {
          data: claimedPerkObjects,
          hasNextPage: false,
          nextCursor: null
        };
      }
      
      const claimedPerkIds = new Set<string>();
      
      claimedObjects.data.forEach((obj: any) => {
        if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
          const fields = (obj.data.content as any).fields;
          
          // Try different possible field names
          const perkDefinitionId = fields.perk_definition_id || fields.perkDefinitionId || fields.definition_id;
          
          if (perkDefinitionId) {
            console.log('🎯 Found claimed perk ID:', perkDefinitionId);
            claimedPerkIds.add(perkDefinitionId);
          }
        }
      });
      
      console.log('✅ Loaded', claimedPerkIds.size, 'claimed perk IDs:', Array.from(claimedPerkIds));
      setClaimedPerks(claimedPerkIds);
    } catch (error) {
      console.error('❌ Failed to fetch claimed perks:', error);
      setClaimedPerks(new Set());
    }
  };

  // Helper function to decode u64 values (same as main frontend)
  const decodeU64 = (bytesInput: Array<number> | Uint8Array | unknown): number => {
    let bytes: Uint8Array;

    // Convert standard array to Uint8Array if necessary
    if (Array.isArray(bytesInput) && bytesInput.every(n => typeof n === 'number')) {
      bytes = new Uint8Array(bytesInput);
    } else if (bytesInput instanceof Uint8Array) {
      bytes = bytesInput;
    } else {
      console.error('Invalid input type for u64 decoding:', typeof bytesInput);
      return 0;
    }

    if (!bytes || bytes.length !== 8) {
      console.error(`Invalid byte length for u64: expected 8, got ${bytes?.length}`);
      return 0;
    }
    
    try {
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const valueBigInt = dataView.getBigUint64(0, true); // true for little-endian
      
      const valueNumber = Number(valueBigInt);
      
      if (valueBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        console.warn(
          `Potential precision loss converting u64 value ${valueBigInt} to JavaScript number.`
        );
      }
      
      return valueNumber;
    } catch (err) {
      console.error('Error decoding u64 value:', err);
      return 0;
    }
  };

  // Fetch user's Alpha Points balance from the blockchain
  const fetchUserAlphaPoints = async () => {
    if (!suiClient || !currentAccount?.address) {
      setUserAlphaPoints(0);
      return;
    }

    try {
      console.log('🔍 Fetching Alpha Points balance for:', currentAccount.address);
      console.log('🔧 Using package:', SUI_CONFIG.packageIds.perkManager);
      console.log('🔧 Using ledger:', SUI_CONFIG.sharedObjects.ledger);
      
      // Use the simpler integration function
      const { Transaction } = await import('@mysten/sui/transactions');
      const txb = new Transaction();

      // Try the integration module function
      txb.moveCall({
        target: `${SUI_CONFIG.packageIds.perkManager}::integration::get_user_points_balance`,
        arguments: [
          txb.object(SUI_CONFIG.sharedObjects.ledger),
          txb.pure.address(currentAccount.address),
        ],
      });

      const inspectResult = await suiClient.devInspectTransactionBlock({
        sender: currentAccount.address,
        transactionBlock: txb, 
      });
      
      const status = inspectResult?.effects?.status?.status;
      if (status !== 'success') {
        const errorMsg = inspectResult?.effects?.status?.error || 'Unknown devInspect error';
        console.error('DevInspect execution failed:', errorMsg, inspectResult);
        throw new Error(`Failed to fetch points: ${errorMsg}`);
      }

      console.log('📊 DevInspect result:', inspectResult);
      
      if (!inspectResult.results || inspectResult.results.length < 1) {
        console.error('DevInspect results missing or incomplete:', inspectResult);
        throw new Error('Could not retrieve point balance: Invalid response structure.');
      }
      
      const balanceResult = inspectResult.results[0];
      if (balanceResult?.returnValues?.[0]) {
        const [bytes, type] = balanceResult.returnValues[0];
        if (type === 'u64' && Array.isArray(bytes)) {
          const totalBalance = decodeU64(bytes);
          console.log('💰 Found total balance:', totalBalance);
          setUserAlphaPoints(totalBalance);
        } else {
          throw new Error(`Unexpected format for balance. Expected type 'u64' and Array bytes.`);
        }
      } else {
        throw new Error("Could not find balance return value.");
      }
      
    } catch (error: any) {
      console.error('❌ Failed to fetch user Alpha Points:', error);
      setUserAlphaPoints(0);
    }
  };

  // Load all data
  const loadMarketplaceData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try cache first
      const cachedPerks = getLocalStorageCache();
      if (cachedPerks && cachedPerks.length > 0) {
        console.log('📦 Using cached perks:', cachedPerks.length);
        // Apply brand filtering to cached perks
        const filteredPerks = cachedPerks.filter(perk => shouldDisplayPerk(perk, BRAND_CONFIG));
        console.log('✅ After filtering cached perks:', filteredPerks.length, 'remain');
        setPerks(filteredPerks);
        setIsLoading(false);
        
        // Load partner names in background for cached data
        const uniquePartnerCapIds = [...new Set(filteredPerks.map(perk => perk.creator_partner_cap_id))];
        fetchPartnerNames(uniquePartnerCapIds);
        return;
      }
      
      // Fetch fresh data
      const allPerks = await fetchMarketplacePerks();
      
      // Apply brand filtering
      console.log('🎯 Applying brand filtering to', allPerks.length, 'perks');
      const filteredPerks = allPerks.filter(perk => {
        const shouldShow = shouldDisplayPerk(perk, BRAND_CONFIG);
        if (!shouldShow) {
          console.log('❌ Filtered out perk:', perk.name, perk.id);
        }
        return shouldShow;
      });
      
      console.log('✅ After brand filtering:', filteredPerks.length, 'perks remain');
      setPerks(filteredPerks);
      setLocalStorageCache(allPerks); // Cache all perks, filter on display
      
      // Load partner names
      if (filteredPerks.length > 0) {
        const uniquePartnerCapIds = [...new Set(filteredPerks.map(perk => perk.creator_partner_cap_id))];
        fetchPartnerNames(uniquePartnerCapIds);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load perks';
      setError(errorMessage);
      toast.error('Failed to load marketplace perks');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data
  const refresh = async () => {
    // Clear cache
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
    
    await loadMarketplaceData();
    await fetchClaimedPerks();
    await fetchUserAlphaPoints();
    
    toast.success('Marketplace refreshed!');
  };

  // Initial load
  useEffect(() => {
    loadMarketplaceData();
  }, [suiClient]);

  // Load user-specific data when account changes
  useEffect(() => {
    fetchClaimedPerks();
    fetchUserAlphaPoints();
  }, [currentAccount?.address, suiClient]);

  // Auto-refresh balance every 30 seconds
  useEffect(() => {
    if (!currentAccount?.address) return;

    const interval = setInterval(() => {
      fetchUserAlphaPoints();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentAccount?.address, suiClient]);

  // Apply brand configuration sorting
  const sortedPerks = useMemo(() => {
    return [...perks].sort((a, b) => {
      switch (BRAND_CONFIG.perks.defaultSort) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'date':
          return b.last_price_update_timestamp_ms - a.last_price_update_timestamp_ms;
        case 'price-low':
          return a.current_alpha_points_price - b.current_alpha_points_price;
        case 'price-high':
          return b.current_alpha_points_price - a.current_alpha_points_price;
        case 'claims':
          return b.total_claims_count - a.total_claims_count;
        default:
          return 0;
      }
    });
  }, [perks]);

  return {
    perks: sortedPerks,
    isLoading,
    error,
    partnerNames,
    claimedPerks,
    userAlphaPoints,
    refresh,
    hasPerkClaimed: (perkId: string) => claimedPerks.has(perkId),
    canAffordPerk: (perk: PerkDefinition) => userAlphaPoints >= perk.current_alpha_points_price,
  };
}; 