// === useLoans.ts (Corrected Field Access) ===
import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
// No specific import needed for SuiParsedMoveObject if we check dataType

import { Loan } from '../types'; // Your local Loan type definition
import { PACKAGE_ID, SUI_TYPE } from '../config/contract';

export const useLoans = () => {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();

  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      const response = await client.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${PACKAGE_ID}::loan::Loan<${SUI_TYPE}>`,
        },
        options: {
          showContent: true,
        },
      });

      const activeLoans = response.data
        .map(obj => {
          const content = obj.data?.content;

          // Type Guard: Ensure it's a Move object before proceeding
          if (content?.dataType === 'moveObject') {
            // Access the inner 'fields' property which holds the actual struct data
            // Cast to Record<string, any> for dynamic property access,
            // as TS might not know the specific fields of the generic MoveStruct type.
            const moveStructFields = content.fields as Record<string, any>;

            // Add a check if fields actually exists after the cast
            if (!moveStructFields) {
                 console.warn(`Move object ${obj.data?.objectId} content missing 'fields'.`, content);
                 return null; // Skip this object
            }

            // Now access properties *from* moveStructFields
            const principal = BigInt(moveStructFields.principal_points || '0');
            const interest = principal * BigInt(10) / BigInt(100); // Demo interest
            const estimatedRepayment = (principal + interest).toString();

            // Construct the Loan object
            const loanData: Loan = {
              id: obj.data?.objectId || '',
              // Access specific fields from the inner fields object
              borrower: moveStructFields.borrower || '',
              stakeId: moveStructFields.stake_id || '',
              principalPoints: moveStructFields.principal_points || '0',
              interestOwedPoints: moveStructFields.interest_owed_points || '0',
              openedEpoch: moveStructFields.opened_epoch || '0',
              estimatedRepayment,
              // Add other fields required by your Loan type
            };
            return loanData;
          }

          // If not a moveObject, return null
          return null;
        })
        // Filter out any nulls
        .filter((loan): loan is Loan => loan !== null);

      setLoans(activeLoans);
    } catch (error: any) {
      console.error('Error fetching loans:', error);
      setError(error.message || 'Failed to fetch loans');
    } finally {
      setLoading(false);
    }
  }, [client, currentAccount?.address]);

  useEffect(() => {
    fetchLoans();
    const interval = setInterval(fetchLoans, 10000);
    return () => clearInterval(interval);
  }, [fetchLoans]);

  return { loans, loading, error, refetch: fetchLoans };
};