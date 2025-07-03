import { useState, useEffect, useCallback, useRef } from 'react';
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

// Global cache to prevent duplicate requests
const CACHE_DURATION = 30000; // 30 seconds
const stakesCache = new Map<string, { data: GenericStakedSui[]; timestamp: number }>();
const ongoingRequests = new Map<string, Promise<GenericStakedSui[]>>();

/**
 * Fetches all '0x3::staking_pool::StakedSui' objects owned by the given address.
 * @param address The Sui address of the user.
 */
export function useAllUserStakes(address: string | undefined, autoLoad: boolean = false) {
  const suiClient = useSuiClient();
  const [allStakedSuiObjects, setAllStakedSuiObjects] = useState<GenericStakedSui[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentRequestRef = useRef<Promise<GenericStakedSui[]> | null>(null);

  const fetchAllUserStakes = useCallback(async (addr: string | undefined) => {
    if (!addr) {
      setAllStakedSuiObjects([]);
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = stakesCache.get(addr);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('[useAllUserStakes] Using cached data for', addr);
      setAllStakedSuiObjects(cached.data);
      setLoading(false);
      return;
    }

    // Check if there's already an ongoing request for this address
    if (ongoingRequests.has(addr)) {
      console.log('[useAllUserStakes] Request already in progress for', addr);
      try {
        const result = await ongoingRequests.get(addr)!;
        setAllStakedSuiObjects(result);
        setLoading(false);
        return;
      } catch (e) {
        // Will handle error below
      }
    }

    setLoading(true);
    setError(null);
    
    const requestPromise = (async (): Promise<GenericStakedSui[]> => {
      try {
        let allOwnedStakes: GenericStakedSui[] = [];
        let cursor: string | null | undefined = undefined;
        let hasNextPage = true;
        let pageCount = 0;
        const MAX_PAGES = 10; // Limit to prevent infinite loops

        while (hasNextPage && pageCount < MAX_PAGES) {
          console.log(`[useAllUserStakes] Fetching page ${pageCount + 1} for ${addr}`);
          
          const response = await suiClient.getOwnedObjects({
            owner: addr,
            filter: { StructType: '0x3::staking_pool::StakedSui' },
            options: { 
              showType: true, 
              showContent: true, 
              showOwner: false, 
              showPreviousTransaction: false, 
              showDisplay: false, 
              showBcs: false 
            },
            cursor: cursor,
            limit: 50, // Reasonable page size
          });

          if (response.data) {
            const stakes = response.data
              .filter(obj => obj.data?.objectId && obj.data?.type === '0x3::staking_pool::StakedSui' && obj.data?.content?.dataType === 'moveObject')
              .map(obj => {
                let principal: string | undefined = undefined;
                if (obj.data?.content && 'fields' in obj.data.content && obj.data.content.fields) {
                  const fields = obj.data.content.fields as any;
                  if (fields.principal) {
                      principal = String(fields.principal);
                  } else if (fields.staked) {
                      principal = String(fields.staked);
                  } else if (fields.balance) {
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
          pageCount++;
          
          if (!hasNextPage) break;
        }

        // Cache the result
        stakesCache.set(addr, { data: allOwnedStakes, timestamp: Date.now() });
        console.log(`[useAllUserStakes] Successfully fetched ${allOwnedStakes.length} stakes for ${addr}`);
        
        return allOwnedStakes;
      } catch (e: any) {
        console.error('[useAllUserStakes] Error fetching all user StakedSui objects:', e);
        throw new Error(e.message || 'Failed to fetch all user StakedSui objects.');
      }
    })();

    // Store the ongoing request
    ongoingRequests.set(addr, requestPromise);
    currentRequestRef.current = requestPromise;

    try {
      const result = await requestPromise;
      // Only update state if this is still the current request
      if (currentRequestRef.current === requestPromise) {
        setAllStakedSuiObjects(result);
        setError(null);
      }
    } catch (e: any) {
      // Only update state if this is still the current request
      if (currentRequestRef.current === requestPromise) {
        setError(e.message || 'Failed to fetch all user StakedSui objects.');
        setAllStakedSuiObjects([]);
      }
    } finally {
      // Clean up
      ongoingRequests.delete(addr);
      if (currentRequestRef.current === requestPromise) {
        setLoading(false);
        currentRequestRef.current = null;
      }
    }
  }, [suiClient]);

  useEffect(() => {
    if (autoLoad) {
      fetchAllUserStakes(address);
    }
  }, [address, fetchAllUserStakes, autoLoad]);

  const refetch = useCallback((addr?: string) => {
     fetchAllUserStakes(addr || address);
  }, [address, fetchAllUserStakes]);

  return { allStakedSuiObjects, loading, error, refetch };
} 