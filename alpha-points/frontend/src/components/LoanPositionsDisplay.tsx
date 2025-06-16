// === LoanPositionsDisplay.tsx (Dashboard Display Only) ===
import React from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui, formatAddress, formatTimestamp } from '../utils/format';
import { convertMistToSui } from '../utils/constants';

export const LoanPositionsDisplay: React.FC = () => {
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
    <div className="card-modern p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Active Loans</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">
                Your loan positions
              </p>
              {loans.length > 0 && (
                <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-lg text-xs font-medium">
                  {loans.length} active
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loans Content */}
      {loans.length > 0 ? (
        <div className="space-y-3">
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
                className="block bg-black/20 backdrop-blur-lg border border-white/10 rounded-lg p-4 hover:bg-black/30 hover:border-white/20 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-yellow-500/10"
                title="View Loan on Suiscan"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="status-indicator-warning"></div>
                    <div>
                      <span className="text-gray-300 font-mono text-sm block">
                        Loan Position
                      </span>
                      <span className="text-gray-500 text-xs">
                        {formatAddress(loan.id)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 mb-1">{timeSinceOpened}</div>
                    <div className="px-2 py-1 bg-yellow-900/50 text-yellow-300 border border-yellow-700/50 rounded text-xs font-medium">
                      Active
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Borrowed</span>
                      <div className="text-right">
                        <span className="text-white font-semibold">{formatPoints(loan.principalPoints)}</span>
                        <span className="text-purple-400 text-sm ml-1">αP</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Interest</span>
                      <span className="text-orange-400 text-sm font-medium">
                        {formatPoints(loan.interestOwedPoints)} αP
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Collateral</span>
                      <div className="text-right">
                        <span className="text-white">{principalSui.toFixed(3)}</span>
                        <span className="text-blue-400 text-sm ml-1">SUI</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Total Due</span>
                      <span className="text-red-400 text-sm font-medium">
                        {formatPoints(loan.estimatedRepayment)} αP
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action hint */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-gray-500 text-center">
                    💡 Go to Generation page to create new loans
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center mb-3 shadow-lg">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-white mb-1">No Active Loans</h3>
          <p className="text-sm text-gray-400 mb-1">You don't have any open loan positions.</p>
          <p className="text-xs text-gray-500">Go to Generation page to create your first loan</p>
        </div>
      )}
    </div>
  );
}; 