import { useState, useEffect, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { SuiObjectResponse } from '@mysten/sui/client';

/**
 * Simplified representation of a StakedSui object fetched directly from the user's account.
 * We primarily need the ID. Other details like principal might be harder to get reliably
 * without fetching and parsing full object content, which can be intensive.
 */
export interface GenericStakedSui {
  id: string;
  // principalAmount?: string; // Example: Could be added if content is fetched and parsed
  // type: string; // Should always be '0x3::staking_pool::StakedSui'
}

/**
 * Fetches all '0x3::staking_pool::StakedSui' objects owned by the given address.
 * @param address The Sui address of the user.
 */
export function useAllUserStakes(address: string | undefined) {
  const suiClient = useSuiClient();
  const [allStakedSuiObjects, setAllStakedSuiObjects] = useState<GenericStakedSui[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllUserStakes = useCallback(async (addr: string | undefined) => {
    if (!addr) {
      setAllStakedSuiObjects([]);
      setLoading(false); // Ensure loading is false if no address
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let allOwnedStakes: GenericStakedSui[] = [];
      let cursor: string | null | undefined = undefined; // SDK expects string | null | undefined
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await suiClient.getOwnedObjects({
          owner: addr,
          filter: { StructType: '0x3::staking_pool::StakedSui' },
          // Fetching only objectId and type initially for performance.
          // To get principal, showContent: true and parsing would be needed.
          options: { showType: true, showContent: false, showOwner: false, showPreviousTransaction: false, showDisplay: false, showBcs: false },
          cursor: cursor,
        });

        if (response.data) {
          const stakes = response.data
            .filter(obj => obj.data?.objectId && obj.data?.type === '0x3::staking_pool::StakedSui')
            .map(obj => ({
              id: obj.data!.objectId,
            }));
          allOwnedStakes = [...allOwnedStakes, ...stakes];
        }
        cursor = response.nextCursor;
        hasNextPage = response.hasNextPage;
        if (!hasNextPage) break; // Exit if no more pages
      }
      setAllStakedSuiObjects(allOwnedStakes);
    } catch (e: any) {
      console.error('[useAllUserStakes] Error fetching all user StakedSui objects:', e);
      setError(e.message || 'Failed to fetch all user StakedSui objects.');
      setAllStakedSuiObjects([]); // Clear on error
    } finally {
      setLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchAllUserStakes(address);
  }, [address, fetchAllUserStakes]);

  const refetch = useCallback((addr?: string) => {
     fetchAllUserStakes(addr || address);
  }, [address, fetchAllUserStakes]);

  return { allStakedSuiObjects, loading, error, refetch };
} 