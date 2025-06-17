import React from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatSui } from '../utils/format';

export const UserBalancesCard: React.FC = () => {
  const { suiBalance, loading: { suiBalance: isLoadingBalance } } = useAlphaContext();

  const formatSuiBalance = () => {
    return formatSui(suiBalance, 2); // Format with 2 decimal places
  };

  const handleFaucetClick = () => {
    window.open('https://faucet.sui.io/?network=testnet', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="card-modern p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white mb-1">SUI Balance</h3>
            
            {isLoadingBalance ? (
              <div className="animate-pulse">
                <div className="h-6 bg-gray-700/50 rounded w-24 mb-2"></div>
                <div className="h-3 bg-gray-700/30 rounded w-16"></div>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline space-x-2 mb-1">
                  <span className="text-xl font-bold text-white">{formatSuiBalance()}</span>
                  <span className="text-base text-blue-400 font-medium">SUI</span>
                </div>
                <div className="text-xs text-gray-400">
                  ??? ${(parseFloat(formatSuiBalance()) * 3.28).toFixed(2)} USD
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-shrink-0">
          <button
            onClick={handleFaucetClick}
            className="btn-modern-secondary text-sm px-4 py-2 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Get Testnet SUI</span>
          </button>
        </div>
      </div>
    </div>
  );
}; 
