import React from 'react';
import { useTVLCalculation } from '../hooks/useTVLCalculation';

export const TVLDisplay: React.FC = () => {
  const { totalStakedSui, totalTVL, stakeCount, isLoading, error, refreshTVL } = useTVLCalculation();

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading TVL</h3>
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <p className="text-red-500 text-xs">
              This might be due to RPC rate limits. Please try again in a moment.
            </p>
          </div>
          <button 
            onClick={refreshTVL}
            className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Platform TVL</h2>
        <div className="flex items-center space-x-2">
          {isLoading && (
            <div className="flex items-center text-blue-600 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Calculating...
            </div>
          )}
          <button
            onClick={refreshTVL}
            disabled={isLoading}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
        </div>
      </div>
      
      {isLoading && totalTVL === 0 ? (
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-6 bg-gray-200 rounded w-full"></div>
            <div className="h-6 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-1">Total Value Locked</p>
              <p className="text-4xl font-bold text-green-600">
                ${totalTVL.toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm mb-1">Total Staked SUI</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {totalStakedSui.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })} SUI
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm mb-1">Active Stakes</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {stakeCount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Additional metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Avg Stake Size</p>
                <p className="text-lg font-medium text-gray-700">
                  {stakeCount > 0 
                    ? `${(totalStakedSui / stakeCount).toFixed(2)} SUI`
                    : '0 SUI'
                  }
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">SUI Price</p>
                <p className="text-lg font-medium text-gray-700">
                  ${totalStakedSui > 0 
                    ? (totalTVL / totalStakedSui).toFixed(2)
                    : '3.28'
                  }
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-1">Last Updated</p>
                <p className="text-lg font-medium text-gray-700">
                  {new Date().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Data freshness indicator */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {totalStakedSui > 0 
                  ? `✅ Data loaded successfully`
                  : `⚠️ Limited data - using fallback calculation`
                }
              </span>
              <span>Auto-refresh in 3 minutes</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 