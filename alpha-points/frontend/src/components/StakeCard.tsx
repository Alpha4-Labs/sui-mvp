import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { buildStakeTransaction } from '../utils/transaction';
import {
  adaptPtbJsonForSignAndExecute,
  getTransactionErrorMessage,
  // Import the function to specifically check the transaction result's status
  getTransactionResponseError,
} from '../utils/transaction-adapter';
import { formatSui } from '../utils/format';

export const StakeCard: React.FC = () => {
  const {
    refreshData,
    durations,
    selectedDuration,
    setSelectedDuration,
    setTransactionLoading,
    loading: contextLoading,
  } = useAlphaContext();

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const [amount, setAmount] = useState('');
  const [currentlyStaked] = useState('0'); // Note: This seems static, might need fetching
  const [availableBalance, setAvailableBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch user's SUI balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!currentAccount?.address) return;

      setIsLoadingBalance(true);
      try {
        const { totalBalance } = await suiClient.getBalance({
          owner: currentAccount.address,
          coinType: '0x2::sui::SUI'
        });
        setAvailableBalance(totalBalance);
      } catch (err) {
        console.error('Error fetching SUI balance:', err);
        setError("Failed to fetch SUI balance.");
      } finally {
        setIsLoadingBalance(false);
      }
    };

    if (currentAccount?.address) {
        fetchBalance();
    } else {
        // Clear balance if account disconnects
        setAvailableBalance('0');
    }
  }, [currentAccount?.address, suiClient]);

  /**
   * Handles staking SUI tokens
   */
  const handleStake = async () => {
    setError(null);
    setSuccess(null);

    if (!currentAccount?.address) {
      setError("Please connect your wallet.");
      return;
    }

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setError("Please enter a valid positive amount");
      return;
    }

    const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));
    const availableInMist = BigInt(availableBalance);
    const gasBuffer = BigInt(10_000_000); // 0.01 SUI
    const minStake = BigInt(1_000_000); // 0.001 SUI

    if (amountInMist < minStake) {
      setError(`Minimum stake amount is ${formatSui(minStake.toString())} SUI`);
      return;
    }

    if (amountInMist + gasBuffer > availableInMist) {
      setError("Insufficient balance for stake amount + gas fee buffer (0.01 SUI).");
      return;
    }

    setTransactionLoading(true);

    try {
      const ptbJson = buildStakeTransaction(amountInMist, selectedDuration.days);
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);

      // Execute the transaction - No type assertion
      const result = await signAndExecute(executionInput);

      // Runtime checks based on actual hook output structure
      let txDigest = 'no digest available';
      let txFailed = false;
      let failureErrorMsg = 'Transaction failed without specific error message.';

      // 1. Check if result is an object and has a digest (core success indicator)
      if (result && typeof result === 'object' && 'digest' in result && typeof result.digest === 'string') {
        txDigest = result.digest;
        console.log('Stake transaction submitted successfully:', txDigest);

        // 2. Check for failure using the utility function which handles the effects structure
        const responseError = getTransactionResponseError(result);
        if (responseError) {
            txFailed = true;
            failureErrorMsg = responseError; // Get the specific error from effects
        }
        // If responseError is null, the transaction effects indicated success or were not available/parsable

      } else {
        // If we don't even get a digest in the expected format, treat as failure
        txFailed = true;
        failureErrorMsg = 'Transaction failed to execute or response format was unexpected.';
        console.error('Stake transaction response missing digest:', result);
      }

      // 3. Handle outcome
      if (txFailed) {
         throw new Error(failureErrorMsg);
      } else {
         // Success path
         setSuccess(`Successfully staked ${formatSui(amountInMist.toString())} SUI for ${selectedDuration.label}! Digest: ${txDigest.substring(0, 10)}...`);
         setAmount('');
         refreshData(); // Call directly

         // Re-fetch balance
         try {
            const balanceResult = await suiClient.getBalance({
              owner: currentAccount.address,
              coinType: '0x2::sui::SUI'
            });
            setAvailableBalance(balanceResult.totalBalance);
         } catch (balanceError) {
             console.warn("Failed to re-fetch balance after staking:", balanceError);
             // Optionally inform user balance might be stale
         }
      }

    } catch (error: any) {
      console.error('Error staking SUI:', error);
      // Use the generic error message handler, which now includes getTransactionResponseError logic
      setError(getTransactionErrorMessage(error));
    } finally {
      setTransactionLoading(false);
    }
  };

  // --- Full JSX ---
  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Manage Stake</h2>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm break-words">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-md text-green-400 text-sm break-words">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {/* Available Balance Display */}
        <div className="bg-background rounded-lg p-3 flex justify-between items-center">
          <span className="text-gray-400 text-sm">Available Balance:</span>
          {isLoadingBalance ? (
            <span className="text-white text-sm animate-pulse">Loading...</span>
          ) : (
            <span className="text-white text-sm font-medium">{formatSui(availableBalance)} SUI</span>
          )}
        </div>

        {/* Stake Amount Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="stake-amount" className="text-gray-400 text-sm">Amount to Stake (SUI)</label>
            <button
              type="button"
              onClick={() => {
                if (availableBalance) {
                  const availableInSui = parseFloat(availableBalance) / 1_000_000_000;
                  const gasBufferInSui = 0.01; // 0.01 SUI
                  const maxPossible = availableInSui - gasBufferInSui;
                  const minStakeSui = 0.001;
                  const maxAmount = Math.max(minStakeSui, maxPossible).toFixed(9);
                  setAmount(maxPossible >= minStakeSui ? maxAmount : '0');
                }
              }}
              className="text-xs text-primary hover:text-primary-dark transition-colors"
              disabled={!currentAccount || isLoadingBalance} // Disable if no account or loading balance
            >
              Max
            </button>
          </div>
          <div className="relative">
            <input
              id="stake-amount"
              type="text"
              inputMode="decimal"
              pattern="^[0-9]*[.,]?[0-9]*$"
              value={amount}
              onChange={(e) => {
                const value = e.target.value.replace(',', '.');
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
              placeholder="0.0"
              className="w-full bg-background-input rounded p-3 text-white border border-gray-600 focus:border-primary focus:ring-primary pr-16"
              aria-label="Amount to Stake in SUI"
              disabled={!currentAccount} // Disable if no account
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              SUI
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Currently Staked: {formatSui(currentlyStaked)} SUI</span>
            <span>Min: 0.001 SUI</span>
          </div>
        </div>

        {/* Duration Selection */}
        <div>
          <label className="block text-gray-400 mb-2 text-sm">Stake Duration</label>
          <div className="grid grid-cols-3 gap-2">
            {durations.map((duration) => (
              <button
                key={duration.days}
                className={`py-2 px-3 rounded-md text-sm transition-colors ${
                  selectedDuration.days === duration.days
                    ? 'bg-primary text-white font-medium ring-2 ring-primary-focus'
                    : 'bg-background-input text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedDuration(duration)}
                disabled={!currentAccount} // Disable if no account
              >
                {duration.label}
              </button>
            ))}
          </div>

          {/* APY and Rewards Estimation */}
          <div className="mt-3 p-3 bg-background rounded-lg">
            <div className="flex justify-between mb-1">
              <span className="text-gray-400 text-sm">Est. APY Rate:</span>
              <span className="text-green-400 text-sm font-medium">{selectedDuration.apy}%</span>
            </div>
            {(() => {
              const amountNum = parseFloat(amount);
              if (!isNaN(amountNum) && amountNum > 0) {
                const apyRate = selectedDuration.apy / 100;
                const days = selectedDuration.days;
                const estRewards = amountNum * apyRate * (days / 365);
                const formattedRewards = isFinite(estRewards) ? formatSui(estRewards.toString(), 9) : '0';
                return (
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Est. Rewards:</span>
                    <span className="text-white text-sm">
                     ~{formattedRewards} SUI
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleStake}
            // More comprehensive disable check
            disabled={
                !currentAccount || // No wallet connected
                !amount || // No amount entered
                !(parseFloat(amount) > 0) || // Amount is not positive
                contextLoading.transaction || // Transaction already in progress
                isLoadingBalance // Still loading balance
            }
            className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
          >
            {contextLoading.transaction ? (
              <>
                <span className="opacity-0">Stake SUI</span> {/* Keep layout */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              </>
            ) : !currentAccount ? (
                 'Connect Wallet' // Prompt connection if disconnected
            ) :(
              'Stake SUI'
            )}
          </button>

          {/* Unstake button - disabled for now, would be implemented in StakedPositionsList */}
          <button
            disabled
            className="flex-1 bg-transparent border border-gray-600 text-gray-500 py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unstake
          </button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 mt-2 italic">
          Note: Staking locks your SUI. Early unstaking might be possible via Alpha Points loans (check loan terms).
        </div>
      </div>
    </div>
  );
};