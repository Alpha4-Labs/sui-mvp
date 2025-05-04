import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatTimeAgo } from '../utils/format';

export const PointsDisplay: React.FC = () => {
  const { points, loading, refreshData, setTransactionLoading } = useAlphaContext();
  const [showDetails, setShowDetails] = useState(false);
  const [claimInProgress, setClaimInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // In a real implementation, these would be fetched from the contract
  // For now, we're using mock data
  const accrualStartTime = Date.now() - 6313 * 60 * 1000; // 6313 minutes ago
  const accruedPoints = 1999.243333;
  const accrualRate = 78.5; // Points per day
  
  /**
   * Handles claiming accrued Alpha Points
   * In a real implementation, this would call a transaction
   */
  const handleClaim = async () => {
    // Clear previous status messages
    setError(null);
    setSuccess(null);
    
    setClaimInProgress(true);
    setTransactionLoading(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, we would call the contract
      // For now, just show a success message
      setSuccess(`Successfully claimed ${formatPoints(accruedPoints)} Alpha Points!`);
      
      // Refresh data to update UI
      refreshData();
    } catch (error: any) {
      console.error('Error claiming points:', error);
      setError(error.message || 'Failed to claim Alpha Points');
    } finally {
      setClaimInProgress(false);
      setTransactionLoading(false);
    }
  };
  
  // Show loading skeleton
  if (loading.points) {
    return (
      <div className="bg-background-card rounded-lg p-6 shadow-lg animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-10 bg-gray-700 rounded w-1/2 mb-6"></div>
        <div className="h-6 bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-8 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-2">Alpha Points Balance</h2>
      
      {/* Status messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-md text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-md text-green-400 text-sm">
          {success}
        </div>
      )}
      
      {/* Points balance */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-4xl font-bold text-secondary mb-1">
            {formatPoints(points.available)}
          </div>
          <div className="text-sm text-gray-400">
            Available Alpha Points
          </div>
        </div>
        
        {points.locked > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-yellow-500 mb-1">
              {formatPoints(points.locked)}
            </div>
            <div className="text-sm text-gray-400">
              Locked (Loans)
            </div>
          </div>
        )}
      </div>
      
      {/* Accrual info */}
      <div 
        className="bg-background rounded-lg p-4 mb-4 cursor-pointer transition-colors hover:bg-background-card"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            <span>Accruing Since: {formatTimeAgo(accrualStartTime)}</span>
          </div>
          <div className="text-gray-500">
            <svg 
              className={`w-4 h-4 transform transition-transform ${showDetails ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Generation Rate:</span>
              <span className="text-white">{accrualRate} Points/day</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Generated:</span>
              <span className="text-white">{formatPoints(points.total)} Points</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Sources:</span>
              <span className="text-white">Staking, Referrals</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Accrued points and claim button */}
      <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
        <div>
          <div className="text-yellow-400 text-xl font-semibold">
            +{formatPoints(accruedPoints)} Accrued
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Since last claim
          </div>
        </div>
        
        <button 
          onClick={handleClaim}
          disabled={claimInProgress || accruedPoints <= 0}
          className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
        >
          {claimInProgress ? (
            <>
              <span className="opacity-0">Claim</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            </>
          ) : (
            'Claim'
          )}
        </button>
      </div>
    </div>
  );
};