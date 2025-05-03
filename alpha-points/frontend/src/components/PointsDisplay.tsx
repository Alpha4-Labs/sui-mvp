import React from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatTimeAgo } from '../utils/format';

export const PointsDisplay: React.FC = () => {
  const { points, loading } = useAlphaContext();
  // Mock data for demonstration purposes
  const accrualStartTime = Date.now() - 6313 * 60 * 1000; // 6313 minutes ago
  const accruedPoints = 1999.243333;
  
  if (loading.points) {
    return (
      <div className="bg-background-card rounded-lg p-6 shadow-lg animate-pulse">
        <div className="h-8 bg-background-input rounded w-3/4 mb-4"></div>
        <div className="h-10 bg-background-input rounded w-1/2 mb-6"></div>
        <div className="h-6 bg-background-input rounded w-full mb-2"></div>
        <div className="h-8 bg-background-input rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-2">Alpha Points Balance</h2>
      
      <div className="text-4xl font-bold text-secondary mb-6">
        {formatPoints(points.available)}
      </div>
      
      <div className="flex items-center text-sm text-gray-400 mb-2">
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
        <span>Accruing Since: {formatTimeAgo(accrualStartTime)}</span>
        <div className="ml-1 w-4 h-4 rounded-full flex items-center justify-center bg-gray-700 text-xs cursor-help" title="Points accrue based on your staked assets and duration">
          ?
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-yellow-400 text-xl font-semibold">
          +{formatPoints(accruedPoints)} Accrued
        </div>
        
        <button className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-4 rounded transition-colors">
          Claim
        </button>
      </div>
    </div>
  );
};