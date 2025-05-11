import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useCurrentAccount, useDisconnectWallet, useSuiClient } from '@mysten/dapp-kit';
import { useAlphaPoints } from '../hooks/useAlphaPoints';
import { useStakePositions } from '../hooks/useStakePositions';
import { useLoans } from '../hooks/useLoans';
import { useZkLogin } from '../hooks/useZkLogin';
import { Loan, StakePosition, PointBalance, DurationOption } from '../types';

// Define the shape of the context value using specific types
interface AlphaContextType {
  // Connection & Account
  isConnected: boolean;
  address: string | undefined;
  provider: string | null;
  
  // Core Data
  suiBalance: string;
  points: PointBalance;
  stakePositions: StakePosition[];
  loans: Loan[];
  
  // Loading States
  loading: {
    suiBalance: boolean;
    points: boolean;
    positions: boolean;
    loans: boolean;
    transaction: boolean;
  };
  error: {
    points: string | null;
    positions: string | null;
    loans: string | null;
  };

  // Staking options
  durations: DurationOption[];
  selectedDuration: DurationOption;
  setSelectedDuration: (duration: DurationOption) => void;

  // Functions
  refreshData: () => void;
  setTransactionLoading: (loading: boolean) => void;
  logout: () => void;
}

// Create context with a proper initial value that matches the type
const defaultContext: AlphaContextType = {
  isConnected: false,
  address: undefined,
  provider: null,
  suiBalance: '0',
  points: { available: 0, locked: 0, total: 0 },
  stakePositions: [],
  loans: [],
  loading: {
    suiBalance: false,
    points: false,
    positions: false,
    loans: false,
    transaction: false,
  },
  error: {
    points: null,
    positions: null,
    loans: null,
  },
  durations: [],
  selectedDuration: { days: 30, label: '30 days', apy: 10.0 },
  setSelectedDuration: () => {},
  refreshData: () => {},
  setTransactionLoading: () => {},
  logout: () => {},
};

// Create context with proper initial value
const AlphaContext = createContext<AlphaContextType>(defaultContext);

// Default staking durations
const DEFAULT_DURATIONS: DurationOption[] = [
  { days: 7, label: '7 days', apy: 5.0 },
  { days: 14, label: '14 days', apy: 7.5 },
  { days: 30, label: '30 days', apy: 10.0 },
  { days: 90, label: '90 days', apy: 15.0 },
  { days: 180, label: '180 days', apy: 20.0 },
  { days: 365, label: '365 days', apy: 25.0 },
];

export const AlphaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentAccount = useCurrentAccount();
  const zkLogin = useZkLogin();
  const { mutate: disconnectWalletDappKit } = useDisconnectWallet();
  const suiClient = useSuiClient();

  // Use the data fetching hooks with proper typing
  const { 
    points, 
    loading: loadingPoints, 
    error: errorPoints, 
    refetch: refetchPoints 
  } = useAlphaPoints();
  
  const { 
    positions: stakePositions, 
    loading: loadingPositions, 
    error: errorPositions, 
    refetch: refetchPositions 
  } = useStakePositions();
  
  const { 
    loans, 
    loading: loadingLoans, 
    error: errorLoans, 
    refetch: refetchLoans 
  } = useLoans();

  // SUI Balance state
  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [loadingSuiBalance, setLoadingSuiBalance] = useState(false);

  // Transaction loading state
  const [transactionLoading, setTransactionLoading] = useState(false);
  
  // Staking duration options
  const [durations] = useState<DurationOption[]>(DEFAULT_DURATIONS);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DEFAULT_DURATIONS[2]); // Default to 30 days

  // Version state to force context consumers to re-render on data refresh
  const [version, setVersion] = useState(0);

  // Data fetching functions
  const fetchSuiBalance = useCallback(async (addr: string | undefined) => {
    if (!addr) {
      setSuiBalance('0');
      return;
    }
    setLoadingSuiBalance(true);
    try {
      const { totalBalance } = await suiClient.getBalance({ owner: addr, coinType: '0x2::sui::SUI' });
      setSuiBalance(totalBalance);
    } catch (err) {
      console.error("[AlphaContext] Error fetching SUI balance:", err);
      setSuiBalance('0'); // Reset on error
    } finally {
      setLoadingSuiBalance(false);
    }
  }, [suiClient]);

  // Combined refresh function for all data
  const refreshData = useCallback(async () => {
    const activeAddress = zkLogin.address || currentAccount?.address;
    if (activeAddress) {
      await Promise.all([
        fetchSuiBalance(activeAddress),
        refetchPoints(activeAddress),
        refetchPositions(activeAddress),
        refetchLoans(activeAddress),
      ]);
    } else {
      await Promise.all([
        fetchSuiBalance(undefined),
        refetchPoints(undefined),
        refetchPositions(undefined),
        refetchLoans(undefined),
      ]);
    }
    setVersion(v => v + 1); // Force context consumers to re-render
  }, [
    fetchSuiBalance,
    refetchPoints, 
    refetchPositions, 
    refetchLoans, 
    currentAccount?.address, 
    zkLogin.address
  ]);

  // Auto-refresh when account changes (either from wallet or zkLogin)
  useEffect(() => {
    const activeAddress = zkLogin.address || currentAccount?.address;
    if (zkLogin.isAuthenticated || currentAccount?.address) {
      refreshData();
    } else {
      refreshData(); // This will call refetches with undefined address
    }
  }, [currentAccount?.address, zkLogin.address, zkLogin.isAuthenticated, refreshData]);

  // Unified logout function
  const logout = useCallback(() => {
    if (zkLogin.isAuthenticated) {
      zkLogin.logout();
    }
    if (currentAccount) {
      disconnectWalletDappKit();
    }
    // Data clearing should be handled by the refreshData effect when addresses become null
  }, [zkLogin, currentAccount, disconnectWalletDappKit]);

  // Construct the context value
  const value: AlphaContextType & { version: number } = {
    isConnected: zkLogin.isAuthenticated || !!currentAccount,
    address: zkLogin.address || currentAccount?.address,
    provider: zkLogin.isAuthenticated ? zkLogin.provider : (currentAccount ? 'dapp-kit' : null),
    suiBalance,
    points,
    stakePositions,
    loans,
    loading: {
      suiBalance: loadingSuiBalance,
      points: loadingPoints,
      positions: loadingPositions,
      loans: loadingLoans,
      transaction: transactionLoading,
    },
    error: {
      points: errorPoints,
      positions: errorPositions,
      loans: errorLoans,
    },
    durations,
    selectedDuration,
    setSelectedDuration,
    refreshData,
    setTransactionLoading,
    logout,
    version,
  };

  return <AlphaContext.Provider value={value}>{children}</AlphaContext.Provider>;
};

// Custom hook to consume the context
export const useAlphaContext = (): AlphaContextType => {
  const context = useContext(AlphaContext);
  
  if (context === undefined) {
    throw new Error('useAlphaContext must be used within an AlphaProvider');
  }
  
  return context;
};