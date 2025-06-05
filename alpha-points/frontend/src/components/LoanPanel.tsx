// === LoanPanel.tsx (Using Corrected Adapter) ===
import React, { useState, useEffect, useMemo } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui/client';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatSui, formatAddress } from '../utils/format';
import { buildCreateLoanTransaction, buildRepayLoanTransaction } from '../utils/transaction';
import { getTransactionErrorMessage } from '../utils/transaction-adapter';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';

import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Chevron icons (copied from StakedPositionsList)
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// --- Eligible Position Filtering Logic ---
// Only positions that are not encumbered and not mature are eligible
function getEligiblePositions(stakePositions: any[]): any[] {
  return stakePositions.filter((pos) => {
    const isEncumbered = pos.encumbered === true;
    const isMature = pos.maturityPercentage >= 100;
    return !isEncumbered && !isMature;
  });
}

export const LoanPanel: React.FC = () => {
  const { stakePositions, loans, refreshData, setTransactionLoading } = useAlphaContext();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const [selectedStakeId, setSelectedStakeId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [maxLoanAmount, setMaxLoanAmount] = useState(0);
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swiperInstance, setSwiperInstance] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slidesPerView, setSlidesPerView] = useState(1);

  // FIXED: Use correct 1:1000 ratio (1 USD = 1000 Alpha Points)
  const SUI_PRICE_USD_FOR_LOAN = 3.28;
  const ALPHA_POINTS_PER_USD = 1000; // Fixed ratio: 1 USD = 1000 Alpha Points
  const ALPHA_POINTS_PER_SUI_FOR_LOAN = SUI_PRICE_USD_FOR_LOAN * ALPHA_POINTS_PER_USD; // 3.28 * 1000 = 3,280 AP per SUI

  // Loan-to-Value ratio (70%)
  const LTV_RATIO = 0.7;

  // Memoize eligible positions to avoid recalculating on every render
  const eligiblePositions = useMemo(
    () => getEligiblePositions(stakePositions),
    [stakePositions]
  );

  // Calculate max loan amount when stake position changes
  useEffect(() => {
    if (selectedStakeId) {
      const selectedPosition = eligiblePositions.find(pos => pos.id === selectedStakeId);
      if (selectedPosition) {
        const principalSuiValue = Number(selectedPosition.principal) / 1_000_000_000;
        // Calculate the stake's value in Alpha Points using the new rate
        const stakeValueInAlphaPoints = principalSuiValue * ALPHA_POINTS_PER_SUI_FOR_LOAN;
        
        const maxLoan = Math.floor(stakeValueInAlphaPoints * LTV_RATIO);
        setMaxLoanAmount(maxLoan);
        
        // USD value of the max loan, using the new Alpha Point USD value
        // setMaxLoanUsd(maxLoan * ALPHA_POINT_PRICE_USD_FOR_LOAN); // Removed as maxLoanUsd is not used
        setLoanAmount(maxLoan > 0 ? maxLoan.toString() : '0'); // Default to max loan if possible
        setError(null); // Clear previous errors
      }
    } else {
      setMaxLoanAmount(0);
      // setMaxLoanUsd(0); // Removed as maxLoanUsd is not used
      setLoanAmount('');
      setSelectedPercentage(null);
    }
  }, [selectedStakeId, eligiblePositions]);

  // Handle percentage selection
  const handlePercentageSelect = (percentage: number) => {
    setSelectedPercentage(percentage);
    const amount = Math.floor(maxLoanAmount * (percentage / 100));
    setLoanAmount(amount.toString());
  };

  // Handle manual input
  const handleLoanAmountChange = (value: string) => {
    // Allow only numbers
    const numericValue = value.replace(/[^0-9]/g, '');

    if (numericValue === '') {
      setLoanAmount('');
      setSelectedPercentage(null);
      return;
    }

    const numericAmount = parseInt(numericValue, 10);

    // Cap at max loan amount
    if (numericAmount > maxLoanAmount) {
      setLoanAmount(maxLoanAmount.toString());
      setSelectedPercentage(100);
    } else {
      setLoanAmount(numericValue);
      // Calculate and set the percentage
      const currentLoanAmount = parseInt(numericValue, 10);
      if (maxLoanAmount > 0 && !isNaN(currentLoanAmount)) { // Add check for maxLoanAmount > 0
        const percentage = Math.round((currentLoanAmount / maxLoanAmount) * 100);
        setSelectedPercentage(percentage);
      } else {
        setSelectedPercentage(null); // Reset if maxLoanAmount is 0 or input is invalid
      }
    }
  };

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const handleCreateLoan = async () => {
    // Ensure account is connected before proceeding
    if (!currentAccount?.address) {
       setError("Please connect your wallet first.");
       return;
    }
    if (!selectedStakeId || !loanAmount) return;

    setError(null);
    setTransactionLoading(true);
    try {
      // Convert to Alpha Points amount and VALIDATE
      const pointsAmount = parseInt(loanAmount, 10);
      if (
        isNaN(pointsAmount) ||
        pointsAmount <= 0 ||
        pointsAmount > maxLoanAmount
      ) {
        setError("Please enter a valid loan amount within the allowed maximum.");
        setTransactionLoading(false);
        return;
      }

      const tx = buildCreateLoanTransaction(selectedStakeId, pointsAmount);

      // --- Set Sender for Dry Run ---
      tx.setSender(currentAccount.address);
      // -----------------------------

      // --- Manual Dry Run ---
      // Cast suiClient via unknown first due to structural incompatibility
      const txBytes = await tx.build({ client: suiClient as unknown as SuiClient });
      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });

      if (dryRunResult.effects.status.status !== 'success') {
        const errorMsg = dryRunResult.effects.status.error || 'Unknown dry run error';
        setError(`Transaction simulation failed: ${errorMsg}`);
        setTransactionLoading(false);
        return;
      }
      // --- End Manual Dry Run --- 

      // If dry run is successful, proceed to sign and execute
      // Attempt to use tx.serialize() to bypass Transaction object identity issue
      /* const result = */ await signAndExecute({ transaction: tx.serialize() });

      // Refresh data and reset form on success
      await refreshData();
      setSelectedStakeId('');
      setLoanAmount('');
      setSelectedPercentage(null);
      setTimeout(() => {
        toast.success("Loan created successfully! Your stake is now locked as collateral.", { position: 'top-center', autoClose: 5000 });
      }, 0);
    } catch (error: any) {
      setError(error.message ? `Error: ${error.message}` : getTransactionErrorMessage(error));
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleRepayLoan = async (loanId: string, stakeId: string, principalPoints: string) => {
    setError(null);
    setTransactionLoading(true);
    try {
      // Ensure principalPoints is a valid string that can be converted to BigInt
      if (!principalPoints || typeof principalPoints !== 'string' || principalPoints.trim() === '') {
        setError("Invalid loan principal amount for repayment.");
        setTransactionLoading(false);
        return;
      }
      const tx = buildRepayLoanTransaction(loanId, stakeId, principalPoints);
      
      // Attempt to use tx.serialize() to bypass Transaction object identity issue
      /* const result = */ await signAndExecute({ transaction: tx.serialize() });
      await refreshData();
      setTimeout(() => {
        toast.success("Loan repaid successfully! Your stake is now unlocked.", { position: 'top-center', autoClose: 5000 });
      }, 0);
    } catch (error) {
      setError(getTransactionErrorMessage(error));
    } finally {
      setTransactionLoading(false);
    }
  };

  // Responsive slidesPerView tracking
  useEffect(() => {
    function updateSlidesPerView() {
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setSlidesPerView(Math.min(loans.length, 3));
      } else {
        setSlidesPerView(1);
      }
    }
    updateSlidesPerView();
    window.addEventListener('resize', updateSlidesPerView);
    return () => window.removeEventListener('resize', updateSlidesPerView);
  }, [loans.length]);

  useEffect(() => {
    if (error) {
      toast.error(error, { position: 'top-center', autoClose: 5000 });
    }
  }, [error]);

  // --- JSX Rendering ---
  return (
    <div className="bg-background-card rounded-lg shadow-lg">
      {/* "Loan Against Stake" Section (Previously Borrow Section) */}
      <div className="border-b border-gray-700 p-4 md:px-6 md:py-4">
        {eligiblePositions.length > 0 ? (
          <div className="flex flex-col md:flex-row md:items-end md:gap-x-2 w-full space-y-2 md:space-y-0">
            {/* Title */}
            <div className="flex-shrink-0 self-center md:self-end mb-1 md:mb-0">
              <h2 className="text-lg md:text-xl font-semibold text-white whitespace-nowrap">Loan Against Stake</h2>
            </div>
            {/* Dropdown */}
            <div className="md:flex-1 min-w-0"> 
              <select
                value={selectedStakeId}
                onChange={(e) => setSelectedStakeId(e.target.value)}
                className="w-full bg-background-input rounded px-2 py-1.5 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
              >
                <option value="">-- Select a position --</option>
                {eligiblePositions.map((pos: any) => (
                  <option key={pos.id} value={pos.id}>
                    {formatSui(pos.principal)} SUI - {formatAddress(pos.id)}
                  </option>
                ))}
              </select>
            </div>
            {/* Loan Amount Input & USD Estimate */}
            <div className="md:flex-[1.5] min-w-0">
              <label htmlFor="loanAmountInput" className="block text-gray-400 mb-1 text-xs md:hidden">Loan Amount (αP)</label>
              <input
                id="loanAmountInput"
                type="text"
                inputMode="numeric"
                value={!selectedStakeId ? "<-- Select a position" : (parseInt(loanAmount, 10).toLocaleString(undefined, {maximumFractionDigits: 0}) || '')}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/[^0-9]/g, '');
                  handleLoanAmountChange(rawValue);
                }}
                placeholder={`Max ${formatPoints(maxLoanAmount.toString())} αP`}
                className="w-full bg-background-input rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
                aria-label="Loan Amount (Alpha Points)"
              />
              {/* {loanAmount && parseInt(loanAmount) > 0 && (
                <div className="text-xs text-gray-400 mt-0.5 text-right md:text-left">
                  ≈ ${(parseInt(loanAmount) * ALPHA_POINT_PRICE_USD_FOR_LOAN).toFixed(2)} USD
                </div>
              )} */}
            </div>
            {/* Quick Select Buttons */}
            <div className="flex flex-row gap-1 items-center flex-shrink-0 flex-wrap justify-center md:justify-start">
              {[10, 25, 50, 75, 100].map((percentage) => (
                <button
                  key={percentage}
                  onClick={() => handlePercentageSelect(percentage)}
                  className={`py-1 px-1.5 md:px-2 rounded text-xs transition-colors min-w-[32px] md:min-w-[36px] ${
                    selectedPercentage === percentage
                      ? 'bg-primary text-white'
                      : 'bg-background-input text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {percentage}%
                </button>
              ))}
            </div>
            {/* Create Loan Button */}
            <div className="flex-shrink-0 w-full md:w-auto">
              <button
                onClick={handleCreateLoan}
                disabled={!selectedStakeId || !loanAmount || parseInt(loanAmount, 10) <= 0 || parseInt(loanAmount, 10) > maxLoanAmount}
                className="w-full md:w-auto py-2 px-3 md:px-4 bg-primary hover:bg-primary-dark text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Create Loan
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2">
            <h2 className="text-xl font-semibold text-white">Loan Against Stake</h2>
            <p className="text-gray-400 mb-0">
              You don't have any eligible staked positions to borrow against.
            </p>
          </div>
        )}
      </div>
      {/* Active Loans Section */}
      <div className="p-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h2 className="text-xl font-semibold text-white">Active Loans</h2>
          </div>
          {loans.length === 0 ? (
            <p className="text-gray-400">You don't have any active loans.</p>
          ) : (
            <div className="relative">
              <Swiper
                modules={[Navigation, Pagination, A11y]}
                spaceBetween={20}
                slidesPerView={slidesPerView}
                breakpoints={{
                  1024: { slidesPerView: Math.min(loans.length, 3) },
                }}
                loop={loans.length > slidesPerView && loans.length >= 3}
                onSwiper={setSwiperInstance}
                onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
                pagination={false}
                navigation={false}
                className="h-full pb-10"
              >
                {loans.map((loan: any) => (
                  <SwiperSlide key={loan.id} className="bg-background rounded-lg p-1 self-stretch h-full min-h-0">
                    <a
                      href={`https://testnet.suivision.xyz/object/${loan.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-gray-700 rounded-lg p-4 text-sm h-full flex flex-col justify-between bg-gray-800/30 hover:bg-gray-800/60 transition-colors cursor-pointer no-underline"
                      title="View on Suivision"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-400 font-mono text-xs" title={loan.id}>{formatAddress(loan.id)}</span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-900/40 text-blue-300">Active</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3 text-xs">
                          <span className="text-gray-400">Borrowed:</span>
                          <span className="text-white text-right font-medium">{formatPoints(loan.principalPoints)} αP</span>
                          <span className="text-gray-400">Collateral:</span>
                          <span className="text-white text-right font-mono">{formatAddress(loan.stakeId)}</span>
                          <span className="text-gray-400">Est. Repayment:</span>
                          <span className="text-green-400 text-right">{formatPoints(loan.estimatedRepayment)} αP</span>
                        </div>
                      </div>
                      <div className="mt-auto pt-2">
                        <button
                          onClick={e => { 
                            e.preventDefault(); 
                            // Pass loan.principalPoints to handleRepayLoan
                            handleRepayLoan(loan.id, loan.stakeId, loan.principalPoints); 
                          }}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-xs"
                        >
                          Repay Loan
                        </button>
                      </div>
                    </a>
                  </SwiperSlide>
                ))}
              </Swiper>
              {/* Navigation below Swiper, only if needed */}
              {loans.length > slidesPerView && (() => {
                const numPages = slidesPerView > 0 && loans.length > 0 ? Math.ceil(loans.length / slidesPerView) : 0;
                const currentPage = slidesPerView > 0 ? Math.floor(activeIndex / slidesPerView) : 0;
                
                if (numPages <= 0) return null; // Don't render if no pages

                return (
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <button
                      className="p-1 rounded-full bg-background-card/50 hover:bg-background-card/80 text-white transition-colors"
                      aria-label="Previous slide"
                      onClick={() => swiperInstance && swiperInstance.slidePrev()}
                    >
                      <ChevronLeftIcon />
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: numPages }).map((_, idx) => (
                        <button
                          key={idx}
                          className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-semibold transition-colors
                            ${currentPage === idx ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                          onClick={() => {
                            if (swiperInstance) {
                              // Use slideTo instead of slideToLoop when not in loop mode
                              const isLoopMode = loans.length > slidesPerView && loans.length >= 3;
                              if (isLoopMode) {
                                swiperInstance.slideToLoop(idx * slidesPerView);
                              } else {
                                swiperInstance.slideTo(idx * slidesPerView);
                              }
                            }
                          }}
                          aria-label={`Go to page ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      className="p-1 rounded-full bg-background-card/50 hover:bg-background-card/80 text-white transition-colors"
                      aria-label="Next slide"
                      onClick={() => swiperInstance && swiperInstance.slideNext()}
                    >
                      <ChevronRightIcon />
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};