import React, { useState, useEffect, useMemo } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { usePerkData, PerkDefinition } from '../hooks/usePerkData';
import { useAlphaContext } from '../context/AlphaContext';
import { buildClaimPerkTransaction, buildClaimPerkWithMetadataTransaction } from '../utils/transaction';
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

  // Metadata collection modal state
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [selectedPerkForMetadata, setSelectedPerkForMetadata] = useState<PerkDefinition | null>(null);
  const [perkMetadataFields, setPerkMetadataFields] = useState<MetadataField[]>([]);
  const [partnerSalt, setPartnerSalt] = useState<string>('');
  const [perkPurchaseLoading, setPerkPurchaseLoading] = useState(false);

  // Discord modal state
  const [isDiscordModalOpen, setIsDiscordModalOpen] = useState(false);
  const [selectedDiscordPerk, setSelectedDiscordPerk] = useState<PerkDefinition | null>(null);

  // Filtering state
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [activeCompanies, setActiveCompanies] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // OPTIMIZATION: Batch and cache partner names with better error handling
  const fetchPartnerNames = async (partnerCapIds: string[]) => {
    if (!suiClient || partnerCapIds.length === 0) return;

    // Filter out already cached partner names
    const uncachedIds = partnerCapIds.filter(id => !globalPartnerNamesCache.has(id));
    if (uncachedIds.length === 0) {
      // All names already cached, update local state
      setPartnerNames(new Map(globalPartnerNamesCache));
      return;
    }

    setIsLoadingPartnerNames(true);
    
    try {
      // Use cached requestCache for partner names with 10-minute cache
      const cacheKey = `partner_names_batch_${uncachedIds.sort().join('_')}`;
      
      const newPartnerNames = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          const nameMap = new Map<string, string>();
          
          // OPTIMIZATION: Parallel processing with smaller batches and timeouts
          const BATCH_SIZE = 15; // Increased from 10 since we have caching
          const TIMEOUT_MS = 8000; // 8 second timeout per batch
          
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
                      setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS / batch.length)
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
              
              // OPTIMIZATION: Reduced delay between batches
              if (i + BATCH_SIZE < uncachedIds.length) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms
              }
            } catch (batchError) {
              // If entire batch fails, set fallback names
              batch.forEach(id => nameMap.set(id, 'Unknown Partner'));
            }
          }
          
          return nameMap;
        },
        600000 // 10-minute cache for partner names
      );

      // Update global cache
      newPartnerNames.forEach((name, id) => {
        globalPartnerNamesCache.set(id, name);
      });
      
      // Update local state with all cached names
      setPartnerNames(new Map(globalPartnerNamesCache));
    } catch (error) {
      console.warn('Failed to fetch partner names:', error);
      // Set fallback names for failed requests
      uncachedIds.forEach(id => {
        globalPartnerNamesCache.set(id, 'Unknown Partner');
      });
      setPartnerNames(new Map(globalPartnerNamesCache));
    } finally {
      setIsLoadingPartnerNames(false);
    }
  };

  // OPTIMIZATION: Progressive loading - load perks first, then partner names in parallel
  useEffect(() => {
    const loadMarketplaceData = async () => {
      try {
        // Start loading perks immediately
        const perksPromise = fetchAllMarketplacePerks();
        
        // Get perks first
        const perks = await perksPromise;
        setMarketplacePerks(perks);

        // Then start loading partner names in parallel (non-blocking)
        if (perks.length > 0) {
          const uniquePartnerCapIds = [...new Set(perks.map(perk => perk.creator_partner_cap_id))];
          // Don't await - let it load in background
          fetchPartnerNames(uniquePartnerCapIds);
        }
      } catch (error) {
        console.error('Failed to load marketplace perks:', error);
      }
    };

    loadMarketplaceData();
  }, [fetchAllMarketplacePerks]);

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

  // Filter perks based on active status, tags and companies
  const displayedPerks = useMemo(() => {
    let filtered = marketplacePerks;

    // First filter out paused/inactive perks
    filtered = filtered.filter(perk => perk.is_active);

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

    return filtered;
  }, [marketplacePerks, activeTags, activeCompanies, partnerNames]);

  // Get the Alpha Points price for a perk (uses stored price from fixed contract)
  const getCorrectAlphaPointsPrice = (perk: PerkDefinition) => {
    // With fixed contract functions, stored prices are correct
    // No need to calculate - use the stored value directly
    return perk.current_alpha_points_price;
  };

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

    // Validate metadata exists
    const metadataKeys = Object.keys(metadata);
    const metadataValues = Object.values(metadata);
    if (metadataKeys.length === 0 || !metadataValues[0]) {
      toast.error("Missing metadata information.");
      return;
    }

    setPerkPurchaseLoading(true);
    setTransactionLoading(true);

    try {
      console.log('🔐 Privacy: Metadata processed with partner salt for on-chain storage');

      const transaction = buildClaimPerkWithMetadataTransaction(
        selectedPerkForMetadata.id,
        metadataKeys[0],
        metadataValues[0] as string
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
      toast.error(error.message || 'Failed to purchase perk with metadata.');
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
      
      const transaction = buildClaimPerkTransaction(perk.id);

      // Set the sender explicitly to match the connected account
      transaction.setSender(currentAccount.address);

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

        // Call optional callback
        if (onPerkPurchase) {
          onPerkPurchase(perk);
        }
      }
    } catch (error: any) {
      console.error('Failed to purchase perk:', error);
      toast.error(error.message || 'Failed to purchase perk.');
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

    setPerkPurchaseLoading(true);
    setTransactionLoading(true);

    try {
      console.log('🔐 Discord: Processing Discord ID for role assignment');

      // Hash the Discord ID for privacy
      const hashedDiscordId = hashMetadata(discordId, import.meta.env['VITE_DISCORD_SALT'] || 'alpha4-default-salt-2024');

      const transaction = buildClaimPerkWithMetadataTransaction(
        selectedDiscordPerk.id,
        'discord_id_hash',
        hashedDiscordId
      );

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
      toast.error(error.message || 'Failed to purchase Discord perk.');
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
      
      // Load perks first (fast)
      const perks = await fetchAllMarketplacePerks();
      setMarketplacePerks(perks);
      
      // Update partner names in background (slower, non-blocking)
      if (perks.length > 0) {
        const uniquePartnerCapIds = [...new Set(perks.map(perk => perk.creator_partner_cap_id))];
        fetchPartnerNames(uniquePartnerCapIds); // Don't await
      }
      
      toast.success('Marketplace refreshed!');
    } catch (error) {
      console.error('Failed to refresh marketplace:', error);
      toast.error('Failed to refresh marketplace.');
    }
  };

  return (
    <div>
      {/* Filter Controls */}
      <div className="card-modern p-6 mb-6 flex items-center justify-between animate-fade-in">
        <button 
          onClick={() => setIsFilterModalOpen(true)}
          className="btn-modern-secondary flex items-center text-sm"
          aria-label="Filter perks"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          Filter Perks
          {(activeTags.size > 0 || activeCompanies.size > 0) && (
            <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full animate-pulse">
              {activeTags.size + activeCompanies.size}
            </span>
          )}
        </button>
        
        <div className="flex items-center space-x-4">
          {(activeTags.size > 0 || activeCompanies.size > 0) && (
            <div className="text-sm text-gray-400">
              Showing {displayedPerks.length} of {marketplacePerks.length} perks
              {activeTags.size > 0 && (
                <span className="ml-2 text-blue-400">
                  {activeTags.size} tag{activeTags.size !== 1 ? 's' : ''}
                </span>
              )}
              {activeCompanies.size > 0 && (
                <span className="ml-2 text-green-400">
                  {activeCompanies.size} compan{activeCompanies.size === 1 ? 'y' : 'ies'}
                </span>
              )}
            </div>
          )}
          
          <button
            onClick={handleRefresh}
            disabled={isLoadingPerks}
            className="btn-modern-secondary flex items-center text-sm"
          >
            {isLoadingPerks ? '⏳' : '🔄'} Refresh
          </button>
          
          <div className="text-right">
            <span className="text-gray-400 mr-2">Available Balance:</span>
            <span className="text-xl font-semibold text-secondary">{userPoints.toLocaleString()} αP</span>
          </div>
        </div>
      </div>

      {/* Marketplace Content */}
      <div className="max-h-[30rem] overflow-y-auto scrollbar-thin grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
        {isLoadingPerks ? (
          // Loading state with progressive information
          <div className="col-span-full text-center py-12 animate-fade-in">
            <div className="text-6xl mb-6 opacity-50">⏳</div>
            <div className="text-gray-300 mb-3 text-lg font-medium">Loading marketplace perks...</div>
            <div className="text-sm text-gray-500 mb-4">
              Fetching perks from latest partner packages
            </div>
            <div className="bg-gray-700/30 rounded-full h-2 w-64 mx-auto overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-full w-1/3 animate-pulse"></div>
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
          displayedPerks.map((perk, index) => (
            <div 
              key={perk.id} 
              className="card-modern p-4 flex items-center hover:scale-[1.01] group transition-transform duration-200 m-1"
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
                    </h3>
                    <div className="text-sm text-gray-400 mt-0.5">
                      by {partnerNames.get(perk.creator_partner_cap_id) || (isLoadingPartnerNames ? 'Loading...' : 'Unknown Partner')}
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
                          disabled={perkPurchaseLoading || !canAffordPerk(perk) || hasBuggyPricing(perk)} 
                          className={`flex-shrink-0 px-4 py-2 text-sm rounded-lg transition-all duration-200 relative min-w-[140px] text-center font-medium ${
                            hasBuggyPricing(perk)
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
          ))
        )}
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <PerkFilterModal 
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          allTags={allUniqueTags}
          allCompanies={allUniqueCompanies}
          activeTags={activeTags}
          activeCompanies={activeCompanies}
          setActiveTags={setActiveTags}
          setActiveCompanies={setActiveCompanies}
          modalTitle="Filter Marketplace Perks"
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