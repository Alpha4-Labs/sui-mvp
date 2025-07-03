import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

import { Loan } from '../types';
import { PACKAGE_ID, ALL_PACKAGE_IDS } from '../config/contract';

// Define the explicit type argument for native StakedSui, consistent with useStakePositions
const NATIVE_STAKED_SUI_TYPE_ARG = '0x3::staking_pool::StakedSui';

/**
 * Hook for fetching and managing user's loans against staked positions
 */
export const useLoans = (userAddress: string | undefined, autoLoad: boolean = false) => {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();

  // State management
  const [loading, setLoading] = useState(false); // Start as false when not auto-loading
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Main fetch function
  const fetchLoans = useCallback(async (addr: string | undefined = userAddress) => {
    const owner = addr || currentAccount?.address;
    if (!owner) {
      setLoans([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let allOwnedObjectsData: any[] = [];

      // Query for loans from all known package IDs
      for (const pkgId of ALL_PACKAGE_IDS) {
        const response = await client.getOwnedObjects({
          owner,
          filter: {
            StructType: `${pkgId}::loan::Loan`,
          },
          options: {
            showContent: true, // Request content to get fields
          },
        });
        if (response.data) {
          allOwnedObjectsData = allOwnedObjectsData.concat(response.data);
        }
      }

      // De-duplicate based on objectId
      const uniqueObjectsData = Array.from(new Map(allOwnedObjectsData.map(obj => [obj.data?.objectId, obj])).values());

      // Process response
      const activeLoans = uniqueObjectsData
        .map(obj => {
          const content = obj.data?.content;

          // Type Guard: Ensure it's a Move object before proceeding
          if (content?.dataType === 'moveObject') {
            // Access the inner 'fields' property which holds the actual struct data
            const moveStructFields = content.fields as Record<string, any>;

            // Add a check if fields actually exists after the cast
            if (!moveStructFields) {
              console.warn(`Move object ${obj.data?.objectId} content missing 'fields'.`, content);
              return null; // Skip this object
            }

            // Calculate interest and repayment amount (simplified for demo)
            const principal = BigInt(moveStructFields.principal_points || '0');
            // Demo calculation: 10% interest rate
            const interest = principal * BigInt(10) / BigInt(100);
            const estimatedRepayment = (principal + interest).toString();

            // Construct the Loan object
            const loanData: Loan = {
              id: obj.data?.objectId || '',
              borrower: moveStructFields.borrower || '',
              stakeId: moveStructFields.stake_id || '',
              principalPoints: moveStructFields.principal_points || '0',
              interestOwedPoints: moveStructFields.interest_owed_points || '0',
              openedTimeMs: moveStructFields.opened_time_ms || '0',
              estimatedRepayment,
            };
            return loanData;
          }

          // If not a moveObject, return null
          return null;
        })
        // Filter out any nulls introduced by the map
        .filter((loan): loan is Loan => loan !== null);

      setLoans(activeLoans);
    } catch (error: any) {
      console.error('Error fetching loans:', error);
      setError(error.message || 'Failed to fetch loans');
    } finally {
      setLoading(false);
    }
  }, [client, currentAccount, userAddress]);

  // Auto-load effect
  useEffect(() => {
    if (autoLoad && userAddress) {
      fetchLoans(userAddress);
    }
  }, [autoLoad, userAddress, fetchLoans]);

  // Return consistent interface
  const refetch = useCallback((addr?: string) => {
    fetchLoans(addr || userAddress);
  }, [fetchLoans, userAddress]);

  // Return loans, loading state, error state, and refetch function
  return { loans, loading, error, refetch };
};