import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints } from '../utils/format';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SuiSystemStateSummary } from '@mysten/sui/client';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';
import { StakePosition } from '../types';

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

  useEffect(() => {
    suiClient.getLatestSuiSystemState().then((state: SuiSystemStateSummary) => setCurrentEpoch(BigInt(state.epoch)));
  }, [suiClient]);

  useEffect(() => {
    if (!currentEpoch || loading.positions || !stakePositions || stakePositions.length === 0) {
      setTotalClaimablePoints(0n);
      return;
    }
    setLoadingClaimable(true);
    let accumulatedPoints = 0n;

    stakePositions.forEach((pos: StakePosition) => {
      if (!pos || typeof pos.lastClaimEpoch === 'undefined' || typeof pos.amount === 'undefined' || typeof pos.unlockTimeMs === 'undefined' || typeof pos.startTimeMs === 'undefined' || typeof pos.assetType === 'undefined') {
        console.warn('Stake position object is missing required fields', pos);
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

      if (stakeApyBps === 0n) return;

      const numeratorPart1 = principalMist * stakeApyBps;
      const numerator = numeratorPart1 * APY_POINT_SCALING_FACTOR;
      const denominator = SUI_TO_MIST_CONVERSION * BigInt(EPOCHS_PER_YEAR);

      const pointsPerEpoch = denominator > 0n ? numerator / denominator : 0n;
      
      const epochsPassed = currentEpoch - lastClaimEpochBigInt;
      if (epochsPassed > 0n) {
        accumulatedPoints += pointsPerEpoch * epochsPassed;
      }
    });

    setTotalClaimablePoints(accumulatedPoints);
    setLoadingClaimable(false);
  }, [currentEpoch, stakePositions, loading.positions]);

  const handleClaim = async () => {
    if (!currentAccount || !currentAccount.address || totalClaimablePoints === 0n || !stakePositions || stakePositions.length === 0) {
      console.error("Cannot claim: No account, no claimable points, or no stake positions.");
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
        console.log("No claims to add to transaction.");
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
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold text-white">Alpha Points Balance</h2>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-4xl font-bold text-secondary mb-1">
            {formatPoints(points.available)}
          </div>
          <div className="text-sm text-gray-400">
            Available Alpha Points
          </div>
        </div>
        
        {points.locked > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-yellow-500 mb-1">
              {formatPoints(points.locked)}
            </div>
            <div className="text-sm text-gray-400">
              Locked (Loans)
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 bg-background/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-yellow-400 text-xl font-semibold">
              +{formatPoints(totalClaimablePoints.toString())} Accrued
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Estimated claimable from your stakes
            </div>
          </div>
          
          <button 
            onClick={handleClaim}
            disabled={!currentAccount || !currentAccount.address || totalClaimablePoints === 0n || loading.transaction || loadingClaimable}
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
          >
            {loading.transaction ? 'Claiming...' : 'Claim All'}
          </button>
        </div>
      </div>

      {!loading.points && points.total === 0 && (
        <div className="text-center text-gray-500 text-sm py-4">
          No Alpha Points balance found.
        </div>
      )}
    </div>
  );
};