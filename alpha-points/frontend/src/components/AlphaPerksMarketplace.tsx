import React, { useState, useEffect, useMemo } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { usePerkData, PerkDefinition } from '../hooks/usePerkData';
import { useAlphaContext } from '../context/AlphaContext';
import { buildClaimPerkTransaction, buildClaimPerkWithMetadataTransaction, findPartnerStatsId, findOrSuggestCreatePartnerStats, ensurePartnerStatsExists, checkPartnerQuotaStatus, calculateExpectedPartnerShare, buildClaimPerkQuotaFreeTransaction, buildClaimPerkWithMetadataQuotaFreeTransaction } from '../utils/transaction';
import { hashMetadata } from '../utils/privacy';
import { PerkFilterModal } from './PerkFilterModal';
import { MetadataCollectionModal } from './MetadataCollectionModal';
import { DiscordHandleModal } from './DiscordHandleModal';
import type { MetadataField } from '../hooks/usePartnerSettings';
import { toast } from 'react-toastify';
import { requestCache } from '../utils/cache';
// Removed SuinsClient import - no longer needed
import { SHARED_OBJECTS } from '../config/contract';

interface AlphaPerksMarketplaceProps {
  userPoints: number;
  onPerkPurchase?: (perk: PerkDefinition) => void;
}

// OPTIMIZATION: Global partner names cache to avoid refetching across component instances
const globalPartnerNamesCache = new Map<string, string>();

export const AlphaPerksMarketplace: React.FC<AlphaPerksMarketplaceProps> = ({
  userPoints,
  onPerkPurchase
}) => {
  const { suiClient, refreshData, setTransactionLoading } = useAlphaContext();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Perk data from blockchain
  const { 
    fetchAllMarketplacePerks, 
    isLoading: isLoadingPerks, 
    error: perkError,
    refreshPerkData 
  } = usePerkData();

  // Local state for marketplace perks
  const [marketplacePerks, setMarketplacePerks] = useState<PerkDefinition[]>([]);
  const [partnerNames, setPartnerNames] = useState<Map<string, string>>(new Map(globalPartnerNamesCache));
  const [isLoadingPartnerNames, setIsLoadingPartnerNames] = useState(false);
  
  // Simple loading state tracking
  const [loadingStage, setLoadingStage] = useState<'perks' | 'partners' | 'complete'>('perks');

  // Track user's claimed perks
  const [claimedPerks, setClaimedPerks] = useState<Set<string>>(new Set());
  const [isLoadingClaimedPerks, setIsLoadingClaimedPerks] = useState(false);

  // Metadata collection modal state
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [selectedPerkForMetadata, setSelectedPerkForMetadata] = useState<PerkDefinition | null>(null);
  const [perkMetadataFields, setPerkMetadataFields] = useState<MetadataField[]>([]);
  const [partnerSalt, setPartnerSalt] = useState<string>('');
  const [perkPurchaseLoading, setPerkPurchaseLoading] = useState(false);

  // Discord modal state
  const [isDiscordModalOpen, setIsDiscordModalOpen] = useState(false);
  const [selectedDiscordPerk, setSelectedDiscordPerk] = useState<PerkDefinition | null>(null);

  // Filtering and sorting state
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [activeCompanies, setActiveCompanies] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // New sorting and filtering options
  const [sortBy, setSortBy] = useState<'alphabetical' | 'date' | 'price-low' | 'price-high' | 'owned' | 'claims'>('date');
  const [filterByOwned, setFilterByOwned] = useState<'all' | 'owned' | 'not-owned'>('all');
  const [filterByCategory, setFilterByCategory] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000000]); // In Alpha Points
  const [showExpired, setShowExpired] = useState(true);

  // Fetch user's claimed perks
  const fetchClaimedPerks = async () => {
    if (!suiClient || !currentAccount?.address) {
      setClaimedPerks(new Set());
      return;
    }

    setIsLoadingClaimedPerks(true);
    
    try {
      const packageId = import.meta.env['VITE_PACKAGE_ID'];
      if (!packageId) {
        console.warn('Package ID not configured, cannot fetch claimed perks');
        return;
      }

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

      // If no results, try querying all objects and filtering
      if (claimedObjects.data.length === 0) {
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
            claimedPerkIds.add(perkDefinitionId);
          }
        }
      });
      setClaimedPerks(claimedPerkIds);
    } catch (error) {
      console.error('Failed to fetch claimed perks:', error);
      setClaimedPerks(new Set());
    } finally {
      setIsLoadingClaimedPerks(false);
    }
  };

  // OPTIMIZATION: Batch and cache partner names with better error handling
  const fetchPartnerNames = async (partnerCapIds: string[]) => {
    if (!suiClient || partnerCapIds.length === 0) return;

    // Filter out already cached partner names
    const uncachedIds = partnerCapIds.filter(id => !globalPartnerNamesCache.has(id));
    if (uncachedIds.length === 0) {
      // All names already cached, update local state
      setPartnerNames(new Map(globalPartnerNamesCache));
      setLoadingStage('complete');
      return;
    }

    setIsLoadingPartnerNames(true);
    setLoadingStage('partners');
    
    try {
      // Use cached requestCache for partner names with 10-minute cache
      const cacheKey = `partner_names_batch_${uncachedIds.sort().join('_')}`;
      
      const newPartnerNames = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          const nameMap = new Map<string, string>();
          
          // FAST OPTIMIZATION: Much smaller batches with shorter timeouts
          const BATCH_SIZE = 8; // Reduced from 15 for faster processing
          const TIMEOUT_MS = 3000; // Reduced from 8000ms to 3000ms
          const totalBatches = Math.ceil(uncachedIds.length / BATCH_SIZE);
          
          for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
            const batch = uncachedIds.slice(i, i + BATCH_SIZE);
            
            try {
              const batchPromises = batch.map(async (partnerCapId) => {
                try {
                  const result = await Promise.race([
                    suiClient.getObject({
                      id: partnerCapId,
                      options: {
                        showContent: true,
                        showType: true,
                      },
                    }),
                    new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Timeout')), 2000) // Fixed 2s timeout per request
                    )
                  ]);

                  if (result?.data?.content && result.data.content.dataType === 'moveObject') {
                    const fields = (result.data.content as any).fields;
                    const companyName = fields.partner_name || 'Unknown Partner';
                    nameMap.set(partnerCapId, companyName);
                  } else {
                    nameMap.set(partnerCapId, 'Unknown Partner');
                  }
                } catch (error) {
                  // Set fallback name for failed requests
                  nameMap.set(partnerCapId, 'Unknown Partner');
                }
              });

              await Promise.all(batchPromises);
              
              // FAST OPTIMIZATION: Minimal delay between batches
              if (i + BATCH_SIZE < uncachedIds.length) {
                await new Promise(resolve => setTimeout(resolve, 10)); // Reduced from 50ms to 10ms
              }
            } catch (batchError) {
              // If entire batch fails, set fallback names
              batch.forEach(id => nameMap.set(id, 'Unknown Partner'));
            }
          }
          
          return nameMap;
        },
        1800000 // 30-minute cache for partner names (longer cache)
      );

      // Update global cache
      newPartnerNames.forEach((name, id) => {
        globalPartnerNamesCache.set(id, name);
      });
      
      // Update local state with all cached names
      setPartnerNames(new Map(globalPartnerNamesCache));
      setLoadingStage('complete');
    } catch (error) {
      console.warn('Failed to fetch partner names:', error);
      // Set fallback names for failed requests
      uncachedIds.forEach(id => {
        globalPartnerNamesCache.set(id, 'Unknown Partner');
      });
      setPartnerNames(new Map(globalPartnerNamesCache));
      setLoadingStage('complete');
    } finally {
      setIsLoadingPartnerNames(false);
    }
  };

  // OPTIMIZATION: Progressive loading - load perks first, then partner names in parallel
  useEffect(() => {
    const loadMarketplaceData = async () => {
      try {
        setLoadingStage('perks');
        
        // Start loading perks immediately
        const perksPromise = fetchAllMarketplacePerks();
        
        // Get perks first and show immediately
        const perks = await perksPromise;
        setMarketplacePerks(perks);
        setLoadingStage('complete'); // Allow perks to display right away

        // Load partner names in background without blocking UI
        if (perks.length > 0) {
          const uniquePartnerCapIds = [...new Set(perks.map(perk => perk.creator_partner_cap_id))];
          // Use setTimeout to defer partner name loading to next tick
          setTimeout(() => {
            fetchPartnerNames(uniquePartnerCapIds);
          }, 0);
        }
      } catch (error) {
        console.error('Failed to load marketplace perks:', error);
        setLoadingStage('complete');
      }
    };

    loadMarketplaceData();
  }, [fetchAllMarketplacePerks]);

  // Fetch claimed perks when user connects or changes
  useEffect(() => {
    fetchClaimedPerks();
  }, [currentAccount?.address, suiClient]);

  // Extract all unique tags and companies from marketplace perks
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    marketplacePerks.forEach(perk => {
      perk.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [marketplacePerks]);

  const allUniqueCompanies = useMemo(() => {
    const companySet = new Set<string>();
    marketplacePerks.forEach(perk => {
      const companyName = partnerNames.get(perk.creator_partner_cap_id);
      if (companyName && companyName !== 'Loading...' && companyName !== 'Unknown Partner') {
        companySet.add(companyName);
      }
    });
    return Array.from(companySet).sort();
  }, [marketplacePerks, partnerNames]);

  const allUniqueCategories = useMemo(() => {
    const categorySet = new Set<string>();
    marketplacePerks.forEach(perk => {
      if (perk.perk_type) {
        categorySet.add(perk.perk_type);
      }
    });
    return Array.from(categorySet).sort();
  }, [marketplacePerks]);

  // Get the Alpha Points price for a perk (uses stored price from fixed contract)
  const getCorrectAlphaPointsPrice = (perk: PerkDefinition) => {
    // With fixed contract functions, stored prices are correct
    // No need to calculate - use the stored value directly
    return perk.current_alpha_points_price;
  };

  // Check if user has already claimed a perk
  const hasPerkClaimed = (perk: PerkDefinition) => {
    return claimedPerks.has(perk.id);
  };

  // Check if a perk is expired
  const isPerkExpired = (perk: PerkDefinition) => {
    if (!perk.expiration_timestamp_ms) return false;
    return Date.now() > perk.expiration_timestamp_ms;
  };

  // Sorting function
  const sortPerks = (perks: PerkDefinition[]) => {
    return [...perks].sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'date':
          return b.last_price_update_timestamp_ms - a.last_price_update_timestamp_ms; // Newest first
        case 'price-low':
          return getCorrectAlphaPointsPrice(a) - getCorrectAlphaPointsPrice(b);
        case 'price-high':
          return getCorrectAlphaPointsPrice(b) - getCorrectAlphaPointsPrice(a);
        case 'owned':
          const aOwned = hasPerkClaimed(a) ? 1 : 0;
          const bOwned = hasPerkClaimed(b) ? 1 : 0;
          return bOwned - aOwned; // Owned first
        case 'claims':
          return b.total_claims_count - a.total_claims_count; // Most claimed first
        default:
          return 0;
      }
    });
  };

  // Filter and sort perks based on all criteria
  const displayedPerks = useMemo(() => {
    let filtered = marketplacePerks;

    // First filter out paused/inactive perks
    filtered = filtered.filter(perk => perk.is_active);

    // Filter by owned status
    if (filterByOwned === 'owned') {
      filtered = filtered.filter(perk => hasPerkClaimed(perk));
    } else if (filterByOwned === 'not-owned') {
      filtered = filtered.filter(perk => !hasPerkClaimed(perk));
    }

    // Filter by tags
    if (activeTags.size > 0) {
      filtered = filtered.filter(perk => 
        perk.tags?.some(tag => activeTags.has(tag))
      );
    }

    // Filter by companies
    if (activeCompanies.size > 0) {
      filtered = filtered.filter(perk => {
        const companyName = partnerNames.get(perk.creator_partner_cap_id);
        return companyName && activeCompanies.has(companyName);
      });
    }

    // Filter by categories
    if (filterByCategory.size > 0) {
      filtered = filtered.filter(perk => 
        filterByCategory.has(perk.perk_type)
      );
    }

    // Filter by price range
    filtered = filtered.filter(perk => {
      const price = getCorrectAlphaPointsPrice(perk);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Filter expired perks
    if (!showExpired) {
      filtered = filtered.filter(perk => !isPerkExpired(perk));
    }

    // Apply sorting
    return sortPerks(filtered);
  }, [
    marketplacePerks, 
    activeTags, 
    activeCompanies, 
    partnerNames, 
    filterByOwned, 
    filterByCategory, 
    priceRange, 
    showExpired, 
    sortBy, 
    claimedPerks
  ]);

  // DEPRECATED: No longer needed since we fixed the contract functions
  // Keeping for potential legacy perk detection if needed
  const hasBuggyPricing = (perk: PerkDefinition) => {
    // With fixed contract functions, new perks will have correct pricing
    // Only very old perks might still have buggy stored values
    return false; // Disabled since we're using fixed contract functions
  };

  // Check if user can afford a perk
  const canAffordPerk = (perk: PerkDefinition) => {
    // Use the correctly calculated Alpha Points price instead of buggy stored value
    return userPoints >= getCorrectAlphaPointsPrice(perk);
  };

  // Check if a perk allows multiple claims/uses
  const allowsMultipleClaims = (perk: PerkDefinition) => {
    // If max_claims is undefined (None) or > 1, it allows multiple claims
    // If max_uses_per_claim is defined, it's a consumable perk that can be used multiple times
    return !perk.max_claims || perk.max_claims > 1 || perk.max_uses_per_claim;
  };

  // Get the USDC price for display - use the actual stored usdc_price field
  const getDisplayUsdcPrice = (perk: PerkDefinition) => {
    // Use the actual usdc_price stored in the contract instead of reverse-calculating
    // The contract stores this as raw USD amount (e.g., 5 = $5.00)
    return perk.usdc_price;
  };

  // Fetch partner metadata configuration for a perk
  const fetchPartnerMetadataConfig = async (partnerCapId: string): Promise<{ salt: string; fields: MetadataField[] }> => {
    try {
      // For now, return hardcoded values until we store these on-chain
      // In a real implementation, you'd fetch this from the partner's settings
      
      // Check if this is the Discord role perk (temporary compatibility)
      const isDiscordPerk = selectedPerkForMetadata?.name.toLowerCase().includes('alpha4 og role') || 
                           selectedPerkForMetadata?.name.toLowerCase().includes('discord');
      
      if (isDiscordPerk) {
        // Legacy Discord integration
        return {
          salt: import.meta.env['VITE_DISCORD_SALT'] || import.meta.env['VITE_METADATA_SALT'] || 'alpha4-default-salt-2024',
          fields: [
            {
              key: 'discord_id',
              type: 'discord_id',
              required: true,
              description: 'Your Discord User ID for role assignment'
            }
          ]
        };
      }
      
      // Default generic metadata collection
      return {
        salt: 'partner-default-salt-' + partnerCapId.substring(0, 8),
        fields: [
          {
            key: 'user_id',
            type: 'username',
            required: true,
            description: 'Your username or identifier'
          }
        ]
      };
    } catch (error) {
      console.error('Failed to fetch partner metadata config:', error);
      return {
        salt: 'fallback-salt-' + Date.now(),
        fields: []
      };
    }
  };

  // Open metadata collection modal for perks that require it
  const openMetadataModal = async (perk: PerkDefinition) => {
    setSelectedPerkForMetadata(perk);
    
    // Fetch partner's metadata configuration
    const config = await fetchPartnerMetadataConfig(perk.creator_partner_cap_id);
    setPerkMetadataFields(config.fields);
    setPartnerSalt(config.salt);
    
    setIsMetadataModalOpen(true);
  };

  // Handle metadata modal submission
  const handleMetadataModalSubmit = async (metadata: Record<string, string>) => {
    if (!currentAccount?.address || !selectedPerkForMetadata) {
      toast.error("Missing account or perk information.");
      return;
    }

    if (!signAndExecute) {
      toast.error("Transaction signing not available. Please refresh and try again.");
      return;
    }

    setPerkPurchaseLoading(true);
    setTransactionLoading(true);

    try {
      console.log('🔐 Processing metadata for perk purchase');

      // ENHANCED: Automatically handle PartnerPerkStatsV2 creation if needed
      if (!suiClient) {
        throw new Error("SUI client not available");
      }
      
      console.log('⚡ Ensuring PartnerPerkStatsV2 exists for partner...');
      const statsId = await ensurePartnerStatsExists(
        suiClient, 
        selectedPerkForMetadata.creator_partner_cap_id,
        signAndExecute
      );
      
      console.log('✅ PartnerPerkStatsV2 ready:', statsId);

      // Process metadata - currently only handles first metadata field
      const metadataKeys = Object.keys(metadata);
      const metadataValues = Object.values(metadata);

              if (metadataKeys.length === 0) {
          throw new Error("No metadata provided");
        }

        const metadataValue = metadataValues[0];
        if (!metadataValue || typeof metadataValue !== 'string') {
          throw new Error("Metadata value is required and must be a string");
        }

        // Build the perk claiming transaction with metadata
        const transaction = buildClaimPerkWithMetadataTransaction(
          selectedPerkForMetadata.id,
          statsId,
          metadataKeys[0],
          metadataValue as string // Type assertion after validation
        );

      const result = await signAndExecute({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        toast.success(
          `✅ Successfully purchased "${selectedPerkForMetadata.name}"!\n\n🔗 Transaction: ${result.digest.substring(0, 8)}...`,
          {
            onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, '_blank'),
            style: { whiteSpace: 'pre-line', cursor: 'pointer' }
          }
        );

        // Refresh data
        refreshData();
        refreshPerkData();
        fetchClaimedPerks(); // Refresh claimed perks after purchase

        // Call optional callback
        if (onPerkPurchase) {
          onPerkPurchase(selectedPerkForMetadata);
        }

        // Close modal
        setIsMetadataModalOpen(false);
        setSelectedPerkForMetadata(null);
      }
    } catch (error: any) {
      console.error('Failed to purchase perk with metadata:', error);
      
      // Provide more specific error messages based on error type
      if (error.message?.includes('No PartnerPerkStatsV2 found')) {
        toast.error(
          `❌ Partner setup incomplete\n\n` +
          `This partner needs to complete their V2 system setup before users can purchase perks.\n` +
          `Please contact the partner or try again later.`,
          {
            autoClose: 8000,
            style: { whiteSpace: 'pre-line' }
          }
        );
      } else if (error.message?.includes('EMaxUsesReachedOnPerk')) {
        toast.error(
          `❌ Partner quota exceeded\n\n` +
          `This partner has reached their daily quota limit. Please try again tomorrow or contact the partner.`,
          {
            autoClose: 8000,
            style: { whiteSpace: 'pre-line' }
          }
        );
      } else if (error.message?.includes('Unable to create required PartnerPerkStatsV2')) {
        toast.error(
          `❌ Partner setup required\n\n` +
          `The partner needs to create their analytics system first. Please contact them to complete their setup.`,
          {
            autoClose: 8000,
            style: { whiteSpace: 'pre-line' }
          }
        );
      } else {
        toast.error(error.message || 'Failed to purchase perk with metadata.');
      }
    } finally {
      setPerkPurchaseLoading(false);
      setTransactionLoading(false);
    }
  };

  // Handle regular perk purchase (non-role perks)
  const handleRegularPerkPurchase = async (perk: PerkDefinition) => {
    if (!currentAccount?.address) {
      toast.error("Please connect your wallet to purchase perks.");
      return;
    }
    if (!canAffordPerk(perk)) {
      toast.error("You don't have enough Alpha Points for this perk.");
      return;
    }

    setPerkPurchaseLoading(true);
    setTransactionLoading(true);

    try {
      console.log('🔍 DEBUG: Building transaction for perk purchase');
      console.log('🔍 Current Account:', currentAccount.address);
      console.log('🔍 Perk ID:', perk.id);
      console.log('🔍 Partner Cap ID:', perk.creator_partner_cap_id);
      
      // Find the correct PartnerPerkStatsV2 object ID
      if (!suiClient) {
        throw new Error("SUI client not available");
      }

      // Use the comprehensive function to find or suggest creating stats
      const statsResult = await findOrSuggestCreatePartnerStats(suiClient, perk.creator_partner_cap_id);
      
      if (statsResult.needsCreation) {
        toast.error(
          `❌ This partner hasn't set up their stats tracking yet.\n\n` +
          `The partner needs to create a PartnerPerkStatsV2 object before users can purchase their perks.\n\n` +
          `Please contact the partner or try again later.`,
          {
            autoClose: 10000,
            style: { whiteSpace: 'pre-line' }
          }
        );
        return;
      }

      if (!statsResult.statsId) {
        throw new Error("Failed to get stats ID");
      }

      console.log('🔍 Found Partner Stats ID:', statsResult.statsId);
      
      const transaction = buildClaimPerkTransaction(perk.id, statsResult.statsId);

      // Set the sender explicitly to match the connected account
      if (currentAccount?.address) {
        transaction.setSender(currentAccount.address);
      }

      const result = await signAndExecute({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        toast.success(
          `✅ Successfully purchased "${perk.name}"!\n\n🔗 Transaction: ${result.digest.substring(0, 8)}...`,
          {
            onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, '_blank'),
            style: { whiteSpace: 'pre-line', cursor: 'pointer' }
          }
        );

        // Refresh data
        refreshData();
        refreshPerkData();
        fetchClaimedPerks(); // Refresh claimed perks after purchase

        // Call optional callback
        if (onPerkPurchase) {
          onPerkPurchase(perk);
        }
      }
    } catch (error: any) {
      console.error('Failed to purchase perk:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('No PartnerPerkStatsV2 found')) {
        toast.error(
          `❌ Partner setup required\n\n` +
          `This partner needs to create their stats tracking object before users can purchase perks.\n\n` +
          `Please contact the partner or try again later.`,
          {
            autoClose: 8000,
            style: { whiteSpace: 'pre-line' }
          }
        );
      } else {
        toast.error(error.message || 'Failed to purchase perk.');
      }
    } finally {
      setPerkPurchaseLoading(false);
      setTransactionLoading(false);
    }
  };

  // Removed handleSubnameInputSubmit - no longer needed

  // Open Discord modal for Discord-tagged perks
  const openDiscordModal = (perk: PerkDefinition) => {
    setSelectedDiscordPerk(perk);
    setIsDiscordModalOpen(true);
  };

  // Handle Discord modal submission
  const handleDiscordModalSubmit = async (discordId: string) => {
    if (!currentAccount?.address || !selectedDiscordPerk) {
      toast.error("Missing account or perk information.");
      return;
    }

    if (!signAndExecute) {
      toast.error("Transaction signing not available. Please refresh and try again.");
      return;
    }

    setPerkPurchaseLoading(true);
    setTransactionLoading(true);

    try {
      console.log('🔐 Discord: Processing Discord ID for role assignment');
      console.log('⚡ Using QUOTA-FREE perk claiming (no PartnerPerkStatsV2 needed)');

      // Hash the Discord ID for privacy
      const salt = import.meta.env['VITE_METADATA_SALT'] ?? 'alpha4-default-salt-2024';
      const hashedDiscordId = hashMetadata(discordId, salt);

      // Build the QUOTA-FREE perk claiming transaction
      // This bypasses the quota validation that was causing Error 110
      const transaction = buildClaimPerkWithMetadataQuotaFreeTransaction(
        selectedDiscordPerk.id,
        'discord_id_hash',
        hashedDiscordId
      );

      console.log('🚀 Executing QUOTA-FREE perk claim transaction...');
      const result = await signAndExecute({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        toast.success(
          `✅ Successfully purchased "${selectedDiscordPerk.name}"!\n\n🔗 Transaction: ${result.digest.substring(0, 8)}...`,
          {
            onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, '_blank'),
            style: { whiteSpace: 'pre-line', cursor: 'pointer' }
          }
        );

        // Refresh data
        refreshData();
        refreshPerkData();
        fetchClaimedPerks(); // Refresh claimed perks after purchase

        // Call optional callback
        if (onPerkPurchase) {
          onPerkPurchase(selectedDiscordPerk);
        }

        // Close modal
        setIsDiscordModalOpen(false);
        setSelectedDiscordPerk(null);
      }
    } catch (error: any) {
      console.error('Failed to purchase Discord perk:', error);
      
      // Provide clear error messages for quota-free function
      if (error.message?.includes('EPerkNotActive')) {
        toast.error('❌ This perk is not currently active. Please contact the partner.');
      } else if (error.message?.includes('EMaxClaimsReached')) {
        toast.error('❌ This perk has reached its maximum claims limit.');
      } else if (error.message?.includes('Insufficient balance')) {
        toast.error('❌ You don\'t have enough Alpha Points for this perk.');
      } else {
        toast.error(`❌ Failed to purchase perk: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setPerkPurchaseLoading(false);
      setTransactionLoading(false);
    }
  };

  // Determine if a perk requires Discord input specifically
  const requiresDiscordInput = (perk: PerkDefinition) => {
    return perk.tags?.some(tag => tag.toLowerCase().includes('discord')) ||
           perk.name.toLowerCase().includes('discord');
  };

  // Determine if a perk requires other metadata collection (non-Discord)
  const requiresMetadata = (perk: PerkDefinition) => {
    return perk.generates_unique_claim_metadata || 
           perk.name.toLowerCase().includes('alpha4 og role') || 
           perk.name.toLowerCase().includes('role');
  };

  // Handle perk purchase click - route to appropriate modal
  const handlePerkClick = (perk: PerkDefinition) => {
    if (requiresDiscordInput(perk)) {
      openDiscordModal(perk);
    } else if (requiresMetadata(perk)) {
      openMetadataModal(perk);
    } else {
      handleRegularPerkPurchase(perk);
    }
  };

  // OPTIMIZATION: Fast refresh with progressive updates
  const handleRefresh = async () => {
    try {
      // Clear caches for fresh data
      refreshPerkData();
      globalPartnerNamesCache.clear();
      
      // Reset progress tracking
      setLoadingStage('perks');
      
      // Load perks first (fast)
      const perks = await fetchAllMarketplacePerks();
      setMarketplacePerks(perks);
      setLoadingStage('complete');
      
      // Also refresh claimed perks
      fetchClaimedPerks();
      
      toast.success('Marketplace refreshed!');
    } catch (error) {
      console.error('Failed to refresh marketplace:', error);
      toast.error('Failed to refresh marketplace.');
      setLoadingStage('complete');
    }
  };

  return (
    <div>
      {/* Filter Controls */}
      <div className="card-modern p-6 mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className="btn-modern-secondary flex items-center text-sm"
              aria-label="Filter perks"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              Filter & Sort
              {(activeTags.size > 0 || activeCompanies.size > 0 || filterByCategory.size > 0 || filterByOwned !== 'all') && (
                <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                  {activeTags.size + activeCompanies.size + filterByCategory.size + (filterByOwned !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Quick Sort Dropdown */}
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="date">🕒 Newest First</option>
              <option value="alphabetical">🔤 A-Z</option>
              <option value="price-low">💰 Price: Low to High</option>
              <option value="price-high">💰 Price: High to Low</option>
              <option value="owned">⭐ Owned First</option>
              <option value="claims">🔥 Most Popular</option>
            </select>

            {/* Quick Owned Filter */}
            <select 
              value={filterByOwned}
              onChange={(e) => setFilterByOwned(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">All Perks</option>
              <option value="owned">✅ Owned</option>
              <option value="not-owned">🆕 Not Owned</option>
            </select>

            {/* Inline Filter Status */}
            {(activeTags.size > 0 || activeCompanies.size > 0 || filterByCategory.size > 0 || filterByOwned !== 'all') && (
              <div className="text-sm text-gray-400 px-3 py-2 bg-gray-800 rounded-lg border border-gray-600">
                Showing {displayedPerks.length} of {marketplacePerks.length}
                {activeTags.size > 0 && (
                  <span className="ml-1 text-blue-400">• {activeTags.size} tag{activeTags.size !== 1 ? 's' : ''}</span>
                )}
                {activeCompanies.size > 0 && (
                  <span className="ml-1 text-green-400">• {activeCompanies.size} co.</span>
                )}
                {filterByCategory.size > 0 && (
                  <span className="ml-1 text-purple-400">• {filterByCategory.size} cat.</span>
                )}
                {filterByOwned !== 'all' && (
                  <span className="ml-1 text-yellow-400">• {filterByOwned === 'owned' ? 'Owned only' : 'Not owned only'}</span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={isLoadingPerks}
              className="btn-modern-secondary flex items-center text-sm"
            >
              {isLoadingPerks ? '⏳' : '🔄'} Refresh
            </button>
            
            <div className="text-right">
              <div>
                <span className="text-gray-400 mr-2">Available Balance:</span>
                <span className="text-xl font-semibold text-secondary">{userPoints.toLocaleString()} αP</span>
              </div>
              <div className="text-sm text-green-400 mt-1">
                ≈ ${(userPoints / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Marketplace Content */}
      <div className="max-h-[30rem] overflow-y-auto scrollbar-thin grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
        {isLoadingPerks ? (
          // Simple loading state with spinning hourglass
          <div className="col-span-full text-center py-8 animate-fade-in">
            <div 
              className="text-6xl mb-4 inline-block animate-spin-slow opacity-70"
              style={{ 
                animation: 'spin 3s linear infinite',
                transformOrigin: 'center center'
              }}
            >
              ⏳
            </div>
            <div className="text-gray-300 text-lg font-medium">
              Loading marketplace perks...
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Please wait while we fetch the latest perks
            </div>
          </div>
        ) : perkError ? (
          // Error state
          <div className="col-span-full text-center py-8">
            <div className="text-4xl mb-4">❌</div>
            <div className="text-red-400 mb-2">Error loading marketplace</div>
            <div className="text-sm text-gray-500 mb-4">{perkError}</div>
            <button
              onClick={handleRefresh}
              className="btn-modern-primary bg-red-600 hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : displayedPerks.length === 0 ? (
          // Empty state
          <div className="col-span-full text-center py-8">
            <div className="text-6xl mb-4">🏪</div>
            <div className="text-gray-400 mb-4">
              {(activeTags.size > 0 || activeCompanies.size > 0) ? 'No perks match your filters' : 'No perks available'}
            </div>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
              {(activeTags.size > 0 || activeCompanies.size > 0) 
                ? 'Try adjusting your filter criteria to see more perks.'
                : 'Partners haven\'t created any perks yet. Check back later!'
              }
            </p>
            {(activeTags.size > 0 || activeCompanies.size > 0) && (
              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => {
                    setActiveTags(new Set());
                    setActiveCompanies(new Set());
                  }}
                  className="btn-modern-primary"
                >
                  Clear All Filters
                </button>
                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="btn-modern-secondary"
                >
                  Adjust Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          // Marketplace perks
          displayedPerks.map((perk, index) => {
            const isPerkClaimed = hasPerkClaimed(perk);
            return (
            <div 
              key={perk.id} 
              className={`card-modern p-4 flex items-center hover:scale-[1.01] group transition-transform duration-200 m-1 ${
                isPerkClaimed ? 'bg-green-500/5 border-green-500/20' : ''
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center mr-4 text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                {perk.icon || 
                 (perk.perk_type === 'Access' ? '🔑' :
                  perk.perk_type === 'Digital Asset' ? '🖼️' :
                  perk.perk_type === 'Service' ? '🎧' :
                  perk.perk_type === 'Event' ? '🎫' :
                  perk.perk_type === 'Physical' ? '📦' : '🎁')}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium flex items-center gap-1 break-words mr-1">
                      {perk.name}
                      {isPerkClaimed && (
                        <div className="relative group">
                          <span 
                            className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse cursor-help"
                          />
                          {/* Tooltip - only shows on circle hover */}
                          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-yellow-400 text-black text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                            ✅ Already Claimed
                          </div>
                        </div>
                      )}
                    </h3>
                    <div className="text-sm text-gray-400 mt-0.5">
                      by {partnerNames.get(perk.creator_partner_cap_id) || 'Partner'}
                      {isLoadingPartnerNames && !partnerNames.get(perk.creator_partner_cap_id) && (
                        <span className="ml-1 inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start flex-shrink-0 text-right">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 mb-1">
                        {perk.tags && perk.tags.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1">
                            {perk.tags.slice(0, 2).map((tag) => (
                              <span 
                                key={tag} 
                                className="text-xs bg-gray-600/80 text-gray-200 px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              >
                                {tag}
                              </span>
                            ))}
                            {perk.tags.length > 2 && (
                              <span className="text-xs text-gray-400">+{perk.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                        
                        <button 
                          onClick={() => handlePerkClick(perk)}
                          disabled={perkPurchaseLoading || !canAffordPerk(perk) || hasBuggyPricing(perk) || (isPerkClaimed && !allowsMultipleClaims(perk))} 
                          className={`flex-shrink-0 px-4 py-2 text-sm rounded-lg transition-all duration-200 relative min-w-[140px] text-center font-medium ${
                            isPerkClaimed && !allowsMultipleClaims(perk)
                              ? 'bg-green-600/50 text-green-300 cursor-not-allowed'
                              : hasBuggyPricing(perk)
                              ? 'bg-yellow-600/50 text-yellow-300 cursor-not-allowed'
                              : !canAffordPerk(perk)
                              ? 'bg-red-600/50 text-red-300 cursor-not-allowed'
                              : 'btn-modern-primary'
                          }`}
                        >
                          {perkPurchaseLoading ? (
                            <>
                              <span className="opacity-0">{getCorrectAlphaPointsPrice(perk).toLocaleString()} αP</span>
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </span>
                            </>
                          ) : isPerkClaimed && !allowsMultipleClaims(perk) ? (
                            "✅ Already Claimed"
                          ) : hasBuggyPricing(perk) ? (
                            "⚠️ PRICING BUG"
                          ) : (
                            `${getCorrectAlphaPointsPrice(perk).toLocaleString()} αP`
                          )}
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-400 flex items-center space-x-2">
                        <span className="text-green-400">
                          Perk valued at: ${getDisplayUsdcPrice(perk).toFixed(2)} USDC
                        </span>
                        <span>•</span>
                        <span>
                          {perk.total_claims_count} claimed
                        </span>
                        {hasBuggyPricing(perk) && (
                          <>
                            <span>•</span>
                            <span className="text-yellow-400">
                              ⚠️ Pricing fix pending
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 mt-1 break-words line-clamp-2">
                  {perk.description}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <PerkFilterModal 
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          allTags={allUniqueTags}
          allCompanies={allUniqueCompanies}
          allCategories={allUniqueCategories}
          activeTags={activeTags}
          activeCompanies={activeCompanies}
          activeCategories={filterByCategory}
          setActiveTags={setActiveTags}
          setActiveCompanies={setActiveCompanies}
          setActiveCategories={setFilterByCategory}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterByOwned={filterByOwned}
          setFilterByOwned={setFilterByOwned}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
          showExpired={showExpired}
          setShowExpired={setShowExpired}
          modalTitle="Filter & Sort Marketplace Perks"
          totalPerks={marketplacePerks.length}
          displayedPerks={displayedPerks.length}
        />
      )}

      {/* Metadata Collection Modal */}
      {isMetadataModalOpen && selectedPerkForMetadata && (
        <MetadataCollectionModal
          isOpen={isMetadataModalOpen}
          onClose={() => {
            setIsMetadataModalOpen(false);
            setSelectedPerkForMetadata(null);
          }}
          onSubmit={handleMetadataModalSubmit}
          fields={perkMetadataFields}
          perkName={selectedPerkForMetadata.name}
          perkCost={`${getCorrectAlphaPointsPrice(selectedPerkForMetadata).toLocaleString()} αP`}
          isLoading={perkPurchaseLoading}
          partnerSalt={partnerSalt}
        />
      )}

      {/* Discord Handle Modal */}
      {isDiscordModalOpen && selectedDiscordPerk && (
        <DiscordHandleModal
          isOpen={isDiscordModalOpen}
          onClose={() => {
            setIsDiscordModalOpen(false);
            setSelectedDiscordPerk(null);
          }}
          onSubmit={handleDiscordModalSubmit}
          perkName={selectedDiscordPerk.name}
          perkCost={`${getCorrectAlphaPointsPrice(selectedDiscordPerk).toLocaleString()} αP`}
          isLoading={perkPurchaseLoading}
        />
      )}
    </div>
  );
}; 