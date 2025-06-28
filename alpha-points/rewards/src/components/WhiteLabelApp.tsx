import React, { useEffect } from 'react';
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets } from '@mysten/dapp-kit';
import { toast, Toaster } from 'react-hot-toast';
import { CuratedPerkMarketplace } from './CuratedPerkMarketplace';
import { PerkDebugHelper } from './PerkDebugHelper';
import { BRAND_CONFIG, generateCSSVars } from '../config/brand';

export const WhiteLabelApp: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const wallets = useWallets();

  // Apply brand CSS variables
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = generateCSSVars(BRAND_CONFIG);
    document.head.appendChild(style);
    
    // Apply background color to body
    document.body.style.backgroundColor = 'var(--color-background)';
    document.body.style.color = 'var(--color-text)';
    document.body.style.fontFamily = 'var(--font-primary)';
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleConnectWallet = () => {
    // Find the first available wallet or default to Sui Wallet
    const availableWallet = wallets.find(wallet => 
      wallet.name.toLowerCase().includes('sui')
    ) || wallets[0];
    
    if (!availableWallet) {
      toast.error("No Sui wallets found. Please install a Sui wallet.");
      return;
    }
    
    connectWallet(
      { wallet: availableWallet },
      {
        onSuccess: () => {
          toast.success("Wallet connected successfully!");
        },
        onError: (error) => {
          console.error("Wallet connection failed:", error);
          toast.error("Failed to connect wallet. Please try again.");
        }
      }
    );
  };

  const handleDisconnectWallet = () => {
    disconnectWallet();
    toast.success("Wallet disconnected");
  };

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text)'
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-sm border-b" 
              style={{ 
                backgroundColor: 'rgba(var(--color-background-card), 0.8)',
                borderColor: 'var(--color-border)'
              }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Name */}
            <div className="flex items-center space-x-4">
              {BRAND_CONFIG.company.logo && (
                <img 
                  src={BRAND_CONFIG.company.logo} 
                  alt={`${BRAND_CONFIG.company.name} logo`}
                  className="h-8 w-8 rounded-lg"
                />
              )}
              <div>
                <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                  {BRAND_CONFIG.company.name}
                </h1>
                {BRAND_CONFIG.company.tagline && (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {BRAND_CONFIG.company.tagline}
                  </p>
                )}
              </div>
            </div>

            {/* Network Status & Wallet Connection */}
            <div className="flex items-center space-x-4">
              {/* Network Status */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-success)' }}></div>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Live on Sui Testnet</span>
              </div>
              
              {currentAccount ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm">
                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                      Connected
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnectWallet}
                    className="px-4 py-2 text-sm rounded-lg border transition-colors hover:opacity-80"
                    style={{ 
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-muted)',
                      backgroundColor: 'transparent'
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectWallet}
                  className="px-6 py-2 font-medium rounded-lg transition-all duration-200 hover:scale-105"
                  style={{ 
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text)',
                  }}
                >
                  {BRAND_CONFIG.content.connectWalletText}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentAccount ? (
          /* Welcome State - Not Connected */
          <div className="text-center py-16">
            <div className="max-w-2xl mx-auto">
              {BRAND_CONFIG.company.logo && (
                <img 
                  src={BRAND_CONFIG.company.logo} 
                  alt={`${BRAND_CONFIG.company.name} logo`}
                  className="h-20 w-20 mx-auto mb-6 rounded-2xl"
                />
              )}
              
              <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                {BRAND_CONFIG.content.title}
              </h2>
              
              {BRAND_CONFIG.content.subtitle && (
                <p className="text-xl mb-6" style={{ color: 'var(--color-text-muted)' }}>
                  {BRAND_CONFIG.content.subtitle}
                </p>
              )}
              
              {BRAND_CONFIG.content.welcomeMessage && (
                <p className="text-lg mb-8 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {BRAND_CONFIG.content.welcomeMessage}
                </p>
              )}

              <div className="space-y-4">
                <button
                  onClick={handleConnectWallet}
                  className="px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
                  style={{ 
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text)',
                  }}
                >
                  🚀 {BRAND_CONFIG.content.connectWalletText}
                </button>
                
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Connect your Sui wallet to access exclusive perks and rewards
                </div>
              </div>

              {/* Features Preview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
                <div 
                  className="p-6 rounded-xl text-center"
                  style={{ 
                    backgroundColor: 'var(--color-background-card)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div className="text-4xl mb-3">🎁</div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Exclusive Perks
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Access premium benefits and rewards curated by {BRAND_CONFIG.company.name}
                  </p>
                </div>
                
                <div 
                  className="p-6 rounded-xl text-center"
                  style={{ 
                    backgroundColor: 'var(--color-background-card)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div className="text-4xl mb-3">⚡</div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Instant Redemption
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Redeem your Alpha Points instantly for valuable perks and services
                  </p>
                </div>
                
                <div 
                  className="p-6 rounded-xl text-center"
                  style={{ 
                    backgroundColor: 'var(--color-background-card)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div className="text-4xl mb-3">🔒</div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    Secure & Trusted
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Built on Sui blockchain with enterprise-grade security
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Marketplace - Connected */
          <div className="space-y-8">
            {/* Curated Marketplace */}
            <CuratedPerkMarketplace />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              {BRAND_CONFIG.company.logo && (
                <img 
                  src={BRAND_CONFIG.company.logo} 
                  alt={`${BRAND_CONFIG.company.name} logo`}
                  className="h-6 w-6 rounded"
                />
              )}
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                © 2024 {BRAND_CONFIG.company.name}. All rights reserved.
              </span>
            </div>
            
            <div className="flex items-center space-x-6">
              {BRAND_CONFIG.company.website && (
                <a 
                  href={BRAND_CONFIG.company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Website
                </a>
              )}
              
              {BRAND_CONFIG.company.supportEmail && (
                <a 
                  href={`mailto:${BRAND_CONFIG.company.supportEmail}`}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Support
                </a>
              )}
              
              {BRAND_CONFIG.content.footerText && (
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {BRAND_CONFIG.content.footerText}
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--color-background-card)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-success)',
              secondary: 'var(--color-background-card)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-error)',
              secondary: 'var(--color-background-card)',
            },
          },
        }}
      />

      {/* Debug Helper - Only shows when VITE_DEBUG_MODE=true */}
      <PerkDebugHelper />
    </div>
  );
}; 