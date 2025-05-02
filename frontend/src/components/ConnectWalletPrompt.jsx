// src/components/ConnectWalletPrompt.jsx
import React from 'react';
import Spinner from './Spinner';

/**
 * Component for prompting users to connect their wallet when not connected
 */
function ConnectWalletPrompt({ 
  isMobile, 
  isInAppBrowser, 
  isConnecting,
  availableWallets, 
  onConnectWallet 
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full pt-20 text-center">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        Welcome to Alpha Points
      </h1>
      
      <p className="text-xl text-gray-400 mb-4 px-4">
        Connect your wallet to track your points and stake ALPHA.
      </p>
      
      {/* Mobile-specific message */}
      {isMobile && (
        <p className="text-sm text-gray-500 mb-6 max-w-lg">
          You're using a mobile device. You can connect using a mobile wallet app like Sui Wallet or other compatible wallets.
        </p>
      )}
      
      {/* In-app browser detection message */}
      {isInAppBrowser && (
        <p className="text-sm text-gray-500 mb-6 max-w-lg">
          You're browsing from within a wallet app. Your wallet should be available automatically.
        </p>
      )}
      
      <button
        onClick={onConnectWallet}
        disabled={isConnecting}
        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 active:scale-100 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isConnecting ? <Spinner/> : 'Connect Wallet'}
      </button>
      
      {/* Show available wallet info */}
      {availableWallets.length > 0 && (
        <div className="mt-6 text-xs text-gray-500">
          {availableWallets.length === 1 ? (
            <p>Found: {availableWallets[0].name}</p>
          ) : (
            <p>Found {availableWallets.length} wallet options</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ConnectWalletPrompt;