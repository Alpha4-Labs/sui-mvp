import { useCallback, useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';

import { StakePosition, DurationOption } from '../types';
import { PACKAGE_ID } from '../config/contract';

// Define the explicit type argument for native StakedSui
const NATIVE_STAKED_SUI_TYPE_ARG = '0x3::staking_pool::StakedSui';

// Replicate or import DEFAULT_DURATIONS to look up APY
// For simplicity, replicating here. Ideally, this would be a shared constant.
const DEFAULT_DURATIONS_FOR_APY_LOOKUP: DurationOption[] = [
  { days: 7, label: '7 days', apy: 5.0 },
  { days: 14, label: '14 days', apy: 7.5 },
  { days: 30, label: '30 days', apy: 10.0 },
  { days: 90, label: '90 days', apy: 15.0 },
  { days: 180, label: '180 days', apy: 20.0 },
  { days: 365, label: '365 days', apy: 25.0 },
];

/**
 * Hook for fetching and managing user's stake positions using timestamps
 */
export const useStakePositions = () => {
  const client = useSuiClient();

  // State management
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<StakePosition[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Main fetch function - accepts userAddress
  const fetchPositions = useCallback(async (userAddress: string | undefined) => {
    if (!userAddress) {
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentTimeMs = Date.now(); 

      // console.log(`Fetching stake positions for ${userAddress} with type ${NATIVE_STAKED_SUI_TYPE_ARG}`);
      const response = await client.getOwnedObjects({
        owner: userAddress, // Use provided userAddress
        filter: {
          StructType: `${PACKAGE_ID}::stake_position::StakePosition<${NATIVE_STAKED_SUI_TYPE_ARG}>`,
        },
        options: {
          showContent: true,
        },
      });

      // console.log('Fetched stake positions, count:', response.data.length);

      const stakePositions = response.data
        .map(obj => {
          const content = obj.data?.content;

          if (content?.dataType === 'moveObject') {
            const moveStructFields = content.fields as Record<string, any>;
            if (!moveStructFields) return null;

            // Read fields directly from the StakePosition NFT
            const principalStr = moveStructFields.amount || '0'; // 'amount' field from Move struct
            const unlockTimeMsStr = moveStructFields.unlock_time_ms || '0';
            const startTimeMsStr = moveStructFields.start_time_ms || '0';
            // duration_days is not a direct field, it's derived. We'll use start/unlock times.
            const stakedSuiObjectId = moveStructFields.staked_sui_id || null; // Get the StakedSui object ID

            const startTimeMs = parseInt(startTimeMsStr, 10);
            const unlockTimeMs = parseInt(unlockTimeMsStr, 10);
            const principal = BigInt(principalStr).toString(); // Keep as string for consistency

            if (isNaN(startTimeMs) || isNaN(unlockTimeMs)) {
              console.warn(`Invalid time/duration/unlock data for StakePosition ${obj.data?.objectId}`);
              return null;
            }
            
            const durationMs = unlockTimeMs - startTimeMs;
            const durationDays = durationMs > 0 ? Math.floor(durationMs / (24 * 60 * 60 * 1000)) : 0;

            // Find APY from the durations config
            const matchedDurationOption = DEFAULT_DURATIONS_FOR_APY_LOOKUP.find(d => d.days === durationDays);
            const apy = matchedDurationOption ? matchedDurationOption.apy : 0; // Default to 0 if no match

            let maturityPercentage = 0;
            if (durationMs > 0) {
              const elapsedMs = Math.max(0, currentTimeMs - startTimeMs);
              maturityPercentage = Math.min(100, Math.max(0, Math.floor((elapsedMs / durationMs) * 100)));
            } else if (currentTimeMs >= unlockTimeMs) {
                maturityPercentage = 100;
            }

            const calculatedUnlockDateISO: string | null = new Date(unlockTimeMs).toISOString();

            const positionData: StakePosition = {
              id: obj.data?.objectId || '',
              owner: typeof moveStructFields.owner === 'string' ? moveStructFields.owner : userAddress,
              principal: principal, 
              amount: principal, // Map 'amount' from Move to both principal and amount for TS type
              startTimeMs: String(startTimeMsStr),
              unlockTimeMs: String(unlockTimeMsStr),
              durationDays: String(durationDays), // Calculated duration
              apy: apy, // Set the APY
              encumbered: typeof moveStructFields.encumbered === 'boolean' ? moveStructFields.encumbered : false,
              maturityPercentage,
              calculatedUnlockDate: calculatedUnlockDateISO,
              lastClaimEpoch: typeof moveStructFields.last_claim_epoch === 'string' ? moveStructFields.last_claim_epoch : '0',
              assetType: NATIVE_STAKED_SUI_TYPE_ARG, // Reflect the actual type argument
              // Fields like startEpoch, unlockEpoch, durationEpochs are not on StakePosition<StakedSui>
              // and were likely from an older design. They should be removed or re-evaluated if needed.
              // For now, providing defaults or null based on the type definition.
              startEpoch: typeof moveStructFields.start_epoch === 'string' ? moveStructFields.start_epoch : '0', // Or derive from startTimeMs if meaningful
              unlockEpoch: typeof moveStructFields.unlock_epoch === 'string' ? moveStructFields.unlock_epoch : '0', // Or derive from unlockTimeMs
              durationEpochs: '0', // This was specific to epoch-based staking
              // Add staked_sui_id to the processed data if needed by UI, though not directly in StakePosition type yet
              // nativeStakeObjectId: stakedSuiObjectId 
            };
            return positionData;
          }
          return null;
        })
        .filter((pos): pos is StakePosition => pos !== null);

      setPositions(stakePositions);
    } catch (error: any) {
      console.error('Error fetching stake positions:', error);
      setError(error.message || 'Failed to fetch stake positions');
    } finally {
      setLoading(false);
    }
  }, [client]);

  return { positions, loading, error, refetch: fetchPositions };
};

// --- IMPORTANT ---
// You MUST also update your `StakePosition` type definition in `src/types/index.ts`
// to match the new fields used here (startTimeMs, unlockTimeMs, durationDays).
// Example structure:
/*
export interface StakePosition {
  id: string;
  owner: string;
  principal: string;
  amount: string;
  startTimeMs: string;    // Store as string from source
  unlockTimeMs: string;   // Store as string from source
  durationDays: string;   // Store as string from source
  encumbered: boolean;
  maturityPercentage: number;
  calculatedUnlockDate: string | null; // Holds ISO string derived from unlockTimeMs
  lastClaimEpoch: string;
  assetType: string;
  startEpoch: string;
  unlockEpoch: string;
  durationEpochs: string;
}
*/