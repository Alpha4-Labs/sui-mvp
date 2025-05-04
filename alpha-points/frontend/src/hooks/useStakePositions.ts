import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

import { StakePosition } from '../types';
import { PACKAGE_ID, SUI_TYPE } from '../config/contract';

/**
 * Hook for fetching and managing user's stake positions
 */
export const useStakePositions = () => {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();

  // State management
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<StakePosition[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Main fetch function
  const fetchPositions = useCallback(async () => {
    if (!currentAccount?.address) {
      setPositions([]); // Clear positions if no user
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      // Process response
      const stakePositions = response.data
        // Map over potentially mixed object types
        .map(obj => {
          const content = obj.data?.content;

          // Type Guard: Ensure it's a Move object before proceeding
          if (content?.dataType === 'moveObject') {
            // Access the inner 'fields' property which holds the actual struct data
            // Cast to Record<string, any> for dynamic property access
            const moveStructFields = content.fields as Record<string, any>;

            // Check if fields exist after cast
            if (!moveStructFields) {
              console.warn(`Stake position object ${obj.data?.objectId} content missing 'fields'.`, content);
              return null; // Skip this object
            }

            // Safely access properties from moveStructFields, with defaults
            const startEpochStr = moveStructFields.start_epoch || '0';
            const unlockEpochStr = moveStructFields.unlock_epoch || '0';

            // Calculate maturity percentage
            const now = Math.floor(Date.now() / (1000 * 86400)); // Current day number
            const startEpoch = parseInt(startEpochStr, 10);
            const unlockEpoch = parseInt(unlockEpochStr, 10);

            // Check for valid epochs before calculation
            if (isNaN(startEpoch) || isNaN(unlockEpoch)) {
              console.warn(`Invalid epoch data for StakePosition ${obj.data?.objectId}`);
              return null; // Skip if epoch data is invalid
            }

            const duration = unlockEpoch > startEpoch ? unlockEpoch - startEpoch : 0;
            const elapsed = now >= startEpoch ? now - startEpoch : 0;
            let maturityPercentage = 0;

            if (duration > 0) {
              // Calculate percentage, clamping between 0 and 100
              maturityPercentage = Math.min(100, Math.max(0, Math.floor((elapsed / duration) * 100)));
            } else if (elapsed >= 0 && duration === 0 && startEpoch > 0) {
              // If duration is 0 but it's past start, consider it mature
              maturityPercentage = 100;
            } else if (now < startEpoch) {
              maturityPercentage = 0; // Not started yet
            }

            // Construct the StakePosition object
            const positionData: StakePosition = {
              id: obj.data?.objectId || '',
              owner: moveStructFields.owner || '',
              principal: moveStructFields.principal || '0',
              startEpoch: startEpochStr,
              unlockEpoch: unlockEpochStr,
              durationEpochs: moveStructFields.duration_epochs || '0',
              encumbered: moveStructFields.encumbered || false,
              maturityPercentage,
            };
            return positionData;
          }
          // If not a moveObject, return null
          return null;
        })
        // Filter out any nulls introduced by the map
        .filter((pos): pos is StakePosition => pos !== null);

      setPositions(stakePositions);
    } catch (error: any) {
      console.error('Error fetching stake positions:', error);
      setError(error.message || 'Failed to fetch stake positions');
    } finally {
      setLoading(false);
    }
  }, [client, currentAccount?.address]);

  // Initialize data and set up polling
  useEffect(() => {
    fetchPositions();
    // Set up polling interval
    const interval = setInterval(fetchPositions, 10000); // Poll every 10 seconds
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fetchPositions]);

  // Return positions, loading state, error state, and refetch function
  return { positions, loading, error, refetch: fetchPositions };
};