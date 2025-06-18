import { useCallback, useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

import { PointBalance } from '../types';
import { SHARED_OBJECTS, PACKAGE_ID } from '../config/contract';

/**
 * Improved decoder for u64 values from Sui Move call results
 * Handles various edge cases and provides better error reporting
 * Now accepts standard Array<number> as input and converts internally.
 */
function decodeU64(bytesInput: Array<number> | Uint8Array | unknown): number {
  let bytes: Uint8Array;

  // Convert standard array to Uint8Array if necessary
  if (Array.isArray(bytesInput) && bytesInput.every(n => typeof n === 'number')) {
    bytes = new Uint8Array(bytesInput);
  } else if (bytesInput instanceof Uint8Array) {
    bytes = bytesInput;
  } else {
    console.error('Invalid input type for u64 decoding:', typeof bytesInput);
    return 0;
  }

  // Original validation and decoding logic using the ensured Uint8Array
  if (!bytes) {
    console.error('No data provided for decoding u64 value');
    return 0;
  }
  
  // Length check still applies
  if (bytes.length !== 8) {
    console.error(`Invalid byte length for u64: expected 8, got ${bytes.length}`);
    return 0;
  }
  
  try {
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const valueBigInt = dataView.getBigUint64(0, true); // true for little-endian
    
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
    return 0;
  }
}

/**
 * Hook for fetching and managing Alpha Points balance
 */
export const useAlphaPoints = () => {
  const client = useSuiClient();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<PointBalance>({ available: 0, locked: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  
  // Main fetch function - now accepts userAddress
  const fetchPoints = useCallback(async (userAddress: string | undefined) => {
    // Skip if no account is provided
    if (!userAddress) {
      setPoints({ available: 0, locked: 0, total: 0 });
      setLoading(false); // Set loading to false if no address
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {

      
      const txb = new Transaction();

      txb.moveCall({
        target: `${PACKAGE_ID}::ledger::get_available_balance`,
        arguments: [
          txb.object(SHARED_OBJECTS.ledger),
          txb.pure.address(userAddress), // Use provided userAddress
        ],
        typeArguments: [],
      });

      txb.moveCall({
        target: `${PACKAGE_ID}::ledger::get_locked_balance`,
        arguments: [
          txb.object(SHARED_OBJECTS.ledger),
          txb.pure.address(userAddress), // Use provided userAddress
        ],
        typeArguments: [],
      });

      const inspectResult = await client.devInspectTransactionBlock({
        sender: userAddress, // Use provided userAddress
        transactionBlock: txb as any, 
      });
      
      const status = inspectResult?.effects?.status?.status;
      if (status !== 'success') {
        const errorMsg = inspectResult?.effects?.status?.error || 'Unknown devInspect error';
        console.error('DevInspect execution failed:', errorMsg, inspectResult);
        throw new Error(`Failed to fetch points: ${errorMsg}`);
      }
      

      
      if (!inspectResult.results || inspectResult.results.length < 2) {
        console.error('DevInspect results missing or incomplete:', inspectResult);
        throw new Error('Could not retrieve point balances: Invalid response structure.');
      }
      
      let available = 0;
      let locked = 0;
      
      const availableResult = inspectResult.results[0];
      if (availableResult?.returnValues?.[0]) {
        const [bytes, type] = availableResult.returnValues[0];
        if (type === 'u64' && Array.isArray(bytes)) {
          available = decodeU64(bytes);
        } else {
          throw new Error(`Unexpected format for available balance. Expected type 'u64' and Array bytes.`);
        }
      } else {
        throw new Error("Could not find available balance return value.");
      }
      
      const lockedResult = inspectResult.results[1];
      if (lockedResult?.returnValues?.[0]) {
        const [bytes, type] = lockedResult.returnValues[0];
        if (type === 'u64' && Array.isArray(bytes)) {
          locked = decodeU64(bytes);
        } else {
          throw new Error(`Unexpected format for locked balance. Expected type 'u64' and Array bytes.`);
        }
      } else {
        throw new Error("Could not find locked balance return value.");
      }
      
      const totalPoints = available + locked;
      setPoints({
        available,
        locked,
        total: totalPoints,
      });
      

      setLastRefresh(Date.now());
      
    } catch (error: any) {
      console.error('Error fetching Alpha Points:', error);
      setError(error.message || 'An unknown error occurred while fetching points.');
    } finally {
      setLoading(false);
    }
  }, [client]); // Removed currentAccount.address from dependencies
  
  // REMOVED INTERNAL useEffect for initial load/polling
  // AlphaContext will now trigger refetch with the correct address.
  
  return { 
    points, 
    loading, 
    error, 
    refetch: fetchPoints,
    lastRefresh
  };
};