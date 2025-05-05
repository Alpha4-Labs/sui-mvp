// === LoanPanel.tsx (Using Corrected Adapter) ===
import React, { useState, useEffect, useMemo } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui/client';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui, formatAddress } from '../utils/format';
import { buildCreateLoanTransaction, buildRepayLoanTransaction } from '../utils/transaction';
import { getTransactionErrorMessage } from '../utils/transaction-adapter';

// --- Eligible Position Filtering Logic ---
// This logic should match the one used in StakedPositionsList for "can borrow" positions.
// For this example, we consider a position eligible if:
// - It is not encumbered (not collateral for a loan)
// - It is not already mature (still locked)
// - It is not already used as collateral for a loan
// You may want to adjust this logic to match your protocol's rules.

function getEligiblePositions(stakePositions: any[], loans: any[]): any[] {
  // Get all stakeIds currently used as collateral
  const encumberedStakeIds = new Set(loans.map((loan) => loan.stakeId));
  return stakePositions.filter((pos) => {
    // Not encumbered, not mature, not already used as collateral
    const isEncumbered = encumberedStakeIds.has(pos.id);
    const isMature = pos.isMature || false; // You may want to refine this
    return !isEncumbered && !isMature;
  });
}

export const LoanPanel: React.FC = () => {
  const { stakePositions, loans, refreshData, setTransactionLoading } = useAlphaContext();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [selectedStakeId, setSelectedStakeId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [maxLoanAmount, setMaxLoanAmount] = useState(0);
  const [maxLoanUsd, setMaxLoanUsd] = useState(0);
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Assume 1 Alpha Point = $0.10 USD for demonstration
  const ALPHA_POINT_USD_VALUE = 0.1;
  // Loan-to-Value ratio (70%)
  const LTV_RATIO = 0.7;

  // Memoize eligible positions to avoid recalculating on every render
  const eligiblePositions = useMemo(
    () => getEligiblePositions(stakePositions, loans),
    [stakePositions, loans]
  );

  // Calculate max loan amount when stake position changes
  useEffect(() => {
    if (selectedStakeId) {
      const selectedPosition = eligiblePositions.find(pos => pos.id === selectedStakeId);
      if (selectedPosition) {
        // Convert SUI to Alpha Points (simplified conversion for demo)
        // Assuming 1 SUI = 10 Alpha Points for this example
        const stakeValueInPoints = Number(selectedPosition.principal) / 1_000_000_000 * 10;
        const maxLoan = Math.floor(stakeValueInPoints * LTV_RATIO);
        setMaxLoanAmount(maxLoan);
        setMaxLoanUsd(maxLoan * ALPHA_POINT_USD_VALUE);

        // Reset loan amount and percentage when position changes
        setLoanAmount('');
        setSelectedPercentage(null);
      }
    } else {
      setMaxLoanAmount(0);
      setMaxLoanUsd(0);
      setLoanAmount('');
      setSelectedPercentage(null);
    }
  }, [selectedStakeId, eligiblePositions]);

  // Handle percentage selection
  const handlePercentageSelect = (percentage: number) => {
    setSelectedPercentage(percentage);
    const amount = Math.floor(maxLoanAmount * (percentage / 100));
    setLoanAmount(amount.toString());
  };

  // Handle manual input
  const handleLoanAmountChange = (value: string) => {
    // Allow only numbers
    const numericValue = value.replace(/[^0-9]/g, '');

    if (numericValue === '') {
      setLoanAmount('');
      setSelectedPercentage(null);
      return;
    }

    const numericAmount = parseInt(numericValue, 10);

    // Cap at max loan amount
    if (numericAmount > maxLoanAmount) {
      setLoanAmount(maxLoanAmount.toString());
      setSelectedPercentage(100);
    } else {
      setLoanAmount(numericValue);
      // Calculate and set the percentage
      const percentage = Math.round((numericAmount / maxLoanAmount) * 100);
      setSelectedPercentage(percentage);
    }
  };

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const handleCreateLoan = async () => {
    // Ensure account is connected before proceeding
    if (!currentAccount?.address) {
       setError("Please connect your wallet first.");
       return;
    }
    if (!selectedStakeId || !loanAmount) return;

    setError(null);
    setTransactionLoading(true);
    try {
      // Convert to Alpha Points amount and VALIDATE
      const pointsAmount = parseInt(loanAmount, 10);
      if (
        isNaN(pointsAmount) ||
        pointsAmount <= 0 ||
        pointsAmount > maxLoanAmount
      ) {
        console.error("Invalid loan amount:", loanAmount, "Parsed:", pointsAmount);
        setError("Please enter a valid loan amount within the allowed maximum.");
        setTransactionLoading(false);
        return;
      }

      console.log("Building transaction with stakeId:", selectedStakeId, "and pointsAmount:", pointsAmount);
      const tx = buildCreateLoanTransaction(selectedStakeId, pointsAmount);

      // --- Set Sender for Dry Run ---
      tx.setSender(currentAccount.address);
      // -----------------------------

      // --- Manual Dry Run ---
      console.log("Performing manual dry run...");
      // Cast suiClient via unknown first due to structural incompatibility
      const txBytes = await tx.build({ client: suiClient as unknown as SuiClient });
      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });

      console.log('Dry Run Result:', JSON.stringify(dryRunResult, null, 2));

      if (dryRunResult.effects.status.status !== 'success') {
        const errorMsg = dryRunResult.effects.status.error || 'Unknown dry run error';
        console.error('Dry run failed:', errorMsg);
        setError(`Transaction simulation failed: ${errorMsg}`);
        setTransactionLoading(false);
        return;
      }
      // --- End Manual Dry Run --- 

      // If dry run is successful, proceed to sign and execute
      console.log("Dry run successful. Proceeding to sign and execute...");
      // Pass the original tx object (which now has sender set, but serialize() ignores it)
      const result = await signAndExecute({ transaction: tx.serialize() });
      console.log("Execution result:", result); 

      // Reset form and refresh data on success
      setSelectedStakeId('');
      setLoanAmount('');
      setSelectedPercentage(null);
      refreshData();
    } catch (error: any) {
      console.error('Error during loan creation process:', error);
      setError(error.message ? `Error: ${error.message}` : getTransactionErrorMessage(error));
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleRepayLoan = async (loanId: string, stakeId: string) => {
    setError(null);
    setTransactionLoading(true);
    try {
      const tx = buildRepayLoanTransaction(loanId, stakeId);
      const result = await signAndExecute({ transaction: tx.serialize() });
      refreshData();
    } catch (error) {
      console.error('Error repaying loan:', error);
      setError(getTransactionErrorMessage(error));
    } finally {
      setTransactionLoading(false);
    }
  };

  // --- JSX Rendering ---
  return (
    <div className="bg-background-card rounded-lg shadow-lg">
      {/* Borrow Section */}
      <div className="border-b border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Borrow Against Stake</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm break-words">
            {error}
          </div>
        )}
        
        {eligiblePositions.length === 0 ? (
          <p className="text-gray-400">
            You don't have any eligible staked positions to borrow against.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-1">Select Stake Position</label>
              <select
                value={selectedStakeId}
                onChange={(e) => setSelectedStakeId(e.target.value)}
                className="w-full bg-background-input rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary"
              >
                <option value="">-- Select a position --</option>
                {eligiblePositions.map((pos: any) => (
                  <option key={pos.id} value={pos.id}>
                    {formatSui(pos.principal)} SUI - {formatAddress(pos.id)}
                  </option>
                ))}
              </select>
            </div>

            {selectedStakeId && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Maximum Loan Amount:</span>
                  <span className="text-white font-medium">
                    {formatPoints(maxLoanAmount.toString())} αP (≈${maxLoanUsd.toFixed(2)})
                  </span>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Loan Amount (Alpha Points)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={loanAmount}
                    onChange={(e) => handleLoanAmountChange(e.target.value)}
                    placeholder={`Max ${formatPoints(maxLoanAmount.toString())} αP`}
                    className="w-full bg-background-input rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary"
                  />
                  {loanAmount && (
                    <div className="text-xs text-gray-400 mt-1">
                      ≈ ${(parseInt(loanAmount) * ALPHA_POINT_USD_VALUE).toFixed(2)} USD
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-400 mb-2">Quick Select</label>
                  <div className="flex space-x-2">
                    {[10, 25, 50, 75, 100].map((percentage) => (
                      <button
                        key={percentage}
                        onClick={() => handlePercentageSelect(percentage)}
                        className={`flex-1 py-1 px-2 rounded text-sm transition-colors ${
                          selectedPercentage === percentage
                            ? 'bg-primary text-white'
                            : 'bg-background-input text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {percentage}%
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleCreateLoan}
              disabled={!selectedStakeId || !loanAmount || parseInt(loanAmount, 10) <= 0 || parseInt(loanAmount, 10) > maxLoanAmount}
              className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Loan
            </button>
          </div>
        )}
      </div>

      {/* Active Loans Section */}
      <div className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Active Loans</h2>
        {loans.length === 0 ? (
          <p className="text-gray-400">You don't have any active loans.</p>
        ) : (
          <div className="space-y-4">
            {loans.map((loan: any) => (
              <div key={loan.id} className="border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-gray-400">Loan ID</span>
                  <span className="text-white font-mono">{formatAddress(loan.id)}</span>
                </div>

                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-gray-400">Borrowed Amount</span>
                  <span className="text-white">{formatPoints(loan.principalPoints)} αP</span>
                </div>

                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-gray-400">Collateral (Stake ID)</span>
                  <span className="text-white font-mono">{formatAddress(loan.stakeId)}</span>
                </div>

                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-gray-400">Est. Repayment</span>
                  <span className="text-white">{formatPoints(loan.estimatedRepayment)} αP</span>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => handleRepayLoan(loan.id, loan.stakeId)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                  >
                    Repay Loan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
