// src/hooks/useSuiWallet.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, JsonRpcProvider } from '@mysten/sui.js/client';
import { getWallets } from '@mysten/wallet-standard';
import { WalletStandardAdapterProvider } from '@mysten/wallet-adapter-wallet-standard';
import { NETWORKS, DEFAULT_NETWORK, REQUIRED_NETWORK } from '../packages/sui-config';

export function useSuiWallet() {
  // Network state
  const [network, setNetwork] = useState(DEFAULT_NETWORK);
  
  // Provider state
  const [provider, setProvider] = useState(null);
  
  // Wallet connection state
  const [walletAdapter, setWalletAdapter] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle'); // 'idle', 'connecting', 'connected', 'failed'
  const [error, setError] = useState(null);
  
  // Available wallets
  const [availableWallets, setAvailableWallets] = useState([]);
  const [activeWalletName, setActiveWalletName] = useState(null);
  
  // Environment detection
  const [isMobile, setIsMobile] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  
  // Initialize provider based on network
  useEffect(() => {
    try {
      const connection = new Connection({
        fullnode: network.rpcUrl
      });
      const newProvider = new JsonRpcProvider(connection);
      setProvider(newProvider);
    } catch (err) {
      console.error("Failed to initialize Sui provider:", err);
      setError("Failed to connect to Sui network");
    }
  }, [network]);
  
  // Detect available wallets
  useEffect(() => {
    const detectWallets = () => {
      try {
        // Get standard wallets
        const wallets = getWallets();
        const walletOptions = wallets.map(wallet => ({
          id: wallet.name,
          name: wallet.name,
          type: 'standard',
          adapter: new WalletStandardAdapterProvider(wallet),
          icon: wallet.icon // Standard wallets provide icon URLs
        }));
        
        setAvailableWallets(walletOptions);
      } catch (err) {
        console.error("Error detecting wallets:", err);
      }
    };
    
    detectWallets();
    
    // Re-detect when window is focused
    window.addEventListener('focus', detectWallets);
    return () => {
      window.removeEventListener('focus', detectWallets);
    };
  }, []);
  
  // Detect device type
  useEffect(() => {
    const checkEnvironment = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      
      // Check if mobile
      const isMobileDevice = /android|iPad|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      
      // Check if inside a wallet browser
      const isWalletBrowser = /SuiWallet|Sui Wallet|Suiet|Ethos|Martian/i.test(userAgent);
      
      setIsMobile(isMobileDevice);
      setIsInAppBrowser(isWalletBrowser);
    };
    
    checkEnvironment();
    
    // Also update on resize, in case of responsive mode in devtools
    window.addEventListener('resize', checkEnvironment);
    return () => window.removeEventListener('resize', checkEnvironment);
  }, []);
  
  // Connect wallet function
  const connectWallet = useCallback(async (walletOption) => {
    if (!walletOption) {
      // If no option specified, use first available wallet
      if (availableWallets.length === 0) {
        setError("No compatible wallets detected");
        return false;
      }
      walletOption = availableWallets[0];
    }
    
    setError(null);
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setActiveWalletName(walletOption.name);
    
    try {
      // Get the wallet adapter
      const adapter = walletOption.adapter;
      
      // Ensure adapter is not already connected
      if (!adapter.connected) {
        await adapter.connect();
      }
      
      // Get accounts
      const accounts = await adapter.getAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found in wallet");
      }
      
      // Set the wallet adapter and address
      setWalletAdapter(adapter);
      setUserAddress(accounts[0].address);
      
      // Check if we're on the right network
      // Note: Network checking may differ in Sui depending on implementation
      // This is a placeholder for now
      const currentNetwork = await adapter.getNetwork();
      if (currentNetwork !== REQUIRED_NETWORK.id) {
        setIsWrongNetwork(true);
      } else {
        setIsWrongNetwork(false);
      }
      
      setConnectionStatus('connected');
      setIsConnecting(false);
      return true;
    } catch (err) {
      console.error("Wallet connection error:", err);
      setError(err.message || "Failed to connect wallet");
      setConnectionStatus('failed');
      setWalletAdapter(null);
      setUserAddress(null);
      setIsConnecting(false);
      return false;
    }
  }, [availableWallets]);
  
  // Disconnect wallet function
  const disconnectWallet = useCallback(async () => {
    if (walletAdapter) {
      try {
        await walletAdapter.disconnect();
      } catch (err) {
        console.error("Error disconnecting wallet:", err);
      }
    }
    
    setWalletAdapter(null);
    setUserAddress(null);
    setActiveWalletName(null);
    setConnectionStatus('idle');
    setError(null);
  }, [walletAdapter]);
  
  // Function to switch networks (if supported)
  const switchNetwork = useCallback(async (networkId) => {
    if (!walletAdapter) {
      return false;
    }
    
    try {
      // Check if wallet supports network switching
      if (typeof walletAdapter.switchNetwork === 'function') {
        await walletAdapter.switchNetwork(networkId);
        const newNetwork = Object.values(NETWORKS).find(net => net.id === networkId);
        if (newNetwork) {
          setNetwork(newNetwork);
          setIsWrongNetwork(false);
        }
        return true;
      } else {
        setError("Wallet doesn't support network switching. Please change network manually in your wallet.");
        return false;
      }
    } catch (err) {
      console.error("Network switch error:", err);
      setError(err.message || "Failed to switch network");
      return false;
    }
  }, [walletAdapter]);
  
  // Reset connection state
  const resetConnectionState = useCallback(() => {
    setError(null);
    setConnectionStatus('idle');
    setActiveWalletName(null);
  }, []);
  
  // Listen for wallet events
  useEffect(() => {
    if (!walletAdapter) return;
    
    const handleAccountChange = (accounts) => {
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
      } else if (accounts[0].address !== userAddress) {
        setUserAddress(accounts[0].address);
      }
    };
    
    const handleNetworkChange = (newNetwork) => {
      const networkConfig = Object.values(NETWORKS).find(net => net.id === newNetwork);
      if (networkConfig) {
        setNetwork(networkConfig);
        setIsWrongNetwork(newNetwork !== REQUIRED_NETWORK.id);
      }
    };
    
    const handleDisconnect = () => {
      disconnectWallet();
    };
    
    // Subscribe to events
    walletAdapter.on('accountsChanged', handleAccountChange);
    walletAdapter.on('networkChanged', handleNetworkChange);
    walletAdapter.on('disconnect', handleDisconnect);
    
    // Cleanup on unmount
    return () => {
      walletAdapter.off('accountsChanged', handleAccountChange);
      walletAdapter.off('networkChanged', handleNetworkChange);
      walletAdapter.off('disconnect', handleDisconnect);
    };
  }, [walletAdapter, userAddress, disconnectWallet]);
  
  return {
    // Connection state
    provider,
    walletAdapter,
    userAddress,
    network,
    
    // Connection status
    isConnecting,
    isWrongNetwork,
    connectionStatus,
    activeWalletName,
    error,
    
    // Environment detection
    isMobile,
    isInAppBrowser,
    
    // Available wallets
    availableWallets,
    
    // Actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    resetConnectionState
  };
}