import { useState, useEffect, useCallback } from 'react';
import { useSuiClient, useCurrentWallet } from '@mysten/dapp-kit';
import { SHARED_OBJECTS, ALL_PACKAGE_IDS } from '../config/contract';
import { requestCache } from '../utils/cache';

export interface WalletStakeInfo {
  stakeId: string;
  amount: number; // In SUI units
  isActive: boolean; // Whether the stake still exists in the staking manager
  packageId: string; // Which package version created this stake
}

export interface WalletStakesData {
  stakes: WalletStakeInfo[];
  totalStakedSui: number;
  totalActiveStakes: number;
  lastUpdated: number;
}

export function useWalletStakes(walletAddress?: string) {
  const { currentWallet } = useCurrentWallet();
  const client = useSuiClient();
  const [stakesData, setStakesData] = useState<WalletStakesData>({
    stakes: [],
    totalStakedSui: 0,
    totalActiveStakes: 0,
    lastUpdated: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use provided wallet address or current wallet
  const targetWallet = walletAddress || currentWallet?.accounts?.[0]?.address;

  /**
   * Efficiently fetch all stakes for a wallet by:
   * 1. Finding stake IDs via NativeStakeStored events
   * 2. Directly checking staking manager for current amounts
   */
  const fetchWalletStakes = useCallback(async (): Promise<WalletStakesData> => {
    if (!targetWallet || !client) {
      console.log('❌ No wallet address or client for stake fetching');
      return { stakes: [], totalStakedSui: 0, totalActiveStakes: 0, lastUpdated: Date.now() };
    }

    const cacheKey = `wallet_stakes_${targetWallet}`;
    
    console.log(`🔍 Fetching stakes for wallet: ${targetWallet}`);
    
    try {
      const result = await requestCache.getOrFetch(
        cacheKey,
        async () => {
          const allStakeInfo: WalletStakeInfo[] = [];
          const seenStakeIds = new Set<string>();

          console.log(`📋 Searching for stake events across ${ALL_PACKAGE_IDS.length} package versions...`);

          // Phase 1: Find all stake IDs for this wallet via events
          for (const [index, packageId] of ALL_PACKAGE_IDS.entries()) {
            if (!packageId) continue;

            try {
              console.log(`🔍 [${index + 1}/${ALL_PACKAGE_IDS.length}] Checking package ${packageId} for stake events...`);

              // Query NativeStakeStored events - these are emitted when stakes are added to the manager
              const stakeStoredEvents = await client.queryEvents({
                query: { 
                  MoveEventType: `${packageId}::staking_manager::NativeStakeStored`,
                  Sender: targetWallet 
                },
                limit: 500, // Generous limit to catch all user stakes
                order: 'descending'
              });

              console.log(`   Found ${stakeStoredEvents.data.length} NativeStakeStored events`);

              for (const event of stakeStoredEvents.data) {
                if (event.parsedJson && typeof event.parsedJson === 'object') {
                  const parsedEvent = event.parsedJson as any;
                  const stakeId = parsedEvent.stake_id;
                  const amount = parsedEvent.amount;

                  if (stakeId && amount && !seenStakeIds.has(stakeId)) {
                    seenStakeIds.add(stakeId);
                    const amountSui = parseInt(amount.toString()) / 1_000_000_000;
                    
                    allStakeInfo.push({
                      stakeId,
                      amount: amountSui,
                      isActive: false, // Will be updated in phase 2
                      packageId
                    });
                  }
                }
              }

              // Also check for StakeDeposited events as a backup source
              const stakeDepositedEvents = await client.queryEvents({
                query: { 
                  MoveEventType: `${packageId}::integration::StakeDeposited`,
                  Sender: targetWallet 
                },
                limit: 200,
                order: 'descending'
              });

              console.log(`   Found ${stakeDepositedEvents.data.length} StakeDeposited events`);

              for (const event of stakeDepositedEvents.data) {
                if (event.parsedJson && typeof event.parsedJson === 'object') {
                  const parsedEvent = event.parsedJson as any;
                  const nativeStakeId = parsedEvent.native_stake_id;
                  const amount = parsedEvent.amount_staked;

                  if (nativeStakeId && amount && !seenStakeIds.has(nativeStakeId)) {
                    seenStakeIds.add(nativeStakeId);
                    const amountSui = parseInt(amount.toString()) / 1_000_000_000;
                    
                    allStakeInfo.push({
                      stakeId: nativeStakeId,
                      amount: amountSui,
                      isActive: false, // Will be updated in phase 2
                      packageId
                    });
                  }
                }
              }

            } catch (error) {
              console.warn(`❌ Error fetching stake events for package ${packageId}:`, error);
            }
          }

          console.log(`📊 Phase 1 complete: Found ${allStakeInfo.length} unique stake IDs`);

          // Phase 2: Check which stakes are still active in the staking manager
          if (allStakeInfo.length > 0) {
            console.log(`🏦 Phase 2: Checking staking manager for active stakes...`);
            
            // Process stakes in batches to avoid overwhelming the RPC
            const batchSize = 20;
            let activeStakes = 0;
            let totalActiveSui = 0;

            for (let i = 0; i < allStakeInfo.length; i += batchSize) {
              const batch = allStakeInfo.slice(i, i + batchSize);
              
              try {
                // For each stake, check if it still exists in the staking manager
                const checkPromises = batch.map(async (stakeInfo) => {
                  try {
                    // Call the view function to check if stake exists and get current amount
                    const hasStake = await client.devInspectTransactionBlock({
                      transactionBlock: {
                        kind: 'ProgrammableTransaction',
                        inputs: [
                          { type: 'object', objectType: 'sharedObject', objectId: SHARED_OBJECTS.stakingManager },
                          { type: 'pure', valueType: 'address', value: stakeInfo.stakeId }
                        ],
                        transactions: [{
                          kind: 'MoveCall',
                          target: `${ALL_PACKAGE_IDS[0]}::staking_manager::has_native_stake`,
                          arguments: ['Input(0)', 'Input(1)']
                        }]
                      },
                      sender: targetWallet
                    });

                    const stakeExists = hasStake.results?.[0]?.returnValues?.[0]?.[0] === 1;

                    if (stakeExists) {
                      // Get the current amount from the staking manager
                      const amountResult = await client.devInspectTransactionBlock({
                        transactionBlock: {
                          kind: 'ProgrammableTransaction',
                          inputs: [
                            { type: 'object', objectType: 'sharedObject', objectId: SHARED_OBJECTS.stakingManager },
                            { type: 'pure', valueType: 'address', value: stakeInfo.stakeId }
                          ],
                          transactions: [{
                            kind: 'MoveCall',
                            target: `${ALL_PACKAGE_IDS[0]}::staking_manager::get_native_stake_balance`,
                            arguments: ['Input(0)', 'Input(1)']
                          }]
                        },
                        sender: targetWallet
                      });

                      if (amountResult.results?.[0]?.returnValues?.[0]) {
                        // Parse the amount from the result (MIST value)
                        const currentAmountMist = BigInt('0x' + amountResult.results[0].returnValues[0][0]);
                        const currentAmountSui = Number(currentAmountMist) / 1_000_000_000;
                        
                        stakeInfo.amount = currentAmountSui; // Update with current amount
                        stakeInfo.isActive = true;
                        totalActiveSui += currentAmountSui;
                        activeStakes++;
                      }
                    }
                  } catch (error) {
                    console.warn(`Error checking stake ${stakeInfo.stakeId}:`, error);
                    // Keep the stake info but mark as inactive
                    stakeInfo.isActive = false;
                  }
                });

                await Promise.all(checkPromises);
                
                console.log(`   Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allStakeInfo.length/batchSize)}`);

              } catch (batchError) {
                console.warn(`Error processing stake batch:`, batchError);
              }
            }

            console.log(`✅ Phase 2 complete: ${activeStakes} active stakes, ${totalActiveSui.toFixed(2)} SUI total`);
          }

          const result: WalletStakesData = {
            stakes: allStakeInfo,
            totalStakedSui: allStakeInfo.filter(s => s.isActive).reduce((sum, s) => sum + s.amount, 0),
            totalActiveStakes: allStakeInfo.filter(s => s.isActive).length,
            lastUpdated: Date.now(),
          };

          console.log(`🎯 Wallet Stakes Summary for ${targetWallet}:`, {
            totalStakes: result.stakes.length,
            activeStakes: result.totalActiveStakes,
            totalStakedSui: `${result.totalStakedSui.toFixed(4)} SUI`,
            lastUpdated: new Date(result.lastUpdated).toLocaleTimeString()
          });

          return result;
        },
        10000 // Cache for 10 seconds
      );

      setStakesData(result);
      return result;

    } catch (err: any) {
      console.error('❌ Failed to fetch wallet stakes:', err);
      setError(err.message || 'Failed to fetch wallet stakes');
      return { stakes: [], totalStakedSui: 0, totalActiveStakes: 0, lastUpdated: Date.now() };
    }
  }, [targetWallet, client]);

  /**
   * Force refresh of stakes data, bypassing cache
   */
  const refreshStakes = useCallback(async (): Promise<void> => {
    if (!targetWallet) return;

    const cacheKey = `wallet_stakes_${targetWallet}`;
    requestCache.delete(cacheKey);
    
    setIsLoading(true);
    setError(null);
    
    try {
      await fetchWalletStakes();
    } finally {
      setIsLoading(false);
    }
  }, [targetWallet, fetchWalletStakes]);

  /**
   * Get only active stakes (exist in staking manager)
   */
  const getActiveStakes = useCallback((): WalletStakeInfo[] => {
    return stakesData.stakes.filter(stake => stake.isActive);
  }, [stakesData.stakes]);

  // Auto-fetch when wallet changes
  useEffect(() => {
    if (targetWallet && client) {
      setIsLoading(true);
      setError(null);
      
      fetchWalletStakes().finally(() => {
        setIsLoading(false);
      });
    } else {
      setStakesData({ stakes: [], totalStakedSui: 0, totalActiveStakes: 0, lastUpdated: 0 });
    }
  }, [targetWallet, client, fetchWalletStakes]);

  return {
    stakesData,
    isLoading,
    error,
    refreshStakes,
    getActiveStakes,
    fetchWalletStakes, // Expose for direct use
  };
} 