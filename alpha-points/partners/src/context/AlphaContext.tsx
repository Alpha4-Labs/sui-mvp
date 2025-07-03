import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useSuiClient, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useAlphaPoints } from '../hooks/useAlphaPoints';
// Removed unnecessary imports for partner app
// import { useStakePositions } from '../hooks/useStakePositions';
// import { useLoans } from '../hooks/useLoans';
// import { useAllUserStakes, GenericStakedSui } from '../hooks/useAllUserStakes';
import { PointBalance } from '../types';
import { retryWithBackoff } from '../utils/retry';

// Define the shape of the context value - simplified for partner app
interface AlphaContextType {
  // Connection & Account
  isConnected: boolean;
  address: string | undefined;
  provider: string | null;
  authLoading: boolean;
  
  // App Mode - always partner for this app
  mode: 'partner';
  
  // Partner Capabilities
  partnerCaps: any[];
  setPartnerCaps: (caps: any[]) => void;
  
  // Core Data - simplified for partners
  suiBalance: string;
  points: PointBalance;
  suiClient: any;
  
  // Loading States - simplified
  loading: {
    suiBalance: boolean;
    points: boolean;
    transaction: boolean;
  };
  error: {
    points: string | null;
  };

  // Functions
  refreshData: () => void;
  setTransactionLoading: (loading: boolean) => void;
  logout: () => void;
  version: number;
}

// Create context with a proper initial value that matches the type
const defaultContext: AlphaContextType = {
  isConnected: false,
  address: undefined,
  provider: null,
  authLoading: true,
  mode: 'partner',
  partnerCaps: [],
  setPartnerCaps: () => {},
  suiBalance: '0',
  points: { available: 0, locked: 0, total: 0 },
  suiClient: {},
  loading: {
    suiBalance: false,
    points: false,
    transaction: false,
  },
  error: {
    points: null,
  },
  refreshData: () => {},
  setTransactionLoading: () => {},
  logout: () => {},
  version: 0,
};

const AlphaContext = createContext<AlphaContextType>(defaultContext);

export const AlphaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: disconnectWalletDappKit } = useDisconnectWallet();

  // Use only currentAccount address
  const activeAddress = currentAccount?.address;
  
  // Basic state - simplified for partner app
  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [loadingSuiBalance, setLoadingSuiBalance] = useState(false);
  const [authLoadingState, setAuthLoadingState] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [partnerCaps, setPartnerCaps] = useState<any[]>([]);
  
  // Simple localStorage-based connection persistence
  useEffect(() => {
    if (currentAccount && activeAddress) {
      // Store the last connected address for persistence
      localStorage.setItem('partner-last-connected-address', activeAddress);
      console.log('[AlphaContext] Stored connection address:', activeAddress);
    } else if (!currentAccount && !activeAddress) {
      // Clear stored address when fully disconnected
      localStorage.removeItem('partner-last-connected-address');
      console.log('[AlphaContext] Cleared stored connection address');
    }
  }, [currentAccount, activeAddress]);

  // Debug logging for connection state
  useEffect(() => {
    console.log('[AlphaContext] Current account state:', {
      currentAccount: !!currentAccount,
      address: activeAddress,
      isConnected: !!currentAccount
    });
  }, [currentAccount, activeAddress]);

  // Simple refs for managing state
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);

  // Data hooks - only what partners need
  const { 
    points, 
    loading: loadingPoints, 
    error: errorPoints, 
    refetch: refetchPoints 
  } = useAlphaPoints(activeAddress, false);

  // SUI Balance fetching effect
  useEffect(() => {
    const fetchSuiBalance = async () => {
      if (!activeAddress || !suiClient) {
        console.log('[AlphaContext] SUI Balance: No address or client, setting to 0');
        setSuiBalance('0');
        setLoadingSuiBalance(false);
        return;
      }

      console.log('[AlphaContext] Fetching SUI balance for:', activeAddress);
      setLoadingSuiBalance(true);
      try {
        const balance = await suiClient.getBalance({
          owner: activeAddress,
          coinType: '0x2::sui::SUI'
        });
        console.log('[AlphaContext] SUI Balance response:', balance);
        setSuiBalance(balance.totalBalance || '0');
        console.log('[AlphaContext] SUI Balance set to:', balance.totalBalance || '0');
      } catch (error) {
        console.error('[AlphaContext] Error fetching SUI balance:', error);
        setSuiBalance('0');
      } finally {
        setLoadingSuiBalance(false);
      }
    };

    fetchSuiBalance();
  }, [activeAddress, suiClient, version]);

  // Simple initialization effect - only load partner-relevant data
  useEffect(() => {
    if (activeAddress && !hasInitialized.current) {
      hasInitialized.current = true;
      console.log('[AlphaContext] Initializing partner data for:', activeAddress);
      
      // Clear any existing timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      
      // Load only partner-relevant data
      refetchPoints(activeAddress);
    }
    
    if (!activeAddress) {
      hasInitialized.current = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    }
  }, [activeAddress]);

  // Auth loading effect - optimized for partner dashboard
  useEffect(() => {
    if (activeAddress) {
      setAuthLoadingState(true);
      // Quick auth loading for better UX
      const timer = setTimeout(() => {
        setAuthLoadingState(false);
        console.log('[AlphaContext] Auth loading complete for partner app');
      }, 1000); // Further reduced to 1 second
      return () => clearTimeout(timer);
    } else {
      setAuthLoadingState(false);
    }
  }, [activeAddress]);

  // Stable callback functions
  const refreshData = useCallback(() => {
    setVersion(prev => prev + 1);
    if (activeAddress) {
      console.log('[AlphaContext] Refreshing partner data');
      refetchPoints(activeAddress);
    }
  }, [activeAddress]);

  const logout = useCallback(() => {
    if (currentAccount) {
      disconnectWalletDappKit();
    }
    hasInitialized.current = false;
    
    // Clear all data on explicit logout
    setSuiBalance('0');
    setPartnerCaps([]);
    localStorage.removeItem('partner-last-connected-address');
    console.log('[AlphaContext] Partner logout completed');
  }, [currentAccount, disconnectWalletDappKit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  // Simple connection state - rely on dapp-kit
  const isConnected = !!currentAccount;
  
  // Debug: Log when connection state changes
  useEffect(() => {
    console.log('[AlphaContext] Connection state changed:', {
      currentAccount: !!currentAccount,
      activeAddress,
      isConnected,
      authLoading: authLoadingState
    });
  }, [currentAccount, activeAddress, isConnected, authLoadingState]);
  
  const value: AlphaContextType = {
    isConnected,
    address: activeAddress,
    provider: isConnected ? 'dapp-kit' : null,
    authLoading: authLoadingState,
    mode: 'partner',
    partnerCaps,
    setPartnerCaps,
    suiBalance,
    points,
    suiClient,
    loading: {
      suiBalance: loadingSuiBalance,
      points: loadingPoints,
      transaction: transactionLoading,
    },
    error: {
      points: errorPoints,
    },
    refreshData,
    setTransactionLoading,
    logout,
    version,
  };

  return <AlphaContext.Provider value={value}>{children}</AlphaContext.Provider>;
};

export const useAlphaContext = (): AlphaContextType => {
  const context = useContext(AlphaContext);
  
  if (context === undefined) {
    throw new Error('useAlphaContext must be used within an AlphaProvider');
  }
  
  return context;
};