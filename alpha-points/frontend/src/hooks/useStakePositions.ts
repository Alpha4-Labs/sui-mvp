import { useCallback, useEffect, useState } from 'react';
import { 
    useSuiClient, 
    useCurrentAccount, 
    useCurrentWallet, 
    useSignAndExecuteTransaction
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID, SUI_SYSTEM_STATE_OBJECT_ID } from '@mysten/sui/utils';

import { StakePosition, DurationOption } from '../types';
import { ALL_PACKAGE_IDS } from '../config/contract';

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
export const useStakePositions = (autoLoad: boolean = false) => {
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { isConnected } = useCurrentWallet();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // State management
  const [loading, setLoading] = useState(false); // Start as false when not auto-loading
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
      let allOwnedObjectsData: any[] = [];

      // Query for stake positions from all known package IDs
      for (const pkgId of ALL_PACKAGE_IDS) {
        const response = await client.getOwnedObjects({
          owner: userAddress!,
          filter: {
            StructType: `${pkgId}::stake_position::StakePosition<${NATIVE_STAKED_SUI_TYPE_ARG}>`,
          },
          options: { showContent: true },
        });
        if (response.data) {
          allOwnedObjectsData = allOwnedObjectsData.concat(response.data);
        }
      }
      
      // De-duplicate based on objectId in case an object somehow matches both
      const uniqueObjectsData = Array.from(new Map(allOwnedObjectsData.map(obj => [obj.data?.objectId, obj])).values());

      const stakePositions = uniqueObjectsData
        .map(obj => {
          const content = obj.data?.content;

          if (content?.dataType === 'moveObject') {
            const moveStructFields = content.fields as Record<string, any>;
            if (!moveStructFields) return null;

            const principalStr = moveStructFields.amount || '0'; 
            const unlockTimeMsStr = moveStructFields.unlock_time_ms || '0';
            const startTimeMsStr = moveStructFields.start_time_ms || '0';
            const stakedSuiObjectId = moveStructFields.staked_sui_id || null; 

            const startTimeMs = parseInt(startTimeMsStr, 10);
            const unlockTimeMs = parseInt(unlockTimeMsStr, 10);
            const principal = BigInt(principalStr).toString(); 

            if (isNaN(startTimeMs) || isNaN(unlockTimeMs)) {
              console.warn(`Invalid time/duration/unlock data for StakePosition ${obj.data?.objectId}`);
              return null;
            }
            
            const durationMs = unlockTimeMs - startTimeMs;
            const durationDays = durationMs > 0 ? Math.floor(durationMs / (24 * 60 * 60 * 1000)) : 0;

            const matchedDurationOption = DEFAULT_DURATIONS_FOR_APY_LOOKUP.find(d => d.days === durationDays);
            const apy = matchedDurationOption ? matchedDurationOption.apy : 0; 

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
              amount: principal, 
              stakedSuiObjectId: stakedSuiObjectId,
              startTimeMs: String(startTimeMsStr),
              unlockTimeMs: String(unlockTimeMsStr),
              durationDays: String(durationDays), 
              apy: apy, 
              encumbered: typeof moveStructFields.encumbered === 'boolean' ? moveStructFields.encumbered : false,
              maturityPercentage,
              calculatedUnlockDate: calculatedUnlockDateISO,
              lastClaimEpoch: typeof moveStructFields.last_claim_epoch === 'string' ? moveStructFields.last_claim_epoch : '0',
              assetType: NATIVE_STAKED_SUI_TYPE_ARG, 
              startEpoch: typeof moveStructFields.start_epoch === 'string' ? moveStructFields.start_epoch : '0', 
              unlockEpoch: typeof moveStructFields.unlock_epoch === 'string' ? moveStructFields.unlock_epoch : '0', 
              durationEpochs: '0', 
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

  const liquidUnstakeAsLoanNativeSui = async (
    stakePositionId: string,
    configObjectId: string,
    loanConfigObjectId: string,
    ledgerObjectId: string,
    mintStatsObjectId: string,
    supplyOracleObjectId: string,
    stakingManagerObjectId: string
  ) => {
    if (!isConnected || !currentAccount) {
      console.error('Wallet not connected or account not available');
      alert('Wallet not connected. Please connect your wallet to proceed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const txb = new Transaction();

      txb.moveCall({
        target: `${PACKAGE_ID}::integration::liquid_unstake_as_loan_native_sui`,
        arguments: [
          txb.object(configObjectId),
          txb.object(loanConfigObjectId),
          txb.object(ledgerObjectId),
          txb.object(stakePositionId),
          txb.object(SUI_CLOCK_OBJECT_ID),
          txb.object(mintStatsObjectId),
          txb.object(supplyOracleObjectId),
          txb.object(stakingManagerObjectId),
          txb.object(SUI_SYSTEM_STATE_OBJECT_ID),
        ],
      });

      signAndExecute(
        { 
            transaction: txb,
        },
        {
          onSuccess: (result: { digest: string; effects?: string }) => {
            console.log('Liquid Unstake as Loan successful:, digest:', result.digest, 'effects (BCS encoded):', result.effects);
            alert('Liquid Unstake as Loan initiated successfully! You have received Alpha Points and a Loan NFT. Your SUI stake is now in cooldown and will be available in your wallet later.');
            if (currentAccount?.address) {
              fetchPositions(currentAccount.address); 
            }
            setLoading(false);
          },
          onError: (e: Error) => {
            console.error('Liquid Unstake as Loan failed:', e);
            setError(e.message || 'Failed to process liquid unstake as loan.');
            alert(`Error during liquid unstake: ${e.message || 'Unknown error'}`);
            setLoading(false);
          }
        }
      );

    } catch (e: any) {
      console.error('Error constructing transaction for liquid unstake:', e);
      setError(e.message || 'Failed to construct transaction.');
      alert(`Error preparing transaction: ${e.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  return { positions, loading, error, refetch: fetchPositions, liquidUnstakeAsLoanNativeSui };
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