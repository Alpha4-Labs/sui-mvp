// src/views/LoanView.jsx
import React, { useState, useEffect } from 'react';
import { useLoanManager } from '../hooks/useLoanManager';
import { useStakeProviders } from '../hooks/useStakeProviders';
import { formatBalance } from '../utils/formatters';
import LoanPanel from '../components/LoanPanel';
import StakedPositionsList from '../components/StakedPositionsList';
import PointsDisplay from '../components/PointsDisplay';
import {
  InformationCircleIcon,
  LightBulbIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

/**
 * View component for the loan functionality
 */
function LoanView({ provider, walletAdapter, userAddress, refreshData }) {
  // Get points data from context (would be passed from parent)
  const { alphaPoints, accruedPoints, lastPointsUpdateTimestamp, handleClaimPoints, isFetchingPoints, isClaiming } = {
    alphaPoints: '0',  // These would be populated from context
    accruedPoints: '0',
    lastPointsUpdateTimestamp: Date.now() / 1000,
    handleClaimPoints: () => console.log('Claim points'),
    isFetchingPoints: false,
    isClaiming: false
  };

  // Use loan manager hook
  const {
    loans,
    getTotalBorrowedAmount,
    isLoadingLoans
  } = useLoanManager(provider, walletAdapter, userAddress, refreshData);

  // Use stake providers hook
  const {
    getAllStakeObjects,
    isLoadingProviders
  } = useStakeProviders(provider, walletAdapter, userAddress, refreshData);

  // Stats for the header
  const totalLoans = loans.length;
  const totalBorrowed = getTotalBorrowedAmount();
  const totalStakes = getAllStakeObjects().length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-100 mb-2">Alpha Points Loans</h2>
        <p className="text-lg text-gray-400">Borrow Alpha Points against your staked assets.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Points Balance Card */}
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-4 rounded-lg border border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">Points Balance</h3>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
              {formatBalance(alphaPoints, 0)} <span className="text-sm text-gray-400">αP</span>
            </p>
          </div>
          <div className="text-3xl text-blue-500">
            <ChartBarIcon className="h-10 w-10 text-blue-500/60" />
          </div>
        </div>

        {/* Active Loans Card */}
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-4 rounded-lg border border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">Active Loans</h3>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              {isLoadingLoans ? '...' : totalLoans}
            </p>
          </div>
          <div className="text-3xl text-yellow-500">
            <InformationCircleIcon className="h-10 w-10 text-yellow-500/60" />
          </div>
        </div>

        {/* Total Borrowed Card */}
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-4 rounded-lg border border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-1">Total Borrowed</h3>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-500">
              {isLoadingLoans ? '...' : `${totalBorrowed} αP`}
            </p>
          </div>
          <div className="text-3xl text-pink-500">
            <LightBulbIcon className="h-10 w-10 text-pink-500/60" />
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Staked Positions */}
        <div className="lg:col-span-1">
          <StakedPositionsList 
            provider={provider} 
            walletAdapter={walletAdapter} 
            userAddress={userAddress} 
            refreshData={refreshData}
          />

          {/* Points Display */}
          <div className="mt-6">
            <PointsDisplay
              alphaPoints={alphaPoints}
              accruedPoints={accruedPoints}
              lastPointsUpdateTimestamp={lastPointsUpdateTimestamp}
              onClaimPoints={handleClaimPoints}
              isClaiming={isClaiming}
              isFetchingPoints={isFetchingPoints}
            />
          </div>
        </div>

        {/* Right Column - Loan Panel */}
        <div className="lg:col-span-2">
          <LoanPanel 
            provider={provider} 
            walletAdapter={walletAdapter} 
            userAddress={userAddress} 
            refreshData={refreshData}
          />

          {/* How Loans Work Explanation */}
          <div className="mt-6 bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700">
            <h3 className="text-lg font-medium text-gray-100 mb-3">How Alpha Points Loans Work</h3>
            <div className="space-y-4 text-sm text-gray-300">
              <p>
                Alpha Points Loans allow you to borrow Alpha Points against your staked assets without having to unstake them. This is useful if you need points for marketplace purchases or other activities.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700/30 p-3 rounded-lg">
                  <h4 className="font-medium text-gray-200 mb-2">Loan Creation</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-400">
                    <li>Select a staked position as collateral</li>
                    <li>Choose how many points to borrow</li>
                    <li>Confirm the transaction to receive points</li>
                  </ol>
                </div>
                <div className="bg-gray-700/30 p-3 rounded-lg">
                  <h4 className="font-medium text-gray-200 mb-2">Loan Repayment</h4>
                  <ol className="list-decimal list-inside space-y-1 text-gray-400">
                    <li>View your active loans</li>
                    <li>Click "Repay Loan" on the loan you want to repay</li>
                    <li>Confirm the transaction to release your collateral</li>
                  </ol>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                <strong>Important:</strong> Staked assets used as collateral for loans cannot be unstaked until the loan is repaid. Interest accrues over time, so longer loans will require more points to repay.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 mt-6">
        <h3 className="text-lg font-medium text-gray-100 mb-3">Frequently Asked Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <h4 className="font-medium text-gray-200">What is the loan-to-value (LTV) ratio?</h4>
            <p className="text-sm text-gray-400">
              The LTV ratio determines how many Alpha Points you can borrow against your staked assets. Currently, you can borrow up to 70% of the value of your staked assets.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-medium text-gray-200">How is interest calculated?</h4>
            <p className="text-sm text-gray-400">
              Interest accrues at a rate of 5% per year, calculated continuously based on the time elapsed since the loan was created.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-medium text-gray-200">What happens if I don't repay my loan?</h4>
            <p className="text-sm text-gray-400">
              Your staked assets will remain locked and you won't be able to unstake them until the loan is repaid. There are no liquidations, but you'll continue to accrue interest.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-medium text-gray-200">Can I repay a loan partially?</h4>
            <p className="text-sm text-gray-400">
              No, loans must be repaid in full in a single transaction. This includes both the principal amount borrowed and any accrued interest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoanView;