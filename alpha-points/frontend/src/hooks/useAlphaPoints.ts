import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

import { PointBalance } from '../types';
import { SHARED_OBJECTS, PACKAGE_ID } from '../config/contract';

/**
 * Improved decoder for u64 values from Sui Move call results
 * Handles various edge cases and provides better error reporting
 */
function decodeU64(bytes: Uint8Array | unknown): number {
  // Input validation with detailed error handling
  if (!bytes) {
    console.error('No data provided for decoding u64 value');
    return 0;
  }
  
  if (!(bytes instanceof Uint8Array)) {
    console.error('Invalid input type for u64 decoding:', typeof bytes);
    return 0;
  }
  
  if (bytes.length !== 8) {
    console.error(`Invalid byte length for u64: expected 8, got ${bytes.length}`);
    return 0;
  }
  
  try {
    // Use DataView for proper binary parsing
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const valueBigInt = dataView.getBigUint64(0, true); // true for little-endian
    
    // Convert to Number and check for potential precision loss
    const valueNumber = Number(valueBigInt);
    
    if (valueBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn(
        `Potential precision loss converting u64 value ${valueBigInt} to JavaScript number. ` +
        `Consider using BigInt for large values.`
      );
    }
    
    return valueNumber;
  } catch (err) {
    console.error('Error decoding u64 value:', err);
    return 0; // Return default on error
  }
}

/**
 * Hook for fetching and managing Alpha Points balance
 */
export const useAlphaPoints = () => {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<PointBalance>({ available: 0, locked: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  
  // Main fetch function
  const fetchPoints = useCallback(async () => {
    // Skip if no account is connected
    if (!currentAccount?.address) {
      setPoints({ available: 0, locked: 0, total: 0 });
      setLoading(false);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching Alpha Points for ${currentAccount.address}`);
      
      // Construct a Programmable Transaction Block for devInspect
      // This allows us to call view functions without executing a real transaction
      const ptb = {
        kind: 'programmable',
        inputs: [
          // Input 0: Shared Ledger Object
          { kind: 'object', value: SHARED_OBJECTS.ledger, type: 'object' },
          // Input 1: User Address
          { kind: 'pure', value: currentAccount.address, type: 'address' },
        ],
        transactions: [
          // Transaction 0: Call get_available_balance
          {
            kind: 'MoveCall',
            target: `${PACKAGE_ID}::ledger::get_available_balance`,
            typeArguments: [],
            arguments: [
              { kind: 'Input', index: 0 }, // Reference ledger
              { kind: 'Input', index: 1 }, // Reference address
            ],
          },
          // Transaction 1: Call get_locked_balance
          {
            kind: 'MoveCall',
            target: `${PACKAGE_ID}::ledger::get_locked_balance`,
            typeArguments: [],
            arguments: [
              { kind: 'Input', index: 0 }, // Reference ledger
              { kind: 'Input', index: 1 }, // Reference address
            ],
          },
        ],
      };
      
      // Execute the transaction in devInspect mode (simulation)
      const inspectResult = await client.devInspectTransactionBlock({
        sender: currentAccount.address,
        transactionBlock: ptb as any, // Cast to any due to potential type mismatch
      });
      
      // Check transaction status
      const status = inspectResult?.effects?.status?.status;
      if (status !== 'success') {
        const errorMsg = inspectResult?.effects?.status?.error || 'Unknown devInspect error';
        console.error('DevInspect execution failed:', errorMsg, inspectResult);
        throw new Error(`Failed to fetch points: ${errorMsg}`);
      }
      
      // Log raw results for debugging
      console.debug('Alpha Points devInspect results:', inspectResult);
      
      // Validate results structure
      if (!inspectResult.results || inspectResult.results.length < 2) {
        console.error('DevInspect results missing or incomplete:', inspectResult);
        throw new Error('Could not retrieve point balances: Invalid response structure.');
      }
      
      let available = 0;
      let locked = 0;
      
      // Parse Available Balance from first call
      const availableResult = inspectResult.results[0];
      if (availableResult?.returnValues?.[0]) {
        const [bytes, type] = availableResult.returnValues[0];
        
        console.debug('Available balance return value:', { bytes, type });
        
        if (type === 'u64' && bytes instanceof Uint8Array) {
          try {
            available = decodeU64(bytes);
            console.log(`Available points parsed: ${available}`);
          } catch (e: any) {
            console.error("Failed to decode available balance:", e);
            throw new Error(`Failed to parse available balance: ${e.message}`);
          }
        } else {
          throw new Error(`Unexpected format for available balance. Expected u64, got Type: ${type}`);
        }
      } else {
        throw new Error("Could not find available balance return value.");
      }
      
      // Parse Locked Balance from second call
      const lockedResult = inspectResult.results[1];
      if (lockedResult?.returnValues?.[0]) {
        const [bytes, type] = lockedResult.returnValues[0];
        
        console.debug('Locked balance return value:', { bytes, type });
        
        if (type === 'u64' && bytes instanceof Uint8Array) {
          try {
            locked = decodeU64(bytes);
            console.log(`Locked points parsed: ${locked}`);
          } catch (e: any) {
            console.error("Failed to decode locked balance:", e);
            throw new Error(`Failed to parse locked balance: ${e.message}`);
          }
        } else {
          throw new Error(`Unexpected format for locked balance. Expected u64, got Type: ${type}`);
        }
      } else {
        throw new Error("Could not find locked balance return value.");
      }
      
      // Update state with fetched balances
      const totalPoints = available + locked;
      setPoints({
        available,
        locked,
        total: totalPoints,
      });
      
      console.log(`Alpha Points balances updated: Available=${available}, Locked=${locked}, Total=${totalPoints}`);
      setLastRefresh(Date.now());
      
    } catch (error: any) {
      console.error('Error fetching Alpha Points:', error);
      setError(error.message || 'An unknown error occurred while fetching points.');
    } finally {
      setLoading(false);
    }
  }, [client, currentAccount?.address]);
  
  // Initialize data and set up polling
  useEffect(() => {
    if (currentAccount?.address) {
      fetchPoints(); // Initial fetch
      
      // Set up polling interval
      const intervalId = setInterval(fetchPoints, 15000); // Poll every 15 seconds
      
      // Cleanup interval on unmount
      return () => clearInterval(intervalId);
    } else {
      // Reset state if no account
      setPoints({ available: 0, locked: 0, total: 0 });
      setLoading(false);
      setError(null);
    }
  }, [fetchPoints, currentAccount?.address]);
  
  // Return hook state and refetch function
  return { 
    points, 
    loading, 
    error, 
    refetch: fetchPoints,
    lastRefresh
  };
};