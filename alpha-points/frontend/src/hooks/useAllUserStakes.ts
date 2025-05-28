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
  principalAmount?: string; // Add principalAmount
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
          // Fetching objectId, type, and content to get principal.
          options: { showType: true, showContent: true, showOwner: false, showPreviousTransaction: false, showDisplay: false, showBcs: false },
          cursor: cursor,
        });

        if (response.data) {
          const stakes = response.data
            .filter(obj => obj.data?.objectId && obj.data?.type === '0x3::staking_pool::StakedSui' && obj.data?.content?.dataType === 'moveObject')
            .map(obj => {
              // Extract principal from content
              // Assuming content.fields.principal exists based on StakedSui structure
              // The actual field name might be 'staked_sui_amount' or similar, adjust if needed
              // For StakedSui, the principal is in the 'balance' field of the StakedSui object itself.
              // However, getOwnedObjects returns the StakedSui object directly, and its 'content' field
              // contains the fields of the object. For a StakedSui object, the field holding the
              // principal amount is typically named 'principal' or 'balance'.
              // Let's assume it's 'principal' based on typical StakedSui struct.
              // If this is incorrect, we'll need to inspect the actual object structure.
              // The type from sui/client getObject indicates content.fields.balance for StakedSui
              let principal: string | undefined = undefined;
              if (obj.data?.content && 'fields' in obj.data.content && obj.data.content.fields) {
                const fields = obj.data.content.fields as any; // Cast to any to access arbitrary fields
                if (fields.principal) { // Standard StakedSui object has 'principal'
                    principal = String(fields.principal);
                } else if (fields.staked) { // Sometimes it's just 'staked' if it's a balance
                    principal = String(fields.staked);
                } else if (fields.balance) { // Fallback to balance if that's the field name
                    principal = String(fields.balance);
                }
              }
              return {
                id: obj.data!.objectId,
                principalAmount: principal,
              };
            });
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