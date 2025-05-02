// src/context/SuiContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useSuiWallet } from '../hooks/useSuiWallet';
import { useSuiObjects } from '../hooks/useSuiObjects';
import { useSuiTransactions } from '../hooks/useSuiTransactions';
import { REQUIRED_NETWORK } from '../packages/sui-config';

// Helper function for formatting elapsed time
export const formatSeconds = (totalSeconds) => {
  if (totalSeconds <= 0) return "0s";
  totalSeconds = Math.ceil(totalSeconds); 
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  let result = '';
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  return result.trim();
};

// Create the context
const SuiContext = createContext(null);

// Custom hook to consume the context
export const useSuiContext = () => {
  const context = useContext(SuiContext);
  if (!context) {
    throw new Error("useSuiContext must be used within a SuiProvider");
  }
  return context;
};

// Provider component
export const SuiProvider = ({ children }) => {
  // Use the wallet hook to get connection state
  const {
    provider,
    walletAdapter,
    userAddress,
    network,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    isConnecting,
    isWrongNetwork,
    connectionStatus,
    activeWalletName: pendingWalletName,
    error,
    resetConnectionState,
    isMobile,
    isInAppBrowser,
    availableWallets
  } = useSuiWallet();
  
  // Use objects hook to get data
  const {
    alphaPoints,
    accruedPoints,
    lastPointsUpdateTimestamp,
    alphaBalance,
    stakedAlphaBalance,
    redemptionRate,
    generationSources,
    isFetchingPoints,
    isFetchingAlpha,
    isFetchingStakedAlpha,
    isFetchingRate,
    isFetchingAny,
    refreshAllData
  } = useSuiObjects(provider, userAddress);
  
  // Use transactions hook to handle interactions
  const {
    handleStake,
    handleUnstake,
    handleClaimPoints,
    handleRedeemPoints,
    handleToggleActivationRequest,
    handleConfirmActivation,
    isApproving,
    isStaking,
    isUnstaking,
    isClaiming,
    isRedeeming,
    isProcessingTx,
    txMessage,
    setTxMessage
  } = useSuiTransactions(provider, walletAdapter, userAddress, refreshAllData);
  
  // Modal state (for activation modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState(null);
  
  // Effect to set transaction message for wrong network
  useEffect(() => {
    if (isWrongNetwork && userAddress) {
      setTxMessage(`Switch to ${REQUIRED_NETWORK.name}`);
    } else if (txMessage === `Switch to ${REQUIRED_NETWORK.name}` && !isWrongNetwork) {
      setTxMessage('');
    }
  }, [isWrongNetwork, userAddress, txMessage, setTxMessage]);
  
  // Combined loading state
  const isLoadingOverall = isProcessingTx || isConnecting;
  
  // Handler for toggling activation modal
  const handleToggleActivation = (sourceId, currentStatus) => {
    const source = generationSources.find(s => s.id === sourceId);
    if (source) {
      setModalContext({
        action: currentStatus ? 'deactivate' : 'activate',
        source: source
      });
      setIsModalOpen(true);
    } else {
      console.error("Source not found for modal:", sourceId);
    }
  };
  
  // The context value that will be provided
  const contextValue = {
    // Wallet connection state
    provider,
    walletAdapter,
    userAddress,
    network,
    
    // Connection actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    resetConnectionState,
    
    // Connection status
    isConnecting,
    isWrongNetwork,
    connectionStatus,
    pendingWalletName,
    
    // Error handling
    error,
    
    // Environment detection
    isMobile,
    isInAppBrowser,
    availableWallets,
    
    // Balances and points
    alphaPoints,
    accruedPoints,
    lastPointsUpdateTimestamp,
    alphaBalance,
    stakedAlphaBalance,
    
    // Redemption rate
    redemptionRate,
    isFetchingRate,
    
    // Generation sources & modal
    generationSources,
    isModalOpen,
    modalContext,
    handleToggleActivationRequest: handleToggleActivation,
    handleConfirmActivation,
    setIsModalOpen,
    
    // Loading states
    isFetchingPoints,
    isFetchingAlpha,
    isFetchingStakedAlpha,
    isFetchingAny,
    isApproving,
    isStaking,
    isUnstaking,
    isClaiming,
    isRedeeming,
    isProcessingTx,
    isLoadingOverall,
    
    // Transaction handlers
    handleStake,
    handleUnstake,
    handleClaimPoints,
    handleRedeemPoints,
    
    // Transaction messaging
    txMessage,
    setTxMessage,
    
    // Data refresh functions
    refreshPointsData: async () => refreshAllData()
  };
  
  return (
    <SuiContext.Provider value={contextValue}>
      {children}
    </SuiContext.Provider>
  );
};

export { SuiContext };