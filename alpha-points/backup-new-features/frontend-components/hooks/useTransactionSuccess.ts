import { useEffect, useRef } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';

/**
 * Hook that provides automatic component refresh functionality when transactions succeed
 * 
 * This hook allows components to register refresh callbacks that will be automatically
 * called after successful transactions, eliminating the need for manual refresh calls
 * and providing a clean, consistent way to update UI state after blockchain operations.
 * 
 * @example
 * ```tsx
 * // In any component that performs transactions:
 * import { useTransactionSuccess } from '../hooks/useTransactionSuccess';
 * import { useAlphaContext } from '../context/AlphaContext';
 * 
 * const MyComponent = () => {
 *   const { refreshData, refreshStakePositions } = useAlphaContext();
 *   const { registerRefreshCallback, signAndExecute } = useTransactionSuccess();
 * 
 *   // Register what should refresh when transactions succeed
 *   useEffect(() => {
 *     const cleanup = registerRefreshCallback(async () => {
 *       await refreshStakePositions(); // Refresh specific data
 *       await refreshData(); // Or refresh all data
 *     });
 *     return cleanup; // Important: cleanup on unmount
 *   }, [registerRefreshCallback, refreshStakePositions, refreshData]);
 * 
 *   const handleTransaction = async () => {
 *     try {
 *       // Use signAndExecute instead of the raw hook
 *       // This will automatically call your refresh callbacks on success
 *       await signAndExecute(transaction);
 *       // No need for manual refresh calls!
 *     } catch (error) {
 *       // Handle errors - refresh won't happen on failure
 *     }
 *   };
 * };
 * ```
 */
export function useTransactionSuccess() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const refreshCallbacksRef = useRef<Set<() => void | Promise<void>>>(new Set());

  /**
   * Register a refresh callback that will be called after successful transactions
   * 
   * @param refreshCallback Function to call when transaction succeeds
   * @returns Cleanup function to remove the callback (call this in useEffect cleanup)
   * 
   * @example
   * ```tsx
   * useEffect(() => {
   *   const cleanup = registerRefreshCallback(async () => {
   *     await refreshMyData();
   *   });
   *   return cleanup; // Always return cleanup function
   * }, [registerRefreshCallback, refreshMyData]);
   * ```
   */
  const registerRefreshCallback = (refreshCallback: () => void | Promise<void>) => {
    refreshCallbacksRef.current.add(refreshCallback);
    
    // Return cleanup function to remove callback
    return () => {
      refreshCallbacksRef.current.delete(refreshCallback);
    };
  };

  /**
   * Execute a transaction and automatically refresh registered components on success
   * 
   * This function wraps the standard signAndExecute but adds automatic refresh
   * functionality. All registered refresh callbacks will be called if the
   * transaction succeeds (has a digest). If the transaction fails, no refresh
   * callbacks are called.
   * 
   * @param transaction Transaction to execute
   * @param options Additional options for transaction execution
   * @returns Promise with transaction result
   * 
   * @example
   * ```tsx
   * const handleClaim = async () => {
   *   try {
   *     const result = await signAndExecute(claimTransaction);
   *     // Refresh callbacks automatically called here if successful
   *     console.log('Transaction successful:', result.digest);
   *   } catch (error) {
   *     // No refresh on error
   *     console.error('Transaction failed:', error);
   *   }
   * };
   * ```
   */
  const executeTransactionWithRefresh = async (
    transaction: any,
    options?: any
  ) => {
    try {
      const result = await signAndExecute({ transaction, ...options });
      
      // If transaction was successful, call all registered refresh callbacks
      if (result?.digest) {
        // Execute all refresh callbacks
        const refreshPromises = Array.from(refreshCallbacksRef.current).map(callback => {
          try {
            const result = callback();
            // Handle both sync and async callbacks
            return Promise.resolve(result);
          } catch (error) {
            console.warn('Error in refresh callback:', error);
            return Promise.resolve();
          }
        });
        
        // Wait for all refresh callbacks to complete
        await Promise.allSettled(refreshPromises);
      }
      
      return result;
    } catch (error) {
      // Don't refresh on transaction failure
      throw error;
    }
  };

  return {
    registerRefreshCallback,
    executeTransactionWithRefresh,
    signAndExecute: executeTransactionWithRefresh // Alias for convenience
  };
} 
