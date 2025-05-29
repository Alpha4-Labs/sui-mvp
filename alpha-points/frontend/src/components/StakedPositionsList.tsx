import React, { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { toast } from 'react-toastify';
import { useAlphaContext, OrphanedStake } from '../context/AlphaContext';
import { buildUnstakeTransaction, buildRegisterStakeTransaction } from '../utils/transaction';
import {
  getTransactionErrorMessage,
  getTransactionResponseError,
} from '../utils/transaction-adapter';
import { formatSui, formatAddress, formatDuration, formatTimestamp } from '../utils/format';
import { StakePosition } from '../types';

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

// --- New imports needed for ZK Login flow in the new handler ---
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair, Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { 
    SuiClient, // For type casting
    SuiTransactionBlockResponse // For type hint
} from '@mysten/sui/client';
import { 
    getZkLoginSignature, 
    ZkLoginSignatureInputs as ActualZkLoginSignatureInputs,
} from '@mysten/sui/zklogin'; 
// Assuming EnokiZkpResponse and related types are defined as in StakeCard.tsx or a shared util
interface ZkProofPoints { a: string[]; b: string[][]; c: string[]; }
interface IssBase64DetailsClaim { value: string; indexMod4: number; }
interface EnokiZkpData { proofPoints: ZkProofPoints; issBase64Details: IssBase64DetailsClaim; headerBase64: string; addressSeed: string; }
interface EnokiZkpResponse { data: EnokiZkpData; }
// --- End of new imports ---

// --- Define a combined type for Swiper items ---
interface SwiperStakeItem extends Omit<StakePosition, 'id'> { 
  id: string; 
  isOrphaned: false;
}

interface SwiperOrphanedItem extends OrphanedStake {
  id: string; // Use stakedSuiObjectId as id for keying
  isOrphaned: true;
  principal: string; // Derived from OrphanedStake.principalAmount for consistency
  // durationDays is already number in OrphanedStake
  // calculatedUnlockDate?: string; // Will be N/A or calculated differently if needed
  // maturityPercentage?: number; // N/A for orphaned
  // encumbered?: boolean; // Always false for orphaned in this context
  // apy?: number; // N/A for orphaned from protocol POV
}

type CombinedStakeListItem = SwiperStakeItem | SwiperOrphanedItem;
// --- End of combined type ---

export const StakedPositionsList: React.FC = () => {
  const { 
    stakePositions, 
    loading, 
    refreshData, 
    setTransactionLoading,
    orphanedStakes = [], 
    removeOrphanedStake = (id: string) => console.warn("removeOrphanedStake not implemented", id),
    address: alphaAddress, 
    isConnected: alphaIsConnected, 
    provider: alphaProvider, 
    suiClient, 
    selectedDuration, 
    version
  } = useAlphaContext();

  const [unstakeInProgress, setUnstakeInProgress] = useState<string | null>(null);
  const [registrationInProgress, setRegistrationInProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [swiperInstance, setSwiperInstance] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

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
      const result = await signAndExecute({ transaction });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      toast.success(`Successfully unstaked ${formatSui(principal)} SUI! Digest: ${txDigest.substring(0, 10)}...`);
      
      setTimeout(() => {
        refreshData();
      }, 2000);

    } catch (err: any) {
      console.error('Error unstaking position:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      toast.error(friendlyErrorMessage);
    } finally {
      setTransactionLoading(false);
      setUnstakeInProgress(null);
    }
  };

  // Helper for Estimated Rewards Calculation
  // Now uses APY directly from the position object and calculates Alpha Points
  const calculateEstAlphaPointRewards = (principal?: string, durationDaysStr?: string, positionApy?: number): string => {
    if (!principal || !durationDaysStr || typeof positionApy === 'undefined') return '~0 αP (0 αP/epoch)';
    try {
      const principalNum = parseInt(principal, 10); // This is MIST
      const durationDays = parseInt(durationDaysStr, 10);
      const principalSui = principalNum / 1_000_000_000; // Convert MIST to SUI

      if (isNaN(principalSui) || isNaN(durationDays) || durationDays <= 0) return '~0 αP (0 αP/epoch)';

      const ALPHA_POINTS_PER_SUI_PER_EPOCH = 68;
      const EPOCHS_PER_DAY = 1; // Corrected: Sui Testnet epochs are 24 hours

      const totalEpochs = durationDays * EPOCHS_PER_DAY; // This will now correctly be equal to durationDays
      const totalAlphaPointsRewards = principalSui * ALPHA_POINTS_PER_SUI_PER_EPOCH * totalEpochs;
      const alphaPointsPerEpoch = principalSui * ALPHA_POINTS_PER_SUI_PER_EPOCH; // This remains per 24h epoch

      const formattedTotalAlphaPoints = totalAlphaPointsRewards.toLocaleString(undefined, {maximumFractionDigits: 0});
      const formattedAlphaPointsPerEpoch = alphaPointsPerEpoch.toLocaleString(undefined, {maximumFractionDigits: 0});

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
        tx.setSender(alphaAddress);
        
        const jwt = localStorage.getItem('zkLogin_jwt');
        const secretKeySeedString = localStorage.getItem('zkLogin_ephemeralSecretKeySeed');
        const maxEpochString = localStorage.getItem('zkLogin_maxEpoch');
        const randomnessString = localStorage.getItem('zkLogin_randomness');
        const publicKeyBytesString = localStorage.getItem('zkLogin_ephemeralPublicKeyBytes');

        if (!jwt || !secretKeySeedString || !maxEpochString || !randomnessString || !publicKeyBytesString) {
          throw new Error("Missing required zkLogin data from localStorage for registration.");
        }

        const secretKeySeed = Uint8Array.from(JSON.parse(secretKeySeedString));
        const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeySeed.slice(0, 32));
        const maxEpoch = parseInt(maxEpochString, 10);
        const randomness = randomnessString;
        const publicKeyBytes = Uint8Array.from(JSON.parse(publicKeyBytesString));
        const ephemeralPublicKey = new Ed25519PublicKey(publicKeyBytes);
        const extendedEphemeralPublicKeyString = ephemeralPublicKey.toSuiPublicKey();
        
        const VITE_ENOKI_KEY = import.meta.env.VITE_ENOKI_KEY; // Ensure this is accessible
        if (!VITE_ENOKI_KEY) throw new Error("Enoki API Key missing.");

        const fullTxBytes = await tx.build({ client: suiClient as unknown as SuiClient });
        const { signature: userSignature } = await ephemeralKeypair.signTransaction(fullTxBytes);

        const enokiZkpRequest = {
            network: 'testnet', // Or your configured network
            ephemeralPublicKey: extendedEphemeralPublicKeyString,
            maxEpoch: maxEpoch,
            randomness: randomness,
        };

        const enokiZkpResponseRaw = await fetch('https://api.enoki.mystenlabs.com/v1/zklogin/zkp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VITE_ENOKI_KEY}`, 'zklogin-jwt': jwt },
            body: JSON.stringify(enokiZkpRequest)
        });

        if (!enokiZkpResponseRaw.ok) {
            const errorBody = await enokiZkpResponseRaw.text();
            throw new Error(`Enoki ZKP service error: ${errorBody}`);
        }
        const enokiResponse: EnokiZkpResponse = await enokiZkpResponseRaw.json();
        if (!enokiResponse.data?.proofPoints) throw new Error("Invalid ZKP response from Enoki.");

        const zkLoginInputs: ActualZkLoginSignatureInputs = {
             proofPoints: enokiResponse.data.proofPoints,
             issBase64Details: enokiResponse.data.issBase64Details,
             headerBase64: enokiResponse.data.headerBase64,
             addressSeed: localStorage.getItem('zkLogin_userSalt_from_enoki') || '', // Ensure salt is available
        };

        const actualZkLoginSignature = getZkLoginSignature({ inputs: zkLoginInputs, maxEpoch, userSignature });

        const result = await suiClient.executeTransactionBlock({ 
          transactionBlock: fullTxBytes,
          signature: actualZkLoginSignature,
          options: { showEffects: true, showObjectChanges: true } // showObjectChanges might be useful
        });
        txDigest = result.digest;
        // Check for errors in effect
        const responseError = getTransactionResponseError(result as SuiTransactionBlockResponse);
        if (responseError) throw new Error(responseError);

      } else if (alphaProvider === 'dapp-kit') {
        const signResult = await signAndExecute({ transaction: tx });
        
        if (!signResult || typeof signResult !== 'object' || !('digest' in signResult)) {
           throw new Error('Transaction returned an unexpected response format from dapp-kit.');
        }
        txDigest = signResult.digest;

        let confirmedTx: SuiTransactionBlockResponse | null = null;
        let attempts = 0;
        const maxAttempts = 5;
        const delayMs = 1000;

        while (attempts < maxAttempts) {
          try {
            confirmedTx = await suiClient.getTransactionBlock({
                digest: txDigest,
                options: { showEffects: true }
            });
            if (confirmedTx) break; // Exit loop if transaction found
          } catch (e: any) {
            if (e.message && e.message.includes('Could not find the referenced transaction')) {
              attempts++;
              if (attempts >= maxAttempts) {
                console.error(`Failed to confirm transaction ${txDigest} after ${maxAttempts} attempts.`);
                throw e; // Re-throw the error if max attempts reached
              }
              await new Promise(resolve => setTimeout(resolve, delayMs)); // Wait before retrying
            } else {
              throw e; // Re-throw other errors immediately
            }
          }
        }

        if (!confirmedTx) {
          throw new Error(`Transaction ${txDigest} could not be confirmed after ${maxAttempts} attempts.`);
        }
        
        const responseError = getTransactionResponseError(confirmedTx);
        if (responseError) throw new Error(responseError);
      } else {
        throw new Error("Unknown provider for transaction execution.");
      }
      
      toast.success(`Successfully registered stake${principalDisplay ? ' for ' + formatSui(principalDisplay) : ''} SUI! Digest: ${txDigest?.substring(0, 10)}...`);
      removeOrphanedStake(stakedSuiObjectId); // Remove from context/local state
      refreshData(); // Refresh all data, including stakePositions

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

  // --- Prepare combined data for Swiper ---
  const combinedListItems = React.useMemo((): CombinedStakeListItem[] => {
    const orphanedAsSwiperItems: SwiperOrphanedItem[] = orphanedStakes.map(orphan => ({
      ...orphan,
      id: orphan.stakedSuiObjectId, 
      isOrphaned: true,
      principal: orphan.principalAmount || '0', 
      // durationDays is already a number in OrphanedStake, no need to String() then parseInt()
    }));

    const registeredAsSwiperItems: SwiperStakeItem[] = stakePositions.map(pos => ({
      ...pos,
      isOrphaned: false,
    }));
    
    // Display orphaned stakes first, or interleave as preferred
    return [...orphanedAsSwiperItems, ...registeredAsSwiperItems];
  }, [orphanedStakes, stakePositions, version]);
  // --- End Prepare combined data ---

  // --- Loading State ---
  if (loading.positions || loading.allUserStakes) {
    return (
      <div className="bg-background-card rounded-lg p-6 shadow-lg animate-pulse h-[420px]"> {/* Fixed height for skeleton */}
        <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-60 bg-gray-700 rounded w-full mb-4"></div> 
        <div className="flex justify-between">
            <div className="h-10 bg-gray-700 rounded w-1/3"></div>
            <div className="h-10 bg-gray-700 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  // --- Full JSX ---
  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg relative overflow-y-auto overflow-x-hidden">
      <h2 className="text-xl font-semibold text-white mb-4">Your Staked Positions</h2>

      {/* Status Messages */}
      <div style={{ minHeight: '20px' }}>
        {errorMessage && (
          <div className="my-3 p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm break-words">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="my-3 p-3 bg-green-900/30 border border-green-700 rounded-md text-green-400 text-sm break-words">
            {successMessage}
          </div>
        )}
      </div>

      {/* Conditional Rendering: Empty State vs. List */}
      {combinedListItems.length === 0 && !loading.positions && !loading.allUserStakes ? (
        // --- Empty State --- (If both registered and orphaned are empty and not loading)
        <div className="text-center py-10 bg-background rounded-lg flex flex-col items-center justify-center h-full">
          <div className="text-5xl text-gray-700 mb-4">📊</div>
          <p className="text-gray-400 mb-2">No Staked Positions Found</p>
          <p className="text-sm text-gray-500">Stake SUI in the 'Manage Stake' section to start earning.</p>
        </div>
      ) : combinedListItems.length > 0 ? (
        // --- List of Combined Staked Positions (Swiper) ---
        <>
          <Swiper
            key={version}
            modules={[Navigation, Pagination, A11y]}
            spaceBetween={20}
            slidesPerView={1}
            loop={combinedListItems.length > 1} // Only loop if more than one item
            onSwiper={setSwiperInstance}
            onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
            pagination={false} 
            navigation={false} 
            className="h-full min-h-0 pb-10"
          >
            {combinedListItems.map((item) => {
              const isOrphaned = item.isOrphaned;
              const displayId = item.id;

              // Adapt data for rendering based on type
              const principalDisplay = item.principal;
              // For SwiperOrphanedItem, item.durationDays is already a number.
              // For SwiperStakeItem, item.durationDays is a string, so parse it.
              const durationDaysDisplay = isOrphaned ? (item as SwiperOrphanedItem).durationDays : parseInt((item as SwiperStakeItem).durationDays || '0', 10);
              const unlockDate = !isOrphaned ? getUnlockDate(item as SwiperStakeItem) : null;
              const formattedUnlockDate = unlockDate ? formatTimestamp(unlockDate) : 'N/A';
              
              const maturityPercentage = !isOrphaned ? Math.max(0, Math.min(100, (item as SwiperStakeItem).maturityPercentage || 0)) : 0;
              const isMature = !isOrphaned && maturityPercentage >= 100;
              const isEncumbered = !isOrphaned && (item as SwiperStakeItem).encumbered;
              const canUnstake = isMature && !isEncumbered;

              const cardClass = isOrphaned 
                ? "border border-red-700/70 rounded-lg p-4 text-sm h-full flex flex-col justify-between bg-red-900/20 hover:bg-red-900/40 transition-colors cursor-pointer no-underline"
                : "border border-gray-700 rounded-lg p-4 text-sm h-full flex flex-col justify-between bg-gray-800/30 hover:bg-gray-800/60 transition-colors cursor-pointer no-underline";

              const statusDotClass = isOrphaned
                ? "bg-red-500"
                : isEncumbered 
                  ? "bg-yellow-500" 
                  : isMature 
                    ? "bg-green-500" 
                    : "bg-blue-500";

              const statusText = isOrphaned
                ? "Pending Registration"
                : isEncumbered 
                  ? "Collateral" 
                  : isMature 
                    ? "Mature" 
                    : "Staking";
              
              const statusChipClass = isOrphaned
                ? "bg-red-900/50 text-red-300"
                : isEncumbered
                  ? "bg-yellow-900/40 text-yellow-300"
                  : isMature
                    ? "bg-green-900/40 text-green-300"
                    : "bg-blue-900/40 text-blue-300";

              return (
                <SwiperSlide key={displayId} className="bg-transparent rounded-lg p-1 self-stretch h-full min-h-0">
                  <a 
                    href={`https://suiscan.xyz/testnet/object/${displayId}`} // Generic link, works for both types of IDs
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cardClass}
                    title={isOrphaned ? "View Native Stake on Suiscan" : "View Staked Position on Suiscan"}
                  >
                    <div> {/* Top content section */}
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${statusDotClass}`} title={statusText}></div>
                          <span className="text-gray-400 font-mono text-xs" title={displayId}>
                            {isOrphaned ? "Native Stake: " : "Position: "}{formatAddress(displayId)}
                          </span>
                        </div>
                        <div className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusChipClass}`}>
                          {statusText}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3 text-xs">
                        <span className="text-gray-400">Principal:</span>
                        <span className="text-white text-right font-medium">
                          {formatSui(principalDisplay)} SUI
                        </span>

                        <span className="text-gray-400">Duration:</span>
                        <span className="text-white text-right">
                          {formatDuration(durationDaysDisplay)} {isOrphaned ? "(Intended)" : `(${formattedUnlockDate})`}
                        </span>
                        
                        {!isOrphaned && (
                          <>
                            <span className="text-gray-400">Est. Rewards:</span>
                            <span className="text-green-400 text-right text-xs">
                              {calculateEstAlphaPointRewards(principalDisplay, String(durationDaysDisplay), (item as SwiperStakeItem).apy)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Progress Bar or Register Button Area */}
                      {isOrphaned ? (
                        <div className="mb-3 mt-auto pt-2"> {/* Ensure button is at bottom for orphaned */} 
                          <button
                            onClick={(e) => { 
                              e.preventDefault(); 
                              e.stopPropagation();
                              // Ensure item is SwiperOrphanedItem before accessing its specific props
                              if (item.isOrphaned) {
                                handleCompleteRegistration(item.stakedSuiObjectId, item.durationDays, item.principalAmount);
                              }
                            }}
                            // Disable if not an orphaned item or if registration is in progress for THIS item or general transaction loading
                            disabled={!item.isOrphaned || registrationInProgress === (item.isOrphaned ? item.stakedSuiObjectId : null) || loading.transaction}
                            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors text-xs font-medium disabled:opacity-70 disabled:cursor-not-allowed relative"
                          >
                            {registrationInProgress === (item.isOrphaned ? item.stakedSuiObjectId : null) ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              </span>
                            ) : 'Register Stake with Protocol'}
                          </button>
                        </div>
                      ) : !isMature && !isEncumbered ? (
                        <div className="mb-3"> {/* Progress for active, non-encumbered stakes */} 
                          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                            <span>Progress</span>
                            <span>{maturityPercentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full bg-blue-500`}
                              style={{ width: `${maturityPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : null /* No progress bar for mature/encumbered/orphaned here, actions below */}
                    </div> 

                    {/* Action Button / Status Info for REGISTERED stakes - positioned at the bottom */}
                    {!isOrphaned && (
                      <div className="mt-auto pt-2">
                        {canUnstake ? (
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); handleUnstake(item.id, item.principal); }}
                            disabled={unstakeInProgress === item.id || loading.transaction}
                            className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded transition-colors text-xs font-medium disabled:opacity-70 disabled:cursor-not-allowed relative"
                          >
                            {unstakeInProgress === item.id ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              </span>
                            ) : 'Unstake'}
                          </button>
                        ) : isEncumbered ? (
                          <div className="p-1.5 bg-yellow-900/30 border border-yellow-900/50 rounded text-yellow-400 text-xs text-center">
                            This position is collateral. Repay loan to unstake.
                          </div>
                        ) : null /* Mature but not encumbered and not yet showing unstake button (e.g. if canUnstake is false for other reasons) */}
                      </div>
                    )}
                  </a>
                </SwiperSlide>
              );
            })}
          </Swiper>
          {/* Custom Navigation & Pagination at the bottom */}
          {combinedListItems.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2 absolute left-0 right-0 bottom-4 z-30">
              <button
                className="p-1.5 rounded-full bg-background-card/50 hover:bg-background-card/80 text-white transition-colors"
                aria-label="Previous slide"
                onClick={() => swiperInstance && swiperInstance.slidePrev()}
              >
                <ChevronLeftIcon />
              </button>
              <div className="flex gap-1">
                {combinedListItems.map((_, idx) => (
                  <button
                    key={idx}
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold transition-colors
                      ${activeIndex === idx ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    onClick={() => swiperInstance && swiperInstance.slideToLoop(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <button
                className="p-1.5 rounded-full bg-background-card/50 hover:bg-background-card/80 text-white transition-colors"
                aria-label="Next slide"
                onClick={() => swiperInstance && swiperInstance.slideNext()}
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </>
      ) : <></>}
    </div>
  );
};