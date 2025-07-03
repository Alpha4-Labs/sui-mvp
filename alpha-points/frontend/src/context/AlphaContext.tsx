import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useSuiClient, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { useAlphaPoints } from '../hooks/useAlphaPoints';
import { useStakePositions } from '../hooks/useStakePositions';
import { useLoans } from '../hooks/useLoans';
import { useAllUserStakes, GenericStakedSui } from '../hooks/useAllUserStakes';
// DEPRECATED: Removed zkLogin import - using only dapp-kit wallet connections
// import { useZkLogin } from '../hooks/useZkLogin';
import { Loan, StakePosition, PointBalance, DurationOption } from '../types';
import { retryWithBackoff } from '../utils/retry';

// Define OrphanedStake type - principalAmount and timestamp are now always optional
export interface OrphanedStake {
  stakedSuiObjectId: string;
  durationDays: number; // This will be set from selectedDuration when an orphan is identified
  principalAmount?: string; // Will be undefined for generically found StakedSui initially
  timestamp?: number; // Can be added when identified
}

// Define the shape of the context value
interface AlphaContextType {
  // Connection & Account
  isConnected: boolean;
  address: string | undefined;
  provider: string | null;
  authLoading: boolean;
  
  // App Mode
  mode: 'user' | 'partner';
  setMode: (mode: 'user' | 'partner') => void;
  
  // Partner Capabilities - NEW
  partnerCaps: any[]; // Will store PartnerCapInfo[] but avoiding import cycle
  setPartnerCaps: (caps: any[]) => void;
  
  // Core Data
  suiBalance: string;
  points: PointBalance;
  stakePositions: StakePosition[]; // Stakes registered with *our* protocol
  loans: Loan[];
  orphanedStakes: OrphanedStake[]; // StakedSui objects owned by user but NOT in stakePositions
  suiClient: any;
  
  // Loading States
  loading: {
    suiBalance: boolean;
    points: boolean;
    positions: boolean;
    allUserStakes: boolean; // New loading state for the generic stake fetch
    loans: boolean;
    transaction: boolean;
    // orphanedStakes loading is now tied to allUserStakes and positions loading
  };
  error: {
    points: string | null;
    positions: string | null;
    allUserStakes: string | null; // New error state
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
  removeOrphanedStake: (stakedSuiObjectId: string) => void; // Keeps its utility for signaling UI change
  version: number;

  // Add new selective refresh methods
  refreshCriticalData: () => Promise<void>;
  refreshSecondaryData: () => Promise<void>;
  refreshLoansData: () => Promise<void>;
  refreshStakePositions: () => Promise<void>; // New method for lazy loading stake positions
}

// Create context with a proper initial value that matches the type
const defaultContext: AlphaContextType = {
  isConnected: false,
  address: undefined,
  provider: null,
  authLoading: true,
  mode: 'user',
  setMode: () => {},
  partnerCaps: [],
  setPartnerCaps: () => {},
  suiBalance: '0',
  points: { available: 0, locked: 0, total: 0 },
  stakePositions: [],
  loans: [],
  orphanedStakes: [],
  suiClient: {},
  loading: {
    suiBalance: false,
    points: false,
    positions: false,
    allUserStakes: true, // Default to true initially
    loans: false,
    transaction: false,
  },
  error: {
    points: null,
    positions: null,
    allUserStakes: null, // Added missing allUserStakes error state
    loans: null,
  },
  durations: [],
  selectedDuration: { days: 30, label: '30 days', apy: 10.0 },
  setSelectedDuration: () => {},
  refreshData: () => {},
  setTransactionLoading: () => {},
  logout: () => {},
  removeOrphanedStake: () => {},
  version: 0,
  refreshCriticalData: () => Promise.resolve(),
  refreshSecondaryData: () => Promise.resolve(),
  refreshLoansData: () => Promise.resolve(),
  refreshStakePositions: () => Promise.resolve(),
};

const AlphaContext = createContext<AlphaContextType>(defaultContext);

// REMOVE LocalStorage Key for Orphaned Stakes
// const ORPHANED_STAKES_LS_KEY = 'alphaPoints_orphanedStakes';

const DEFAULT_DURATIONS: DurationOption[] = [
  { days: 7, label: '7 days', apy: 5.0 },
  { days: 14, label: '14 days', apy: 7.5 },
  { days: 30, label: '30 days', apy: 10.0 },
  { days: 90, label: '90 days', apy: 15.0 },
  { days: 180, label: '180 days', apy: 20.0 },
  { days: 365, label: '365 days', apy: 25.0 },
];

// Removed complex request queue - using simpler approach

export const AlphaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { mutate: disconnectWalletDappKit } = useDisconnectWallet();

  // Use only currentAccount address (zkLogin deprecated)
  const activeAddress = currentAccount?.address;

  // Basic state - no complex conditional logic
  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [loadingSuiBalance, setLoadingSuiBalance] = useState(false);
  const [authLoadingState, setAuthLoadingState] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<'user' | 'partner'>('user');
  const [partnerCaps, setPartnerCaps] = useState<any[]>([]);
  const [orphanedStakes, setOrphanedStakes] = useState<OrphanedStake[]>([]);

  // Duration options - stable reference
  const [durations] = useState<DurationOption[]>(DEFAULT_DURATIONS);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(() => 
    DEFAULT_DURATIONS[2] || { days: 30, label: '30 days', apy: 10.0 }
  );

  // Simple refs for managing state
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);

  // Data hooks - called in consistent order every time
  const { 
    points, 
    loading: loadingPoints, 
    error: errorPoints, 
    refetch: refetchPoints 
  } = useAlphaPoints(activeAddress, false);

  const { 
    stakePositions, 
    loading: loadingPositions, 
    error: errorPositions, 
    refetch: refetchPositions 
  } = useStakePositions(activeAddress, true);

  const { 
    loans, 
    loading: loadingLoans, 
    error: errorLoans, 
    refetch: refetchLoans 
  } = useLoans(activeAddress, false);

  const { 
    allStakedSuiObjects, 
    loading: loadingAllUserStakes, 
    error: errorAllUserStakes, 
    refetch: refetchAllUserStakes 
  } = useAllUserStakes(activeAddress, false);

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
  }, [activeAddress, suiClient, version]); // Refresh when version changes

  // Simple initialization effect
  useEffect(() => {
    if (activeAddress && !hasInitialized.current) {
      hasInitialized.current = true;
      
      // Clear any existing timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      
      // Load critical data first
      refetchPoints(activeAddress);
      
      // Load secondary data after a brief delay to ensure primary data loads first
      initTimeoutRef.current = setTimeout(() => {
        // Explicitly refetch stake positions to ensure they load properly
        refetchPositions();
        refetchAllUserStakes();
        refetchLoans();
      }, 1000); // Reduced timeout to 1 second
    }
    
    if (!activeAddress) {
      hasInitialized.current = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    }
  }, [activeAddress]); // Simple dependency

  // Calculate orphaned stakes - simple effect
  useEffect(() => {
    if (allStakedSuiObjects && stakePositions && !loadingAllUserStakes && !loadingPositions) {
      const registeredIds = new Set(stakePositions.map(pos => pos.originalStakedSuiObjectId));
      const orphans = allStakedSuiObjects
        .filter(obj => !registeredIds.has(obj.id))
        .map(obj => ({
          stakedSuiObjectId: obj.id,
          durationDays: selectedDuration.days,
          principalAmount: obj.principalAmount,
          timestamp: Date.now(),
        }));
      setOrphanedStakes(orphans);
    }
  }, [allStakedSuiObjects, stakePositions, loadingAllUserStakes, loadingPositions, selectedDuration.days]);

  // Auth loading effect
  useEffect(() => {
    if (activeAddress) {
      setAuthLoadingState(true);
      const timer = setTimeout(() => {
        setAuthLoadingState(false);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setAuthLoadingState(false);
    }
  }, [activeAddress]);

  // Stable callback functions - no complex dependencies
  const refreshData = useCallback(() => {
    setVersion(prev => prev + 1);
    // Don't reset initialization state during refresh - this prevents data clearing
    if (activeAddress) {
      refetchPoints(activeAddress);
      // Immediately refresh stake positions without delay to prevent missing data
      refetchPositions();
      setTimeout(() => {
        refetchAllUserStakes();
        refetchLoans();
      }, 500);
    }
  }, [activeAddress]); // Minimal dependencies

  const logout = useCallback(() => {
    // DEPRECATED: Removed zkLogin logout logic
    // if (zkLogin.isAuthenticated) {
    //   zkLogin.logout();
    // }
    if (currentAccount) {
      disconnectWalletDappKit();
    }
    hasInitialized.current = false;
    
    // Clear all data on explicit logout
    setSuiBalance('0');
    setOrphanedStakes([]);
  }, [currentAccount, disconnectWalletDappKit]);

  const removeOrphanedStake = useCallback((stakedSuiObjectId: string) => {
    setOrphanedStakes(prev => prev.filter(stake => stake.stakedSuiObjectId !== stakedSuiObjectId));
  }, []);

  // Additional refresh methods
  const refreshCriticalData = useCallback(async () => {
    if (activeAddress) {
      await refetchPoints(activeAddress);
    }
  }, [activeAddress]);

  const refreshSecondaryData = useCallback(async () => {
    await Promise.all([
      refetchPositions(),
      refetchAllUserStakes()
    ]);
  }, []);

  const refreshLoansData = useCallback(async () => {
    await refetchLoans();
  }, []);

  const refreshStakePositions = useCallback(async () => {
    await refetchPositions();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  const value: AlphaContextType = {
    isConnected: !!currentAccount,
    address: activeAddress,
    provider: currentAccount ? 'dapp-kit' : null,
    authLoading: authLoadingState,
    mode,
    setMode,
    partnerCaps,
    setPartnerCaps,
    suiBalance,
    points,
    stakePositions,
    loans,
    orphanedStakes,
    suiClient,
    loading: {
      suiBalance: loadingSuiBalance,
      points: loadingPoints,
      positions: loadingPositions,
      allUserStakes: loadingAllUserStakes,
      loans: loadingLoans,
      transaction: transactionLoading,
    },
    error: {
      points: errorPoints,
      positions: errorPositions,
      allUserStakes: errorAllUserStakes,
      loans: errorLoans,
    },
    durations,
    selectedDuration,
    setSelectedDuration,
    refreshData,
    setTransactionLoading,
    logout,
    removeOrphanedStake,
    version,
    refreshCriticalData,
    refreshSecondaryData,
    refreshLoansData,
    refreshStakePositions,
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