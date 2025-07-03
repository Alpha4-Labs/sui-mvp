import { useCallback, useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

import { PointBalance } from '../types';
import { SHARED_OBJECTS, PACKAGE_ID } from '../config/contract';

// Global cache to avoid duplicate calls
let pointsCache: { [address: string]: { data: PointBalance; timestamp: number } } = {};
const CACHE_TTL = 30000; // 30 seconds cache

/**
 * Improved decoder for u64 values from Sui Move call results
 */
function decodeU64(bytesInput: Array<number> | Uint8Array | unknown): number {
  let bytes: Uint8Array;

  if (Array.isArray(bytesInput) && bytesInput.every(n => typeof n === 'number')) {
    bytes = new Uint8Array(bytesInput);
  } else if (bytesInput instanceof Uint8Array) {
    bytes = bytesInput;
  } else {
    return 0;
  }

  if (!bytes || bytes.length !== 8) {
    return 0;
  }
  
  try {
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const valueBigInt = dataView.getBigUint64(0, true);
    return Number(valueBigInt);
  } catch (err) {
    return 0;
  }
}

// Active requests to prevent duplicates
let activeRequests: { [address: string]: Promise<PointBalance> } = {};

/**
 * FIXED: Hook for fetching and managing Alpha Points balance with proper dependency management
 */
export const useAlphaPoints = (userAddress: string | undefined, autoLoad: boolean = false) => {
  const client = useSuiClient();
  
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<PointBalance>({ available: 0, locked: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  
  // FIXED: Stable fetch function that doesn't cause re-renders
  const fetchPointsInternal = useCallback(async (addr: string): Promise<PointBalance> => {
    const now = Date.now();
    
    // Check cache first
    const cached = pointsCache[addr];
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    
    // Check if request is already in progress
    if (activeRequests[addr]) {
      return activeRequests[addr];
    }
    
    // Create new request
    const requestPromise = (async (): Promise<PointBalance> => {
      try {
        const txb = new Transaction();

        txb.moveCall({
          target: `${PACKAGE_ID}::ledger::get_available_balance`,
          arguments: [
            txb.object(SHARED_OBJECTS.ledger),
            txb.pure.address(addr),
          ],
          typeArguments: [],
        });

        txb.moveCall({
          target: `${PACKAGE_ID}::ledger::get_locked_balance`,
          arguments: [
            txb.object(SHARED_OBJECTS.ledger),
            txb.pure.address(addr),
          ],
          typeArguments: [],
        });

        const inspectResult = await client.devInspectTransactionBlock({
          sender: addr,
          transactionBlock: txb as any,
        });
        
        const status = inspectResult?.effects?.status?.status;
        if (status !== 'success') {
          throw new Error('Failed to fetch points');
        }
        
        if (!inspectResult.results || inspectResult.results.length < 2) {
          throw new Error('Invalid response structure');
        }
        
        let available = 0;
        let locked = 0;
        
        const availableResult = inspectResult.results[0];
        if (availableResult?.returnValues?.[0]) {
          const [bytes, type] = availableResult.returnValues[0];
          if (type === 'u64' && Array.isArray(bytes)) {
            available = decodeU64(bytes);
          }
        }
        
        const lockedResult = inspectResult.results[1];
        if (lockedResult?.returnValues?.[0]) {
          const [bytes, type] = lockedResult.returnValues[0];
          if (type === 'u64' && Array.isArray(bytes)) {
            locked = decodeU64(bytes);
          }
        }
        
        const result = {
          available,
          locked,
          total: available + locked,
        };
        
        // Cache the result
        pointsCache[addr] = {
          data: result,
          timestamp: now,
        };
        
        return result;
      } finally {
        // Clear the active request
        delete activeRequests[addr];
      }
    })();
    
    activeRequests[addr] = requestPromise;
    return requestPromise;
  }, [client]);

  // Public refetch function that accepts userAddress
  const refetch = useCallback(async (addr: string | undefined = userAddress) => {
    if (!addr) {
      setPoints({ available: 0, locked: 0, total: 0 });
      setLoading(false);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchPointsInternal(addr);
      setPoints(result);
      setLastRefresh(Date.now());
    } catch (error: any) {
      setError(error.message || 'Failed to fetch points');
    } finally {
      setLoading(false);
    }
  }, [fetchPointsInternal, userAddress]);

  // Auto-load effect
  useEffect(() => {
    if (autoLoad && userAddress) {
      refetch(userAddress);
    }
  }, [autoLoad, userAddress, refetch]);
  
  return { 
    points, 
    loading, 
    error, 
    refetch,
    lastRefresh
  };
};