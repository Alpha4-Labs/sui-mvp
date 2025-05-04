import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

import { PointBalance } from '../types';
import { SHARED_OBJECTS, PACKAGE_ID } from '../config/contract';

/**
 * Manual decoder for u64 values from Sui Move call results
 * Works around BCS import issues by directly parsing the byte array
 */
function decodeU64(bytes: Uint8Array): number {
  // Input validation
  if (!(bytes instanceof Uint8Array) || bytes.length !== 8) {
    const typeInfo = bytes ? bytes.constructor.name : typeof bytes;
    const lengthInfo = bytes ? bytes.length : 'N/A';
    throw new Error(`Invalid input for u64 decoding: expected 8-byte Uint8Array, got ${typeInfo} length ${lengthInfo}`);
  }
  
  // Use DataView for proper binary parsing
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const valueBigInt = dataView.getBigUint64(0, true); // true for little-endian
  
  // Convert to Number and check for potential precision loss
  const valueNumber = Number(valueBigInt);
  if (valueBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    console.warn(
      `Potential precision loss converting u64 value ${valueBigInt} to JavaScript number. ` +
      `Max safe integer is ${Number.MAX_SAFE_INTEGER}. Consider using BigInt in your state if precision is critical.`
    );
  }
  
  return valueNumber;
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
  
  // Main fetch function
  const fetchPoints = useCallback(async () => {
    // Skip if no account is connected
    if (!currentAccount?.address) {
      setLoading(false);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
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
        transactionBlock: ptb as any, // Cast to any as the exact type might not match SDK expectations
      });
      
      // Check transaction status
      const status = inspectResult?.effects?.status?.status;
      if (status !== 'success') {
        const errorMsg = inspectResult?.effects?.status?.error || 'Unknown devInspect error';
        console.error('DevInspect execution failed:', errorMsg, inspectResult);
        throw new Error(`Failed to fetch points: ${errorMsg}`);
      }
      
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
        if (type === 'u64' && bytes instanceof Uint8Array) {
          try {
            available = decodeU64(bytes);
          } catch (e: any) {
            console.error("Manual u64 decoding failed for available balance:", e);
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
        if (type === 'u64' && bytes instanceof Uint8Array) {
          try {
            locked = decodeU64(bytes);
          } catch (e: any) {
            console.error("Manual u64 decoding failed for locked balance:", e);
            throw new Error(`Failed to parse locked balance: ${e.message}`);
          }
        } else {
          throw new Error(`Unexpected format for locked balance. Expected u64, got Type: ${type}`);
        }
      } else {
        throw new Error("Could not find locked balance return value.");
      }
      
      // Update state with fetched balances
      setPoints({
        available,
        locked,
        total: available + locked,
      });
      
    } catch (error: any) {
      console.error('Error fetching Alpha Points:', error);
      setError(error.message || 'An unknown error occurred while fetching points.');
    } finally {
      setLoading(false);
    }
  }, [client, currentAccount?.address]);
  
  // Initialize data and set up polling
  useEffect(() => {
    fetchPoints(); // Initial fetch
    
    // Set up polling interval
    const intervalId = setInterval(fetchPoints, 10000); // Poll every 10 seconds
    
    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [fetchPoints]);
  
  // Return hook state and refetch function
  return { 
    points, 
    loading, 
    error, 
    refetch: fetchPoints 
  };
};