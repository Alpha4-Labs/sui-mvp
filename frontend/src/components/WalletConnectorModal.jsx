// src/components/WalletConnectorModal.jsx
import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, ExclamationCircleIcon, ArrowPathIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'; 
import Spinner from './Spinner';

// Default wallet icons (using imported SVGs)
import suiWalletLogo from '../assets/sui-wallet-logo.svg';
import suietLogo from '../assets/suiet-logo.svg';
import ethosLogo from '../assets/ethos-logo.svg';

const DEFAULT_ICONS = {
  'Sui Wallet': suiWalletLogo,
  'Suiet': suietLogo,
  'Ethos Wallet': ethosLogo,
  // Add more default icons as needed
};

function WalletConnectorModal({ 
  isOpen, 
  onClose, 
  wallets = [], 
  isConnecting,
  connectionStatus, // 'idle', 'connecting', 'pending', 'connected', 'failed'
  pendingWalletName, // Name of wallet we're waiting for
  onSelectWallet,
  isMobile,
  error,
  onRetry
}) {
  // Function to get appropriate icon for a wallet
  const getWalletIcon = (wallet) => {
    if (wallet.icon) return wallet.icon;
    
    // Try to find a default icon based on wallet name
    for (const [key, icon] of Object.entries(DEFAULT_ICONS)) {
      if (wallet.name.includes(key)) return icon;
    }
    
    // Fallback icon
    return null;
  };

  // Group wallets by type for better organization
  const mobileWallets = wallets.filter(wallet => wallet.type === 'mobile-app');
  const standardWallets = wallets.filter(wallet => wallet.type === 'standard');

  // Determine if we need to show the error state
  const isProcessingError = error && error.includes("already in progress");
  const isRejectedError = error && error.includes("rejected");
  const isPendingConnection = connectionStatus === 'pending';

  // Function to refresh the page
  const handleRefreshPage = () => {
    window.location.reload();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal Content */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-800 border border-gray-700 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium text-white">
                    Connect Wallet
                  </Dialog.Title>
                  <button 
                    onClick={onClose}
                    className="text-gray-400 hover:text-white rounded-full p-1 focus:outline-none"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Pending Connection State */}
                {isPendingConnection && (
                  <div className="mt-2 mb-6 p-4 rounded-lg bg-blue-900/50 border border-blue-700 text-blue-200 text-sm flex gap-3 items-start">
                    <DevicePhoneMobileIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p><strong>Wallet app opened!</strong></p>
                      <p className="mt-1">Please approve the connection request in the {pendingWalletName} app.</p>
                      <p className="mt-3 text-xs">After connecting, return to this browser tab.</p>
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={onRetry}
                          className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-blue-100 rounded-md text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowPathIcon className="h-3.5 w-3.5" />
                          Try Again
                        </button>
                        <button
                          onClick={handleRefreshPage}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md text-xs transition-colors"
                        >
                          Refresh Page
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Error Message Display */}
                {error && !isPendingConnection && (
                  <div className={`mt-2 mb-6 p-4 rounded-lg text-sm flex gap-3 items-start ${
                    isProcessingError 
                      ? 'bg-yellow-900/50 border border-yellow-700 text-yellow-200' 
                      : 'bg-red-900/50 border border-red-700 text-red-200'
                  }`}>
                    <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p>{error}</p>
                      
                      {isProcessingError && (
                        <div className="mt-3 flex flex-col gap-2">
                          <p className="text-xs">
                            Your wallet is still processing the previous connection request. 
                            Please check your wallet extension and try again in a moment.
                          </p>
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={onRetry}
                              className="px-3 py-1.5 bg-yellow-800 hover:bg-yellow-700 text-yellow-100 rounded-md text-xs flex items-center gap-1.5 transition-colors"
                            >
                              <ArrowPathIcon className="h-3.5 w-3.5" />
                              Try Again
                            </button>
                            <button
                              onClick={handleRefreshPage}
                              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md text-xs transition-colors"
                            >
                              Refresh Page
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {isRejectedError && (
                        <p className="mt-1 text-xs">
                          You rejected the connection request. You can try connecting again when ready.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Main content - don't hide wallet options even if there's an error */}
                <div className="mt-2 space-y-6">
                  {/* Show relevant message based on device type */}
                  <p className="text-sm text-gray-400">
                    {isMobile 
                      ? "Connect with your Sui wallet app."
                      : "Connect with your browser extension Sui wallet."}
                  </p>

                  {/* Recommended section - show most appropriate options first */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-300">Recommended for your device</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {isMobile && mobileWallets.length > 0 ? (
                        // Show mobile wallets for mobile users
                        mobileWallets.map(wallet => (
                          <WalletButton
                            key={wallet.id}
                            wallet={wallet}
                            icon={getWalletIcon(wallet)}
                            onClick={() => onSelectWallet(wallet)}
                            disabled={isConnecting || isPendingConnection}
                            isLoading={isConnecting && pendingWalletName === wallet.name}
                          />
                        ))
                      ) : standardWallets.length > 0 ? (
                        // Show standard wallets
                        standardWallets.map(wallet => (
                          <WalletButton
                            key={wallet.id}
                            wallet={wallet}
                            icon={getWalletIcon(wallet)}
                            onClick={() => onSelectWallet(wallet)}
                            disabled={isConnecting || isPendingConnection}
                            isLoading={isConnecting && pendingWalletName === wallet.name}
                          />
                        ))
                      ) : (
                        <div className="text-center py-3 text-gray-500">
                          No compatible wallets detected
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Other options section - show secondary options */}
                  {((isMobile && standardWallets.length > 0) || 
                   (!isMobile && mobileWallets.length > 0)) && (
                    <div className="space-y-3 mt-6 pt-4 border-t border-gray-700">
                      <h4 className="text-sm font-medium text-gray-300">Other options</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {isMobile ? (
                          // Show standard wallets as secondary option on mobile
                          standardWallets.map(wallet => (
                            <WalletButton
                              key={wallet.id}
                              wallet={wallet}
                              icon={getWalletIcon(wallet)}
                              onClick={() => onSelectWallet(wallet)}
                              disabled={isConnecting || isPendingConnection}
                              isLoading={isConnecting && pendingWalletName === wallet.name}
                            />
                          ))
                        ) : (
                          // Show mobile deep links as secondary option on desktop
                          mobileWallets.map(wallet => (
                            <WalletButton
                              key={wallet.id}
                              wallet={wallet}
                              icon={getWalletIcon(wallet)}
                              onClick={() => onSelectWallet(wallet)}
                              disabled={isConnecting || isPendingConnection}
                              isLoading={isConnecting && pendingWalletName === wallet.name}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* No wallets detected message */}
                  {wallets.length === 0 && (
                    <div className="text-center py-6 text-gray-400">
                      <p className="mb-3">No Sui wallet extensions detected</p>
                      <p className="text-sm text-gray-500">
                        We recommend installing{" "}
                        <a 
                          href="https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Sui Wallet
                        </a>{" "}
                        or{" "}
                        <a 
                          href="https://suiet.app/download" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300"
                        >
                          Suiet Wallet
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Wallet button component
function WalletButton({ wallet, icon, onClick, disabled, isLoading }) {
  return (
    <button
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-700 
                 hover:bg-gray-700/50 hover:border-gray-500 transition duration-200 ${
                   disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                 }`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="flex items-center">
        {icon && (
          <img src={icon} alt={`${wallet.name} logo`} className="w-6 h-6 mr-3" />
        )}
        <span className="text-white">{wallet.name}</span>
        {wallet.type === 'mobile-app' && (
          <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">Mobile</span>
        )}
      </div>
      {isLoading && <Spinner size="small" />}
    </button>
  );
}

export default WalletConnectorModal;
