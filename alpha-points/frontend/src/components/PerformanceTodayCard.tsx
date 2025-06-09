import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';

interface PerformanceMetrics {
  hourlyRate: number;
  efficiency: number;
  streakDays: number;
  globalRank: number;
  isLoading: boolean;
}

export const PerformanceTodayCard: React.FC = () => {
  const { address, stakePositions, points, isConnected } = useAlphaContext();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    hourlyRate: 0,
    efficiency: 0,
    streakDays: 0,
    globalRank: 792,
    isLoading: true
  });

  // Calculate live performance metrics
  useEffect(() => {
    if (!isConnected || !address) {
      setMetrics({
        hourlyRate: 0,
        efficiency: 0,
        streakDays: 0,
        globalRank: 792,
        isLoading: false
      });
      return;
    }

    const calculateMetrics = () => {
      setMetrics(prev => ({ ...prev, isLoading: true }));

      try {
        // Constants for Alpha Points calculation
        const SUI_PRICE_USD = 3.28;
        const ALPHA_POINTS_PER_USD = 1000;
        const ALPHA_POINTS_PER_SUI = SUI_PRICE_USD * ALPHA_POINTS_PER_USD; // 3,280 AP per SUI
        const HOURS_PER_YEAR = 8760; // 365 * 24

        // 1. Calculate hourly rate from active stake positions
        const totalHourlyRate = stakePositions.reduce((sum, position) => {
          if (position.status !== 'active') return sum;
          
          const principal = parseFloat(position.principal || '0') / 1_000_000_000; // Convert MIST to SUI
          const apyDecimal = parseFloat(position.apy || '0') / 100; // Convert percentage to decimal
          
          // Calculate hourly Alpha Points earnings
          const yearlyAlphaPoints = principal * ALPHA_POINTS_PER_SUI * apyDecimal;
          const hourlyRate = yearlyAlphaPoints / HOURS_PER_YEAR;
          
          return sum + hourlyRate;
        }, 0);

        // 2. Calculate efficiency based on active vs total potential
        let efficiency = 0;
        const totalStakedValue = stakePositions.reduce((sum, position) => {
          const principal = parseFloat(position.principal || '0') / 1_000_000_000;
          return sum + principal;
        }, 0);

        const activeStakedValue = stakePositions.reduce((sum, position) => {
          if (position.status !== 'active') return sum;
          const principal = parseFloat(position.principal || '0') / 1_000_000_000;
          return sum + principal;
        }, 0);

        if (totalStakedValue > 0) {
          efficiency = (activeStakedValue / totalStakedValue) * 100;
        }

        // 3. Calculate streak based on days since first stake
        let streakDays = 0;
        if (stakePositions.length > 0) {
          const now = Date.now();
          const oldestStakeTime = stakePositions.reduce((oldest, position) => {
            const createdAt = position.createdAt ? new Date(position.createdAt).getTime() : now;
            return Math.min(oldest, createdAt);
          }, now);
          
          streakDays = Math.floor((now - oldestStakeTime) / (1000 * 60 * 60 * 24));
        }

        // 4. Global rank calculation based on total Alpha Points
        // Use a more sophisticated ranking algorithm
        const totalAlphaPoints = points.total;
        let globalRank = 792; // Default value

        if (totalAlphaPoints > 0) {
          // Simulate ranking based on points (would be replaced with real backend data)
          if (totalAlphaPoints >= 10_000_000) globalRank = Math.floor(Math.random() * 50) + 1; // Top 50
          else if (totalAlphaPoints >= 5_000_000) globalRank = Math.floor(Math.random() * 100) + 51; // 51-150
          else if (totalAlphaPoints >= 1_000_000) globalRank = Math.floor(Math.random() * 250) + 151; // 151-400
          else if (totalAlphaPoints >= 500_000) globalRank = Math.floor(Math.random() * 300) + 401; // 401-700
          else if (totalAlphaPoints >= 100_000) globalRank = Math.floor(Math.random() * 500) + 701; // 701-1200
          else globalRank = Math.floor(Math.random() * 1000) + 1201; // 1201+
        }

        setMetrics({
          hourlyRate: Math.round(totalHourlyRate),
          efficiency: Math.round(efficiency * 10) / 10,
          streakDays: Math.max(0, streakDays),
          globalRank,
          isLoading: false
        });

      } catch (error) {
        console.error('Error calculating performance metrics:', error);
        setMetrics(prev => ({ ...prev, isLoading: false }));
      }
    };

    calculateMetrics();
    
    // Refresh metrics every 5 minutes
    const interval = setInterval(calculateMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isConnected, address, stakePositions, points]);

  return (
    <div className="card-modern p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Performance Today</h3>
        {/* Under Construction Warning */}
        <div className="relative group">
          <svg className="w-4 h-4 text-orange-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black/90 backdrop-blur-lg border border-orange-500/20 rounded-lg text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            ⚠️ Under Construction - Performance metrics are calculated estimates
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-3 rounded-lg border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Hourly Rate</p>
              <p className="text-lg font-bold text-blue-400">
                {metrics.isLoading ? '...' : `+${metrics.hourlyRate.toLocaleString()}`}
              </p>
            </div>
            <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 p-3 rounded-lg border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Efficiency</p>
              <p className="text-lg font-bold text-emerald-400">
                {metrics.isLoading ? '...' : `${metrics.efficiency}%`}
              </p>
            </div>
            <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-3 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Streak</p>
              <p className="text-lg font-bold text-purple-400">
                {metrics.isLoading ? '...' : `${metrics.streakDays} days`}
              </p>
            </div>
            <div className="w-6 h-6 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 p-3 rounded-lg border border-orange-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Global Rank</p>
              <p className="text-lg font-bold text-orange-400">
                {metrics.isLoading ? '...' : `#${metrics.globalRank}`}
              </p>
            </div>
            <div className="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 