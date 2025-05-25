import React, { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { toast } from 'react-toastify';
import { useAlphaContext } from '../context/AlphaContext';
import { buildUnstakeTransaction } from '../utils/transaction';
import {
  getTransactionErrorMessage,
  getTransactionResponseError,
} from '../utils/transaction-adapter';
import { formatSui, formatAddress, formatDuration, formatTimestamp } from '../utils/format';

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

export const StakedPositionsList: React.FC = () => {
  const { stakePositions, loading, refreshData, setTransactionLoading } = useAlphaContext();
  const [unstakeInProgress, setUnstakeInProgress] = useState<string | null>(null);
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

  // --- Loading State ---
  if (loading.positions) {
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

      {/* Empty State */}
      {stakePositions.length === 0 && !loading.positions ? (
        <div className="text-center py-10 bg-background rounded-lg flex flex-col items-center justify-center h-full">
          <div className="text-5xl text-gray-700 mb-4">📊</div>
          <p className="text-gray-400 mb-2">No Staked Positions Found</p>
          <p className="text-sm text-gray-500">Stake SUI in the 'Manage Stake' section to start earning.</p>
        </div>
      ) : (
        <>
          <Swiper
            modules={[Navigation, Pagination, A11y]}
            spaceBetween={20}
            slidesPerView={1}
            loop={true}
            onSwiper={setSwiperInstance}
            onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
            pagination={false} // Hide default pagination
            navigation={false} // Hide default navigation
            className="h-full min-h-0 pb-10"
          >
            {stakePositions.map((position) => {
              // Add log to check the date string being used
              // console.log(`Rendering position ${position.id}, calculatedUnlockDate: ${position.calculatedUnlockDate}`); 
              
              // Calculate status variables for clarity
              // maturityPercentage now comes directly from the hook based on time
              const maturityPercentage = Math.max(0, Math.min(100, position.maturityPercentage || 0));
              const isMature = maturityPercentage >= 100;
              const isEncumbered = position.encumbered;
              // isMature check uses the timestamp comparison done in the hook
              const canUnstake = isMature && !isEncumbered;
              const unlockDate = getUnlockDate(position);
              const formattedUnlockDate = unlockDate ? formatTimestamp(unlockDate) : 'N/A';

              return (
                <SwiperSlide key={position.id} className="bg-background rounded-lg p-1 self-stretch h-full min-h-0"> {/* Fill height */}
                  <a
                    href={`https://testnet.suivision.xyz/object/${position.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-gray-700 rounded-lg p-4 text-sm h-full flex flex-col justify-between bg-gray-800/30 hover:bg-gray-800/60 transition-colors cursor-pointer no-underline"
                    title="View on Suivision"
                  >
                    <div> {/* Top content section */}
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            isEncumbered ? "bg-yellow-500" : isMature ? "bg-green-500" : "bg-blue-500"
                          }`} title={isEncumbered ? "Loan Collateral" : isMature ? "Mature" : "Staking"}></div>
                          <span className="text-gray-400 font-mono text-xs" title={position.id}>
                            {formatAddress(position.id)}
                          </span>
                        </div>
                        <div className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                          isEncumbered
                            ? "bg-yellow-900/40 text-yellow-300"
                            : isMature
                              ? "bg-green-900/40 text-green-300"
                              : "bg-blue-900/40 text-blue-300"
                        }`}>
                          {isEncumbered ? "Collateral" : isMature ? "Mature" : "Staking"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3 text-xs">
                        <span className="text-gray-400">Principal:</span>
                        <span className="text-white text-right font-medium">
                          {formatSui(position.principal)} SUI
                        </span>

                        <span className="text-gray-400">Duration:</span>
                        <span className="text-white text-right">
                          {formatDuration(parseInt(position.durationDays || '0', 10))} ({formattedUnlockDate})
                        </span>

                        <span className="text-gray-400">Est. Rewards:</span>
                        <span className="text-green-400 text-right text-xs">
                           {calculateEstAlphaPointRewards(position.principal, position.durationDays, position.apy)}
                        </span>
                      </div>

                      {!isMature && !isEncumbered && (
                        <div className="mb-3">
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
                      )}
                    </div> 

                    {/* Action Button / Status Info - positioned at the bottom */}
                    <div className="mt-auto pt-2">
                      {canUnstake ? (
                        <button
                          onClick={e => { e.preventDefault(); handleUnstake(position.id, position.principal); }}
                          disabled={unstakeInProgress === position.id || loading.transaction}
                          className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded transition-colors text-xs font-medium disabled:opacity-70 disabled:cursor-not-allowed relative"
                        >
                          {unstakeInProgress === position.id ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </span>
                          ) : 'Unstake'}
                        </button>
                      ) : isEncumbered ? (
                        <div className="p-1.5 bg-yellow-900/30 border border-yellow-900/50 rounded text-yellow-400 text-xs text-center">
                          This position is collateral. Repay loan to unstake.
                        </div>
                      ) : null }
                    </div>
                  </a>
                </SwiperSlide>
              );
            })}
          </Swiper>
          {/* Custom Navigation & Pagination at the bottom */}
          {stakePositions.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2 absolute left-0 right-0 bottom-4 z-30">
              <button
                className="p-1.5 rounded-full bg-background-card/50 hover:bg-background-card/80 text-white transition-colors"
                aria-label="Previous slide"
                onClick={() => swiperInstance && swiperInstance.slidePrev()}
              >
                <ChevronLeftIcon />
              </button>
              <div className="flex gap-1">
                {stakePositions.map((_, idx) => (
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
      )}
    </div>
  )};