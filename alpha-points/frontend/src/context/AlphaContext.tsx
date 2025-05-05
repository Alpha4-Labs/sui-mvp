import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useAlphaPoints } from '../hooks/useAlphaPoints';
import { useStakePositions } from '../hooks/useStakePositions';
import { useLoans } from '../hooks/useLoans';
import { Loan, StakePosition, PointBalance, DurationOption } from '../types';

// Define the shape of the context value using specific types
interface AlphaContextType {
  // Data
  isConnected: boolean;
  address: string | undefined;
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
}

// Create context with a proper initial value that matches the type
const defaultContext: AlphaContextType = {
  isConnected: false,
  address: undefined,
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
    console.log("AlphaContext: Refreshing all data...");
    refetchPoints();
    refetchPositions();
    refetchLoans();
  }, [refetchPoints, refetchPositions, refetchLoans]);

  // Auto-refresh when account changes
  useEffect(() => {
    if (currentAccount?.address) {
      console.log("AlphaContext: Account changed, refreshing data for", currentAccount.address);
      refreshData();
    }
  }, [currentAccount?.address, refreshData]);

  // Construct the context value
  const value: AlphaContextType = {
    isConnected: !!currentAccount,
    address: currentAccount?.address,
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