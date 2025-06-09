import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints } from '../utils/format';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SuiSystemStateSummary } from '@mysten/sui/client';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';
import { StakePosition } from '../types';

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

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();

  const EPOCHS_PER_YEAR = 365;
  const SUI_TO_MIST_CONVERSION = 1_000_000_000n;
  const MS_PER_DAY = 86_400_000;
  const SUI_PRICE_USD = 3.28;
  const ALPHA_POINTS_PER_USD = 1000;

  function getApyBpsForDurationDays(durationDays: number): number {
    if (durationDays === 7) return 500;
    if (durationDays === 14) return 750;
    if (durationDays === 30) return 1000;
    if (durationDays === 90) return 1500;
    if (durationDays === 180) return 2000;
    if (durationDays === 365) return 2500;
    return 0; 
  }

  // Fetch system state for epoch info
  useEffect(() => {
    let isMounted = true;
    const fetchSystemState = async () => {
      try {
        const state: SuiSystemStateSummary = await suiClient.getLatestSuiSystemState();
        if (isMounted) {
          const epoch = BigInt(state.epoch);
          const startMs = BigInt(state.epochStartTimestampMs);
          const durationMs = BigInt(state.epochDurationMs);
          const nextEpochStartMs = Number(startMs + durationMs);
          
          setCurrentEpoch(epoch);
          setNextEpochTime(nextEpochStartMs);
        }
      } catch (error) {
        console.error("[PointsDisplay] Error fetching Sui system state:", error);
        if (isMounted) {
          setTimeLeft("Error fetching epoch time");
        }
      }
    };

    fetchSystemState();
    return () => { isMounted = false; };
  }, [suiClient]);

  // Update countdown timer
  useEffect(() => {
    if (nextEpochTime === null) {
      setTimeLeft("Waiting for epoch data...");
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remainingMs = nextEpochTime - now;
      setTimeLeft(formatTimeLeft(remainingMs));

      if (remainingMs <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [nextEpochTime]);

  // Calculate Claimable Points
  useEffect(() => {
    if (!currentEpoch || loading.positions || !stakePositions) { 
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
    let accumulatedPoints = 0n;
    let positionsProcessed = 0;
    let positionsWithClaimable = 0;

    stakePositions.forEach((pos: StakePosition, index: number) => {
      if (!pos || typeof pos.lastClaimEpoch === 'undefined' || typeof pos.amount === 'undefined' || typeof pos.unlockTimeMs === 'undefined' || typeof pos.startTimeMs === 'undefined') {
        return; 
      }
      
      positionsProcessed++;
      const lastClaimEpochBigInt = BigInt(pos.lastClaimEpoch);
      
      if (currentEpoch <= lastClaimEpochBigInt) {
        return; 
      }

      const principalMist = BigInt(pos.amount);
      const durationMs = BigInt(pos.unlockTimeMs) - BigInt(pos.startTimeMs);
      const durationDays = durationMs > 0n ? Number(durationMs / BigInt(MS_PER_DAY)) : 0;
      const stakeApyBps = BigInt(getApyBpsForDurationDays(durationDays));

      if (stakeApyBps === 0n) {
        return;
      }

      // FIXED: Correct calculation using 1:1000 USD ratio
      const principalSui = principalMist; // Keep in MIST for precision
      const alphaPointsPerSui = BigInt(Math.floor(SUI_PRICE_USD * ALPHA_POINTS_PER_USD)); // 3,280 AP per SUI
      const annualPoints = (principalSui * alphaPointsPerSui * stakeApyBps) / (SUI_TO_MIST_CONVERSION * 10000n); // 10000 = 100 * 100 (bps conversion)
      const pointsPerEpoch = annualPoints / BigInt(EPOCHS_PER_YEAR);
      const epochsPassed = currentEpoch - lastClaimEpochBigInt;
      
      if (epochsPassed > 0n && pointsPerEpoch > 0n) {
        const pointsToAdd = pointsPerEpoch * epochsPassed;
        accumulatedPoints += pointsToAdd;
        positionsWithClaimable++;
      }
    });

    setTotalClaimablePoints(accumulatedPoints);
    setDebugInfo(`${positionsProcessed} positions, ${positionsWithClaimable} with rewards`);
    setLoadingClaimable(false);
  }, [currentEpoch, stakePositions, loading.positions]);

  const handleClaim = async () => {
    if (!currentAccount || !currentAccount.address || totalClaimablePoints === 0n || !stakePositions || stakePositions.length === 0) {
      return;
    }

    setTransactionLoading(true);
    try {
      const tx = new Transaction();
      let claimsAdded = 0;

      for (const pos of stakePositions as StakePosition[]) {
        if (!pos || typeof pos.lastClaimEpoch === 'undefined' || typeof pos.amount === 'undefined' || typeof pos.unlockTimeMs === 'undefined' || typeof pos.startTimeMs === 'undefined' || typeof pos.assetType === 'undefined') {
          console.warn("Skipping position due to missing data:", pos);
          continue;
        }
        
        const lastClaimEpochBigInt = BigInt(pos.lastClaimEpoch);
        if (currentEpoch && currentEpoch > lastClaimEpochBigInt) {
            const principalMist = BigInt(pos.amount);
            const durationMs = BigInt(pos.unlockTimeMs) - BigInt(pos.startTimeMs);
            const durationDays = durationMs > 0n ? Number(durationMs / BigInt(MS_PER_DAY)) : 0;
            const stakeApyBps = BigInt(getApyBpsForDurationDays(durationDays));

            if (stakeApyBps > 0n && principalMist > 0n) {
                // FIXED: Use same corrected calculation as above
                const principalSui = principalMist; // Keep in MIST for precision
                const alphaPointsPerSui = BigInt(Math.floor(SUI_PRICE_USD * ALPHA_POINTS_PER_USD)); // 3,280 AP per SUI
                const annualPoints = (principalSui * alphaPointsPerSui * stakeApyBps) / (SUI_TO_MIST_CONVERSION * 10000n); // 10000 = 100 * 100 (bps conversion)
                const pointsPerEpoch = annualPoints / BigInt(EPOCHS_PER_YEAR);
                const epochsPassed = currentEpoch - lastClaimEpochBigInt;
                if (pointsPerEpoch * epochsPassed > 0n) {
                    tx.moveCall({
                        target: `${PACKAGE_ID}::integration::claim_accrued_points`,
                        typeArguments: [pos.assetType || SUI_TYPE],
                        arguments: [
                            tx.object(SHARED_OBJECTS.config), 
                            tx.object(SHARED_OBJECTS.ledger), 
                            tx.object(pos.id),                
                            tx.object(CLOCK_ID) // clock argument itself             
                        ],
                    });
                    claimsAdded++;
                }
            }
        }
      }

      if (claimsAdded === 0) {

        setTransactionLoading(false);
        return;
      }
      

      await signAndExecute({ transaction: tx }, { onSuccess: () => refreshData() });
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
            <div className="text-xs text-gray-400">Available αP</div>
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
                  +{formatPoints(totalClaimablePoints.toString())}
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