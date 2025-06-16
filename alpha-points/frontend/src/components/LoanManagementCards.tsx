import React, { useState } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatSui, formatPoints } from '../utils/format';
import { SUI_PRICE_USD, ALPHA_POINTS_PER_USD } from '../utils/constants';

interface LoanManagementCardsProps {
  // Optional props for customization
  className?: string;
}

export const LoanManagementCards: React.FC<LoanManagementCardsProps> = ({ className = '' }) => {
  const { stakePositions, points, isConnected } = useAlphaContext();
  const [selectedStakeId, setSelectedStakeId] = useState<string | null>(null);
  const [loanAmount, setLoanAmount] = useState('');

  // Calculate available collateral from stake positions
  const availableCollateral = stakePositions.reduce((total, position) => {
    if (!position.isEncumbered) {
      const principal = parseFloat(position.principal || '0') / 1_000_000_000; // Convert MIST to SUI
      return total + principal;
    }
    return total;
  }, 0);

  // Calculate max loan amount (70% LTV)
  const maxLoanAmount = availableCollateral * SUI_PRICE_USD * ALPHA_POINTS_PER_USD * 0.7;

  // Get unencumbered positions for selection
  const availablePositions = stakePositions.filter(pos => !pos.isEncumbered);

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

        {availablePositions.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">No available stake positions for collateral</p>
            <p className="text-gray-500 text-xs mt-1">Stake SUI first to use as loan collateral</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availablePositions.map((position) => {
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
                      <span className="text-xs text-gray-400">
                        {position.duration} days
                      </span>
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

          {loanAmount && selectedStakeId && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Loan Amount:</span>
                <span className="text-white">{formatPoints(loanAmount)} αP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">USD Value:</span>
                <span className="text-white">${(parseInt(loanAmount || '0') / ALPHA_POINTS_PER_USD).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Interest Rate:</span>
                <span className="text-white">5% APY</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Origination Fee:</span>
                <span className="text-white">0.1%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Card */}
      <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <button
          disabled={!isConnected || !selectedStakeId || !loanAmount || parseInt(loanAmount) <= 0}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {!isConnected 
            ? 'Connect Wallet' 
            : !selectedStakeId 
            ? 'Select Collateral' 
            : !loanAmount || parseInt(loanAmount) <= 0
            ? 'Enter Loan Amount'
            : `Borrow ${formatPoints(loanAmount)} αP`
          }
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

      {/* Information Card */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <div className="w-6 h-6 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-amber-300 mb-2">Important Information</h4>
            <ul className="text-xs text-amber-200/80 space-y-1">
              <li>• Maximum loan-to-value ratio: 70%</li>
              <li>• Interest rate: 5% APY (calculated daily)</li>
              <li>• Origination fee: 0.1% of loan amount</li>
              <li>• Your staked SUI will be locked as collateral</li>
              <li>• Repay the loan to unlock your collateral</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 