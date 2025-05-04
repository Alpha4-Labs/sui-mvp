import React, { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { buildUnstakeTransaction } from '../utils/transaction';
import {
  adaptPtbJsonForSignAndExecute,
  getTransactionErrorMessage,
  // Import the function to specifically check the transaction result's status
  getTransactionResponseError,
} from '../utils/transaction-adapter';
// Assuming formatTimestamp will be added and exported from format.ts
import { formatSui, formatAddress, formatDuration, formatTimestamp } from '../utils/format';

export const StakedPositionsList: React.FC = () => {
  const { stakePositions, loading, refreshData, setTransactionLoading } = useAlphaContext();
  const [unstakeInProgress, setUnstakeInProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  /**
   * Handles unstaking a position
   * @param stakeId The ID of the stake position to unstake
   * @param principal The principal amount of the stake (for feedback)
   */
  const handleUnstake = async (stakeId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnstakeInProgress(stakeId); // Mark this specific position as loading
    setTransactionLoading(true); // Mark global transaction loading

    try {
      const ptbJson = buildUnstakeTransaction(stakeId);
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);

      // Execute the transaction - No type assertion
      const result = await signAndExecute(executionInput);

      // Runtime checks based on actual hook output structure
      let txDigest = 'no digest available';
      let txFailed = false;
      let failureErrorMsg = 'Transaction failed without specific error message.';

      // 1. Check if result is an object and has a digest
      if (result && typeof result === 'object' && 'digest' in result && typeof result.digest === 'string') {
        txDigest = result.digest;
        console.log('Unstake transaction submitted successfully:', txDigest);

        // 2. Check for failure using the utility function
        const responseError = getTransactionResponseError(result);
        if (responseError) {
            txFailed = true;
            failureErrorMsg = responseError;
        }
        // If responseError is null, effects indicated success or were not available/parsable

      } else {
        txFailed = true;
        failureErrorMsg = 'Transaction failed to execute or response format was unexpected.';
        console.error('Unstake transaction response missing digest:', result);
      }

      // 3. Handle outcome
      if (txFailed) {
          throw new Error(failureErrorMsg);
      } else {
          setSuccessMessage(`Successfully unstaked ${formatSui(principal)} SUI! Digest: ${txDigest.substring(0, 10)}...`);
          refreshData(); // Call directly to refresh the list
          // No balance refresh needed here unless unstaking affects main balance directly
      }

    } catch (err: any) {
      console.error('Error unstaking position:', err);
      setErrorMessage(getTransactionErrorMessage(err)); // Use the generic error handler
    } finally {
      setTransactionLoading(false); // Clear global loading
      setUnstakeInProgress(null); // Clear loading for this specific button
    }
  };

  // --- Helper Functions (Keep within component or move to utils) ---

  // Helper to calculate Unlock Date safely
  const getUnlockDate = (unlockEpoch?: string): Date | null => {
    if (!unlockEpoch) return null;
    try {
      // ** CRITICAL: Verify the actual meaning of unlockEpoch from your contract **
      // Assuming it's a Unix timestamp in MILLISECONDS for this example
      const epochNumber = parseInt(unlockEpoch, 10);
      if (isNaN(epochNumber)) return null;
      return new Date(epochNumber); // Adjust logic if it's seconds, days, etc.
    } catch {
      return null;
    }
  };

  // Helper for Estimated Rewards Calculation
  const calculateEstRewards = (principal?: string, durationEpochs?: string): string => {
      // ** CRITICAL: Replace placeholder APY with actual logic/source **
      if (!principal || !durationEpochs) return '0';
      try {
          const principalNum = parseInt(principal, 10); // This is MIST
          const durationDays = parseInt(durationEpochs, 10); // Assuming means days
          const placeholderAPY = 0.05; // 5% APY - REPLACE THIS

          if (isNaN(principalNum) || isNaN(durationDays) || durationDays <= 0) return '0';

          // Calculate reward based on principal in SUI, APY, and duration
          const principalSui = principalNum / 1_000_000_000;
          const rewards = principalSui * placeholderAPY * (durationDays / 365);

          return isFinite(rewards) ? formatSui(rewards.toString(), 9) : '0';
      } catch {
          return '0';
      }
  };

  // --- Loading State ---
  if (loading.positions) {
    return (
      <div className="bg-background-card rounded-lg p-6 shadow-lg animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-full mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-full mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-full"></div>
      </div>
    );
  }

  // --- Full JSX ---
  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Your Staked Positions</h2>

      {/* Status Messages */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm break-words">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-md text-green-400 text-sm break-words">
          {successMessage}
        </div>
      )}

      {/* Empty State */}
      {stakePositions.length === 0 && !loading.positions ? ( // Ensure not shown while loading initially
        <div className="text-center py-10 bg-background rounded-lg">
          <div className="text-4xl text-gray-700 mb-3">📊</div>
          <p className="text-gray-400 mb-4">You haven't staked any SUI yet.</p>
          <p className="text-sm text-gray-500">Stake SUI in the 'Manage Stake' section to earn rewards.</p>
        </div>
      ) : (
        // Positions List
        <div className="space-y-4">
          {stakePositions.map((position) => {
            // Calculate status variables for clarity
            const maturityPercentage = Math.max(0, Math.min(100, position.maturityPercentage || 0));
            const isMature = maturityPercentage >= 100;
            const isEncumbered = position.encumbered;
            const canUnstake = isMature && !isEncumbered;
            const unlockDate = getUnlockDate(position.unlockEpoch);
            const formattedUnlockDate = unlockDate ? formatTimestamp(unlockDate) : 'N/A'; // Ensure formatTimestamp is available

            return (
              <div
                key={position.id}
                className="border border-gray-700 rounded-lg p-4 text-sm transition-colors bg-background hover:bg-gray-800"
              >
                {/* Position Header */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      isEncumbered ? "bg-yellow-500" : isMature ? "bg-green-500" : "bg-blue-500"
                    }`} title={isEncumbered ? "Encumbered (Loan Collateral)" : isMature ? "Mature (Ready to Unstake)" : "Actively Staking"}></div>
                    <span className="text-gray-300 font-mono text-xs" title={position.id}>
                      {formatAddress(position.id)}
                    </span>
                  </div>
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                    isEncumbered
                      ? "bg-yellow-900/30 text-yellow-400 border border-yellow-700/50"
                      : isMature
                        ? "bg-green-900/30 text-green-400 border border-green-700/50"
                        : "bg-blue-900/30 text-blue-400 border border-blue-700/50"
                  }`}>
                    {isEncumbered ? "Loan Collateral" : isMature ? "Mature" : "Staking"}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                  <span className="text-gray-400">Principal</span>
                  <span className="text-white text-right font-medium">
                    {formatSui(position.principal)} SUI
                  </span>

                  <span className="text-gray-400">Duration</span>
                  <span className="text-white text-right">
                    {formatDuration(parseInt(position.durationEpochs || '0', 10))}
                  </span>

                  <span className="text-gray-400">Unlock Date</span>
                  <span className="text-white text-right">
                    {formattedUnlockDate}
                  </span>

                  <span className="text-gray-400">Est. Rewards</span>
                  <span className="text-green-400 text-right">
                     ~{calculateEstRewards(position.principal, position.durationEpochs)} SUI
                  </span>
                </div>

                {/* Maturity Progress Bar */}
                {!isMature && !isEncumbered && (
                   <div className="mb-4">
                     <div className="flex justify-between text-xs text-gray-400 mb-1">
                       <span>Progress</span>
                       <span>{maturityPercentage.toFixed(1)}% Complete</span>
                     </div>
                     <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                       <div
                         className={`h-2 rounded-full transition-all duration-500 bg-blue-500`} // Always blue if shown (not mature)
                         style={{ width: `${maturityPercentage}%` }}
                         role="progressbar"
                         aria-valuenow={maturityPercentage}
                         aria-valuemin={0}
                         aria-valuemax={100}
                         aria-label="Staking progress"
                       ></div>
                     </div>
                   </div>
                )}

                {/* Action Button / Status Info */}
                <div className="mt-4">
                   {canUnstake ? (
                       <button
                         onClick={() => handleUnstake(position.id, position.principal)}
                         // Disable if this button's action is in progress OR a global transaction is happening
                         disabled={unstakeInProgress === position.id || loading.transaction}
                         className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed relative"
                       >
                         {unstakeInProgress === position.id ? (
                           <>
                             <span className="opacity-0">Unstake</span> {/* Keep layout */}
                             <span className="absolute inset-0 flex items-center justify-center">
                               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                               </svg>
                             </span>
                           </>
                         ) : (
                           'Unstake'
                         )}
                       </button>
                   ) : isEncumbered ? (
                       <div className="p-2 bg-yellow-900/20 border border-yellow-900/40 rounded text-yellow-300 text-xs text-center">
                         This position is collateral for a loan. Repay the loan to unstake.
                       </div>
                   ) : !isMature ? (
                       <div className="p-2 bg-blue-900/20 border border-blue-900/40 rounded text-blue-300 text-xs text-center">
                         Matures on {formattedUnlockDate}. You might be able to borrow against it.
                       </div>
                   ) : null /* Should not reach here if logic is sound */ }
                 </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};