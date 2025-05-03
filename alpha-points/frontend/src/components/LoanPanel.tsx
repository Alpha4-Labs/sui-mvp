// === LoanPanel.tsx (Using Corrected Adapter) ===
import React, { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui, formatAddress } from '../utils/format';
import { buildCreateLoanTransaction, buildRepayLoanTransaction } from '../utils/transaction';
// Import the corrected adapter function
import { adaptPtbJsonForSignAndExecute } from '../utils/transaction-adapter';

export const LoanPanel: React.FC = () => {
  const { stakePositions, loans, refreshData, setTransactionLoading } = useAlphaContext();
  const [selectedStakeId, setSelectedStakeId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');

  // Rename the hook's result for clarity if needed, or keep as is
  const { mutate: signAndExecute /* or rename: executeTransaction */ } = useSignAndExecuteTransaction();

  const eligiblePositions = stakePositions.filter(pos => !pos.encumbered);

  const handleCreateLoan = async () => {
    if (!selectedStakeId || !loanAmount) return;

    setTransactionLoading(true);
    try {
      // Convert to Alpha Points amount (ensure safe parsing)
      const amountNumber = parseInt(loanAmount, 10);
      if (isNaN(amountNumber)) {
          console.error("Invalid loan amount input");
          setTransactionLoading(false);
          return; // Or show user error
      }
      const pointsAmount = amountNumber * 10; // Simple conversion for demo

      // Build the PTB JSON
      const ptbJson = buildCreateLoanTransaction(selectedStakeId, pointsAmount);
      // Adapt it to the correct input structure for the hook
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);

      // Execute the transaction
      await signAndExecute(executionInput); // Pass the correctly structured object

      // Reset form and refresh data on success
      setSelectedStakeId('');
      setLoanAmount('');
      refreshData(); // Make sure this refreshes loans and positions
    } catch (error) {
      console.error('Error creating loan:', error);
      // Optionally show user feedback here
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleRepayLoan = async (loanId: string, stakeId: string) => {
    setTransactionLoading(true);
    try {
      // Build the PTB JSON
      const ptbJson = buildRepayLoanTransaction(loanId, stakeId);
      // Adapt it to the correct input structure for the hook
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);

      // Execute the transaction
      await signAndExecute(executionInput); // Pass the correctly structured object

      refreshData(); // Make sure this refreshes loans
    } catch (error) {
      console.error('Error repaying loan:', error);
      // Optionally show user feedback here
    } finally {
      setTransactionLoading(false);
    }
  };

  // --- JSX Rendering (No changes needed here based on the error) ---
  return (
    <div className="bg-background-card rounded-lg shadow-lg">
      {/* Borrow Section */}
      <div className="border-b border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Borrow Against Stake</h2>
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
                {eligiblePositions.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {/* Consider showing more useful info like amount/maturity */}
                    {formatAddress(pos.id)} - {formatSui(pos.principal)} SUI
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-1">Loan Amount (Alpha Points)</label>
              <input
                type="text" // Use type="number" for better input handling?
                inputMode="numeric" // Hint for mobile keyboards
                pattern="[0-9]*"  // Pattern for numeric input
                value={loanAmount}
                onChange={(e) => {
                    // Allow only numbers
                    const numericValue = e.target.value.replace(/[^0-9]/g, '');
                    setLoanAmount(numericValue);
                }}
                placeholder="Amount to borrow"
                className="w-full bg-background-input rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary"
              />
              <div className="text-xs text-gray-500 mt-1">
                {/* Add dynamic calculation if possible */}
                Max LTV: 70% of stake value (demo)
              </div>
            </div>

            <button
              onClick={handleCreateLoan}
              disabled={!selectedStakeId || !loanAmount || parseInt(loanAmount, 10) <= 0} // Add check for > 0
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
            {loans.map((loan) => (
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
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm" // Adjusted color/size maybe
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