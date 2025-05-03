// === AlphaContext.tsx ===
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useAlphaPoints } from '../hooks/useAlphaPoints';
import { useStakePositions } from '../hooks/useStakePositions';
import { useLoans } from '../hooks/useLoans';
import { DurationOption } from '../types';

interface AlphaContextType {
  // Data
  isConnected: boolean;
  address: string | undefined;
  points: {
    available: number;
    locked: number;
    total: number;
  };
  stakePositions: any[];
  loans: any[];
  loading: {
    points: boolean;
    positions: boolean;
    loans: boolean;
    transaction: boolean;
  };
  
  // Staking options
  durations: DurationOption[];
  selectedDuration: DurationOption;
  setSelectedDuration: (duration: DurationOption) => void;
  
  // Functions
  refreshData: () => void;
  setTransactionLoading: (loading: boolean) => void;
}

const AlphaContext = createContext<AlphaContextType | undefined>(undefined);

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
  
  const { points, loading: loadingPoints, refetch: refetchPoints } = useAlphaPoints();
  const { positions: stakePositions, loading: loadingPositions, refetch: refetchPositions } = useStakePositions();
  const { loans, loading: loadingLoans, refetch: refetchLoans } = useLoans();
  
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [durations] = useState<DurationOption[]>(DEFAULT_DURATIONS);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DEFAULT_DURATIONS[2]); // Default to 30 days

  const refreshData = useCallback(() => {
    refetchPoints();
    refetchPositions();
    refetchLoans();
  }, [refetchPoints, refetchPositions, refetchLoans]);

  // Provide values to context consumers
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
    durations,
    selectedDuration,
    setSelectedDuration,
    refreshData,
    setTransactionLoading,
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