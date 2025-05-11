import React from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatSui } from '../utils/format';
import suiLogo from '../assets/sui-logo.jpg';

export const UserBalancesCard: React.FC = () => {
  const {
    loading: alphaContextLoading,
    suiBalance,
    isConnected,
    logout,
  } = useAlphaContext();

  const handleDisconnect = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error disconnecting:", error);
    }
  };
  
  if (alphaContextLoading.suiBalance) {
    return (
      <div className="bg-background-card rounded-lg p-6 shadow-lg animate-pulse">
        <div> 
          <div className="h-6 bg-gray-700 rounded w-1/2 mb-3"></div>
          <div className="h-10 bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-700 rounded w-full mb-3"></div>
          <div className="h-8 bg-gray-700 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-white">Your SUI Balance</h2>
            <p className="text-4xl font-bold text-primary flex items-center">
              {formatSui(suiBalance)}
              <img src={suiLogo} alt="Sui Logo" className="w-6 h-6 rounded-full object-cover ml-2" />
            </p>
          </div>
        </div>
        <div className="flex items-stretch space-x-2 p-1 bg-background-input rounded-md border border-gray-600">
          <a
            href="https://faucet.testnet.sui.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-cyan-500 hover:bg-cyan-600 text-white py-2.5 px-4 rounded-md transition-colors text-sm font-medium"
          >
            Get Testnet SUI
          </a>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              disabled={alphaContextLoading.transaction}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-md transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {alphaContextLoading.transaction ? 'Processing...' : 'Disconnect Wallet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 