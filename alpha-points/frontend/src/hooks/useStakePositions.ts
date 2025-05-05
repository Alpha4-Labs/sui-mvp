import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

import { StakePosition } from '../types';
import { PACKAGE_ID, SUI_TYPE } from '../config/contract';

/**
 * Hook for fetching and managing user's stake positions using timestamps
 */
export const useStakePositions = () => {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();

  // State management
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<StakePosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState<number | null>(null);
  const [currentEpochStartMs, setCurrentEpochStartMs] = useState<number | null>(null);

  // Helper to fetch the current epoch info (if still needed elsewhere)
  const fetchCurrentEpochInfo = useCallback(async () => {
    try {
      const systemState = await client.getLatestSuiSystemState();
      if (systemState && systemState.epoch && systemState.epochStartTimestampMs) {
        const epochNum = parseInt(systemState.epoch, 10);
        const epochStartNum = parseInt(systemState.epochStartTimestampMs, 10);
        if (!isNaN(epochNum) && !isNaN(epochStartNum)) {
          setCurrentEpoch(epochNum);
          setCurrentEpochStartMs(epochStartNum);
          console.log('Current epoch info fetched:', epochNum, 'Start MS:', epochStartNum);
        } else {
           console.error('Error parsing epoch or start timestamp', systemState);
        }
      }
    } catch (err) {
      console.error('Error fetching current epoch info:', err);
    }
  }, [client]);

  // Main fetch function
  const fetchPositions = useCallback(async () => {
    if (!currentAccount?.address) {
      setPositions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch current time for maturity calculation *now*
      // We don't strictly need epoch info *for maturity* anymore, but fetch it just in case
      await fetchCurrentEpochInfo();
      const currentTimeMs = Date.now(); // Use local time as proxy for clock time for calculation

      // Query owned objects of type StakePosition
      const response = await client.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${PACKAGE_ID}::stake_position::StakePosition<${SUI_TYPE}>`,
        },
        options: {
          showContent: true, // Request content to get fields
        },
      });

      console.log('Fetched stake positions, count:', response.data.length);

      // Process response
      const stakePositions = response.data
        .map(obj => {
          const content = obj.data?.content;

          if (content?.dataType === 'moveObject') {
            const moveStructFields = content.fields as Record<string, any>;
            if (!moveStructFields) return null; // Skip missing fields

            // ADD LOGGING HERE:
            console.log(`Raw fields for ${obj.data?.objectId}:`, JSON.stringify(moveStructFields));
            const unlockTimeMsStr = moveStructFields.unlock_time_ms || '0';
            console.log(`Raw unlockTimeMsStr: ${unlockTimeMsStr}`);

            // Access timestamp fields
            const startTimeMsStr = moveStructFields.start_time_ms || '0';
            const durationDaysStr = moveStructFields.duration_days || '0';

            // Parse numeric values
            const startTimeMs = parseInt(startTimeMsStr, 10);
            const unlockTimeMs = parseInt(unlockTimeMsStr, 10);
            const durationDays = parseInt(durationDaysStr, 10);

            // Validate all parsed numbers
            if (isNaN(startTimeMs) || isNaN(unlockTimeMs) || isNaN(durationDays)) {
              console.warn(`Invalid time/duration/unlock data for StakePosition ${obj.data?.objectId}: start=${startTimeMsStr}, unlock=${unlockTimeMsStr}, duration=${durationDaysStr}`);
              return null; // Skip invalid data
            }

            // Calculate maturity percentage based on time
            let maturityPercentage = 0;
            const durationMs = durationDays * 24 * 60 * 60 * 1000;
            if (durationMs > 0) {
              const elapsedMs = Math.max(0, currentTimeMs - startTimeMs);
              maturityPercentage = Math.min(100, Math.max(0, Math.floor((elapsedMs / durationMs) * 100)));
            } else if (currentTimeMs >= unlockTimeMs) {
                // Fallback if duration somehow 0 but unlock time passed
                maturityPercentage = 100;
            }

            // Unlock date is directly from the object field
            const calculatedUnlockDateISO: string | null = new Date(unlockTimeMs).toISOString();

            // Construct the updated StakePosition object
            // Ensure your ../types.ts definition matches these fields
            const positionData: StakePosition = {
              id: obj.data?.objectId || '',
              owner: moveStructFields.owner || currentAccount.address,
              principal: moveStructFields.principal || '0',
              startTimeMs: startTimeMsStr,      // Keep as string from source
              unlockTimeMs: unlockTimeMsStr,    // Keep as string from source
              durationDays: durationDaysStr,    // Keep as string from source
              encumbered: moveStructFields.encumbered || false,
              maturityPercentage,
              calculatedUnlockDate: calculatedUnlockDateISO // Use the direct unlock time
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
  }, [client, currentAccount?.address, fetchCurrentEpochInfo]);

  // Initialize data and set up polling
  useEffect(() => {
    if (currentAccount?.address) {
      fetchPositions(); // Fetch immediately on account change
    } else {
      setPositions([]);
    }

    const interval = setInterval(() => {
      if (currentAccount?.address) {
        fetchPositions();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [currentAccount?.address, fetchPositions]); // fetchPositions is now stable

  // Return positions, loading state, error state, and refetch function
  return { positions, loading, error, refetch: fetchPositions, currentEpoch }; // Still return currentEpoch if needed elsewhere
};

// --- IMPORTANT ---
// You MUST also update your `StakePosition` type definition in `src/types.ts`
// to match the new fields used here (startTimeMs, unlockTimeMs, durationDays).
// Example structure:
/*
export interface StakePosition {
  id: string;
  owner: string;
  principal: string;
  startTimeMs: string;    // Store as string from source
  unlockTimeMs: string;   // Store as string from source
  durationDays: string;   // Store as string from source
  encumbered: boolean;
  maturityPercentage: number;
  calculatedUnlockDate: string | null; // Holds ISO string derived from unlockTimeMs
}
*/