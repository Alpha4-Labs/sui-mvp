// === LoanPanel.tsx (Displaying Active Loans Only) ===
import React from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui, formatAddress, formatTimestamp } from '../utils/format';
import { convertMistToSui } from '../utils/constants';

export const LoanPanel: React.FC = () => {
  const { loans, stakePositions } = useAlphaContext();

  // Helper function to get stake details for a loan
  const getStakeDetails = (stakeId: string) => {
    return stakePositions.find(pos => pos.id === stakeId);
  };

  // Calculate time since loan was opened
  const getTimeSinceOpened = (openedTimeMs: string) => {
    const openedTime = parseInt(openedTimeMs, 10);
    const now = Date.now();
    const diffMs = now - openedTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  return (
    <div className="h-full">
      <div className="p-2 h-full">
        {loans.length > 0 ? (
          <div className="space-y-2 h-full">
            {/* Title */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Active Loans</h2>
              <div className="text-xs text-gray-400">
                {loans.length} loan{loans.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            {/* Loans List */}
            <div className="space-y-1 flex-1 overflow-y-auto">
              {loans.map((loan) => {
                const stakeDetails = getStakeDetails(loan.stakeId);
                const principalSui = stakeDetails ? convertMistToSui(stakeDetails.principal) : 0;
                const timeSinceOpened = getTimeSinceOpened(loan.openedTimeMs);
                
                return (
                  <a
                    key={loan.id}
                    href={`https://suiscan.xyz/testnet/object/${loan.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-black/20 backdrop-blur-lg border border-white/10 rounded-lg p-2 hover:bg-black/30 hover:border-white/20 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-purple-500/10"
                    title="View Loan on Suiscan"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center space-x-2">
                        <div className="status-indicator-warning"></div>
                        <div>
                          <span className="text-gray-300 font-mono text-xs block">
                            Loan Position
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatAddress(loan.id)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">{timeSinceOpened}</div>
                        <div className="px-2 py-1 bg-yellow-900/50 text-yellow-300 border border-yellow-700/50 rounded text-xs font-medium">
                          Active
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Borrowed</span>
                        <div className="text-right">
                          <span className="text-white font-semibold">{formatPoints(loan.principalPoints)}</span>
                          <span className="text-purple-400 text-sm ml-1">αP</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Collateral</span>
                        <div className="text-right">
                          <span className="text-white">{principalSui.toFixed(3)}</span>
                          <span className="text-blue-400 text-sm ml-1">SUI</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Interest</span>
                        <span className="text-orange-400 text-sm font-medium">
                          {formatPoints(loan.interestOwedPoints)} αP
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">Est. Repayment</span>
                        <span className="text-red-400 text-sm font-medium">
                          {formatPoints(loan.estimatedRepayment)} αP
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 h-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Active Loans</h3>
            <p className="text-gray-400 text-sm mb-2">
              You don't have any open loan positions.
            </p>
            <p className="text-gray-500 text-xs">
              Loans appear here when you borrow Alpha Points against your stakes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
