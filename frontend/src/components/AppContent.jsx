// src/components/AppContent.jsx
import React, { useState } from 'react';
import { SwitchTransition, CSSTransition } from 'react-transition-group';

// Import hooks and context
import { useSuiContext } from '../context/SuiContext';
import { useChartLogic } from '../hooks/useChartLogic';
import { useViewManager } from '../hooks/useViewManager';
import { REQUIRED_NETWORK } from '../packages/sui-config';

// Import components
import Header from './Header';
import MainContent from './MainContent';
import ConnectWalletPrompt from './ConnectWalletPrompt';
import Footer from './Footer';
import TransactionMessage from './TransactionMessage';
import ActivationModal from './ActivationModal';
import WalletConnectorModal from './WalletConnectorModal';

/**
 * Main application content component
 * Handles state management and view rendering
 */
function AppContent() {
  // --- Consume Sui Context ---
  const {
    userAddress, network, connectWallet, connectToWallet, switchNetwork, disconnectWallet,
    isSwitchingNetwork, isConnecting, isWrongNetwork,
    // Enhanced mobile properties
    isMobile, isInAppBrowser, availableWallets,
    // Enhanced connection status properties
    connectionStatus, pendingWalletName,
    // Error handling
    error, resetConnectionState,
    // Balances, Points, Sources for Chart Logic
    alphaPoints, accruedPoints, stakedAlphaBalance, generationSources,
    // Loading States for UI feedback
    isLoadingOverall, isFetchingAny,
    // Tx Message
    txMessage, setTxMessage,
    // Modal State & Handlers
    isModalOpen, modalContext, setIsModalOpen, handleConfirmActivation,
    // Pass down specific flags if needed by components directly
    isClaiming, isStaking, isApproving, isUnstaking, isRedeeming
  } = useSuiContext();

  // --- View Manager Hook ---
  const { currentView, isTransitioning, changeView } = useViewManager('dashboard');

  // --- Chart Logic Hook ---
  const {
    projectionData,
    assetPriceData,
    chartSourceToggles,
    chartAssetToggles,
    handleChartSourceToggle,
    handleChartAssetToggle
  } = useChartLogic(alphaPoints, accruedPoints, stakedAlphaBalance, generationSources, isFetchingAny);

  // --- Local UI State ---
  const [stakeAmount, setStakeAmount] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // --- Wallet Connection Handlers ---
  const handleConnectWalletClick = () => {
    // Reset any previous error state
    resetConnectionState();
    
    // If we have multiple wallet options, show the modal
    if (availableWallets.length > 1) {
      setIsWalletModalOpen(true);
    } else {
      // Otherwise just call the connect function directly
      connectWallet();
    }
  };

  const handleWalletSelection = (wallet) => {
    // Call to specific wallet option
    connectToWallet(wallet);
    
    // Keep modal open during pending connections to mobile apps
    if (connectionStatus !== 'pending') {
      setIsWalletModalOpen(false);
    }
  };
  
  // Handle the retry button in modal
  const handleRetryConnection = () => {
    resetConnectionState();
  };

  // --- Simulated Handlers ---
  const handleSimulatedUnlock = (itemName, cost) => console.log(`Simulating unlock ${itemName}...`);
  const handleSimulatedBuyAsset = (assetName, cost) => console.log(`Simulating buy ${assetName}...`);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-gray-100 flex flex-col items-center p-4 font-sans animate-gradient-bg">
      <Header
        userAddress={userAddress}
        network={network}
        onConnectWallet={handleConnectWalletClick}
        currentView={currentView}
        setCurrentView={changeView}
        disconnectWallet={disconnectWallet}
      />

      <main className="w-full max-w-4xl mt-8 flex-grow backdrop-blur-sm bg-black/10 p-1 rounded-xl relative overflow-hidden">
        {/* Transaction/Loading/Error Message Area */}
        {txMessage && (
          <TransactionMessage 
            message={txMessage}
            isWrongNetwork={isWrongNetwork}
            isLoading={isLoadingOverall || isFetchingAny}
            onSwitchNetwork={() => switchNetwork(REQUIRED_NETWORK.id)}
            networkName={REQUIRED_NETWORK.name}
          />
        )}

        {/* Main Content Area */}
        {userAddress ? (
          <MainContent 
            currentView={currentView}
            isTransitioning={isTransitioning}
            stakeAmount={stakeAmount}
            onStakeAmountChange={setStakeAmount}
            projectionData={projectionData}
            assetPriceData={assetPriceData}
            sources={generationSources}
            sourceToggles={chartSourceToggles}
            assetToggles={chartAssetToggles}
            onSourceToggle={handleChartSourceToggle}
            onAssetToggle={handleChartAssetToggle}
            onSimulatedUnlock={handleSimulatedUnlock}
            onSimulatedBuyAsset={handleSimulatedBuyAsset}
          />
        ) : (
          <ConnectWalletPrompt 
            isMobile={isMobile} 
            isInAppBrowser={isInAppBrowser}
            isConnecting={isConnecting}
            availableWallets={availableWallets}
            onConnectWallet={handleConnectWalletClick}
          />
        )}
      </main>

      <Footer />

      {/* Modals */}
      <ActivationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        context={modalContext}
        onConfirm={handleConfirmActivation}
      />
      
      <WalletConnectorModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          // Only allow closing when not in pending state
          if (connectionStatus !== 'pending') {
            setIsWalletModalOpen(false);
          }
        }}
        wallets={availableWallets}
        isConnecting={isConnecting}
        connectionStatus={connectionStatus}
        pendingWalletName={pendingWalletName}
        onSelectWallet={handleWalletSelection}
        isMobile={isMobile}
        error={error}
        onRetry={handleRetryConnection}
      />
    </div>
  );
}

export default AppContent;