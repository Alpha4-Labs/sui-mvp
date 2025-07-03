import React, { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { toast } from 'react-toastify';
import { useAlphaContext, OrphanedStake } from '../context/AlphaContext';
import { buildUnstakeTransaction, buildRegisterStakeTransaction, buildEarlyUnstakeTransaction, buildReclaimPrincipalTransaction, buildClaimWithdrawalTicketTransaction } from '../utils/transaction';
import { PACKAGE_ID } from '../config/contract';
import {
  getTransactionErrorMessage,
  getTransactionResponseError,
} from '../utils/transaction-adapter';
import { formatSui, formatAddress, formatDuration, formatTimestamp } from '../utils/format';
import { StakePosition } from '../types';
import { useTransactionSuccess } from '../hooks/useTransactionSuccess';
import { 
  convertMistToSui, 
  convertSuiToAlphaPointsWithFee, 
  calculateDailyAlphaPointsRewards, 
  calculateTotalAlphaPointsRewards,
  ALPHA_POINTS_PER_SUI,
  DAYS_PER_YEAR,
  EPOCHS_PER_DAY
} from '../utils/constants';
import { LoanPanel } from './LoanPanel';

// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules'; // Import Swiper core and required modules

// Import Swiper styles
// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/navigation';
// @ts-ignore
import 'swiper/css/pagination';

// Import SuiClient type
import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';

// Old package constants removed - migration functionality no longer needed

// --- Icons for Carousel Navigation (simple SVGs) ---
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// --- Combined type for Swiper items ---
interface SwiperStakeItem {
  id: string;
  principal: string;
  durationDays?: string;
  maturityPercentage?: number;
  encumbered?: boolean;
  isOrphaned: false;
}

interface SwiperOrphanedItem {
  id: string;
  principal: string;
  durationDays: number;
  isOrphaned: true;
}

type SwiperItem = SwiperStakeItem | SwiperOrphanedItem;

// --- End of combined type ---

export const StakedPositionsList: React.FC = () => {
  const { 
    stakePositions, 
    loans,
    loading, 
    refreshData, 
    refreshLoansData,
    refreshStakePositions,
    setTransactionLoading,
    orphanedStakes = [], 
    removeOrphanedStake = (id: string) => {},
    address: alphaAddress, 
    isConnected: alphaIsConnected, 
    provider: alphaProvider, 
    suiClient, 
    selectedDuration, 
    version
  } = useAlphaContext();

  const [activeTab, setActiveTab] = useState<'stakes' | 'loans'>('stakes');
  const [unstakeInProgress, setUnstakeInProgress] = useState<string | null>(null);
  const [earlyUnstakeInProgress, setEarlyUnstakeInProgress] = useState<string | null>(null);
  const [registrationInProgress, setRegistrationInProgress] = useState<string | null>(null);
  const [reclaimPrincipalInProgress, setReclaimPrincipalInProgress] = useState<string | null>(null);
  const [claimWithdrawalInProgress, setClaimWithdrawalInProgress] = useState<string | null>(null);
  const [nativeWithdrawInProgress, setNativeWithdrawInProgress] = useState<string | null>(null);
  const [showWithdrawalGuide, setShowWithdrawalGuide] = useState(false);
  // Migration-related state removed - no longer needed
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [swiperInstance, setSwiperInstance] = useState<any>(null);
  const [mainSwiperInstance, setMainSwiperInstance] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Prevent duplicate toasts from React StrictMode
  const [lastToastTime, setLastToastTime] = useState<Record<string, number>>({});

  const { registerRefreshCallback, signAndExecute } = useTransactionSuccess();
  const { mutateAsync: rawSignAndExecute } = useSignAndExecuteTransaction();

  // Register refresh callback for this component
  React.useEffect(() => {
    const cleanup = registerRefreshCallback(async () => {
      // Refresh stake positions and loans data after successful transactions
      await refreshStakePositions();
      await refreshLoansData();
      // Also refresh general data to update points balance
      await refreshData();
    });

    return cleanup; // Cleanup on unmount
  }, [registerRefreshCallback, refreshStakePositions, refreshLoansData, refreshData]);

  // Helper function to prevent duplicate toasts (caused by React StrictMode)
  const showToastOnce = (key: string, toastFn: () => void, timeoutMs: number = 3000) => {
    const now = Date.now();
    const lastTime = lastToastTime[key] || 0;
    
    if (now - lastTime > timeoutMs) {
      setLastToastTime(prev => ({ ...prev, [key]: now }));
      toastFn();
    }
  };

  // Helper function to extract original ID from prefixed display ID
  const extractOriginalId = (displayId: string): string => {
    // Handle double prefixing: stake-stake-xxx -> xxx
    if (displayId.startsWith('stake-stake-')) {
      return displayId.replace('stake-stake-', '');
    }
    if (displayId.startsWith('orphaned-')) {
      return displayId.replace('orphaned-', '');
    }
    if (displayId.startsWith('stake-')) {
      return displayId.replace('stake-', '');
    }
    return displayId;
  };

  // Helper function to check if an encumbered stake is loan collateral vs early withdrawn
  const hasAssociatedLoan = (stakeId: string): boolean => {
    // stakeId should already be the raw ID, but ensure it's clean
    const originalId = extractOriginalId(stakeId);
    const hasLoan = loans.some(loan => loan.stakeId === originalId);
    console.log(`[hasAssociatedLoan] Checking stake ${originalId}:`, {
      inputStakeId: stakeId,
      cleanedStakeId: originalId,
      availableLoans: loans.map(l => l.stakeId),
      hasLoan
    });
    return hasLoan;
  };

  // Helper function to determine if a stake should be considered as loan collateral
  // This accounts for potential data synchronization issues
  const isStakeLoanCollateral = (position: any, stakeId: string): boolean => {
    const isEncumbered = position.encumbered === true;
    // Ensure we're using the raw stake ID for loan checking
    const rawStakeId = extractOriginalId(stakeId);
    const hasLoan = hasAssociatedLoan(rawStakeId);
    
    console.log(`[isStakeLoanCollateral] Position ${rawStakeId}:`, {
      inputStakeId: stakeId,
      rawStakeId,
      isEncumbered,
      hasLoan,
      result: isEncumbered && hasLoan
    });
    
    // If not encumbered, it's definitely not loan collateral
    if (!isEncumbered) return false;
    
    // If encumbered and has an active loan, it's loan collateral
    if (hasLoan) return true;
    
    // If encumbered but no active loan, this could be a data sync issue
    // Let's be more conservative and treat recent encumbered stakes without loans
    // as potentially having repaid loans (better UX than showing as early withdrawn)
    return false;
  };

  // Old package stake checking removed - no longer needed

  // Load loans data when component mounts to help distinguish loan collateral from early unstake
  React.useEffect(() => {
    if (alphaIsConnected && alphaAddress) {
      refreshLoansData();
    }
  }, [alphaIsConnected, alphaAddress, refreshLoansData]);

  // Refresh data when switching between tabs to ensure consistency
  React.useEffect(() => {
    if (alphaIsConnected && alphaAddress) {
      console.log('[StakedPositionsList] Tab changed to:', activeTab, '- refreshing data');
      refreshStakePositions();
      refreshLoansData();
    }
  }, [activeTab, alphaIsConnected, alphaAddress, refreshStakePositions, refreshLoansData]);

  // Refresh data when user comes back to the tab/window
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && alphaIsConnected && alphaAddress) {
        console.log('[StakedPositionsList] Tab became visible - refreshing data');
        refreshStakePositions();
        refreshLoansData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [alphaIsConnected, alphaAddress, refreshStakePositions, refreshLoansData]);

  // checkForOldPackageStakes function removed - no longer needed

  // handleSelfServeMigration function removed - no longer needed

  // Consolidate loading state to prevent flickering
  const isLoading = loading.positions || loading.allUserStakes;

  /**
   * Gets a properly formatted unlock date from a stake position
   * Uses the calculatedUnlockDate field which is now derived directly from unlockTimeMs
   */
  const getUnlockDate = (position: any): Date | null => {
    if (position.calculatedUnlockDate) { // This field should now be reliable
      try {
        return new Date(position.calculatedUnlockDate);
      } catch (e) {
        console.warn("Invalid calculatedUnlockDate format:", position.calculatedUnlockDate, e);
      }
    }
    // Removed epoch fallback as it's no longer relevant
    return null;
  };

  /**
   * Handles unstaking a position
   * Updated to use the new Transaction API
   * @param stakeId The ID of the stake position to unstake
   * @param principal The principal amount of the stake (for feedback)
   */
  const handleUnstake = async (stakeId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnstakeInProgress(stakeId);
    setTransactionLoading(true);

    try {
      const transaction = buildUnstakeTransaction(stakeId);
      
      // Use raw signAndExecute instead of the wrapped one to avoid toJSON issues
      const result = await rawSignAndExecute({
        transaction,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      // Prevent duplicate toasts
      showToastOnce(`unstake-${stakeId}-${txDigest}`, () => {
        toast.success(`Successfully unstaked ${formatSui(principal)} SUI! Digest: ${txDigest.substring(0, 10)}...`);
      });
      
      // Manual refresh since we're not using the wrapped signAndExecute
      try {
        await refreshStakePositions();
        await refreshLoansData();
        await refreshData();
      } catch (refreshError) {
        console.warn('Failed to refresh data after successful unstake:', refreshError);
      }

    } catch (err: any) {
      console.error('Error unstaking position:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      
      // Prevent duplicate error toasts
      showToastOnce(`unstake-error-${stakeId}`, () => {
        toast.error(friendlyErrorMessage);
      });
    } finally {
      setTransactionLoading(false);
      setUnstakeInProgress(null);
    }
  };

  /**
   * Handles converting a mature stake position to Alpha Points
   * User receives 100% Alpha Points value (1 SUI = 3,280 αP) for their mature stake
   * Also receives a SUI withdrawal ticket that can be claimed after cooldown
   * @param stakeId The ID of the mature stake position to convert
   * @param principal The principal amount of the stake (for feedback)
   */
  const handleConvertMatureStakeToPoints = async (stakeId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEarlyUnstakeInProgress(stakeId);
    setTransactionLoading(true);

    try {
      const transaction = buildEarlyUnstakeTransaction(stakeId);
      
      // Use raw signAndExecute instead of the wrapped one to avoid toJSON issues
      const result = await rawSignAndExecute({
        transaction,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      // Calculate expected Alpha Points using centralized constants
      const principalSui = convertMistToSui(principal);
      const expectedAlphaPoints = convertSuiToAlphaPointsWithFee(principalSui);

      // Prevent duplicate toasts caused by React StrictMode
      showToastOnce(`convert-mature-${stakeId}-${txDigest}`, () => {
        toast.success(
          `💎 Mature stake converted successfully! You received ~${expectedAlphaPoints.toLocaleString()} Alpha Points ` +
          `✅ BONUS: You also received a SUI withdrawal ticket worth 100% of your stake! ` +
          `Check your wallet for both: Alpha Points (spendable now) + SUI withdrawal ticket (claimable after 2-3 epochs). ` +
          `Digest: ${txDigest.substring(0, 10)}...`,
          {
            autoClose: 8000, // Longer duration for important message
            position: "top-center",
          }
        );
      });
      
      // Manual refresh since we're not using the wrapped signAndExecute
      try {
        await refreshStakePositions();
        await refreshLoansData();
        await refreshData();
      } catch (refreshError) {
        console.warn('Failed to refresh data after successful mature stake conversion:', refreshError);
      }

    } catch (err: any) {
      console.error('Error converting mature stake:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      
      // Prevent duplicate error toasts
      showToastOnce(`convert-mature-error-${stakeId}`, () => {
        toast.error(`Mature stake conversion failed: ${friendlyErrorMessage}`);
      });
    } finally {
      setTransactionLoading(false);
      setEarlyUnstakeInProgress(null);
    }
  };

  /**
   * Handles reclaiming principal SUI from a matured early-withdrawn stake
   * User returns the Alpha Points they received during early withdrawal to get their principal SUI back
   * @param stakeId The ID of the matured early-withdrawn stake position
   * @param principal The principal amount of the stake (for calculating required Alpha Points)
   */
  const handleReclaimPrincipal = async (stakeId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setReclaimPrincipalInProgress(stakeId);
    setTransactionLoading(true);

    try {
      // Find the associated loan for this stake
      const originalStakeId = extractOriginalId(stakeId);
      const associatedLoan = loans.find(loan => loan.stakeId === originalStakeId);
      
      if (!associatedLoan) {
        throw new Error('No associated loan found for this stake. Cannot reclaim principal without loan ID.');
      }

      // Calculate the Alpha Points that were received during early withdrawal
      // Using centralized constants to match the smart contract
      const principalSui = convertMistToSui(principal);
      const alphaPointsReceived = convertSuiToAlphaPointsWithFee(principalSui);
      const alphaPointsToReturn = alphaPointsReceived.toString();

      const transaction = buildReclaimPrincipalTransaction(associatedLoan.id, stakeId, alphaPointsToReturn);
      
      // Use raw signAndExecute instead of the wrapped one to avoid toJSON issues
      const result = await rawSignAndExecute({
        transaction,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      // Prevent duplicate toasts
      showToastOnce(`reclaim-${stakeId}-${txDigest}`, () => {
        toast.success(
          `Alpha Points returned successfully! ` +
          `Returned ${alphaPointsReceived.toLocaleString()} Alpha Points. ` +
          `⚠️ Note: Due to current system limitations, you may already have the SUI withdrawal ticket. ` +
          `Digest: ${txDigest.substring(0, 10)}...`
        );
      });
      
      // Manual refresh since we're not using the wrapped signAndExecute
      try {
        await refreshStakePositions();
        await refreshLoansData();
        await refreshData();
      } catch (refreshError) {
        console.warn('Failed to refresh data after successful reclaim:', refreshError);
      }

    } catch (err: any) {
      console.error('Error reclaiming principal:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      
      // Prevent duplicate error toasts
      showToastOnce(`reclaim-error-${stakeId}`, () => {
        toast.error(`Principal reclaim failed: ${friendlyErrorMessage}`);
      });
    } finally {
      setTransactionLoading(false);
      setReclaimPrincipalInProgress(null);
    }
  };

  /**
   * Handles claiming SUI from a withdrawal ticket after the cooldown period
   * Users can claim their full SUI principal + staking rewards using this function
   * @param withdrawalTicketId The ID of the withdrawal ticket (StakedSui in cooldown)
   * @param principal The principal amount for display purposes
   */
  const handleClaimWithdrawalTicket = async (withdrawalTicketId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setClaimWithdrawalInProgress(withdrawalTicketId);
    setTransactionLoading(true);

    try {
      const transaction = buildClaimWithdrawalTicketTransaction(withdrawalTicketId);
      
      // Use raw signAndExecute instead of the wrapped one to avoid toJSON issues
      const result = await rawSignAndExecute({
        transaction,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      // Prevent duplicate toasts
      showToastOnce(`claim-withdrawal-${withdrawalTicketId}-${txDigest}`, () => {
        toast.success(
          `Successfully claimed SUI from withdrawal ticket! ` +
          `Received ${formatSui(principal)} SUI + rewards. ` +
          `Digest: ${txDigest.substring(0, 10)}...`
        );
      });
      
      // Manual refresh since we're not using the wrapped signAndExecute
      try {
        await refreshStakePositions();
        await refreshLoansData();
        await refreshData();
      } catch (refreshError) {
        console.warn('Failed to refresh data after successful claim:', refreshError);
      }

    } catch (err: any) {
      console.error('Error claiming withdrawal ticket:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      
      // Prevent duplicate error toasts
      showToastOnce(`claim-withdrawal-error-${withdrawalTicketId}`, () => {
        toast.error(`Withdrawal claim failed: ${friendlyErrorMessage}`);
      });
    } finally {
      setTransactionLoading(false);
      setClaimWithdrawalInProgress(null);
    }
  };

  /**
   * Handles claiming SUI from withdrawal tickets using native Sui staking
   * This bypasses any encumbrance checks from our package by calling the native system directly
   * @param withdrawalTicketId The ID of the withdrawal ticket (StakedSui in cooldown)
   * @param principal The principal amount for display purposes
   */
  const handleNativeWithdrawStake = async (withdrawalTicketId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setNativeWithdrawInProgress(withdrawalTicketId);
    setTransactionLoading(true);

    try {
      const transaction = buildClaimWithdrawalTicketTransaction(withdrawalTicketId);
      const result = await rawSignAndExecute({ transaction });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      // Prevent duplicate toasts
      showToastOnce(`native-withdraw-${withdrawalTicketId}-${txDigest}`, () => {
        toast.success(
          `🎉 Successfully claimed ${formatSui(principal)} SUI from withdrawal ticket! ` +
          `Your SUI has been returned to your wallet. ` +
          `Digest: ${txDigest.substring(0, 10)}...`
        );
      });
      
      // Manual refresh since we're using raw hook
      try {
        await refreshStakePositions();
        await refreshLoansData();
        await refreshData();
      } catch (refreshError) {
        console.warn('Failed to refresh data after transaction:', refreshError);
      }

    } catch (err: any) {
      console.error('Error claiming SUI from withdrawal ticket:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      
      // Prevent duplicate error toasts
      showToastOnce(`native-withdraw-error-${withdrawalTicketId}`, () => {
        toast.error(`SUI claim failed: ${friendlyErrorMessage}`);
      });
    } finally {
      setTransactionLoading(false);
      setNativeWithdrawInProgress(null);
    }
  };

  // Helper for Estimated Rewards Calculation
  // Uses centralized constants for consistent Alpha Points calculations
  const calculateEstAlphaPointRewards = (principal?: string, durationDaysStr?: string, positionApy?: number): string => {
    if (!principal || !durationDaysStr || typeof positionApy === 'undefined') return '~0 αP (0 αP/epoch)';
    try {
      const durationDays = parseInt(durationDaysStr, 10);
      const principalSui = convertMistToSui(principal);

      if (isNaN(principalSui) || isNaN(durationDays) || durationDays <= 0) return '~0 αP (0 αP/epoch)';

      // Calculate rewards using centralized helper functions
      const dailyAlphaPointsRewards = calculateDailyAlphaPointsRewards(principalSui, positionApy);
      const totalAlphaPointsRewards = calculateTotalAlphaPointsRewards(principalSui, positionApy, durationDays);

      const formattedTotalAlphaPoints = totalAlphaPointsRewards.toLocaleString(undefined, {maximumFractionDigits: 0});
      const formattedAlphaPointsPerEpoch = dailyAlphaPointsRewards.toLocaleString(undefined, {maximumFractionDigits: 0});

      return `~${formattedTotalAlphaPoints} αP (${formattedAlphaPointsPerEpoch} αP/epoch)`;
    } catch {
      return '~0 αP (0 αP/epoch)';
    }
  };

  // --- New Handler for Completing Registration of Orphaned Stakes ---
  const handleCompleteRegistration = async (stakedSuiObjectId: string, durationDays: number, principalDisplay?: string) => {
    if (!alphaIsConnected || !alphaAddress) {
      toast.error("Please connect wallet or sign in.");
      return;
    }
    if (registrationInProgress) return; // Prevent multiple simultaneous registrations

    setErrorMessage(null);
    setSuccessMessage(null);
    setRegistrationInProgress(stakedSuiObjectId);
    setTransactionLoading(true);
    let txDigest: string | null = null;

    try {
      const tx = buildRegisterStakeTransaction(stakedSuiObjectId, durationDays);

      if (alphaProvider === 'google') {
        // zkLogin is deprecated - redirect to use wallet connection instead
        throw new Error("zkLogin authentication is deprecated. Please use wallet connection instead.");

      } else if (alphaProvider === 'dapp-kit') {
        // Use raw signAndExecute instead of the wrapped one to avoid toJSON issues
        const signResult = await rawSignAndExecute({
          transaction: tx,
          options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
          },
        });
        
        if (!signResult || typeof signResult !== 'object' || !('digest' in signResult)) {
           throw new Error('Transaction returned an unexpected response format from dapp-kit.');
        }
        txDigest = signResult.digest;

        // No need for manual transaction confirmation with rawSignAndExecute
        const responseError = getTransactionResponseError(signResult);
        if (responseError) throw new Error(responseError);
      } else {
        throw new Error("Unknown provider for transaction execution.");
      }
      
      toast.success(`Successfully registered stake${principalDisplay ? ' for ' + formatSui(principalDisplay) : ''} SUI! Digest: ${txDigest?.substring(0, 10)}...`);
      removeOrphanedStake(stakedSuiObjectId); // Remove from context/local state
      
      // Manual refresh since we're not using the wrapped signAndExecute
      try {
        await refreshStakePositions();
        await refreshLoansData();
        await refreshData();
      } catch (refreshError) {
        console.warn('Failed to refresh data after successful registration:', refreshError);
      }

    } catch (err: any) {
      console.error('Error completing stake registration:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      toast.error(`Registration failed: ${friendlyErrorMessage}`);
      setErrorMessage(friendlyErrorMessage); // Set local error for display if needed
    } finally {
      setTransactionLoading(false);
      setRegistrationInProgress(null);
    }
  };
  // --- End of New Handler ---

  // Helper function to detect problematic withdrawal tickets that should be filtered out
  const isProblematicWithdrawalTicket = (position: any): boolean => {
    // Get the position details for analysis
    const positionId = position.id || '';
    const stakedSuiObjectId = position.stakedSuiObjectId || '';
    const startTimeMs = position.startTimeMs ? parseInt(position.startTimeMs) : 0;
    
    // Check if this is an early withdrawn position (encumbered = true but not loan collateral)
    const isEncumbered = position.encumbered === true;
    // Use the raw position ID for loan checking, not the prefixed version
    const rawStakeId = extractOriginalId(positionId);
    const hasLoan = hasAssociatedLoan(rawStakeId);
    const isLoanCollateral = isStakeLoanCollateral(position, rawStakeId);
    const isEarlyWithdrawn = isEncumbered && !isLoanCollateral;
    
    // Log details for debugging
    console.log(`Checking position ${positionId}:`, {
      encumbered: isEncumbered,
      rawStakeId,
      hasLoan,
      isLoanCollateral,
      isEarlyWithdrawn,
      startTimeMs,
      calculatedUnlockDate: position.calculatedUnlockDate,
      principal: position.principal,
      id: position.id,
      hasCalculatedUnlockDate: !!position.calculatedUnlockDate,
      hasId: !!position.id,
      hasPrincipal: !!position.principal,
      principalValue: position.principal,
      allFields: Object.keys(position)
    });
    
    // If it's a legitimate loan collateral position, allow it
    if (isLoanCollateral) {
      console.log('✅ ALLOWING loan collateral position:', positionId);
      return false;
    }
    
    // For early withdrawn positions (encumbered=true but no loan), they are problematic
    // These positions have already been paid back in some way due to contract logic errors
    if (isEarlyWithdrawn) {
      console.log('🚫 BLOCKING early withdrawn position (already paid back):', positionId);
      return true;
    }
    
    // Check for other problematic conditions
    const hasKnownIssues = (
      // Missing critical fields
      !position.id ||
      !position.principal ||
      position.principal === '0' ||
      // Object IDs that might reference old packages
      positionId.includes('db62a7c') || 
      positionId.includes('bae3eef') ||
      stakedSuiObjectId.includes('db62a7c') ||
      stakedSuiObjectId.includes('bae3eef') ||
      // Very old positions that predate stable package
      startTimeMs < 1703000000000 ||
      startTimeMs === 0
    );
    
    if (hasKnownIssues) {
      console.log('🚫 BLOCKING position with known issues:', positionId);
      return true;
    }
    
    // Allow legitimate active positions
    console.log('✅ ALLOWING legitimate position:', positionId);
    return false;
  };

  // --- First, filter problematic positions with minimal logging ---
  const filteredStakePositions = React.useMemo(() => {
    if (isLoading || stakePositions.length === 0) {
      return [];
    }
    
    const filtered = stakePositions.filter((pos) => {
      const isProblematic = isProblematicWithdrawalTicket(pos);
      return !isProblematic;
    });
    
    // Only log summary if there's a difference
    if (filtered.length !== stakePositions.length) {
      console.log(`[StakedPositionsList] Filtered ${stakePositions.length - filtered.length} problematic positions. ${filtered.length} positions remaining.`);
    }
    
    return filtered;
  }, [stakePositions, isLoading]); // Only depend on actual position data

  // --- Prepare combined data for Swiper with simplified logic ---
  const combinedListItems = React.useMemo((): SwiperItem[] => {
    console.log('[StakedPositionsList] Computing combinedListItems:', {
      isLoading,
      filteredStakePositionsLength: filteredStakePositions.length,
      orphanedStakesLength: orphanedStakes.length,
      filteredStakePositions,
      orphanedStakes
    });

    // Always compute the combined list - don't return empty during loading
    const orphanedAsSwiperItems: SwiperOrphanedItem[] = orphanedStakes.map((orphan, index) => ({
      ...orphan,
      id: `orphaned-${orphan.stakedSuiObjectId || index}`, // Ensure unique ID
      isOrphaned: true,
      principal: orphan.principalAmount || '0', 
    }));

    const registeredAsSwiperItems: SwiperStakeItem[] = filteredStakePositions.map((pos, index) => ({
      ...pos,
      id: `stake-${pos.id || index}`, // Ensure unique ID
      isOrphaned: false,
    }));
    
    const combined = [...orphanedAsSwiperItems, ...registeredAsSwiperItems];
    
    console.log('[StakedPositionsList] Computed combinedListItems:', {
      orphanedAsSwiperItems,
      registeredAsSwiperItems,
      combined
    });
    
    return combined;
  }, [orphanedStakes, filteredStakePositions, isLoading]); // Simplified dependencies

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="card-modern p-6 animate-fade-in">
        {/* Header skeleton - match exact structure */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
              <div className="w-5 h-5 bg-white/30 rounded"></div>
            </div>
            <div>
              <div className="h-5 bg-gray-700/50 rounded w-36 mb-2"></div>
              <div className="h-3 bg-gray-700/30 rounded w-28"></div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="status-indicator-active"></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
        
        <div>
          {/* Content skeleton */}
          <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-700/50 animate-pulse"></div>
                <div className="h-4 bg-gray-700/50 rounded w-32"></div>
              </div>
              <div className="h-5 bg-gray-700/50 rounded w-20"></div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <div className="h-3 bg-gray-700/50 rounded w-16"></div>
                <div className="h-3 bg-gray-700/50 rounded w-20"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 bg-gray-700/50 rounded w-14"></div>
                <div className="h-3 bg-gray-700/50 rounded w-24"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 bg-gray-700/50 rounded w-20"></div>
                <div className="h-3 bg-gray-700/50 rounded w-28"></div>
              </div>
            </div>
            
            <div className="mt-auto">
              <div className="h-10 bg-gray-700/50 rounded-lg w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Full JSX ---
  return (
    <div className="relative">
      <div className="card-modern p-4 animate-fade-in relative z-[40]">
            {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-[41] h-12">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {activeTab === 'stakes' ? 'Staked Positions' : 'Active Loans'}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">
                {activeTab === 'stakes' ? 'Your active stakes' : 'Your loan positions'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Individual Position Navigation - Positioned at Header Level */}
        {activeTab === 'stakes' && combinedListItems.length > 1 && (
          <div className="flex items-center gap-1 relative z-[31]">
            <button
              onClick={() => swiperInstance?.slidePrev()}
              disabled={!swiperInstance}
              className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-lg border border-white/30 hover:bg-black/60 hover:border-white/50 text-white transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous stake"
              title="Previous stake"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            
            {/* Page indicators */}
            {combinedListItems.map((_, index) => (
              <button
                key={index}
                onClick={() => swiperInstance?.slideTo(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? 'bg-purple-400 scale-125'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to stake ${index + 1}`}
                title={`Stake ${index + 1}`}
              />
            ))}
            
            <button
              onClick={() => swiperInstance?.slideNext()}
              disabled={!swiperInstance}
              className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-lg border border-white/30 hover:bg-black/60 hover:border-white/50 text-white transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next stake"
              title="Next stake"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Individual Loan Navigation - Positioned at Header Level */}
        {activeTab === 'loans' && loans.length > 1 && (
          <div className="flex items-center gap-1 relative z-[31]">
            <button
              onClick={() => {
                const swiperInstance = (window as any).loanSwiperInstance;
                swiperInstance?.slidePrev();
              }}
              className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-lg border border-white/30 hover:bg-black/60 hover:border-white/50 text-white transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center"
              aria-label="Previous loan"
              title="Previous loan"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            
            {/* Page indicators */}
            {loans.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  const swiperInstance = (window as any).loanSwiperInstance;
                  swiperInstance?.slideTo(index);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  index === ((window as any).loanActiveIndex || 0)
                    ? 'bg-purple-400 scale-125'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to loan ${index + 1}`}
                title={`Loan ${index + 1}`}
              />
            ))}
            
            <button
              onClick={() => {
                const swiperInstance = (window as any).loanSwiperInstance;
                swiperInstance?.slideNext();
              }}
              className="w-6 h-6 rounded-full bg-black/40 backdrop-blur-lg border border-white/30 hover:bg-black/60 hover:border-white/50 text-white transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center"
              aria-label="Next loan"
              title="Next loan"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}

      </div>

      {/* Main Content Swiper */}
      <div className="relative z-[30]">
        <Swiper
          modules={[Navigation, Pagination, A11y]}
          spaceBetween={0}
          slidesPerView={1}
          loop={false}
          onSwiper={setMainSwiperInstance}
          onSlideChange={(swiper) => {
            const newTab = swiper.activeIndex === 0 ? 'stakes' : 'loans';
            setActiveTab(newTab);
          }}
          pagination={false} 
          navigation={false} 
          className="h-full min-h-0"
        >
          {/* Stakes Slide */}
          <SwiperSlide className="bg-transparent rounded-lg self-stretch h-full min-h-0 relative z-[29]">
            <div>
              {/* Stakes Content */}
              {(() => {
                const shouldShowEmpty = combinedListItems.length === 0 && !isLoading;
                console.log('[StakedPositionsList] Rendering decision:', {
                  combinedListItemsLength: combinedListItems.length,
                  isLoading,
                  shouldShowEmpty,
                  shouldShowList: combinedListItems.length > 0
                });
                return null;
              })()}
              
              {combinedListItems.length === 0 && !isLoading ? (
                // --- Empty State ---
                <div className="text-center py-8 bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-medium text-white mb-1">No Staked Positions</h3>
                  <p className="text-sm text-gray-400 mb-1">Ready to start earning?</p>
                  <p className="text-xs text-gray-500">Go to Generation page to create your first stake</p>
                </div>
              ) : combinedListItems.length > 0 ? (
          // --- List of Combined Staked Positions (Swiper) ---
          <div className="relative z-[30]">
            

            
            <Swiper
              modules={[Navigation, Pagination, A11y]}
              spaceBetween={20}
              slidesPerView={1}
              loop={combinedListItems.length > 1 && combinedListItems.length >= 3}
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
              pagination={false} 
              navigation={false} 
              className="h-full min-h-0"
            >
              {combinedListItems.map((item) => {
                const isOrphaned = item.isOrphaned;
                const displayId = item.id;

                // Adapt data for rendering based on type
                const principalDisplay = item.principal;
                const durationDaysDisplay = isOrphaned ? (item as SwiperOrphanedItem).durationDays : parseInt((item as SwiperStakeItem).durationDays || '0', 10);
                const unlockDate = !isOrphaned ? getUnlockDate(item as SwiperStakeItem) : null;
                const formattedUnlockDate = unlockDate ? formatTimestamp(unlockDate) : 'N/A';
                
                const maturityPercentage = !isOrphaned ? Math.max(0, Math.min(100, (item as SwiperStakeItem).maturityPercentage || 0)) : 0;
                const isMature = !isOrphaned && maturityPercentage >= 100;
                const isEncumbered = !isOrphaned && (item as SwiperStakeItem).encumbered;
                
                // Check if encumbered stake is loan collateral vs early withdrawn
                const isLoanCollateral = isStakeLoanCollateral(item, item.id);
                const isEarlyWithdrawn = isEncumbered && !isLoanCollateral;
                
                // Check if early withdrawn stake has now matured (can reclaim principal)
                const isEarlyWithdrawnAndMatured = isEarlyWithdrawn && isMature;
                
                const canUnstake = isMature && !isEncumbered;
                const canReclaimPrincipal = isEarlyWithdrawnAndMatured;

                const cardClass = isOrphaned 
                  ? "bg-red-900/20 backdrop-blur-lg border border-red-500/30 rounded-xl p-4 text-sm h-full flex flex-col justify-between hover:bg-red-900/30 hover:border-red-400/40 transition-all duration-300 cursor-pointer no-underline shadow-xl hover:shadow-red-500/10"
                  : "bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-4 text-sm h-full flex flex-col justify-between hover:bg-black/30 hover:border-white/20 transition-all duration-300 cursor-pointer no-underline shadow-xl hover:shadow-purple-500/10";

                const statusDotClass = isOrphaned
                  ? "status-indicator-warning"
                  : isLoanCollateral
                    ? "status-indicator-warning"
                    : isEarlyWithdrawnAndMatured
                      ? "status-indicator-active"
                    : isEarlyWithdrawn
                      ? "status-indicator-info" 
                      : isMature 
                        ? "status-indicator-active" 
                        : "status-indicator-info";

                const statusText = isOrphaned
                  ? "Pending Registration"
                  : isLoanCollateral
                    ? "Loan Collateral"
                    : isEarlyWithdrawnAndMatured
                      ? "Loan Collateral (Matured)"
                    : isEarlyWithdrawn
                      ? "Loan Collateral"
                      : isMature 
                        ? "Mature" 
                        : "Staking";
                
                const statusChipClass = isOrphaned
                  ? "bg-red-900/50 text-red-300 border border-red-700/50"
                  : isLoanCollateral
                    ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700/50"
                    : isEarlyWithdrawnAndMatured
                      ? "bg-green-900/50 text-green-300 border border-green-700/50"
                    : isEarlyWithdrawn
                      ? "bg-blue-900/50 text-blue-300 border border-blue-700/50"
                      : isMature
                        ? "bg-green-900/50 text-green-300 border border-green-700/50"
                        : "bg-blue-900/50 text-blue-300 border border-blue-700/50";

                return (
                  <SwiperSlide key={displayId} className="bg-transparent rounded-lg p-1 self-stretch h-full min-h-0 relative z-[29]">
                    <a 
                      href={`https://suiscan.xyz/testnet/object/${displayId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cardClass}
                      title={isOrphaned ? "View Native Stake on Suiscan" : "View Staked Position on Suiscan"}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={statusDotClass}></div>
                            <div>
                              <span className="text-gray-300 font-mono text-xs block" title={displayId}>
                                {isOrphaned ? "Native Stake" : "Position"}
                              </span>
                              <span className="text-gray-500 text-xs">
                                {formatAddress(displayId)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Convert to Alpha Points button for mature positions (not for encumbered stakes) */}
                            {!isOrphaned && !isEncumbered && isMature && (
                              <button
                                onClick={e => { e.preventDefault(); e.stopPropagation(); handleConvertMatureStakeToPoints(extractOriginalId(item.id), item.principal); }}
                                disabled={earlyUnstakeInProgress === extractOriginalId(item.id) || loading.transaction}
                                className="px-2 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium rounded transition-all duration-300 disabled:opacity-50 relative z-[28]"
                                title="Convert mature stake to Alpha Points (100% value) + SUI withdrawal ticket"
                              >
                                {earlyUnstakeInProgress === extractOriginalId(item.id) ? (
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  '💎 αP'
                                )}
                              </button>
                            )}


                            
                            <div className={`px-2 py-1 rounded text-xs font-medium ${statusChipClass}`}>
                              {statusText}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Principal</span>
                            <div className="text-right">
                              <span className="text-white font-semibold">{formatSui(principalDisplay)}</span>
                              <span className="text-blue-400 text-sm ml-1">SUI</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Duration</span>
                            <div className="text-right">
                              <span className="text-white">{formatDuration(durationDaysDisplay)}</span>
                              {!isOrphaned && (
                                <div className="text-xs text-gray-500">{formattedUnlockDate}</div>
                              )}
                            </div>
                          </div>
                          
                          {!isOrphaned && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Est. Rewards</span>
                              <span className="text-emerald-400 text-sm font-medium">
                                {calculateEstAlphaPointRewards(principalDisplay, String(durationDaysDisplay), (item as SwiperStakeItem).apy)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {isOrphaned ? null : !isMature && !isEncumbered ? (
                          <div className="mb-2">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Progress</span>
                              <span>{maturityPercentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${maturityPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : null}
                      </div> 

                      {/* Action Button / Status Info - positioned at the bottom */}
                      <div className="mt-auto pt-1">
                        {isOrphaned ? (
                          <button
                            onClick={(e) => { 
                              e.preventDefault(); 
                              e.stopPropagation();
                              if (item.isOrphaned) {
                                handleCompleteRegistration(extractOriginalId(item.id), item.durationDays, item.principalAmount);
                              }
                            }}
                            disabled={!item.isOrphaned || registrationInProgress === (item.isOrphaned ? extractOriginalId(item.id) : null) || loading.transaction}
                            className="w-full btn-modern-secondary relative z-[28]"
                          >
                            {registrationInProgress === (item.isOrphaned ? extractOriginalId(item.id) : null) ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </span>
                            ) : 'Register Stake with Protocol'}
                          </button>
                        ) : canUnstake ? (
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); handleUnstake(extractOriginalId(item.id), item.principal); }}
                            disabled={unstakeInProgress === extractOriginalId(item.id) || loading.transaction}
                            className="w-full btn-modern-primary relative z-[28]"
                          >
                            {unstakeInProgress === extractOriginalId(item.id) ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </span>
                            ) : 'Unstake'}
                          </button>
                        ) : isLoanCollateral ? (
                          <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-300 text-xs text-center backdrop-blur-sm">
                            This position is collateral. Repay loan to unstake.
                          </div>
                        ) : canReclaimPrincipal ? (
                          <div className="p-2 bg-blue-900/30 border border-blue-700/50 rounded text-blue-300 text-xs text-center backdrop-blur-sm">
                            💰 Early withdrawn stake has matured.<br/>
                            <strong>Check the Loans tab</strong> to repay your loan and unlock this collateral.
                          </div>
                        ) : isEarlyWithdrawn ? (
                          // Safety net: Don't show claim button for positions that might have migration issues
                          isProblematicWithdrawalTicket(item as any) ? (
                            <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-xs text-center backdrop-blur-sm">
                              Withdrawal ticket requires migration. Position hidden for safety.
                            </div>
                          ) : (
                            <button
                              onClick={e => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                                handleNativeWithdrawStake(extractOriginalId(item.id), item.principal);
                              }}
                              disabled={nativeWithdrawInProgress === extractOriginalId(item.id) || loading.transaction}
                              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium py-3 rounded-lg transition-all duration-300 relative z-[28] disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Claim SUI from withdrawal ticket using native Sui staking (bypasses encumbrance)"
                            >
                              {nativeWithdrawInProgress === extractOriginalId(item.id) ? (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </span>
                              ) : (
                                '💰 Claim SUI'
                              )}
                            </button>
                          )
                        ) : null}
                      </div>
                    </a>
                  </SwiperSlide>
                );
              })}
            </Swiper>
            

          </div>
        ) : <></>}
            </div>
          </SwiperSlide>

          {/* Loans Slide */}
          <SwiperSlide className="bg-transparent rounded-lg self-stretch h-full min-h-0 relative z-[29]">
            <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden">
              <LoanPanel />
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
    </div>

    {/* Floating Swiper Arrow - Positioned at right edge of card */}
    <button
      className="absolute top-1/2 -translate-y-1/2 -right-1 w-10 h-10 bg-black/40 backdrop-blur-lg border border-white/30 hover:bg-black/60 hover:border-white/50 text-white rounded-full transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center z-[50] group"
      aria-label={activeTab === 'stakes' ? 'View loans' : 'View stakes'}
      title={activeTab === 'stakes' ? 'Switch to Loan Positions' : 'Switch to Stake Positions'}
      onClick={() => {
        if (activeTab === 'stakes') {
          setActiveTab('loans');
          mainSwiperInstance?.slideTo(1);
        } else {
          setActiveTab('stakes');
          mainSwiperInstance?.slideTo(0);
        }
      }}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={2} 
        stroke="currentColor" 
        className={`w-5 h-5 transition-transform duration-300 ${
          activeTab === 'stakes' ? 'rotate-0' : 'rotate-180'
        } group-hover:scale-110`}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>

    {/* Withdrawal Guide Modal */}
    {showWithdrawalGuide && (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🎯 Claim Your SUI Withdrawal Ticket
          </h3>
          <button
            onClick={() => setShowWithdrawalGuide(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Warning Box */}
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-lg">⚠️</span>
            <div className="text-amber-200 text-sm">
              <strong>Double Spend Issue:</strong> You received both Alpha Points AND a SUI withdrawal ticket worth 100% of your original stake!
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-4">
          <h4 className="text-white font-semibold mb-2">How to claim your SUI:</h4>
          
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-2 bg-green-800/50 rounded border border-green-700/50">
              <span className="bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</span>
              <div className="text-green-200 text-sm">
                <strong>NEW:</strong> Click the <span className="bg-purple-600 px-1 rounded text-white">💰 Claim SUI</span> button above! 
                This bypasses encumbrance and claims your SUI directly.
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 bg-slate-800/50 rounded">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
              <div className="text-slate-300 text-sm">
                <strong>Alternative:</strong> Look for <code className="bg-slate-700 px-1 rounded text-blue-300">StakePosition&lt;StakedSui&gt;</code> objects in your wallet
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 bg-slate-800/50 rounded">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
              <div className="text-slate-300 text-sm">
                These are <strong>wrapped withdrawal tickets</strong> - you need to extract the StakedSui first
              </div>
            </div>

            <div className="flex items-start gap-3 p-2 bg-slate-800/50 rounded">
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
              <div className="text-slate-300 text-sm">
                Wait 2-3 epochs for cooldown, then use Sui Wallet or Suiscan to claim your SUI
              </div>
            </div>
          </div>
        </div>

        {/* Technical Info */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 mb-4">
          <div className="text-blue-200 text-sm">
            <strong>Technical Note:</strong> The "💰 Claim SUI" button calls the native Sui staking system directly, 
            bypassing our package's encumbrance checks. This is the easiest way to claim your SUI!
          </div>
        </div>

        {/* Reward Info */}
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-green-200 text-sm">
            <span className="text-green-400">💰</span>
            <strong>You'll receive:</strong> 100% SUI value + any staking rewards earned!
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              window.open(`https://suiscan.xyz/testnet/account/${alphaAddress}?module=objects&type=${PACKAGE_ID}::stake_position::StakePosition`, '_blank');
              setShowWithdrawalGuide(false);
            }}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium rounded-lg transition-all duration-300"
          >
            🔍 Find My Tickets
          </button>
          <button
            onClick={() => setShowWithdrawalGuide(false)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-all duration-300"
          >
            Got it
          </button>
        </div>
              </div>
      </div>
    )}
  </div>
  );
};