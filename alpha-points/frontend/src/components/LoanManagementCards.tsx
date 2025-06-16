import React, { useState, useEffect } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatSui, formatPoints } from '../utils/format';
import { SUI_PRICE_USD, ALPHA_POINTS_PER_USD } from '../utils/constants';
import { buildCreateLoanTransaction } from '../utils/transaction';

interface LoanManagementCardsProps {
  // Optional props for customization
  className?: string;
}

export const LoanManagementCards: React.FC<LoanManagementCardsProps> = ({ className = '' }) => {
  const { stakePositions, points, isConnected, refreshStakePositions, loading, setTransactionLoading, refreshData, refreshLoansData } = useAlphaContext();
  const [selectedStakeId, setSelectedStakeId] = useState<string | null>(null);
  const [loanAmount, setLoanAmount] = useState('');
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Load stake positions when component mounts
  useEffect(() => {
    if (isConnected && stakePositions.length === 0 && !loading.positions) {
      refreshStakePositions();
    }
  }, [isConnected, stakePositions.length, loading.positions, refreshStakePositions]);

  // Filter eligible positions (same logic as LoanPanel)
  const eligiblePositions = stakePositions.filter((pos) => {
    const isEncumbered = pos.encumbered === true;
    const isMature = pos.maturityPercentage >= 100;
    return !isEncumbered && !isMature;
  });

  // Calculate available collateral from eligible positions only
  const availableCollateral = eligiblePositions.reduce((total, position) => {
    const principal = parseFloat(position.principal || '0') / 1_000_000_000; // Convert MIST to SUI
    return total + principal;
  }, 0);

  // Calculate max loan amount (70% LTV)
  const maxLoanAmount = availableCollateral * SUI_PRICE_USD * ALPHA_POINTS_PER_USD * 0.7;

  // Handle loan creation
  const handleCreateLoan = async () => {
    if (!selectedStakeId || !loanAmount || parseInt(loanAmount) <= 0) {
      return;
    }

    try {
      setTransactionLoading(true);
      
      const transaction = buildCreateLoanTransaction(
        selectedStakeId,
        parseInt(loanAmount)
      );

      await signAndExecute(
        { transaction },
        {
          onSuccess: async (result) => {
            console.log('Loan created successfully:', result);
            
            // Reset form
            setSelectedStakeId(null);
            setLoanAmount('');
            
            // Refresh all relevant data after successful loan creation
            try {
              // Refresh stake positions (to show encumbered status)
              await refreshStakePositions();
              // Refresh loans data (to show new loan)
              await refreshLoansData();
              // Refresh general data (points balance, etc.)
              await refreshData();
            } catch (refreshError) {
              console.error('Error refreshing data after loan creation:', refreshError);
            }
          },
          onError: (error) => {
            console.error('Failed to create loan:', error);
            // You could add a toast notification here
          }
        }
      );
    } catch (error) {
      console.error('Error creating loan:', error);
    } finally {
      setTransactionLoading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Loan Overview Card */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Loan Overview</h3>
            <p className="text-sm text-gray-400">Borrow Alpha Points against your staked SUI</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Available Collateral</div>
            <div className="text-lg font-semibold text-white">
              {formatSui((availableCollateral * 1_000_000_000).toString())} SUI
            </div>
            <div className="text-xs text-gray-400">
              ≈ ${(availableCollateral * SUI_PRICE_USD).toFixed(2)}
            </div>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Max Loan (70% LTV)</div>
            <div className="text-lg font-semibold text-purple-400">
              {formatPoints(maxLoanAmount.toString(), 0)} αP
            </div>
            <div className="text-xs text-gray-400">
              ≈ ${(maxLoanAmount / ALPHA_POINTS_PER_USD).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Collateral Selection Card */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Select Collateral</h3>
            <p className="text-sm text-gray-400">Choose which staked position to use as collateral</p>
          </div>
        </div>

        {loading.positions ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-spin">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Loading stake positions...</p>
            <p className="text-gray-500 text-xs mt-1">Please wait while we fetch your collateral</p>
          </div>
        ) : eligiblePositions.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">No eligible stake positions for collateral</p>
            <p className="text-gray-500 text-xs mt-1">Need active, unencumbered stakes to borrow against</p>
          </div>
        ) : (
          <div className="space-y-2">
            {eligiblePositions.map((position) => {
              const principal = parseFloat(position.principal || '0') / 1_000_000_000;
              const value = principal * SUI_PRICE_USD;
              const maxLoan = value * ALPHA_POINTS_PER_USD * 0.7;
              
              return (
                <div
                  key={position.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    selectedStakeId === position.id
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : 'border-white/10 bg-black/10 hover:border-white/20 hover:bg-black/20'
                  }`}
                  onClick={() => setSelectedStakeId(position.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-white font-medium">
                        {formatSui(position.principal || '0')} SUI
                      </div>
                      <div className="text-xs text-gray-400">
                        Max loan: {formatPoints(maxLoan.toString(), 0)} αP
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">
                          {position.durationDays} days
                        </div>
                        <div className="text-xs text-green-400">
                          {position.maturityPercentage}% mature
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        selectedStakeId === position.id
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-400'
                      }`}>
                        {selectedStakeId === position.id && (
                          <div className="w-full h-full rounded-full bg-white scale-50"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Loan Amount Card */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Loan Amount</h3>
            <p className="text-sm text-gray-400">Enter the amount of Alpha Points to borrow</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 pr-12"
              disabled={!selectedStakeId}
            />
            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
              αP
            </span>
          </div>

          {/* Quick Amount Buttons */}
          {selectedStakeId && maxLoanAmount > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <button 
                onClick={() => setLoanAmount(Math.floor(maxLoanAmount * 0.1).toString())}
                className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200"
              >
                10%
              </button>
              <button 
                onClick={() => setLoanAmount(Math.floor(maxLoanAmount * 0.25).toString())}
                className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200"
              >
                25%
              </button>
              <button 
                onClick={() => setLoanAmount(Math.floor(maxLoanAmount * 0.5).toString())}
                className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200"
              >
                50%
              </button>
              <button 
                onClick={() => setLoanAmount(Math.floor(maxLoanAmount).toString())}
                className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200"
              >
                MAX
              </button>
            </div>
          )}

          {loanAmount && selectedStakeId && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">You'll receive:</span>
                <span className="text-white font-semibold">{formatPoints(loanAmount)} αP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Est. repayment:</span>
                <span className="text-orange-400">
                  {formatPoints((parseInt(loanAmount || '0') * 1.051).toString(), 0)} αP
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Card */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <button
          onClick={handleCreateLoan}
          disabled={!isConnected || !selectedStakeId || !loanAmount || parseInt(loanAmount) <= 0 || loading.transaction}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center"
        >
          {loading.transaction ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Loan...
            </>
          ) : !isConnected ? (
            'Connect Wallet'
          ) : !selectedStakeId ? (
            'Select Collateral'
          ) : !loanAmount || parseInt(loanAmount) <= 0 ? (
            'Enter Loan Amount'
          ) : (
            `Borrow ${formatPoints(loanAmount)} αP`
          )}
        </button>

        {isConnected && (
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-400">
              By borrowing, you agree to use your staked SUI as collateral.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Loans must be repaid to unlock your collateral.
            </p>
          </div>
        )}
      </div>


    </div>
  );
}; 