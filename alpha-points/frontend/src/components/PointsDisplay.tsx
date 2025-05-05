import React, { useState } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatTimeAgo } from '../utils/format';

export const PointsDisplay: React.FC = () => {
  // Use context to get points data and loading state
  const { points, loading, lastRefresh } = useAlphaContext();
  const [showDetails, setShowDetails] = useState(false);

  // Accrual info is currently mock - keep placeholders or remove
  // Let's comment out for now as it's not real data
  // const accrualStartTime = Date.now() - 6313 * 60 * 1000; 
  // const accruedPoints = 1999.243333;
  // const accrualRate = 78.5; 

  // Claim function is disabled as it's not implemented on-chain
  /*
  const handleClaim = async () => {
    // ... implementation removed ...
  };
  */

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
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold text-white">Alpha Points Balance</h2>
        {/* Display last refresh time */}
        {lastRefresh > 0 && (
          <span className="text-xs text-gray-500" title={new Date(lastRefresh).toISOString()}>
            Updated: {formatTimeAgo(lastRefresh)}
          </span>
        )}
      </div>
      
      {/* Removed status messages related to mock claim */}
      
      {/* Points balance - Use data from context */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-4xl font-bold text-secondary mb-1">
            {formatPoints(points.available)}
          </div>
          <div className="text-sm text-gray-400">
            Available Alpha Points
          </div>
        </div>
        
        {/* Only show locked section if locked points > 0 */}
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
      
      {/* Accrual info section - commented out as it uses mock data */}
      {/* 
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
      */}
      
      {/* Accrued points and claim button - commented out as it uses mock data/disabled functionality */}
      {/*
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
          disabled // Disabled permanently for now
          className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
        >
           Claim
        </button>
      </div>
      */}

      {/* Placeholder if no points data is available yet */}
      {!loading.points && points.total === 0 && (
        <div className="text-center text-gray-500 text-sm py-4">
          No Alpha Points balance found.
        </div>
      )}
    </div>
  );
};