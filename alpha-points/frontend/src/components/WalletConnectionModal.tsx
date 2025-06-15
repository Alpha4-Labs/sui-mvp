import React, { useEffect } from 'react';
import { 
  useWallets,
  useConnectWallet,
  useDisconnectWallet
} from '@mysten/dapp-kit';
import { toast } from 'react-toastify';

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: () => void;
}

export const WalletConnectionModal: React.FC<WalletConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnect
}) => {
  const wallets = useWallets();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleWalletConnect = async (wallet: any) => {
    try {
      // Disconnect any existing wallet first
      await disconnectWallet();
    } catch (disconnectError) {
      // Ignore disconnect errors as wallet might not be connected
    }

    console.log('Attempting to connect to wallet:', wallet.name);
    
    connectWallet(
      { wallet },
      {
        onSuccess: () => {
          console.log('Wallet connected successfully!');
          toast.success(`Connected to ${wallet.name}!`);
          onConnect?.();
          onClose();
        },
        onError: (error) => {
          console.error('Wallet connection error:', error);
          
          // Provide user-friendly error messages
          if (error.message.includes('User rejected')) {
            toast.error('Connection rejected by user');
          } else if (error.message.includes('standard:connect')) {
            toast.error('Wallet connection method not supported. Please update your wallet extension.');
          } else {
            toast.error(`Failed to connect to ${wallet.name}: ${error.message}`);
          }
        },
      }
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <div 
          className="bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto animate-fade-in shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Connect Wallet</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {wallets.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-gray-300 font-medium mb-2">No wallets detected</p>
                <p className="text-sm text-gray-500 mb-4">Please install a SUI wallet extension to continue</p>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">Recommended wallets:</p>
                  <ul className="text-sm text-gray-400 mt-2 space-y-1">
                    <li>• Sui Wallet</li>
                    <li>• Suiet</li>
                    <li>• Ethos Wallet</li>
                    <li>• Martian Wallet</li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-4">
                  Choose a wallet to connect to Alpha Points
                </p>
                <div className="space-y-2">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => handleWalletConnect(wallet)}
                      className="w-full flex items-center p-4 bg-black/20 hover:bg-black/40 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all duration-300 group"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        {wallet.icon && (
                          <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors duration-300">
                            <img 
                              src={wallet.icon} 
                              alt={`${wallet.name} icon`} 
                              className="w-6 h-6" 
                            />
                          </div>
                        )}
                        <div className="text-left">
                          <p className="font-medium text-white group-hover:text-purple-300 transition-colors duration-300">
                            {wallet.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {Object.keys(wallet.features).length > 0 
                              ? `Supports: ${Object.keys(wallet.features).join(', ')}`
                              : 'SUI Wallet'
                            }
                          </p>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center">
              By connecting a wallet, you agree to Alpha Points' terms of use
            </p>
          </div>
        </div>
      </div>
    </>
  );
}; 