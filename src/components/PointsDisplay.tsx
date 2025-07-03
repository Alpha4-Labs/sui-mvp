import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints } from '../utils/format';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SuiSystemStateSummary } from '@mysten/sui/client';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';
import { StakePosition } from '../types';
import { useTransactionSuccess } from '../hooks/useTransactionSuccess';

// Helper to format time remaining
function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "Epoch changing...";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const PointsDisplay: React.FC = () => {
  const { 
    points, 
    loading, 
    stakePositions,
    refreshData,
    setTransactionLoading
  } = useAlphaContext();

  const [totalClaimablePoints, setTotalClaimablePoints] = useState(0n);
  const [loadingClaimable, setLoadingClaimable] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState<bigint | null>(null);
  const [nextEpochTime, setNextEpochTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");
  const [debugInfo, setDebugInfo] = useState<string>("");

  const { registerRefreshCallback, signAndExecute } = useTransactionSuccess();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();

  // Register refresh callback for this component
  useEffect(() => {
    const cleanup = registerRefreshCallback(async () => {
      // Refresh both context data and local accrued points calculation
      await refreshData();
      // Re-fetch accrued points after context refresh
      if (currentEpoch && stakePositions && currentAccount) {
        fetchAccruedPoints();
      }
    });

    return cleanup; // Cleanup on unmount
  }, [registerRefreshCallback, refreshData, currentEpoch, stakePositions, currentAccount]);

  // Fetch system state for epoch info
    const fetchSystemState = async () => {
      try {
        const state: SuiSystemStateSummary = await suiClient.getLatestSuiSystemState();
          const epoch = BigInt(state.epoch);
          const startMs = BigInt(state.epochStartTimestampMs);
          const durationMs = BigInt(state.epochDurationMs);
      let nextEpochStartMs = Number(startMs + durationMs);
      
      // If the calculated next epoch time is in the past (stale RPC data),
      // calculate the correct next epoch time based on 24-hour cycles
      const now = Date.now();
      if (nextEpochStartMs <= now) {
        const epochDuration = Number(durationMs); // Should be ~24 hours
        const epochsPassed = Math.ceil((now - nextEpochStartMs) / epochDuration);
        nextEpochStartMs = nextEpochStartMs + (epochsPassed * epochDuration);
      }
          
          setCurrentEpoch(epoch);
          setNextEpochTime(nextEpochStartMs);
      } catch (error) {
        console.error("[PointsDisplay] Error fetching Sui system state:", error);
          setTimeLeft("Error fetching epoch time");
      }
    };

  useEffect(() => {
    fetchSystemState();
  }, [suiClient]);

  // Update countdown timer
  useEffect(() => {
    if (nextEpochTime === null) {
      setTimeLeft("Calculating...");
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remainingMs = nextEpochTime - now;
      setTimeLeft(formatTimeLeft(remainingMs));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [nextEpochTime]);

  // Helper function to properly decode u64 from BCS bytes
  const decodeU64 = (bytesInput: Array<number> | Uint8Array | unknown): number => {
    let bytes: Uint8Array;
    
    if (Array.isArray(bytesInput)) {
      bytes = new Uint8Array(bytesInput);
    } else if (bytesInput instanceof Uint8Array) {
      bytes = bytesInput;
    } else {
      console.error('Invalid bytes input for u64 decoding:', bytesInput);
      return 0;
    }
    
    if (bytes.length !== 8) {
      console.error(`Invalid byte length for u64: expected 8, got ${bytes.length}`);
      return 0;
    }
    
    try {
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const valueBigInt = dataView.getBigUint64(0, true); // true for little-endian
      
      const valueNumber = Number(valueBigInt);
      
      if (valueBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        console.warn(
          `Potential precision loss converting u64 value ${valueBigInt} to JavaScript number. ` +
          `Consider using BigInt for large values.`
        );
      }
      
      return valueNumber;
    } catch (err) {
      console.error('Error decoding u64 value:', err);
      return 0;
    }
  };

  // Extract accrued points fetching into separate function for reuse
  const fetchAccruedPoints = async () => {
    if (!currentEpoch || !stakePositions || !currentAccount) {
      setTotalClaimablePoints(0n);
      setDebugInfo("Waiting for epoch or position data...");
      return;
    }
    
    if (stakePositions.length === 0) {
      setTotalClaimablePoints(0n);
      setDebugInfo("No stake positions found");
      return;
    }
    
    setLoadingClaimable(true);
    
    try {
      let accumulatedPoints = 0;
      let positionsProcessed = 0;
      let positionsWithClaimable = 0;
      let errors = 0;

      // Query accrued points for each position using the chain's view function
      const promises = stakePositions.map(async (pos: StakePosition) => {
        if (!pos || typeof pos.lastClaimEpoch === 'undefined' || !pos.id) {
          return { points: 0, error: 'Invalid position data' };
        }
        
        try {
          const tx = new Transaction();
          tx.moveCall({
            target: `${PACKAGE_ID}::integration::view_accrued_points_for_stake`,
            arguments: [
              tx.object(pos.id),
              tx.pure.u64(Number(currentEpoch))
            ],
            typeArguments: [pos.assetType || SUI_TYPE],
          });

          const devInspectResult = await suiClient.devInspectTransactionBlock({
            sender: currentAccount.address,
            transactionBlock: tx,
          });

          if (devInspectResult.results?.[0]?.returnValues?.[0]) {
            const [returnValue] = devInspectResult.results[0].returnValues[0];
            // Use proper BCS decoding to read the contract value
            const contractPoints = decodeU64(returnValue);
            
            // Contract has a 223x multiplier bug - divide by 223 to get economically correct amount
            const economicallyCorrectPoints = Math.round(contractPoints / 223);
            
            return { points: economicallyCorrectPoints, error: null };
          } else {
            return { points: 0, error: 'No return value' };
          }
        } catch (error) {
          console.error(`Error fetching accrued points for position ${pos.id}:`, error);
          return { points: 0, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        positionsProcessed++;
        if (result.error) {
          errors++;
        } else if (result.points > 0) {
          accumulatedPoints += result.points;
          positionsWithClaimable++;
        }
      });

      setTotalClaimablePoints(BigInt(accumulatedPoints));
      setDebugInfo(`${positionsProcessed} positions, ${positionsWithClaimable} with rewards${errors > 0 ? `, ${errors} errors` : ''}`);
    } catch (error) {
      console.error("[PointsDisplay] Error fetching accrued points:", error);
      setDebugInfo(`Error fetching accrued points: ${error.message}`);
      setTotalClaimablePoints(0n);
    } finally {
      setLoadingClaimable(false);
    }
  };

  // Calculate Claimable Points using actual chain data
  useEffect(() => {
    fetchAccruedPoints();
  }, [currentEpoch, stakePositions, loading.positions, currentAccount, suiClient]);

  const handleClaim = async () => {
    if (!currentAccount || !currentAccount.address || totalClaimablePoints === 0n || !stakePositions || stakePositions.length === 0) {
      return;
    }

    setTransactionLoading(true);
    try {
      const tx = new Transaction();
      let claimsAdded = 0;

      // Only add claims for positions that actually have claimable points
      for (const pos of stakePositions as StakePosition[]) {
        if (!pos || typeof pos.lastClaimEpoch === 'undefined' || !pos.id || typeof pos.assetType === 'undefined') {
          console.warn("Skipping position due to missing data:", pos);
          continue;
        }
        
        const lastClaimEpochBigInt = BigInt(pos.lastClaimEpoch);
        if (currentEpoch && currentEpoch > lastClaimEpochBigInt) {
          // Check if this position actually has claimable points by querying the chain
          try {
            const checkTx = new Transaction();
            checkTx.moveCall({
              target: `${PACKAGE_ID}::integration::view_accrued_points_for_stake`,
              arguments: [
                checkTx.object(pos.id),
                checkTx.pure.u64(Number(currentEpoch))
              ],
              typeArguments: [pos.assetType],
            });

            const devInspectResult = await suiClient.devInspectTransactionBlock({
              sender: currentAccount.address,
              transactionBlock: checkTx,
            });

            if (devInspectResult.results?.[0]?.returnValues?.[0]) {
              const [returnValue] = devInspectResult.results[0].returnValues[0];
              // Use proper BCS decoding to read the contract value
              const contractPoints = decodeU64(returnValue);
              
              // Contract has a 223x multiplier bug - divide by 223 to get economically correct amount
              const economicallyCorrectPoints = Math.round(contractPoints / 223);
              
              if (economicallyCorrectPoints > 0) {
                tx.moveCall({
                  target: `${PACKAGE_ID}::integration::claim_accrued_points`,
                  typeArguments: [pos.assetType],
                  arguments: [
                    tx.object(SHARED_OBJECTS.config), 
                    tx.object(SHARED_OBJECTS.ledger), 
                    tx.object(pos.id),                
                    tx.object(CLOCK_ID)             
                  ],
                });
                claimsAdded++;
              }
            }
          } catch (error) {
            console.warn(`Error checking accrued points for position ${pos.id}:`, error);
            // Still try to claim in case the check failed but points exist
            tx.moveCall({
              target: `${PACKAGE_ID}::integration::claim_accrued_points`,
              typeArguments: [pos.assetType],
              arguments: [
                tx.object(SHARED_OBJECTS.config), 
                tx.object(SHARED_OBJECTS.ledger), 
                tx.object(pos.id),                
                tx.object(CLOCK_ID)             
              ],
            });
            claimsAdded++;
          }
        }
      }

      if (claimsAdded === 0) {
        console.log("No claimable positions found");
        setTransactionLoading(false);
        return;
      }

      // Use the transaction success hook - this will automatically refresh the component
      await signAndExecute(tx);
    } catch (error) {
      console.error('Error claiming points:', error);
    } finally {
      setTransactionLoading(false);
    }
  };

  if (loading.points || loadingClaimable) {
    return (
      <div className="card-modern p-6 animate-pulse">
        <div className="h-6 bg-gray-700/50 rounded-lg w-3/4 mb-4"></div>
        <div className="h-10 bg-gray-700/50 rounded-lg w-1/2 mb-6"></div>
        <div className="h-4 bg-gray-700/30 rounded w-full mb-2"></div>
        <div className="h-8 bg-gray-700/30 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="card-modern p-4 animate-fade-in">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Alpha Points</h3>
            <p className="text-xs text-gray-400">Available balance</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <div className="status-indicator-active"></div>
            <span>Next Epoch: {timeLeft}</span>
          </div>
        </div>
      </div>
      
      {/* Main Balance Display */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between">
          {/* Left: Available Points */}
          <div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatPoints(points.available)}
            </div>
            <div className="text-xs text-green-400">
              ≈ ${(points.available / 1000).toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })} USD
            </div>
          </div>
          
          {/* Center: Accrued Rewards - Always Show */}
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
              totalClaimablePoints > 0n 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-gray-500/5'
            }`}>
              <div className={`w-4 h-4 rounded flex items-center justify-center ${
                totalClaimablePoints > 0n 
                  ? 'bg-green-500/20' 
                  : 'bg-gray-500/20'
              }`}>
                <svg className={`w-2 h-2 ${
                  totalClaimablePoints > 0n 
                    ? 'text-green-400' 
                    : 'text-gray-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="text-center">
                <div className={`text-sm font-semibold ${
                  totalClaimablePoints > 0n 
                    ? 'text-green-400' 
                    : 'text-gray-400'
                }`}>
                  +{formatPoints(totalClaimablePoints?.toString() || '0')}
                </div>
                <div className="text-xs text-gray-500">Accrued</div>
              </div>
            </div>
          </div>
          
          {/* Right: Claim Button */}
          <button 
            onClick={handleClaim}
            disabled={!currentAccount || !currentAccount.address || totalClaimablePoints === 0n || loading.transaction || loadingClaimable}
            className={`btn-modern-primary text-sm ${totalClaimablePoints === 0n ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading.transaction ? (
              <div className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Claiming...</span>
              </div>
            ) : (
              'Claim All'
            )}
          </button>
        </div>
      </div>



      {/* Locked Points Display (if any) */}
      {points.locked > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-amber-500/20 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-medium text-amber-300">Locked Points</div>
                <div className="text-xs text-amber-400/70">Used as loan collateral</div>
              </div>
            </div>
            <div className="text-base font-bold text-amber-300">
              {formatPoints(points.locked)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};