import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useCurrentAccount, useDisconnectWallet, useSuiClient } from '@mysten/dapp-kit';
import { useAlphaPoints } from '../hooks/useAlphaPoints';
import { useStakePositions } from '../hooks/useStakePositions';
import { useLoans } from '../hooks/useLoans';
import { useZkLogin } from '../hooks/useZkLogin';
import { useAllUserStakes, GenericStakedSui } from '../hooks/useAllUserStakes';
import { Loan, StakePosition, PointBalance, DurationOption } from '../types';

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
}

// Create context with a proper initial value that matches the type
const defaultContext: AlphaContextType = {
  isConnected: false,
  address: undefined,
  provider: null,
  authLoading: true,
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

export const AlphaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentAccount = useCurrentAccount();
  const zkLogin = useZkLogin();
  const { mutate: disconnectWalletDappKit } = useDisconnectWallet();
  const suiClient = useSuiClient();

  const { points, loading: loadingPoints, error: errorPoints, refetch: refetchPoints } = useAlphaPoints();
  const { positions: stakePositions, loading: loadingPositions, error: errorPositions, refetch: refetchPositions } = useStakePositions();
  const { loans, loading: loadingLoans, error: errorLoans, refetch: refetchLoans } = useLoans();
  
  // Use the new hook
  const activeAddress = zkLogin.address || currentAccount?.address;
  const { 
    allStakedSuiObjects, 
    loading: loadingAllUserStakes, 
    error: errorAllUserStakes, 
    refetch: refetchAllUserStakes 
  } = useAllUserStakes(activeAddress);

  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [loadingSuiBalance, setLoadingSuiBalance] = useState(false);
  const [authLoadingState, setAuthLoadingState] = useState(true);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [durations] = useState<DurationOption[]>(DEFAULT_DURATIONS);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DEFAULT_DURATIONS[2]);
  const [version, setVersion] = useState(0);

  // State for derived orphanedStakes - no longer directly set by add/remove, but calculated
  const [orphanedStakes, setOrphanedStakes] = useState<OrphanedStake[]>([]);

  // --- Calculate Orphaned Stakes --- 
  useEffect(() => {
    // Only calculate if both sources of data are not loading
    if (!loadingAllUserStakes && !loadingPositions) {
      const registeredStakeIds = new Set(stakePositions.map(p => p.id));
      
      const newOrphanedStakes = allStakedSuiObjects
        .filter(genericStake => !registeredStakeIds.has(genericStake.id))
        .map(genericStake => ({
          stakedSuiObjectId: genericStake.id,
          durationDays: selectedDuration.days, // Default to currently selected duration
          // principalAmount: undefined, // Explicitly undefined for now
          timestamp: Date.now(), // Mark when it was identified as an orphan
        }));
      setOrphanedStakes(newOrphanedStakes);
    }
    // Add selectedDuration to dependencies, so if user changes default duration, orphaned stakes get that new default
  }, [allStakedSuiObjects, stakePositions, loadingAllUserStakes, loadingPositions, selectedDuration]);

  // REMOVE addOrphanedStake and its localStorage logic
  // const addOrphanedStake = useCallback(...);

  // removeOrphanedStake will now primarily signal a UI update via setVersion
  // The actual removal from the list happens via the useEffect above when stakePositions updates
  const removeOrphanedStake = useCallback((_stakedSuiObjectId: string) => {
    // The item will be naturally removed from orphanedStakes when 
    // allStakedSuiObjects is still the same, but stakePositions gets updated (after refreshData)
    // to include this _stakedSuiObjectId. The useEffect will then filter it out.
    // We still call setVersion to ensure consumers re-render and re-evaluate.
    setVersion(v => v + 1);
    // No direct manipulation of orphanedStakes state or localStorage here anymore.
  }, []); // Empty deps as it only calls setVersion

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

  const refreshData = useCallback(async () => {
    const currentActiveAddress = zkLogin.address || currentAccount?.address;
    if (currentActiveAddress) {
      await Promise.all([
        fetchSuiBalance(currentActiveAddress),
        refetchPoints(currentActiveAddress),
        refetchPositions(currentActiveAddress), // Fetches stakes registered with our protocol
        refetchAllUserStakes(currentActiveAddress), // Fetches ALL StakedSui objects user owns
        refetchLoans(currentActiveAddress),
      ]);
    } else {
      // Clear data if no user
      await Promise.all([
        fetchSuiBalance(undefined),
        refetchPoints(undefined),
        refetchPositions(undefined),
        refetchAllUserStakes(undefined),
        refetchLoans(undefined),
      ]);
    }
    setVersion(v => v + 1);
    setAuthLoadingState(false);
  }, [
    fetchSuiBalance, refetchPoints, refetchPositions, refetchAllUserStakes, refetchLoans, 
    currentAccount?.address, zkLogin.address
  ]);

  useEffect(() => {
    setAuthLoadingState(true);
    refreshData();
  }, [currentAccount?.address, zkLogin.address]); // Removed refreshData from deps, it's stable

  const logout = useCallback(() => {
    if (zkLogin.isAuthenticated) {
      zkLogin.logout();
    }
    if (currentAccount) {
      disconnectWalletDappKit();
    }
    // Data clearing should be handled by the refreshData effect when addresses become null
  }, [zkLogin, currentAccount, disconnectWalletDappKit]);

  const value: AlphaContextType & { version: number } = {
    isConnected: zkLogin.isAuthenticated || !!currentAccount,
    address: activeAddress,
    provider: zkLogin.isAuthenticated ? zkLogin.provider : (currentAccount ? 'dapp-kit' : null),
    authLoading: authLoadingState,
    suiBalance,
    points,
    stakePositions,
    loans,
    orphanedStakes, // This is now the derived list
    suiClient,
    loading: {
      suiBalance: loadingSuiBalance,
      points: loadingPoints,
      positions: loadingPositions,
      allUserStakes: loadingAllUserStakes, // new loading state
      loans: loadingLoans,
      transaction: transactionLoading,
    },
    error: {
      points: errorPoints,
      positions: errorPositions,
      allUserStakes: errorAllUserStakes, // new error state
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