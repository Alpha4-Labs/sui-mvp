import { useState, useEffect, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { SHARED_OBJECTS, ALL_PACKAGE_IDS } from '../config/contract';

interface PlatformStats {
  totalSuiInEscrow: number; // In SUI units
  totalUsdValue: number; // Estimated USD value
  totalStakedPositions: number;
  totalPartners: number;
  totalActivePerks: number;
  platformTVL: number; // Combined TVL from all partners
}

// Cache with 5-minute expiry to avoid re-fetching constantly
interface CachedStats {
  data: PlatformStats;
  timestamp: number;
  ttl: number; // Time to live in ms
}

let statsCache: CachedStats | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const usePlatformStats = () => {
  const suiClient = useSuiClient();
  const [stats, setStats] = useState<PlatformStats>({
    totalSuiInEscrow: 0,
    totalUsdValue: 0,
    totalStakedPositions: 0,
    totalPartners: 0,
    totalActivePerks: 0,
    platformTVL: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlatformStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check cache first
      if (statsCache && Date.now() - statsCache.timestamp < statsCache.ttl) {
        setStats(statsCache.data);
        return;
      }

      const suiPriceUsd = 3.28;

      let totalSui = 0;
      let totalPositions = 0;
      let totalPartners = 0;
      let totalPartnerCollateral = 0;

      if (import.meta.env.DEV) {
        console.log('🔍 Starting TVL calculation...');
      }

      // PHASE 1: Get staked SUI using direct object queries
      try {
        if (import.meta.env.DEV) {
          console.log('📊 Phase 1: Calculating staked SUI...');
        }
        
        let totalStakesFound = 0;
        
        // APPROACH 1: Query StakingManager table directly
        try {
          console.log('🏦 Querying StakingManager table directly...');
          
          const stakingManagerData = await suiClient.getObject({
            id: SHARED_OBJECTS.stakingManager,
            options: { showContent: true },
          });

          if (stakingManagerData?.data?.content && 'fields' in stakingManagerData.data.content) {
            const fields = stakingManagerData.data.content.fields as any;
            
            if (fields.native_stakes?.fields?.size) {
              totalPositions = parseInt(fields.native_stakes.fields.size);
              console.log(`📊 StakingManager has ${totalPositions} active stakes`);
              
              // Get the table ID for dynamic field querying
              const tableId = fields.native_stakes.fields.id.id;
              console.log(`🗂️ Table ID: ${tableId}`);
              
              // Query table entries in batches
              let cursor = null;
              const batchSize = 50;
              let batchCount = 0;
              
              while (batchCount < 20) { // Limit to prevent infinite loops
                try {
                  const tableEntries = await suiClient.getDynamicFields({
                    parentId: tableId,
                    cursor,
                    limit: batchSize
                  });
                  
                  if (tableEntries.data.length === 0) break;
                  
                  console.log(`   📋 Batch ${batchCount + 1}: Found ${tableEntries.data.length} table entries`);
                  
                  // For each table entry, get the StakedSui object and its amount
                  const stakePromises = tableEntries.data.map(async (entry) => {
                    try {
                      if (entry.objectId) {
                        // Get the actual StakedSui object
                        const stakeObj = await suiClient.getObject({
                          id: entry.objectId,
                          options: { showContent: true }
                        });
                        
                        if (stakeObj.data?.content && 'fields' in stakeObj.data.content) {
                          const stakeFields = stakeObj.data.content.fields as any;
                          
                          // StakedSui has a principal field with the amount
                          const principal = stakeFields.principal;
                          if (principal) {
                            const amountSui = parseInt(principal.toString()) / 1_000_000_000;
                            totalSui += amountSui;
                            totalStakesFound++;
                            
                            if (totalStakesFound <= 5) {
                              console.log(`   💰 Stake ${entry.name?.value || entry.objectId}: ${amountSui.toFixed(4)} SUI`);
                            }
                          }
                        }
                      }
                    } catch (error) {
                      // Skip individual stake errors
                    }
                  });
                  
                  await Promise.all(stakePromises);
                  
                  cursor = tableEntries.nextCursor;
                  if (!tableEntries.hasNextPage) break;
                  
                  batchCount++;
                  
                } catch (batchError) {
                  console.warn(`Error in batch ${batchCount}:`, batchError);
                  break;
                }
              }
              
              console.log(`✅ StakingManager: Found ${totalStakesFound} stakes, ${totalSui.toFixed(2)} SUI total`);
            }
          }
        } catch (managerError) {
          console.warn('Error querying StakingManager:', managerError);
        }
        
        // APPROACH 2: Query StakePosition objects as backup/verification
        if (totalStakesFound === 0) {
          console.log('🎯 Fallback: Querying StakePosition objects...');
          
          try {
            // Query for StakePosition<StakedSui> objects
            const stakePositionType = `${ALL_PACKAGE_IDS[0]}::stake_position::StakePosition<0x3::staking_pool::StakedSui>`;
            
            // This might not work directly, so let's try getting recent transactions that created these objects
            const recentTx = await suiClient.queryTransactionBlocks({
              filter: { Package: ALL_PACKAGE_IDS[0] },
              limit: 100,
              order: 'descending',
              options: {
                showObjectChanges: true,
                showEffects: true,
              }
            });
            
            console.log(`Found ${recentTx.data.length} recent transactions`);
            
            for (const tx of recentTx.data) {
              if (tx.objectChanges) {
                for (const change of tx.objectChanges) {
                  if (change.type === 'created' && 
                      change.objectType && 
                      change.objectType.includes('StakePosition') &&
                      change.objectType.includes('StakedSui')) {
                    
                    try {
                      // Get the StakePosition object
                      const stakePos = await suiClient.getObject({
                        id: change.objectId,
                        options: { showContent: true }
                      });
                      
                      if (stakePos.data?.content && 'fields' in stakePos.data.content) {
                        const fields = stakePos.data.content.fields as any;
                        const amount = fields.amount;
                        
                        if (amount) {
                          const amountSui = parseInt(amount.toString()) / 1_000_000_000;
                          totalSui += amountSui;
                          totalStakesFound++;
                          
                          if (totalStakesFound <= 5) {
                            console.log(`   💰 StakePosition ${change.objectId}: ${amountSui.toFixed(4)} SUI`);
                          }
                        }
                      }
                    } catch (error) {
                      // Skip individual errors
                    }
                  }
                }
              }
            }
            
            console.log(`✅ StakePosition objects: Found ${totalStakesFound} stakes, ${totalSui.toFixed(2)} SUI total`);
            
          } catch (positionError) {
            console.warn('Error querying StakePosition objects:', positionError);
          }
        }
        
        console.log(`✅ Phase 1 Complete: ${totalStakesFound} stakes processed, ${totalSui.toFixed(2)} SUI total from ${totalPositions} reported positions`);
        
      } catch (error) {
        console.error('Error in Phase 1 (staked SUI calculation):', error);
      }

      // PHASE 2: Get partner collateral from CollateralVaults
      try {
        console.log('🏦 Phase 2: Calculating partner collateral...');
        
        const collateralVaults: string[] = [];
        const packagesToCheck = ALL_PACKAGE_IDS.slice(0, 5); // Check more packages for collateral vaults
        
        // Query CollateralVaultCreated events to find all vaults
        for (const packageId of packagesToCheck) {
          try {
            console.log(`  Checking package ${packageId} for collateral vaults...`);
            
            const vaultEvents = await suiClient.queryEvents({
              query: { MoveEventType: `${packageId}::partner_flex::CollateralVaultCreated` },
              limit: 500, // Increased limit
              order: 'descending'
            });
            
            console.log(`  Found ${vaultEvents.data.length} vault creation events`);
            
            for (const event of vaultEvents.data) {
              if (event.parsedJson && typeof event.parsedJson === 'object') {
                const parsedEvent = event.parsedJson as any;
                const vaultId = parsedEvent.collateral_vault_id || parsedEvent.vault_id;
                if (vaultId && !collateralVaults.includes(vaultId)) {
                  collateralVaults.push(vaultId);
                }
              }
            }
          } catch (error) {
            console.warn(`Could not fetch vault events for package ${packageId}:`, error);
          }
        }

        console.log(`🏦 Found ${collateralVaults.length} total collateral vaults`);

        // Fetch vault balances in batches
        if (collateralVaults.length > 0) {
          const batchSize = 25;
          let vaultsProcessed = 0;
          
          for (let i = 0; i < collateralVaults.length; i += batchSize) {
            const batch = collateralVaults.slice(i, i + batchSize);
            
            try {
              const vaultObjects = await suiClient.multiGetObjects({
                ids: batch,
                options: { showContent: true },
              });

              for (const vaultObj of vaultObjects) {
                if (vaultObj.data?.content && 'fields' in vaultObj.data.content) {
                  const fields = vaultObj.data.content.fields as any;
                  
                  // Extract SUI balance from vault
                  let balanceSui = 0;
                  
                  if (fields.locked_sui_balance) {
                    if (typeof fields.locked_sui_balance === 'string') {
                      balanceSui = parseInt(fields.locked_sui_balance) / 1_000_000_000;
                    } else if (fields.locked_sui_balance.fields?.value) {
                      balanceSui = parseInt(fields.locked_sui_balance.fields.value) / 1_000_000_000;
                    }
                  }
                  
                  if (balanceSui > 0) {
                    totalPartnerCollateral += balanceSui;
                    vaultsProcessed++;
                  }
                }
              }
            } catch (batchError) {
              console.warn('Error fetching vault batch:', batchError);
            }
          }
          
          console.log(`💰 Processed ${vaultsProcessed} vaults, total partner collateral: ${totalPartnerCollateral.toFixed(2)} SUI`);
        }
      } catch (collateralError) {
        console.error('Error in Phase 2 (partner collateral):', collateralError);
      }

      // PHASE 3: Get partner count
      try {
        console.log('👥 Phase 3: Counting partners...');
        
        for (const packageId of ALL_PACKAGE_IDS.slice(0, 5)) {
          try {
            const partnerEvents = await suiClient.queryEvents({
              query: { MoveEventType: `${packageId}::partner_flex::PartnerCapCreated` },
              limit: 200,
            });
            totalPartners += partnerEvents.data.length;
          } catch (error) {
            // Silent fail for partners
          }
        }
        
        console.log(`👥 Found ${totalPartners} total partners`);
      } catch (error) {
        console.warn('Error counting partners:', error);
      }

      // Calculate final stats
      const totalStakedSui = totalSui;
      const totalSuiInEscrow = totalStakedSui + totalPartnerCollateral;
      const totalUsdValue = totalSuiInEscrow * suiPriceUsd;
      
      // Enhanced debug logging
      console.log('🎯 TVL Calculation Final Results:', {
        totalStakedSui: `${totalStakedSui.toFixed(2)} SUI`,
        totalPartnerCollateral: `${totalPartnerCollateral.toFixed(2)} SUI`,
        totalSuiInEscrow: `${totalSuiInEscrow.toFixed(2)} SUI`,
        totalUsdValue: `$${totalUsdValue.toFixed(2)}`,
        suiPriceUsd: `$${suiPriceUsd}`,
        totalStakedPositions: totalPositions,
        totalPartners,
        breakdown: {
          stakedPercent: totalStakedSui > 0 ? ((totalStakedSui / totalSuiInEscrow) * 100).toFixed(1) + '%' : '0%',
          collateralPercent: totalPartnerCollateral > 0 ? ((totalPartnerCollateral / totalSuiInEscrow) * 100).toFixed(1) + '%' : '0%'
        }
      });
      
      const finalStats: PlatformStats = {
        totalSuiInEscrow: totalSuiInEscrow,
        totalUsdValue: totalUsdValue,
        totalStakedPositions: totalPositions,
        totalPartners: totalPartners,
        totalActivePerks: 0,
        platformTVL: totalUsdValue,
      };

      // Cache the results
      statsCache = {
        data: finalStats,
        timestamp: Date.now(),
        ttl: CACHE_TTL,
      };

      setStats(finalStats);

    } catch (err) {
      console.error('Error fetching platform stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch platform stats');
    } finally {
      setIsLoading(false);
    }
  }, [suiClient]);

  const refetch = useCallback(() => {
    // Clear cache to force fresh fetch
    statsCache = null;
    fetchPlatformStats();
  }, [fetchPlatformStats]);

  useEffect(() => {
    fetchPlatformStats();
  }, [fetchPlatformStats]);

  return {
    stats,
    isLoading,
    error,
    refetch,
  };
}; 