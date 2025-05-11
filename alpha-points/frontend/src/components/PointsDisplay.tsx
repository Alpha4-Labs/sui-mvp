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

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();

  const EPOCHS_PER_YEAR = 365;
  const SUI_TO_MIST_CONVERSION = 1_000_000_000n;
  const APY_POINT_SCALING_FACTOR = 25n;
  const MS_PER_DAY = 86_400_000;

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
      return;
    }
    if (stakePositions.length === 0) {
        setTotalClaimablePoints(0n);
      return;
    }
    
    setLoadingClaimable(true);
    let accumulatedPoints = 0n;

    stakePositions.forEach((pos: StakePosition, index: number) => {
      if (!pos || typeof pos.lastClaimEpoch === 'undefined' || typeof pos.amount === 'undefined' || typeof pos.unlockTimeMs === 'undefined' || typeof pos.startTimeMs === 'undefined' || typeof pos.assetType === 'undefined') {
        return; 
      }
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

      const numeratorPart1 = principalMist * stakeApyBps;
      const numerator = numeratorPart1 * APY_POINT_SCALING_FACTOR;
      const denominator = SUI_TO_MIST_CONVERSION * BigInt(EPOCHS_PER_YEAR);

      const pointsPerEpoch = denominator > 0n ? numerator / denominator : 0n;
      const epochsPassed = currentEpoch - lastClaimEpochBigInt;
      
      if (epochsPassed > 0n) {
        const pointsToAdd = pointsPerEpoch * epochsPassed;
        accumulatedPoints += pointsToAdd;
      }
    });

    setTotalClaimablePoints(accumulatedPoints);
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
        if (!pos || typeof pos.lastClaimEpoch === 'undefined' || typeof pos.amount === 'undefined' || typeof pos.unlockTimeMs === 'undefined' || typeof pos.startTimeMs === 'undefined' || typeof pos.assetType === 'undefined') continue;
        
        const lastClaimEpochBigInt = BigInt(pos.lastClaimEpoch);
        if (currentEpoch && currentEpoch > lastClaimEpochBigInt) {
            const principalMist = BigInt(pos.amount);
            const durationMs = BigInt(pos.unlockTimeMs) - BigInt(pos.startTimeMs);
            const durationDays = durationMs > 0n ? Number(durationMs / BigInt(MS_PER_DAY)) : 0;
            const stakeApyBps = BigInt(getApyBpsForDurationDays(durationDays));

            if (stakeApyBps > 0n && principalMist > 0n) {
                const numeratorPart1 = principalMist * stakeApyBps;
                const numerator = numeratorPart1 * APY_POINT_SCALING_FACTOR;
                const denominator = SUI_TO_MIST_CONVERSION * BigInt(EPOCHS_PER_YEAR);
                const pointsPerEpoch = denominator > 0n ? numerator / denominator : 0n;
                const epochsPassed = currentEpoch - lastClaimEpochBigInt;
                if (pointsPerEpoch * epochsPassed > 0n) {
                    tx.moveCall({
                        target: `${PACKAGE_ID}::integration::claim_accrued_points`,
                        typeArguments: [pos.assetType || SUI_TYPE],
                        arguments: [
                            tx.object(SHARED_OBJECTS.config),
                            tx.object(pos.id),
                            tx.object(SHARED_OBJECTS.ledger),
                            tx.object(CLOCK_ID),
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
      
      await signAndExecute({ transaction: tx.serialize() }, { onSuccess: () => refreshData() });
    } catch (error) {
      console.error('Error claiming points:', error);
    } finally {
      setTransactionLoading(false);
    }
  };

  if (loading.points || loadingClaimable) {
    return (
      <div className="bg-background-card rounded-lg p-6 shadow-lg animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-1/2 mb-6"></div>
        <div className="h-6 bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-8 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-background-card rounded-lg pt-6 pr-6 pl-6 pb-3 shadow-lg">
      {/* Header Section - Title and Timer on one line */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Alpha Points Balance</h2>
        <div className="text-xs text-gray-400 tabular-nums">
           Next Epoch In: <span className="font-medium text-gray-300">{timeLeft}</span>
        </div>
      </div>
      
      {/* New Single-Line: [Balance Number] | [+Accrued Number] | [Claim All] */}
      <div className="bg-background/50 rounded-lg p-1 flex items-baseline justify-between mb-1">
        {/* Available Points Number */}
        <span className="text-3xl font-bold text-secondary">
          {formatPoints(points.available)}
        </span>
        
        {/* Accrued Points Number (with +) - Conditionally Rendered */}
        {totalClaimablePoints > 0n && (
          <span className="text-yellow-400 text-xl font-semibold">
            +{formatPoints(totalClaimablePoints.toString())}
          </span>
        )}
        
        {/* Claim Button */}
        <button 
          onClick={handleClaim}
          disabled={!currentAccount || !currentAccount.address || totalClaimablePoints === 0n || loading.transaction || loadingClaimable}
          className="bg-yellow-500 hover:bg-yellow-600 text-white py-0.5 px-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
        >
          {loading.transaction ? 'Claiming...' : 'Claim All'}
        </button>
      </div>

      {/* Locked Points Display (if any, shown below the main line) */}
      {points.locked > 0 && (
        <div className="text-right">
          <div className="text-lg font-bold text-yellow-500">
            {formatPoints(points.locked)}
          </div>
          <div className="text-xs text-gray-400">
            Locked (Loans)
          </div>
        </div>
      )}
    </div>
  );
};