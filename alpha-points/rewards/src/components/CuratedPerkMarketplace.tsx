import React, { useState, useMemo } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { toast } from 'react-hot-toast';
import { usePerkMarketplace } from '../hooks/usePerkMarketplace';
import type { PerkDefinition } from '../types/index';
import { BRAND_CONFIG } from '../config/brand';
import { SUI_CONFIG } from '../config/sui';
import { buildClaimPerkQuotaFreeTransaction } from '../utils/transactions';
import { PerkFilterModal } from './PerkFilterModal';

// Export the PerkDefinition type for use in other components
export type { PerkDefinition };

interface CuratedPerkMarketplaceProps {
  className?: string;
}

export const CuratedPerkMarketplace: React.FC<CuratedPerkMarketplaceProps> = ({ 
  className = "" 
}) => {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  
  const {
    perks,
    isLoading,
    error,
    partnerNames,
    claimedPerks,
    userAlphaPoints,
    refresh,
    hasPerkClaimed,
    canAffordPerk,
  } = usePerkMarketplace();

  const [purchaseLoading, setPurchaseLoading] = useState(false);
  
  // Filtering and sorting state
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [activeCompanies, setActiveCompanies] = useState<Set<string>>(new Set());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'alphabetical' | 'date' | 'price-low' | 'price-high' | 'owned' | 'claims'>('date');
  const [filterByOwned, setFilterByOwned] = useState<'all' | 'owned' | 'not-owned'>('all');
  const [filterByCategory, setFilterByCategory] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000000]);
  const [showExpired, setShowExpired] = useState(true);

  // Extract all unique tags and companies from perks
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    perks.forEach(perk => {
      perk.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [perks]);

  const allUniqueCompanies = useMemo(() => {
    const companySet = new Set<string>();
    perks.forEach(perk => {
      const companyName = partnerNames.get(perk.creator_partner_cap_id);
      if (companyName && companyName !== 'Loading...' && companyName !== 'Unknown Partner') {
        companySet.add(companyName);
      }
    });
    return Array.from(companySet).sort();
  }, [perks, partnerNames]);

  const allUniqueCategories = useMemo(() => {
    const categorySet = new Set<string>();
    perks.forEach(perk => {
      if (perk.perk_type || perk.perkType) {
        categorySet.add(perk.perk_type || perk.perkType);
      }
    });
    return Array.from(categorySet).sort();
  }, [perks]);

  // Get perk icon based on type
  const getPerkIcon = (perk: PerkDefinition) => {
    if (perk.icon) return perk.icon;
    
    const perkType = perk.perk_type || perk.perkType;
    switch (perkType) {
      case 'Access': return '🔑';
      case 'Digital Asset': return '🖼️';
      case 'Service': return '🎧';
      case 'Event': return '🎫';
      case 'Physical': return '📦';
      default: return '🎁';
    }
  };

  // Check if perk is expired
  const isPerkExpired = (perk: PerkDefinition) => {
    const expirationTime = perk.expiration_timestamp_ms || perk.expirationTimestamp;
    if (!expirationTime) return false;
    return Date.now() > expirationTime;
  };

  // Get Alpha Points price
  const getAlphaPointsPrice = (perk: PerkDefinition) => {
    return perk.current_alpha_points_price || 0;
  };

  // Get USDC price for display
  const getUsdcPrice = (perk: PerkDefinition) => {
    return perk.usdc_price || 0;
  };

  // Sorting function
  const sortPerks = (perksToSort: PerkDefinition[]) => {
    return [...perksToSort].sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'date':
          const aTime = a.last_price_update_timestamp_ms || 0;
          const bTime = b.last_price_update_timestamp_ms || 0;
          return bTime - aTime; // Newest first
        case 'price-low':
          return getAlphaPointsPrice(a) - getAlphaPointsPrice(b);
        case 'price-high':
          return getAlphaPointsPrice(b) - getAlphaPointsPrice(a);
        case 'owned':
          const aOwned = hasPerkClaimed(a.id) ? 1 : 0;
          const bOwned = hasPerkClaimed(b.id) ? 1 : 0;
          return bOwned - aOwned; // Owned first
        case 'claims':
          const aClaims = a.total_claims_count || 0;
          const bClaims = b.total_claims_count || 0;
          return bClaims - aClaims; // Most claimed first
        default:
          return 0;
      }
    });
  };

  // Filter and sort perks based on all criteria
  const displayedPerks = useMemo(() => {
    let filtered = perks;

    // Filter by owned status
    if (filterByOwned === 'owned') {
      filtered = filtered.filter(perk => hasPerkClaimed(perk.id));
    } else if (filterByOwned === 'not-owned') {
      filtered = filtered.filter(perk => !hasPerkClaimed(perk.id));
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
        filterByCategory.has(perk.perk_type || perk.perkType || '')
      );
    }

    // Filter by price range
    filtered = filtered.filter(perk => {
      const price = getAlphaPointsPrice(perk);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Filter expired perks
    if (!showExpired) {
      filtered = filtered.filter(perk => !isPerkExpired(perk));
    }

    // Apply sorting
    return sortPerks(filtered);
  }, [
    perks, 
    activeTags, 
    activeCompanies, 
    partnerNames, 
    filterByOwned, 
    filterByCategory, 
    priceRange, 
    showExpired, 
    sortBy,
    hasPerkClaimed
  ]);

  // Handle perk purchase
  const handlePerkPurchase = async (perk: PerkDefinition) => {
    if (!currentAccount?.address) {
      toast.error(BRAND_CONFIG.content.connectWalletText);
      return;
    }

    if (!canAffordPerk(perk)) {
      toast.error("Insufficient Alpha Points");
      return;
    }

    const maxUsesPerClaim = perk.max_uses_per_claim || perk.maxUsesPerClaim;
    if (hasPerkClaimed(perk.id) && !maxUsesPerClaim) {
      toast.error("You've already claimed this perk");
      return;
    }

    if (isPerkExpired(perk)) {
      toast.error("This perk has expired");
      return;
    }

    setPurchaseLoading(true);

    try {
      const transaction = buildClaimPerkQuotaFreeTransaction(perk.id);
      
      if (currentAccount?.address) {
        transaction.setSender(currentAccount.address);
      }

      const result = await signAndExecute({
        transaction,
      });

      if (result?.digest) {
        toast.success(
          `✅ Successfully purchased "${perk.name}"!\n\n🔗 Transaction: ${result.digest.substring(0, 8)}...`,
          {
            duration: 5000,
            style: { whiteSpace: 'pre-line' }
          }
        );

        // Refresh data after successful purchase
        setTimeout(() => {
          refresh();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Perk purchase failed:', error);
      
      if (error.message?.includes('EPerkNotActive')) {
        toast.error('❌ This perk is not currently active.');
      } else if (error.message?.includes('EMaxClaimsReached')) {
        toast.error('❌ This perk has reached its maximum claims limit.');
      } else if (error.message?.includes('Insufficient balance')) {
        toast.error('❌ You don\'t have enough Alpha Points.');
      } else {
        toast.error(`❌ Purchase failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <div 
            className="text-6xl mb-4 inline-block opacity-70"
            style={{ 
              animation: 'spin 0.8s linear infinite',
              transformOrigin: 'center center'
            }}
          >
            ⏳
          </div>
          <div className="text-xl font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            Loading {BRAND_CONFIG.company.name} perks...
          </div>
          <div className="text-sm opacity-60" style={{ color: 'var(--color-text-muted)' }}>
            Please wait while we fetch your exclusive perks
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl font-medium mb-2 text-red-400">
            Failed to load perks
          </div>
          <div className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {error}
          </div>
          <button
            onClick={refresh}
            className="px-6 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text)',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (perks.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏪</div>
          <div className="text-xl font-medium mb-4" style={{ color: 'var(--color-text)' }}>
            {BRAND_CONFIG.content.noPerksMessage}
          </div>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--color-text-muted)' }}>
            {BRAND_CONFIG.company.name} will be adding exclusive perks soon. 
            {BRAND_CONFIG.company.supportEmail && (
              <>
                {' '}Have questions? Contact us at{' '}
                <a 
                  href={`mailto:${BRAND_CONFIG.company.supportEmail}`}
                  className="underline hover:no-underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {BRAND_CONFIG.company.supportEmail}
                </a>
              </>
            )}
          </p>
          <button
            onClick={refresh}
            className="px-6 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-text)',
            }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Filter Controls */}
      <div 
        className="p-4 mb-6 rounded-2xl backdrop-blur-lg shadow-lg border"
        style={{
          backgroundColor: 'var(--color-background-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center px-4 py-2 rounded-lg font-medium transition-colors border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
              aria-label="Filter perks"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
              Filter & Sort
              {(activeTags.size > 0 || activeCompanies.size > 0 || filterByCategory.size > 0 || filterByOwned !== 'all') && (
                <span 
                  className="ml-2 text-white text-xs px-2 py-1 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {activeTags.size + activeCompanies.size + filterByCategory.size + (filterByOwned !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Quick Sort Dropdown */}
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-lg text-sm border font-medium focus:ring-2 focus:ring-opacity-50"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              } as React.CSSProperties}
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
              className="px-3 py-2 rounded-lg text-sm border font-medium focus:ring-2 focus:ring-opacity-50"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              } as React.CSSProperties}
            >
              <option value="all">All Perks</option>
              <option value="owned">✅ Owned</option>
              <option value="not-owned">🆕 Not Owned</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center px-4 py-2 rounded-lg font-medium transition-colors border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
              title="Refresh to get the latest perks"
            >
              {isLoading ? '⏳' : '🔄'} Refresh
            </button>
            
            <div className="text-right">
              <div>
                <span style={{ color: 'var(--color-text-muted)' }} className="mr-2">
                  Available Balance:
                </span>
                <span 
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-secondary)' }}
                >
                  {userAlphaPoints.toLocaleString()} αP
                </span>
              </div>
              {BRAND_CONFIG.features.showPriceInUSD && (
                <div className="text-sm mt-1" style={{ color: 'var(--color-success)' }}>
                  ≈ ${(userAlphaPoints / 1000).toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })} USD
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Status */}
        {(activeTags.size > 0 || activeCompanies.size > 0 || filterByCategory.size > 0 || filterByOwned !== 'all') && (
          <div 
            className="text-sm px-3 py-2 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            Showing {displayedPerks.length} of {perks.length} perks
            {activeTags.size > 0 && (
              <span style={{ color: 'var(--color-primary)' }}>
                • {activeTags.size} tag{activeTags.size !== 1 ? 's' : ''}
              </span>
            )}
            {activeCompanies.size > 0 && (
              <span style={{ color: 'var(--color-success)' }}>
                • {activeCompanies.size} company{activeCompanies.size !== 1 ? 'ies' : 'y'}
              </span>
            )}
            {filterByCategory.size > 0 && (
              <span style={{ color: 'var(--color-secondary)' }}>
                • {filterByCategory.size} categor{filterByCategory.size !== 1 ? 'ies' : 'y'}
              </span>
            )}
            {filterByOwned !== 'all' && (
              <span style={{ color: 'var(--color-warning)' }}>
                • {filterByOwned === 'owned' ? 'Owned only' : 'Not owned only'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Perks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayedPerks.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-xl font-medium mb-4" style={{ color: 'var(--color-text)' }}>
              No perks match your filters
            </div>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Try adjusting your filter criteria to see more perks.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => {
                  setActiveTags(new Set());
                  setActiveCompanies(new Set());
                  setFilterByCategory(new Set());
                  setFilterByOwned('all');
                }}
                className="px-6 py-2 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-text)',
                }}
              >
                Clear All Filters
              </button>
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="px-6 py-2 rounded-lg font-medium transition-colors border"
                style={{
                  backgroundColor: 'var(--color-background)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                Adjust Filters
              </button>
            </div>
          </div>
        ) : (
          displayedPerks.map((perk, index) => {
            const isPerkClaimed = hasPerkClaimed(perk.id);
            const alphaPrice = getAlphaPointsPrice(perk);
            const usdcPrice = getUsdcPrice(perk);
            const companyName = partnerNames.get(perk.creator_partner_cap_id) || 'Unknown Partner';
            
            return (
              <div 
                key={perk.id}
                className={`p-4 rounded-2xl backdrop-blur-lg shadow-lg border transition-all duration-200 hover:scale-[1.02] ${
                  isPerkClaimed ? 'ring-2 ring-opacity-50' : ''
                }`}
                style={{
                  backgroundColor: isPerkClaimed 
                    ? 'var(--color-success)15' 
                    : 'var(--color-background-card)',
                  borderColor: isPerkClaimed 
                    ? 'var(--color-success)' 
                    : 'var(--color-border)',
                  animationDelay: `${index * 50}ms`,
                } as React.CSSProperties}
              >
                <div className="flex items-start space-x-4">
                  {/* Perk Icon */}
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`,
                    }}
                  >
                    {getPerkIcon(perk)}
                  </div>
                  
                  {/* Perk Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="font-bold text-lg flex items-center gap-2 break-words"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {perk.name}
                          {isPerkClaimed && (
                            <span 
                              className="inline-block w-3 h-3 rounded-full animate-pulse"
                              style={{ backgroundColor: 'var(--color-success)' }}
                              title="Already Claimed"
                            />
                          )}
                        </h3>
                        {BRAND_CONFIG.features.showPartnerNames && (
                          <div 
                            className="text-sm mt-1"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            by {companyName}
                          </div>
                        )}
                      </div>
                      
                      {/* Purchase Button */}
                      <button 
                        onClick={() => handlePerkPurchase(perk)}
                        disabled={
                          purchaseLoading || 
                          !canAffordPerk(perk) || 
                          (isPerkClaimed && !(perk.max_uses_per_claim || perk.maxUsesPerClaim)) ||
                          isPerkExpired(perk)
                        }
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 min-w-[120px] text-center ${
                          isPerkClaimed && !(perk.max_uses_per_claim || perk.maxUsesPerClaim)
                            ? 'opacity-50 cursor-not-allowed'
                            : !canAffordPerk(perk)
                            ? 'opacity-50 cursor-not-allowed'
                            : isPerkExpired(perk)
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                        style={{
                          backgroundColor: isPerkClaimed && !(perk.max_uses_per_claim || perk.maxUsesPerClaim)
                            ? 'var(--color-success)'
                            : !canAffordPerk(perk) || isPerkExpired(perk)
                            ? 'var(--color-error)'
                            : 'var(--color-primary)',
                          color: 'var(--color-text)',
                        }}
                        title={
                          isPerkClaimed && !(perk.max_uses_per_claim || perk.maxUsesPerClaim)
                            ? 'You have already claimed this perk'
                            : !canAffordPerk(perk)
                            ? `You need ${alphaPrice.toLocaleString()} αP to purchase this perk`
                            : isPerkExpired(perk)
                            ? 'This perk has expired'
                            : 'Click to purchase this perk'
                        }
                      >
                        {purchaseLoading ? (
                          <div className="flex items-center justify-center">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        ) : isPerkClaimed && !(perk.max_uses_per_claim || perk.maxUsesPerClaim) ? (
                          "✅ Claimed"
                        ) : isPerkExpired(perk) ? (
                          "⏰ Expired"
                        ) : (
                          `${alphaPrice.toLocaleString()} αP`
                        )}
                      </button>
                    </div>
                    
                    {/* Perk Description */}
                    <p 
                      className="text-sm mb-3 break-words line-clamp-2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {perk.description}
                    </p>
                    
                    {/* Perk Details */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        {BRAND_CONFIG.features.showPriceInUSD && usdcPrice > 0 && (
                          <span style={{ color: 'var(--color-success)' }}>
                            💰 ${usdcPrice.toFixed(2)} value
                          </span>
                        )}
                                                 {BRAND_CONFIG.features.showClaimCount && (
                           <span style={{ color: 'var(--color-text-muted)' }}>
                             👥 {perk.total_claims_count || 0} claimed
                           </span>
                         )}
                      </div>
                      
                      {/* Tags */}
                      {perk.tags && perk.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {perk.tags.slice(0, 2).map((tag) => (
                            <span 
                              key={tag} 
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: 'var(--color-primary)20',
                                color: 'var(--color-primary)',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                          {perk.tags.length > 2 && (
                            <span 
                              className="text-xs"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              +{perk.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
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
          modalTitle={`Filter & Sort ${BRAND_CONFIG.company.name} Perks`}
          totalPerks={perks.length}
          displayedPerks={displayedPerks.length}
        />
      )}
    </div>
  );
}; 