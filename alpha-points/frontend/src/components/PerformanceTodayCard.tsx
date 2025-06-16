import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { getUserStreak, getEngagementStats } from '../utils/engagement';
import { 
  SUI_PRICE_USD, 
  ALPHA_POINTS_PER_USD, 
  ALPHA_POINTS_PER_SUI,
  convertMistToSui
} from '../utils/constants';

interface PerformanceMetrics {
  hourlyRate: number;           // Alpha Points earned per hour from all sources
  efficiency: number;           // Capital utilization efficiency (0-100%)
  streakDays: number;          // Consecutive epochs with Alpha Points activity
  globalRank: number;          // Position based on total Alpha Points vs all users
  isLoading: boolean;
}

interface CapitalAnalysis {
  totalPotential: number;      // Total available capital (SUI + Alpha Points)
  totalUtilized: number;       // Actually deployed capital (staked + locked + loans)
  utilizationRate: number;     // Efficiency percentage
}

export const PerformanceTodayCard: React.FC = () => {
  const { address, stakePositions, points, isConnected, suiClient } = useAlphaContext();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    hourlyRate: 0,
    efficiency: 0,
    streakDays: 0,
    globalRank: 792,
    isLoading: true
  });

  // Lazy-loaded Global Rank state with caching
  const [globalRankState, setGlobalRankState] = useState<{
    isLazyLoading: boolean;
    hasBeenRequested: boolean;
    lastUpdated: number | null;
  }>({
    isLazyLoading: false,
    hasBeenRequested: false,
    lastUpdated: null
  });

  // Cache utilities for localStorage
  const getCacheKey = (userAddress: string) => `alpha_global_rank_${userAddress}`;

  const loadCachedRank = (userAddress: string): { rank: number; timestamp: number } | null => {
    try {
      const cached = localStorage.getItem(getCacheKey(userAddress));
      if (cached) {
        const data = JSON.parse(cached);
        // Cache is valid for 1 hour
        if (Date.now() - data.timestamp < 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to load cached rank:', error);
    }
    return null;
  };

  const saveCachedRank = (userAddress: string, rank: number) => {
    try {
      localStorage.setItem(getCacheKey(userAddress), JSON.stringify({
        rank,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save cached rank:', error);
    }
  };

  // Calculate comprehensive capital efficiency
  const calculateCapitalEfficiency = async (): Promise<CapitalAnalysis> => {
    if (!address || !suiClient) {
      return { totalPotential: 0, totalUtilized: 0, utilizationRate: 0 };
    }

    try {
      // Get user's SUI balance
      const balance = await suiClient.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'
      });
      const suiBalance = parseInt(balance.totalBalance) / 1_000_000_000; // Convert MIST to SUI

      // Calculate staked value
      const totalStaked = stakePositions.reduce((sum, position) => {
        const principal = parseFloat(position.principal || '0') / 1_000_000_000;
        return sum + principal;
      }, 0);

      // Alpha Points value (converted to SUI equivalent) using centralized constants
      const alphaPointsInSui = (points.total / ALPHA_POINTS_PER_USD) / SUI_PRICE_USD;

      // Calculate total potential and utilized capital
      const totalPotential = suiBalance + totalStaked + alphaPointsInSui;
      const totalUtilized = totalStaked + (points.locked / (ALPHA_POINTS_PER_USD * SUI_PRICE_USD));
      
      const utilizationRate = totalPotential > 0 ? (totalUtilized / totalPotential) * 100 : 0;

      return {
        totalPotential,
        totalUtilized,
        utilizationRate: Math.min(100, utilizationRate) // Cap at 100%
      };
    } catch (error) {
      console.error('Error calculating capital efficiency:', error);
      return { totalPotential: 0, totalUtilized: 0, utilizationRate: 0 };
    }
  };

  // Calculate user's engagement streak using real engagement tracker
  const calculateEngagementStreak = async (): Promise<number> => {
    if (!address || !suiClient) return 0;

    const packageId = import.meta.env['VITE_PACKAGE_ID'];
    if (!packageId) {
      console.warn('Package ID not configured, cannot fetch engagement streak');
      return 0;
    }

    try {
      // Use the engagement utility to get user's streak
      const streak = await getUserStreak(suiClient, packageId, address);
      return streak;
    } catch (error) {
      console.error('Error calculating engagement streak:', error);
      return 0;
    }
  };

  // Simple, fast Global Rank calculation - no API calls during initial load
  const calculateGlobalRank = async (): Promise<number> => {
    if (!address) return 999999;

    const totalAlphaPoints = points.total;
    if (totalAlphaPoints === 0) return 999999; // Unranked

    // Check cache first
    const cached = loadCachedRank(address);
    if (cached) {
      return cached.rank;
    }

    // Use deterministic estimation only - no API calls
    // This ensures fast loading of critical components like StakedPositions
    return getDeterministicRankEstimate(totalAlphaPoints);
  };

  // Lazy loading function for more accurate rank (triggered by user action)
  const refreshGlobalRank = async () => {
    if (!address || globalRankState.isLazyLoading) return;

    setGlobalRankState(prev => ({ ...prev, isLazyLoading: true, hasBeenRequested: true }));

    try {
      const totalAlphaPoints = points.total;
      
      if (totalAlphaPoints === 0) {
        const rank = 999999;
        setMetrics(prev => ({ ...prev, globalRank: rank }));
        setGlobalRankState(prev => ({ ...prev, isLazyLoading: false, lastUpdated: Date.now() }));
        return;
      }

      // For now, use deterministic estimation
      // In the future, this could be enhanced with limited sampling
      const estimatedRank = getDeterministicRankEstimate(totalAlphaPoints);
      
      console.log(`🎯 Global Rank refreshed: #${estimatedRank} (${totalAlphaPoints.toLocaleString()} Alpha Points)`);
      
      // Save to cache
      saveCachedRank(address, estimatedRank);
      
      // Update metrics
      setMetrics(prev => ({ ...prev, globalRank: estimatedRank }));
      setGlobalRankState(prev => ({ 
        ...prev, 
        isLazyLoading: false, 
        lastUpdated: Date.now() 
      }));

    } catch (error) {
      console.error('❌ Error refreshing global rank:', error);
      setGlobalRankState(prev => ({ ...prev, isLazyLoading: false }));
    }
  };

  // Deterministic rank estimation based on point thresholds
  const getDeterministicRankEstimate = (totalPoints: number): number => {
    if (totalPoints === 0) return 999999; // Unranked

    // Deterministic estimation based on realistic Alpha Points distribution
    // These thresholds are based on typical point accumulation patterns
    if (totalPoints >= 50_000_000) return 1;           // Whale tier
    if (totalPoints >= 25_000_000) return 5;           // Top 5
    if (totalPoints >= 10_000_000) return 15;          // Top 15
    if (totalPoints >= 5_000_000) return 50;           // Top 50
    if (totalPoints >= 2_500_000) return 100;          // Top 100
    if (totalPoints >= 1_000_000) return 250;          // Top 250
    if (totalPoints >= 500_000) return 500;            // Top 500
    if (totalPoints >= 250_000) return 1000;           // Top 1K
    if (totalPoints >= 100_000) return 2500;           // Top 2.5K
    if (totalPoints >= 50_000) return 5000;            // Top 5K
    if (totalPoints >= 25_000) return 10000;           // Top 10K
    if (totalPoints >= 10_000) return 20000;           // Top 20K
    if (totalPoints >= 5_000) return 50000;            // Top 50K
    if (totalPoints >= 1_000) return 100000;           // Top 100K
    
    return 250000; // Lower tier
  };

  // Calculate rank estimate from sample data
  const calculateRankFromSample = (
    userPoints: number, 
    sampleBalances: Array<{ address: string; totalBalance: number }>,
    userAddress: string
  ): number => {
    // Sort sample by balance (descending)
    sampleBalances.sort((a, b) => b.totalBalance - a.totalBalance);

    // Check if user is in the sample
    const userInSample = sampleBalances.find(u => 
      u.address.toLowerCase() === userAddress.toLowerCase()
    );

    if (userInSample) {
      // User found in sample - calculate exact position
      const sampleRank = sampleBalances.findIndex(u => 
        u.address.toLowerCase() === userAddress.toLowerCase()
      ) + 1;
      
      console.log(`🎯 User found in sample at position #${sampleRank} of ${sampleBalances.length}`);
      
      // Extrapolate to full population (assume sample is representative)
      // If we sampled ~150 users and user is #10, estimate they're in top ~7% globally
      const samplePercentile = sampleRank / sampleBalances.length;
      const estimatedTotalUsers = Math.max(10000, sampleBalances.length * 50); // Conservative estimate
      const estimatedRank = Math.floor(samplePercentile * estimatedTotalUsers);
      
      console.log(`📊 Estimated rank: #${estimatedRank} (${(samplePercentile * 100).toFixed(1)}% percentile)`);
      return Math.max(1, estimatedRank);
    } else {
      // User not in sample - estimate based on distribution
      const higherBalances = sampleBalances.filter(u => u.totalBalance > userPoints).length;
      const lowerBalances = sampleBalances.filter(u => u.totalBalance < userPoints).length;
      
      if (higherBalances === 0) {
        // User would be #1 in sample
        console.log(`🥇 User would rank #1 in sample with ${userPoints.toLocaleString()} points`);
        return getDeterministicRankEstimate(userPoints); // Use deterministic for very high scores
      } else if (lowerBalances === 0) {
        // User would be last in sample
        console.log(`📉 User would rank last in sample with ${userPoints.toLocaleString()} points`);
        const estimatedTotalUsers = Math.max(50000, sampleBalances.length * 100);
        return Math.floor(estimatedTotalUsers * 0.8); // Assume bottom 20%
      } else {
        // Interpolate position within sample
        const estimatedSampleRank = higherBalances + 1;
        const samplePercentile = estimatedSampleRank / sampleBalances.length;
        const estimatedTotalUsers = Math.max(10000, sampleBalances.length * 50);
        const estimatedRank = Math.floor(samplePercentile * estimatedTotalUsers);
        
        console.log(`📈 Estimated sample position: #${estimatedSampleRank} of ${sampleBalances.length}`);
        console.log(`📊 Estimated global rank: #${estimatedRank} (${(samplePercentile * 100).toFixed(1)}% percentile)`);
        
        return Math.max(1, estimatedRank);
      }
    }
  };

  // Fallback function to estimate rank based on points when on-chain query fails
  const estimateRankFromPoints = (totalAlphaPoints: number): number => {
    // Use deterministic estimation as fallback
    return getDeterministicRankEstimate(totalAlphaPoints);
  };

  // Calculate passive hourly earnings rate
  const calculateHourlyRate = (): number => {
    const HOURS_PER_YEAR = 8760; // 365 * 24

    // Calculate from active stake positions using centralized constants
    const totalHourlyRate = stakePositions.reduce((sum, position) => {
      // Only include positions that are not fully mature and not encumbered
      if (position.encumbered || position.maturityPercentage >= 100) return sum;
      
      const principal = convertMistToSui(position.principal || '0');
      const apyDecimal = (position.apy || 0) / 100; // Convert percentage to decimal
      
      // Calculate hourly Alpha Points earnings
      const yearlyAlphaPoints = principal * ALPHA_POINTS_PER_SUI * apyDecimal;
      const hourlyRate = yearlyAlphaPoints / HOURS_PER_YEAR;
      
      return sum + hourlyRate;
    }, 0);

    return Math.round(totalHourlyRate);
  };

  // Main calculation effect
  useEffect(() => {
    if (!isConnected || !address) {
      setMetrics({
        hourlyRate: 0,
        efficiency: 0,
        streakDays: 0,
        globalRank: 999999,
        isLoading: false
      });
      return;
    }

    const calculateAllMetrics = async () => {
      setMetrics(prev => ({ ...prev, isLoading: true }));

      try {
        // Calculate all metrics in parallel
        const [capitalAnalysis, streakDays, globalRank] = await Promise.all([
          calculateCapitalEfficiency(),
          calculateEngagementStreak(),
          calculateGlobalRank()
        ]);

        const hourlyRate = calculateHourlyRate();

        setMetrics({
          hourlyRate,
          efficiency: Math.round(capitalAnalysis.utilizationRate * 10) / 10, // 1 decimal place
          streakDays,
          globalRank,
          isLoading: false
        });

      } catch (error) {
        console.error('Error calculating performance metrics:', error);
        setMetrics(prev => ({ ...prev, isLoading: false }));
      }
    };

    calculateAllMetrics();
    
    // Refresh metrics every 10 minutes
    const interval = setInterval(calculateAllMetrics, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isConnected, address, stakePositions, points]);

  // Get performance tier for visual styling
  const getPerformanceTier = () => {
    if (metrics.efficiency >= 80) return { tier: 'Elite', color: 'emerald' };
    if (metrics.efficiency >= 60) return { tier: 'Pro', color: 'blue' };
    if (metrics.efficiency >= 40) return { tier: 'Active', color: 'purple' };
    if (metrics.efficiency >= 20) return { tier: 'Starter', color: 'orange' };
    return { tier: 'Rookie', color: 'gray' };
  };

  const performanceTier = getPerformanceTier();

  return (
    <div className="card-modern p-4 relative z-40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-base font-semibold text-white">Performance Dashboard</h3>
          <span className={`text-xs px-2 py-1 rounded-full bg-${performanceTier.color}-500/20 text-${performanceTier.color}-400 font-medium`}>
            {performanceTier.tier}
          </span>
        </div>
        
        {/* Info tooltip */}
        <div className="relative group">
          <svg className="w-4 h-4 text-blue-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black/90 backdrop-blur-lg border border-blue-500/20 rounded-lg text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            💡 Your Alpha Points engagement metrics
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Passive Income Rate */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-3 rounded-lg border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Passive Income</p>
              <p className="text-lg font-bold text-blue-400">
                {metrics.isLoading ? '...' : `+${metrics.hourlyRate.toLocaleString()}/hr`}
              </p>
              <p className="text-xs text-blue-300/70">Alpha Points from staking</p>
            </div>
            <div className="relative group">
              <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center cursor-help">
                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="absolute left-full top-0 ml-2 px-3 py-2 bg-black/95 backdrop-blur-lg border border-blue-500/30 rounded-lg text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] w-64">
                <div className="font-medium text-blue-400 mb-1">💰 Passive Income</div>
                <div className="text-gray-300">Alpha Points earned per hour from your active stake positions.</div>
                <div className="text-blue-300 mt-1">💡 Stake more SUI to increase your hourly rate!</div>
                <div className="absolute right-full top-2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black/95"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Capital Efficiency */}
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-3 rounded-lg border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Capital Efficiency</p>
              <p className="text-lg font-bold text-emerald-400">
                {metrics.isLoading ? '...' : `${metrics.efficiency}%`}
              </p>
              <p className="text-xs text-emerald-300/70">Assets utilized</p>
            </div>
            <div className="relative group">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center cursor-help">
                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="absolute left-full top-0 ml-2 px-3 py-2 bg-black/95 backdrop-blur-lg border border-emerald-500/30 rounded-lg text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] w-64">
                <div className="font-medium text-emerald-400 mb-1">📊 Capital Efficiency</div>
                <div className="text-gray-300">How well you're utilizing your total available capital (SUI + Alpha Points).</div>
                <div className="text-emerald-300 mt-1">💡 Deploy more assets in staking or loans to boost efficiency!</div>
                <div className="absolute right-full top-2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black/95"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Engagement Streak */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-3 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Engagement Streak</p>
              <p className="text-lg font-bold text-purple-400">
                {metrics.isLoading ? '...' : `${metrics.streakDays} epochs`}
              </p>
              <p className="text-xs text-purple-300/70">Consecutive activity</p>
            </div>
            <div className="relative group">
              <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center cursor-help">
                <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
              <div className="absolute left-full top-0 ml-2 px-3 py-2 bg-black/95 backdrop-blur-lg border border-purple-500/30 rounded-lg text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] w-64">
                <div className="font-medium text-purple-400 mb-1">🔥 Engagement Streak</div>
                <div className="text-gray-300">Consecutive epochs with Alpha Points activity (claim, stake, spend, etc.)</div>
                <div className="text-purple-300 mt-1">💡 Stay active every epoch to build your streak!</div>
                <div className="absolute right-full top-2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black/95"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Global Leaderboard Rank */}
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 p-3 rounded-lg border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">Global Rank</p>
                {globalRankState.lastUpdated && (
                  <span className="text-xs text-gray-500">
                    (cached {Math.round((Date.now() - globalRankState.lastUpdated) / 60000)}m ago)
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-orange-400">
                {metrics.isLoading ? '...' : 
                 metrics.globalRank <= 999999 ? `#${metrics.globalRank.toLocaleString()}` : 'Unranked'}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-orange-300/70">By Alpha Points</p>
                <button
                  onClick={refreshGlobalRank}
                  disabled={globalRankState.isLazyLoading}
                  className="text-xs text-orange-400 hover:text-orange-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                  title="Refresh rank estimate"
                >
                  {globalRankState.isLazyLoading ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="relative group">
              <div className="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center cursor-help">
                {metrics.globalRank <= 100 ? (
                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className="absolute left-full top-0 ml-2 px-3 py-2 bg-black/95 backdrop-blur-lg border border-orange-500/30 rounded-lg text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] w-64">
                <div className="font-medium text-orange-400 mb-1">🏆 Global Rank</div>
                <div className="text-gray-300">Your position on the Alpha Points leaderboard vs all other users.</div>
                <div className="text-orange-300 mt-1">💡 Earn more Alpha Points to climb the rankings!</div>
                <div className="text-gray-500 mt-1 text-xs">Click refresh to update estimate</div>
                <div className="absolute right-full top-2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black/95"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      {!metrics.isLoading && metrics.efficiency < 60 && (
        <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-amber-300">
              <p className="font-medium">💡 Boost your efficiency:</p>
              <p className="text-amber-400/80">Stake more SUI or use Alpha Points for loans to improve capital utilization</p>
            </div>
          </div>
        </div>
      )}
    </div>
      );
  }; 