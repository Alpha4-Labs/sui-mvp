// === StakeCard.tsx (Corrected) ===
import React, { useState } from 'react';
// Ensure this is the correct hook name exported by your dapp-kit version
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { buildStakeTransaction } from '../utils/transaction'; // Builds PTB JSON
import { formatSui } from '../utils/format';
// Import the corrected adapter function name
import { adaptPtbJsonForSignAndExecute } from '../utils/transaction-adapter';

export const StakeCard: React.FC = () => {
  const {
    refreshData,
    durations,
    selectedDuration,
    setSelectedDuration,
    setTransactionLoading,
  } = useAlphaContext();

  const [amount, setAmount] = useState('');
  // Currently staked value - remove setter if not used, fetch real value later
  // If you plan to update this state later, you can keep setCurrentlyStaked
  const [currentlyStaked] = useState('1900000000'); // Example value

  // Ensure the hook name here matches the import and your installed version
  // If the import error persists after fixing dependencies, investigate SDK/dapp-kit versions.
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const handleStake = async () => {
    // Validate amount is a positive number
    const amountFloat = parseFloat(amount);
    if (!amount || isNaN(amountFloat) || amountFloat <= 0) {
         console.error("Invalid stake amount");
         // Optionally show user feedback
         return;
    }

    setTransactionLoading(true);
    try {
      // Convert valid float amount to MIST using BigInt for precision
      const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));

      // Build the transaction PTB JSON
      const ptbJson = buildStakeTransaction(amountInMist, selectedDuration.days);

      // Adapt the PTB JSON using the corrected function name
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);

      // Sign and execute the transaction
      await signAndExecute(executionInput);

      // Reset form and refresh data on success
      setAmount('');
      refreshData(); // Ensure this refreshes relevant data
    } catch (error) {
      console.error('Error staking SUI:', error);
      // Optionally show user feedback
    } finally {
      setTransactionLoading(false);
    }
  };

  // --- JSX Rendering (Copied from previous version, seems okay) ---
  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Manage Stake</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-gray-400 mb-1">Amount to Stake (SUI)</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
                const value = e.target.value;
                if (/^\d*\.?\d*$/.test(value)) {
                    setAmount(value);
                }
            }}
            placeholder="0.0"
            className="w-full bg-background-input rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary"
          />
          <div className="text-xs text-gray-500 mt-1">
            Currently Staked: {formatSui(currentlyStaked)} SUI
          </div>
        </div>

        <div>
          <label className="block text-gray-400 mb-2">Stake Duration</label>
          <div className="grid grid-cols-3 gap-2">
            {durations.map((duration) => (
              <button
                key={duration.days}
                className={`py-2 px-3 rounded-md text-sm transition-colors ${
                  selectedDuration.days === duration.days
                    ? 'bg-primary text-white font-medium'
                    : 'bg-background-input text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedDuration(duration)}
              >
                {duration.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-green-400 mt-1 text-right">
            {selectedDuration.apy}% APY
          </div>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleStake}
            disabled={!amount || !(parseFloat(amount) > 0)}
            className="flex-1 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Stake SUI
          </button>

          {/* TODO: Implement Unstake Logic */}
          <button
            disabled
            className="flex-1 bg-transparent border border-gray-600 text-gray-500 py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unstake
          </button>
        </div>
      </div>
    </div>
  );
};