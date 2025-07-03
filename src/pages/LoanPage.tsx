import React, { useEffect } from 'react';
import { LoanPanel } from '../components/LoanPanel';
import { useAlphaContext } from '../context/AlphaContext';

export const LoanPage: React.FC = () => {
  const { stakePositions, refreshLoansData, isConnected } = useAlphaContext();
  
  // Load loans data when accessing loan page
  useEffect(() => {
    if (isConnected) {
      refreshLoansData();
    }
  }, [isConnected, refreshLoansData]);
  
  // Check for eligible positions (same logic as in LoanPanel)
  const eligiblePositions = stakePositions.filter((pos) => {
    const isEncumbered = pos.encumbered === true;
    const isMature = pos.maturityPercentage >= 100;
    return !isEncumbered && !isMature;
  });

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 text-transparent bg-clip-text mb-4">
          Alpha Points Loans
        </h1>
        <p className="text-gray-400 text-lg">Borrow Alpha Points against your staked assets.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up">
        {/* Left Column: Vertical Steps */}
        <div className="card-modern p-6">
          <h2 className="text-xl font-semibold text-white mb-6">How It Works</h2>
          
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex items-start space-x-4 group">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                <span className="text-xl font-bold text-white">1</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base mb-2">Select Stake Position</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Choose one of your active stake positions to use as collateral for your loan.
                </p>
              </div>
            </div>

            {/* Connector Line */}
            <div className="flex justify-start">
              <div className="w-12 flex justify-center">
                <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-600 to-purple-500"></div>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="flex items-start space-x-4 group">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                <span className="text-xl font-bold text-white">2</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base mb-2">Borrow Alpha Points</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Borrow up to 70% of your stake's value in Alpha Points. Points are added to your balance instantly.
                </p>
              </div>
            </div>

            {/* Connector Line */}
            <div className="flex justify-start">
              <div className="w-12 flex justify-center">
                <div className="w-0.5 h-6 bg-gradient-to-b from-pink-600 to-emerald-500"></div>
              </div>
            </div>
            
            {/* Step 3 */}
            <div className="flex items-start space-x-4 group">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                <span className="text-xl font-bold text-white">3</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base mb-2">Repay When Ready</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Repay your loan plus interest to unlock your stake. Interest accrues at 5% APR.
                </p>
              </div>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-start space-x-3 text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium leading-relaxed">
                Your stake will remain locked until the loan is repaid, even if the original lock period has expired.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Input Bar + Vertical Swiper */}
        <div className="space-y-6">
          {/* Input/Controls Section */}
          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Loan Calculator</h2>
              {eligiblePositions.length === 0 && (
                <p className="text-gray-400 text-sm">
                  No eligible staked positions to borrow against
                </p>
              )}
            </div>
            
            {/* Amount Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Loan Amount (Alpha Points)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter amount..."
                    className="w-full bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-medium">
                    αP
                  </span>
                </div>
              </div>
              
              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200">
                  25%
                </button>
                <button className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200">
                  50%
                </button>
                <button className="bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200">
                  Max
                </button>
              </div>
            </div>
          </div>

          {/* Loan Positions Panel */}
          <div className="animate-slide-up animation-delay-200">
            <LoanPanel />
          </div>
        </div>
      </div>
    </div>
  );
};