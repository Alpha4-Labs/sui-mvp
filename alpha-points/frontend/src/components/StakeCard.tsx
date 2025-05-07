import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { buildStakeSuiTransaction } from '../utils/transaction';
import {
  getTransactionErrorMessage,
  getTransactionResponseError,
} from '../utils/transaction-adapter';
import { formatSui } from '../utils/format';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getZkLoginSignature } from '@mysten/sui/zklogin';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';

export const StakeCard: React.FC = () => {
  const {
    refreshData,
    durations,
    selectedDuration,
    setSelectedDuration,
    setTransactionLoading,
    loading: contextLoading,
    address: alphaAddress,
    isConnected: alphaIsConnected,
    provider: alphaProvider
  } = useAlphaContext();

  const suiClient = useSuiClient();

  const [amount, setAmount] = useState('');
  const [currentlyStaked] = useState('0'); // This would ideally be fetched from contract
  const [availableBalance, setAvailableBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [transactionInFlight, setTransactionInFlight] = useState(false);

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Clear error when connection status changes to connected
  useEffect(() => {
    if (alphaIsConnected) {
      setError(null); // Clear any lingering error messages upon connection
    }
  }, [alphaIsConnected]);

  // Fetch user's SUI balance with improved error handling
  useEffect(() => {
    const fetchBalance = async () => {
      if (!alphaAddress) return;

      setIsLoadingBalance(true);
      try {
        console.log(`Fetching balance for ${alphaAddress}`);
        const { totalBalance } = await suiClient.getBalance({
          owner: alphaAddress,
          coinType: '0x2::sui::SUI'
        });
        console.log(`Retrieved balance: ${totalBalance}`);
        setAvailableBalance(totalBalance);
      } catch (err) {
        console.error('Error fetching SUI balance:', err);
        setError("Failed to fetch SUI balance. Please try again later.");
      } finally {
        setIsLoadingBalance(false);
      }
    };

    if (alphaAddress) {
      fetchBalance();
    } else {
      // Clear balance if account disconnects
      setAvailableBalance('0');
    }
  }, [alphaAddress, suiClient]);

  /**
   * Handles staking SUI tokens with improved transaction handling
   */
  const handleStake = async () => {
    console.log('Current alphaProvider:', alphaProvider);
    setError(null);
    setSuccess(null);

    if (!alphaIsConnected || !alphaAddress) {
      setError("Please connect your wallet or sign in.");
      return;
    }

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setError("Please enter a valid positive amount");
      return;
    }

    // Convert to MIST (SUI * 10^9)
    const amountInMist = BigInt(Math.floor(amountFloat * 1_000_000_000));
    const availableInMist = BigInt(availableBalance);
    
    // Reserve 0.01 SUI for gas
    const gasBuffer = BigInt(10_000_000); 
    
    // Minimum stake amount (0.001 SUI)
    const minStake = BigInt(1_000_000); 

    if (amountInMist < minStake) {
      setError(`Minimum stake amount is ${formatSui(minStake.toString())} SUI`);
      return;
    }

    if (amountInMist + gasBuffer > availableInMist) {
      setError("Insufficient balance for stake amount plus gas fee buffer (0.01 SUI).");
      return;
    }

    // Prevent duplicate transactions
    if (transactionInFlight) {
      console.warn("Transaction already in progress");
      return;
    }

    setTransactionInFlight(true);
    setTransactionLoading(true);

    try {
      console.log("Selected Duration Object:", selectedDuration);
      console.log(`Building stake transaction for ${amountInMist.toString()} MIST, ${selectedDuration.days} days`);
      
      // TODO: Fetch or configure the target validator address
      const placeholderValidatorAddress = "0x0000000000000000000000000000000000000000000000000000000000000000"; // REPLACE THIS
      if (placeholderValidatorAddress === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.warn("Using placeholder validator address for staking. This needs to be replaced with a real validator address.");
        setError("Configuration error: Validator address not set. Please contact support or replace the placeholder.");
        setTransactionLoading(false);
        setTransactionInFlight(false);
        return;
      }

      const transaction = buildStakeSuiTransaction(amountInMist, selectedDuration.days, placeholderValidatorAddress);
      console.log("Transaction built");

      let result: any;

      if (alphaProvider === 'google' && alphaAddress) {
        console.log("Executing transaction via zkLogin path...");

        // Set the sender for the transaction block
        transaction.setSender(alphaAddress);

        const jwt = localStorage.getItem('zkLogin_jwt');
        const ephemeralSecretKeySeedString = localStorage.getItem('zkLogin_ephemeralSecretKeySeed');
        const userSaltString = localStorage.getItem('zkLogin_userSalt') || BigInt(0).toString();
        const maxEpochString = localStorage.getItem('zkLogin_maxEpoch') || '0';
        const randomness = localStorage.getItem('zkLogin_randomness');

        if (!jwt || !ephemeralSecretKeySeedString || !randomness) {
          throw new Error("Missing required zkLogin data from localStorage for transaction execution.");
        }
        
        const secretKeySeed = Uint8Array.from(JSON.parse(ephemeralSecretKeySeedString));
        const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeySeed.slice(0, 32));

        // Now build the transaction with the sender set
        const txbBytes = await transaction.build({ client: suiClient as any });
        
        const userSignature = await ephemeralKeypair.sign(txbBytes); 

        console.warn("zkLogin transaction signing is not fully implemented yet. Placeholder for userSignature:", userSignature);
        throw new Error("zkLogin signing not complete.");

      } else if (alphaProvider === 'dapp-kit' && alphaAddress) {
        console.log("Executing transaction via dapp-kit (signAndExecute)...");
        result = await signAndExecute({ transaction: transaction.serialize() });
        console.log("dapp-kit transaction result:", result);
      } else {
        throw new Error ("Cannot determine transaction execution path: No provider or address.");
      }

      // Common result processing (needs to be adapted based on structure of 'result' from both paths)
      if (result && result.digest) { // Check if digest exists, common success indicator
        const txDigest = result.digest;
        console.log('Stake transaction submitted successfully:', txDigest);

        // Check for failure in the effects (effects might be nested differently)
        const responseError = getTransactionResponseError(result); // This might need adjustment
        if (responseError) {
          throw new Error(responseError);
        }
        
        // Success path
        setSuccess(`Successfully staked ${formatSui(amountInMist.toString())} SUI for ${selectedDuration.label}! Transaction: ${txDigest.substring(0, 10)}...`);
        setAmount('');
        
        // Delay refresh to allow indexing
        setTimeout(() => {
          refreshData();
          
          // Re-fetch balance after staking
          if (alphaAddress) {
            try {
              suiClient.getBalance({
                owner: alphaAddress,
                coinType: '0x2::sui::SUI'
              }).then(balanceResult => {
                setAvailableBalance(balanceResult.totalBalance);
              });
            } catch (balanceError) {
              console.warn("Failed to re-fetch balance after staking:", balanceError);
            }
          }
        }, 2000);
      } else {
        // Missing digest in the expected format
        throw new Error('Transaction response format was unexpected. Please check if the transaction completed.');
      }
    } catch (error) {
      console.error('Error staking SUI:', error);
      setError(getTransactionErrorMessage(error));
    } finally {
      setTransactionLoading(false);
      setTransactionInFlight(false);
    }
  };

  // --- JSX Rendering ---
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
                if (availableBalance && !isLoadingBalance) {
                  const availableInSui = parseFloat(availableBalance) / 1_000_000_000;
                  const gasBufferInSui = 0.01; // 0.01 SUI
                  const maxPossible = Math.max(0, availableInSui - gasBufferInSui);
                  const minStakeSui = 0.001;
                  
                  if (maxPossible >= minStakeSui) {
                    // Format with proper precision avoiding scientific notation
                    setAmount(maxPossible.toFixed(9).replace(/\.?0+$/, ''));
                  } else {
                    setAmount('');
                    setError(`Insufficient balance. You need at least ${minStakeSui + gasBufferInSui} SUI.`);
                  }
                }
              }}
              className="text-xs text-primary hover:text-primary-dark transition-colors"
              disabled={!alphaIsConnected || isLoadingBalance || contextLoading.transaction}
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
                // Accept only valid numeric input with one decimal point
                const value = e.target.value.replace(',', '.');
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
              placeholder="0.0"
              className="w-full bg-background-input rounded p-3 text-white border border-gray-600 focus:border-primary focus:ring-primary pr-16"
              aria-label="Amount to Stake in SUI"
              disabled={!alphaIsConnected || contextLoading.transaction}
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
                disabled={!alphaIsConnected || contextLoading.transaction}
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
                const formattedRewards = isFinite(estRewards) 
                  ? formatSui(estRewards.toString(), 4) 
                  : '0';
                
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
            disabled={
                !alphaIsConnected || 
                !amount || 
                !(parseFloat(amount) > 0) || 
                contextLoading.transaction || 
                isLoadingBalance ||
                transactionInFlight
            }
            className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
          >
            {contextLoading.transaction ? (
              <>
                <span className="opacity-0">Stake SUI</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              </>
            ) : !alphaIsConnected ? (
                 'Connect Wallet or Sign In'
            ) :(
              'Stake SUI'
            )}
          </button>

          {/* Unstake button - disabled here, implemented in StakedPositionsList */}
          <button
            disabled
            className="flex-1 bg-transparent border border-gray-600 text-gray-500 py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unstake
          </button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-500 mt-2 italic">
          Note: Staking locks your SUI for the selected duration. Early unstaking is available via Alpha Points loans.
        </div>
      </div>
    </div>
  );
};

export const buildCreateLoanTransaction = (
  stakeId: string,
  pointsAmount: number // Still expect a validated integer here
) => {
  // Defensive check remains important
  if (
    typeof pointsAmount !== 'number' ||
    !Number.isInteger(pointsAmount) ||
    pointsAmount < 0
  ) {
    throw new Error(`Invalid pointsAmount for BCS serialization: must be a non-negative integer. Received type: ${typeof pointsAmount}, value: ${pointsAmount}`);
  }

  const tx = new Transaction();

  // Explicitly serialize the number to BCS bytes for u64
  const serializedPointsAmountBytes = bcs.U64.serialize(pointsAmount).toBytes();

  // Log the serialized bytes for debugging if needed
  // console.log('Serialized pointsAmount (bytes):', serializedPointsAmountBytes);

  tx.moveCall({
    target: `${PACKAGE_ID}::loan::open_loan`,
    typeArguments: [SUI_TYPE],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.loanConfig),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(stakeId),
      tx.object(SHARED_OBJECTS.oracle),
      // Pass the BCS-serialized bytes directly
      tx.pure(serializedPointsAmountBytes), // NOTE: No second 'u64' argument needed here!
      tx.object(CLOCK_ID)
    ]
  });
  return tx;
};