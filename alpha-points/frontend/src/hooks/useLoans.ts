import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

import { Loan } from '../types';
import { PACKAGE_ID, SUI_TYPE } from '../config/contract';

/**
 * Hook for fetching and managing user's loans against staked positions
 */
export const useLoans = () => {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();

  // State management
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Main fetch function
  const fetchLoans = useCallback(async () => {
    if (!currentAccount?.address) {
      setLoans([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query owned objects of type Loan
      const response = await client.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${PACKAGE_ID}::loan::Loan<${SUI_TYPE}>`,
        },
        options: {
          showContent: true, // Request content to get fields
        },
      });

      // Process response
      const activeLoans = response.data
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
              openedEpoch: moveStructFields.opened_epoch || '0',
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
  }, [client, currentAccount?.address]);

  // Initialize data and set up polling
  useEffect(() => {
    fetchLoans();
    // Set up polling interval
    const interval = setInterval(fetchLoans, 10000); // Poll every 10 seconds
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fetchLoans]);

  // Return loans, loading state, error state, and refetch function
  return { loans, loading, error, refetch: fetchLoans };
};