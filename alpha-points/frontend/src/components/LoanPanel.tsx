// === LoanPanel.tsx (Using Corrected Adapter) ===
import React, { useState, useEffect, useMemo } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui/client';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui, formatAddress } from '../utils/format';
import { buildCreateLoanTransaction } from '../utils/transaction';
import { getTransactionErrorMessage } from '../utils/transaction-adapter';
import { 
  SUI_PRICE_USD, 
  ALPHA_POINTS_PER_USD, 
  ALPHA_POINTS_PER_SUI,
  convertMistToSui
} from '../utils/constants';

import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Eligible Position Filtering Logic ---
// Only positions that are not encumbered and not mature are eligible
function getEligiblePositions(stakePositions: any[]): any[] {
  return stakePositions.filter((pos) => {
    const isEncumbered = pos.encumbered === true;
    const isMature = pos.maturityPercentage >= 100;
    return !isEncumbered && !isMature;
  });
}

export const LoanPanel: React.FC = () => {
  const { stakePositions, refreshData, setTransactionLoading } = useAlphaContext();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [selectedStakeId, setSelectedStakeId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [maxLoanAmount, setMaxLoanAmount] = useState(0);
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use centralized constants for consistent Alpha Points calculations

  // Loan-to-Value ratio (70%)
  const LTV_RATIO = 0.7;

  // Memoize eligible positions to avoid recalculating on every render
  const eligiblePositions = useMemo(
    () => getEligiblePositions(stakePositions),
    [stakePositions]
  );

  // Calculate max loan amount when stake position changes
  useEffect(() => {
    if (selectedStakeId) {
      const selectedPosition = eligiblePositions.find(pos => pos.id === selectedStakeId);
      if (selectedPosition) {
        const principalSuiValue = convertMistToSui(selectedPosition.principal);
        // Calculate the stake's value in Alpha Points using centralized constants
        const stakeValueInAlphaPoints = principalSuiValue * ALPHA_POINTS_PER_SUI;
        
        const maxLoan = Math.floor(stakeValueInAlphaPoints * LTV_RATIO);
        setMaxLoanAmount(maxLoan);
        
        // USD value of the max loan, using the new Alpha Point USD value
        // setMaxLoanUsd(maxLoan * ALPHA_POINT_PRICE_USD_FOR_LOAN); // Removed as maxLoanUsd is not used
        setLoanAmount(maxLoan > 0 ? maxLoan.toString() : '0'); // Default to max loan if possible
        setError(null); // Clear previous errors
      }
    } else {
      setMaxLoanAmount(0);
      // setMaxLoanUsd(0); // Removed as maxLoanUsd is not used
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
      const currentLoanAmount = parseInt(numericValue, 10);
      if (maxLoanAmount > 0 && !isNaN(currentLoanAmount)) { // Add check for maxLoanAmount > 0
        const percentage = Math.round((currentLoanAmount / maxLoanAmount) * 100);
        setSelectedPercentage(percentage);
      } else {
        setSelectedPercentage(null); // Reset if maxLoanAmount is 0 or input is invalid
      }
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
        setError("Please enter a valid loan amount within the allowed maximum.");
        setTransactionLoading(false);
        return;
      }

      const tx = buildCreateLoanTransaction(selectedStakeId, pointsAmount);

      // --- Set Sender for Dry Run ---
      tx.setSender(currentAccount.address);
      // -----------------------------

      // --- Manual Dry Run ---
      // Cast suiClient via unknown first due to structural incompatibility
      const txBytes = await tx.build({ client: suiClient as unknown as SuiClient });
      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });

      if (dryRunResult.effects.status.status !== 'success') {
        const errorMsg = dryRunResult.effects.status.error || 'Unknown dry run error';
        setError(`Transaction simulation failed: ${errorMsg}`);
        setTransactionLoading(false);
        return;
      }
      // --- End Manual Dry Run --- 

      // If dry run is successful, proceed to sign and execute
      // Attempt to use tx.serialize() to bypass Transaction object identity issue
      /* const result = */ await signAndExecute({ transaction: tx.serialize() });

      // Refresh data and reset form on success
      await refreshData();
      setSelectedStakeId('');
      setLoanAmount('');
      setSelectedPercentage(null);
      setTimeout(() => {
        toast.success("Loan created successfully! Your stake is now locked as collateral.", { position: 'top-center', autoClose: 5000 });
      }, 0);
    } catch (error: any) {
      setError(error.message ? `Error: ${error.message}` : getTransactionErrorMessage(error));
    } finally {
      setTransactionLoading(false);
    }
  };

  // Show error toasts
  useEffect(() => {
    if (error) {
      toast.error(error, { position: 'top-center', autoClose: 5000 });
    }
  }, [error]);

  // --- JSX Rendering ---
  return (
    <div className="card-modern">
      {/* "Loan Against Stake" Section */}
      <div className="p-4">
        {eligiblePositions.length > 0 ? (
          <div className="space-y-4">
            {/* Title */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Loan Against Stake</h2>
              <div className="text-xs text-gray-400">
                Borrow up to 70% of your stake value
              </div>
            </div>
            
            {/* Loan Creation Form */}
            <div className="space-y-4">
              {/* Position Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Collateral Position</label>
                <select
                  value={selectedStakeId}
                  onChange={(e) => setSelectedStakeId(e.target.value)}
                  className="w-full bg-black/20 backdrop-blur-lg border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300"
                >
                  <option value="">-- Select a position --</option>
                  {eligiblePositions.map((pos: any) => (
                    <option key={pos.id} value={pos.id}>
                      {formatSui(pos.principal)} SUI - {formatAddress(pos.id)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Loan Amount Input */}
              <div>
                <label htmlFor="loanAmountInput" className="block text-sm font-medium text-gray-300 mb-2">
                  Loan Amount (Alpha Points)
                </label>
                <input
                  id="loanAmountInput"
                  type="text"
                  inputMode="numeric"
                  value={!selectedStakeId ? "" : (parseInt(loanAmount, 10).toLocaleString(undefined, {maximumFractionDigits: 0}) || '')}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/[^0-9]/g, '');
                    handleLoanAmountChange(rawValue);
                  }}
                  placeholder={selectedStakeId ? `Max ${formatPoints(maxLoanAmount.toString())} αP` : "Select a position first"}
                  disabled={!selectedStakeId}
                  className="w-full bg-black/20 backdrop-blur-lg border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Loan Amount (Alpha Points)"
                />
                {selectedStakeId && maxLoanAmount > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Maximum available: {formatPoints(maxLoanAmount.toString())} αP
                  </div>
                )}
              </div>

              {/* Quick Select Buttons */}
              {selectedStakeId && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quick Select</label>
                  <div className="flex gap-2 flex-wrap">
                    {[10, 25, 50, 75, 100].map((percentage) => (
                      <button
                        key={percentage}
                        onClick={() => handlePercentageSelect(percentage)}
                        className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                          selectedPercentage === percentage
                            ? 'bg-purple-500 text-white shadow-lg'
                            : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-white/10'
                        }`}
                      >
                        {percentage}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Create Loan Button */}
              <button
                onClick={handleCreateLoan}
                disabled={!selectedStakeId || !loanAmount || parseInt(loanAmount, 10) <= 0 || parseInt(loanAmount, 10) > maxLoanAmount}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl"
              >
                {!selectedStakeId 
                  ? 'Select Position' 
                  : !loanAmount || parseInt(loanAmount, 10) <= 0
                  ? 'Enter Loan Amount'
                  : `Create Loan for ${formatPoints(loanAmount)} αP`
                }
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Eligible Positions</h3>
            <p className="text-gray-400 text-sm">
              You need active, unencumbered stake positions to create loans.
            </p>
          </div>
        )}
      </div>

      {/* Information Section */}
      <div className="border-t border-white/10 p-4 bg-black/10">
        <div className="flex items-start space-x-3">
          <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-300 mb-2">Loan Information</h4>
            <ul className="text-xs text-gray-300 space-y-1 mb-3">
              <li>• Maximum loan-to-value ratio: 70%</li>
              <li>• Interest rate: 5% APY (calculated daily)</li>
              <li>• Your staked SUI will be locked as collateral</li>
              <li>• Repay the loan to unlock your collateral</li>
            </ul>
            <div className="text-xs text-gray-400 bg-black/20 rounded-lg p-2 border border-white/10">
              <strong>View Active Loans:</strong> Check your existing loans and repayment options on the Dashboard.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
