import { useCallback, useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';

import { StakePosition } from '../types';
import { PACKAGE_ID, SUI_TYPE } from '../config/contract';

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

      console.log(`Fetching stake positions for ${userAddress}`);
      const response = await client.getOwnedObjects({
        owner: userAddress, // Use provided userAddress
        filter: {
          StructType: `${PACKAGE_ID}::stake_position::StakePosition<${SUI_TYPE}>`,
        },
        options: {
          showContent: true,
        },
      });

      console.log('Fetched stake positions, count:', response.data.length);

      const stakePositions = response.data
        .map(obj => {
          const content = obj.data?.content;

          if (content?.dataType === 'moveObject') {
            const moveStructFields = content.fields as Record<string, any>;
            if (!moveStructFields) return null;

            const unlockTimeMsStr = moveStructFields.unlock_time_ms || '0';
            const startTimeMsStr = moveStructFields.start_time_ms || '0';
            const durationDaysStr = moveStructFields.duration_days || '0';

            const startTimeMs = parseInt(startTimeMsStr, 10);
            const unlockTimeMs = parseInt(unlockTimeMsStr, 10);
            const durationDays = parseInt(durationDaysStr, 10);

            if (isNaN(startTimeMs) || isNaN(unlockTimeMs) || isNaN(durationDays)) {
              console.warn(`Invalid time/duration/unlock data for StakePosition ${obj.data?.objectId}`);
              return null;
            }

            let maturityPercentage = 0;
            const durationMs = durationDays * 24 * 60 * 60 * 1000;
            if (durationMs > 0) {
              const elapsedMs = Math.max(0, currentTimeMs - startTimeMs);
              maturityPercentage = Math.min(100, Math.max(0, Math.floor((elapsedMs / durationMs) * 100)));
            } else if (currentTimeMs >= unlockTimeMs) {
                maturityPercentage = 100;
            }

            const calculatedUnlockDateISO: string | null = new Date(unlockTimeMs).toISOString();

            const positionData: StakePosition = {
              id: obj.data?.objectId || '',
              owner: typeof moveStructFields.owner === 'string' ? moveStructFields.owner : userAddress, // Use userAddress as fallback
              principal: typeof moveStructFields.principal === 'string' ? moveStructFields.principal : '0',
              amount: typeof moveStructFields.principal === 'string' ? moveStructFields.principal : '0',
              startTimeMs: String(startTimeMsStr),
              unlockTimeMs: String(unlockTimeMsStr),
              durationDays: String(durationDaysStr),
              encumbered: typeof moveStructFields.encumbered === 'boolean' ? moveStructFields.encumbered : false,
              maturityPercentage,
              calculatedUnlockDate: calculatedUnlockDateISO,
              lastClaimEpoch: typeof moveStructFields.last_claim_epoch === 'string' ? moveStructFields.last_claim_epoch : '0',
              assetType: SUI_TYPE,
              startEpoch: typeof moveStructFields.start_epoch === 'string' ? moveStructFields.start_epoch : '0',
              unlockEpoch: typeof moveStructFields.unlock_epoch === 'string' ? moveStructFields.unlock_epoch : '0',
              durationEpochs: typeof moveStructFields.duration_epochs === 'string' ? moveStructFields.duration_epochs : '0'
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