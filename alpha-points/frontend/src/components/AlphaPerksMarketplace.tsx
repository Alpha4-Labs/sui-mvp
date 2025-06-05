import React, { useState, useEffect, useMemo } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount } from '@mysten/dapp-kit';
import { usePerkData, PerkDefinition } from '../hooks/usePerkData';
import { useAlphaContext } from '../context/AlphaContext';
import { buildClaimPerkTransaction } from '../utils/transaction';
import { PerkFilterModal } from './PerkFilterModal';
import { SubnameInputModal } from './SubnameInputModal';
import { SubnameSuccessModal } from './SubnameSuccessModal';
import { toast } from 'react-toastify';
import { SuinsClient } from '@mysten/suins';
import { SHARED_OBJECTS } from '../config/contract';

interface AlphaPerksMarketplaceProps {
  userPoints: number;
  onPerkPurchase?: (perk: PerkDefinition) => void;
}

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
  const [partnerNames, setPartnerNames] = useState<Map<string, string>>(new Map());

  // Modal states
  const [isSubnameInputModalOpen, setIsSubnameInputModalOpen] = useState(false);
  const [isSubnameSuccessModalOpen, setIsSubnameSuccessModalOpen] = useState(false);
  const [selectedPerkForModal, setSelectedPerkForModal] = useState<PerkDefinition | null>(null);
  const [registeredSubname, setRegisteredSubname] = useState<string>('');
  const [perkPurchaseLoading, setPerkPurchaseLoading] = useState(false);

  // Filtering state
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [activeCompanies, setActiveCompanies] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Function to fetch partner company names
  const fetchPartnerNames = async (partnerCapIds: string[]) => {
    if (!suiClient || partnerCapIds.length === 0) return;

    const newPartnerNames = new Map<string, string>();
    
    // Process partner caps in batches to avoid rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < partnerCapIds.length; i += BATCH_SIZE) {
      const batch = partnerCapIds.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(async (partnerCapId) => {
        try {
          const partnerCapObject = await suiClient.getObject({
            id: partnerCapId,
            options: {
              showContent: true,
              showType: true,
            },
          });

          if (partnerCapObject?.data?.content && partnerCapObject.data.content.dataType === 'moveObject') {
            const fields = (partnerCapObject.data.content as any).fields;
            const companyName = fields.partner_name || 'Unknown Partner';
            newPartnerNames.set(partnerCapId, companyName);
          }
        } catch (error) {
          console.warn(`Failed to fetch partner name for ${partnerCapId}:`, error);
          newPartnerNames.set(partnerCapId, 'Unknown Partner');
        }
      });

      await Promise.all(promises);
      
      // Add small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < partnerCapIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setPartnerNames(prev => new Map([...prev, ...newPartnerNames]));
  };

  // Load marketplace perks on component mount
  useEffect(() => {
    const loadMarketplacePerks = async () => {
      try {
        const perks = await fetchAllMarketplacePerks();
        setMarketplacePerks(perks);

        // Extract unique partner cap IDs and fetch their company names
        const uniquePartnerCapIds = [...new Set(perks.map(perk => perk.creator_partner_cap_id))];
        await fetchPartnerNames(uniquePartnerCapIds);
      } catch (error) {
        console.error('Failed to load marketplace perks:', error);
      }
    };

    loadMarketplacePerks();
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

  // Check if user can afford a perk
  const canAffordPerk = (perk: PerkDefinition) => {
    return userPoints >= perk.current_alpha_points_price;
  };

  // Handle perk purchase for role perks (with subname)
  const openSubnameInputModal = (perk: PerkDefinition) => {
    if (!currentAccount?.address) {
      toast.error("Please connect your wallet to purchase perks.");
      return;
    }
    if (!canAffordPerk(perk)) {
      toast.error("You don't have enough Alpha Points for this perk.");
      return;
    }
    setSelectedPerkForModal(perk);
    setIsSubnameInputModalOpen(true);
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
      const transaction = buildClaimPerkTransaction(
        perk.id,
        perk.creator_partner_cap_id,
        undefined // No sponsor
      );

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

  // Handle subname input submission for role perks
  const handleSubnameInputSubmit = async (subname: string) => {
    if (!selectedPerkForModal || !currentAccount?.address) {
      toast.error("Error: No perk selected or user address missing.");
      setIsSubnameInputModalOpen(false);
      return;
    }

    setPerkPurchaseLoading(true);
    setTransactionLoading(true);

    try {
      if (!suiClient) {
        throw new Error("Sui Client is not initialized.");
      }

      const network = (import.meta.env.VITE_SUI_NETWORK as 'mainnet' | 'testnet' | undefined) || 'testnet';
      const suinsClientInstance = new SuinsClient({
        client: suiClient,
        network: network 
      });

      const cleanedSubname = subname.trim().toLowerCase();
      if (!cleanedSubname) {
        toast.error("Subname cannot be empty.");
        return;
      }

      // For now, use the claim perk transaction - in the future this might be a special role perk transaction
      const transaction = buildClaimPerkTransaction(
        selectedPerkForModal.id,
        selectedPerkForModal.creator_partner_cap_id,
        undefined // No sponsor
      );

      const result = await signAndExecute({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        refreshData();
        refreshPerkData();
        setRegisteredSubname(cleanedSubname);
        setIsSubnameInputModalOpen(false);
        setIsSubnameSuccessModalOpen(true);

        toast.success(
          `✅ Successfully purchased "${selectedPerkForModal.name}"!\n\n🔗 Transaction: ${result.digest.substring(0, 8)}...`,
          {
            onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, '_blank'),
            style: { whiteSpace: 'pre-line', cursor: 'pointer' }
          }
        );

        if (onPerkPurchase) {
          onPerkPurchase(selectedPerkForModal);
        }
      }
    } catch (error: any) {
      console.error('Failed to purchase role perk:', error);
      toast.error(error.message || 'Failed to purchase role perk.');
    } finally {
      setPerkPurchaseLoading(false);
      setTransactionLoading(false);
    }
  };

  // Determine if a perk is a role perk that needs subname input
  const isRolePerk = (perk: PerkDefinition) => {
    return perk.tags?.includes('Role') || perk.tags?.includes('Discord') || 
           perk.name.toLowerCase().includes('role') || perk.name.toLowerCase().includes('tester') ||
           perk.name.toLowerCase().includes('veteran');
  };

  // Handle perk purchase click
  const handlePerkClick = (perk: PerkDefinition) => {
    if (isRolePerk(perk)) {
      openSubnameInputModal(perk);
    } else {
      handleRegularPerkPurchase(perk);
    }
  };

  // Refresh marketplace perks
  const handleRefresh = async () => {
    try {
      const perks = await fetchAllMarketplacePerks();
      setMarketplacePerks(perks);
      
      // Refresh partner names too
      const uniquePartnerCapIds = [...new Set(perks.map(perk => perk.creator_partner_cap_id))];
      await fetchPartnerNames(uniquePartnerCapIds);
      
      toast.success('Marketplace refreshed!');
    } catch (error) {
      console.error('Failed to refresh marketplace:', error);
      toast.error('Failed to refresh marketplace.');
    }
  };

  return (
    <div>
      {/* Filter Controls */}
      <div className="bg-background rounded-lg p-4 mb-6 flex items-center justify-between">
        <button 
          onClick={() => setIsFilterModalOpen(true)}
          className="flex items-center text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-md transition-colors"
          aria-label="Filter perks"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          Filter Perks
          {(activeTags.size > 0 || activeCompanies.size > 0) && (
            <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
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
            className="flex items-center text-sm bg-gray-600 hover:bg-gray-500 text-gray-200 py-2 px-3 rounded-md transition-colors disabled:opacity-50"
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
      <div className="max-h-[30rem] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 p-1 rounded-md bg-background-input/30">
        {isLoadingPerks ? (
          // Loading state
          <div className="col-span-full text-center py-8">
            <div className="text-4xl mb-4">⏳</div>
            <div className="text-gray-400 mb-2">Loading marketplace perks...</div>
            <div className="text-sm text-gray-500">
              Fetching perks from all partners across the blockchain
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
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
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
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Clear All Filters
                </button>
                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Adjust Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          // Marketplace perks
          displayedPerks.map((perk) => (
            <div 
              key={perk.id} 
              className="border rounded-lg p-3 flex items-center bg-background-input border-gray-700"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-background rounded-full mr-3 text-xl flex-shrink-0">
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
                      by {partnerNames.get(perk.creator_partner_cap_id) || 'Loading...'}
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
                          disabled={perkPurchaseLoading || !canAffordPerk(perk)} 
                          className={`flex-shrink-0 px-3 py-1.5 text-sm rounded transition-colors relative min-w-[140px] text-center ${
                            !canAffordPerk(perk)
                              ? 'bg-red-600/50 text-red-300 cursor-not-allowed'
                              : 'bg-primary hover:bg-primary-dark text-white'
                          }`}
                        >
                          {perkPurchaseLoading && selectedPerkForModal?.id === perk.id ? (
                            <>
                              <span className="opacity-0">{perk.current_alpha_points_price.toLocaleString()} αP</span>
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </span>
                            </>
                          ) : (
                            `${perk.current_alpha_points_price.toLocaleString()} αP`
                          )}
                        </button>
                      </div>
                      
                      <div className="text-xs text-gray-400 flex items-center space-x-2">
                        <span className="text-green-400">
                          Perk valued at: ${perk.usdc_price.toFixed(2)} USDC
                        </span>
                        <span>•</span>
                        <span>
                          {perk.total_claims_count} claimed
                        </span>
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

      {/* Role Perk Purchase Modals */}
      {selectedPerkForModal && (
        <SubnameInputModal
          isOpen={isSubnameInputModalOpen}
          onClose={() => {
            setIsSubnameInputModalOpen(false);
            setSelectedPerkForModal(null);
          }}
          onSubmit={handleSubnameInputSubmit}
          perkName={selectedPerkForModal.name}
          isLoading={perkPurchaseLoading}
          currentPoints={userPoints}
          perkCost={selectedPerkForModal.current_alpha_points_price}
          userHasAlpha4Subleaf={false} // TODO: Implement this check if needed
        />
      )}

      {selectedPerkForModal && registeredSubname && (
        <SubnameSuccessModal
          isOpen={isSubnameSuccessModalOpen}
          onClose={() => {
            setIsSubnameSuccessModalOpen(false);
            setSelectedPerkForModal(null);
            setRegisteredSubname('');
          }}
          subnameRegistered={registeredSubname}
          perkName={selectedPerkForModal.name}
        />
      )}
    </div>
  );
}; 