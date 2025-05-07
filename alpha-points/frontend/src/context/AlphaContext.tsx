import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useAlphaPoints } from '../hooks/useAlphaPoints';
import { useStakePositions } from '../hooks/useStakePositions';
import { useLoans } from '../hooks/useLoans';
import { useZkLogin } from '../hooks/useZkLogin';
import { Loan, StakePosition, PointBalance, DurationOption } from '../types';

// Define the shape of the context value using specific types
interface AlphaContextType {
  // Data
  isConnected: boolean;
  address: string | undefined;
  provider: string | null;
  points: PointBalance;
  stakePositions: StakePosition[];
  loans: Loan[];
  loading: {
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
  points: { available: 0, locked: 0, total: 0 },
  stakePositions: [],
  loans: [],
  loading: {
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
  selectedDuration: { days: 30, label: '30 days', apy: 10.0 }, // Default value
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

  // Transaction loading state
  const [transactionLoading, setTransactionLoading] = useState(false);
  
  // Staking duration options
  const [durations] = useState<DurationOption[]>(DEFAULT_DURATIONS);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DEFAULT_DURATIONS[2]); // Default to 30 days

  // Combined refresh function for all data
  const refreshData = useCallback(() => {
    const activeAddress = zkLogin.address || currentAccount?.address;
    console.log("AlphaContext: Refreshing all data... for address:", activeAddress);
    if (activeAddress) {
      refetchPoints(activeAddress);
      refetchPositions(activeAddress);
      // TODO: Modify useLoans similarly and call it here with activeAddress
      // refetchLoans(activeAddress);
    } else {
      // If no active address, clear data by calling refetch with undefined
      refetchPoints(undefined);
      refetchPositions(undefined);
      // refetchLoans(undefined);
    }
  }, [refetchPoints, refetchPositions, refetchLoans, currentAccount?.address, zkLogin.address, zkLogin.isAuthenticated]);

  // Auto-refresh when account changes (either from wallet or zkLogin)
  useEffect(() => {
    const activeAddress = zkLogin.address || currentAccount?.address;
    // Trigger refresh if isConnected state changes (e.g. after login) or address changes
    if (zkLogin.isAuthenticated || currentAccount?.address) {
      console.log("AlphaContext: Account changed or zkLogin/wallet detected, refreshing data for", activeAddress);
      refreshData();
    } else {
      // If not connected (e.g. after logout), ensure data is cleared
      console.log("AlphaContext: No active session, ensuring data is cleared.");
      refreshData(); // This will call refetches with undefined address
    }
  }, [currentAccount?.address, zkLogin.address, zkLogin.isAuthenticated, refreshData]);

  // Unified logout function
  const logout = useCallback(() => {
    console.log("AlphaContext: Initiating logout...");
    if (zkLogin.isAuthenticated) {
      console.log("AlphaContext: Logging out from zkLogin.");
      zkLogin.logout();
    }
    if (currentAccount) {
      console.log("AlphaContext: Disconnecting dapp-kit wallet.");
      disconnectWalletDappKit();
    }
    // Data clearing should be handled by the refreshData effect when addresses become null
  }, [zkLogin, currentAccount, disconnectWalletDappKit]);

  // Construct the context value
  const value: AlphaContextType = {
    isConnected: zkLogin.isAuthenticated || !!currentAccount,
    address: zkLogin.address || currentAccount?.address,
    provider: zkLogin.isAuthenticated ? zkLogin.provider : (currentAccount ? 'dapp-kit' : null),
    points,
    stakePositions,
    loans,
    loading: {
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