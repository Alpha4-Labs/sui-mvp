import React, { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import neonLogoVideo from '../assets/Neon_Logo_01.mp4'; // Import the video
import { StakedPositionsList } from '../components/StakedPositionsList';
import { UserBalancesCard } from '../components/UserBalancesCard';
import { PointsDisplay } from '../components/PointsDisplay';
import { PerformanceTodayCard } from '../components/PerformanceTodayCard';
import { RecentActivityCard } from '../components/RecentActivityCard';
import { EngagementTracker } from '../components/EngagementTracker';
import { MainLayout } from '../layouts/MainLayout';

// Define type for projection data to match ProjectionChart.tsx
interface ProjectionDataPoint {
  day: number;
  points: number;
  [key: string]: number; // For asset prices like ALPHA, ETH, etc.
}

// Define type for sources
interface Source {
  id: string;
  name: string;
  stakedAmount?: number;
  type?: string;
}

export const DashboardPage: React.FC = () => {
  const alphaContext = useAlphaContext();
  const client = useSuiClient();
  const navigate = useNavigate();
  
  // State for projection chart
  const [projectionData, setProjectionData] = useState<ProjectionDataPoint[]>([]);
  const [assetPriceData, setAssetPriceData] = useState<ProjectionDataPoint[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceToggles, setSourceToggles] = useState<Record<string, boolean>>({});
  const [assetToggles, setAssetToggles] = useState<Record<string, boolean>>({
    ALPHA: true,
    ETH: false
  });

  // Redirect to welcome page if not connected
  useEffect(() => {
    if (alphaContext.authLoading) return;
    if (!alphaContext.isConnected) {
      navigate('/'); 
    }
  }, [alphaContext.isConnected, alphaContext.authLoading, navigate]);

  // Lazy load stake positions after auth is complete
  useEffect(() => {
    if (alphaContext.isConnected && !alphaContext.authLoading) {
      // Critical data is already loaded by AlphaContext
      // Just lazy load stake positions after a short delay to prevent API spam
      const timeoutId = setTimeout(() => {
        alphaContext.refreshStakePositions();
      }, 2000); // 2 second delay
      
      return () => clearTimeout(timeoutId);
    }
  }, [alphaContext.isConnected, alphaContext.authLoading, alphaContext.refreshStakePositions]);

  // Initialize data
  useEffect(() => {
    if (alphaContext.address) {
      // Generate mock projection data
      const mockProjectionData: ProjectionDataPoint[] = Array.from({ length: 31 }, (_, i) => {
        const basePoints = 10000 + (i * 1500);
        const randomFactor = 0.1;
        const randomVariation = basePoints * randomFactor * (Math.random() - 0.5);
        const points = Math.max(0, Math.round(basePoints + randomVariation));
        return { day: i, points };
      });
      setProjectionData(mockProjectionData);
      
      const mockAssetPriceData: ProjectionDataPoint[] = Array.from({ length: 31 }, (_, i) => {
        return {
          day: i,
          points: 0,
          ALPHA: 12 + (i * 0.05) + (Math.random() - 0.5),
          ETH: 3000 + (i * 25) + (Math.random() - 0.5) * 100
        };
      });
      setAssetPriceData(mockAssetPriceData);
      
      const mockSources: Source[] = [
        { id: 'stake-alpha', name: 'Staked ALPHA', stakedAmount: 1000, type: 'Staking' },
        { id: 'stake-sui', name: 'Staked SUI', stakedAmount: 500, type: 'Staking' },
        { id: 'referrals', name: 'Referral Program', type: 'Participation' }
      ];
      setSources(mockSources);
      
      const initialToggles: Record<string, boolean> = {};
      mockSources.forEach(source => {
        initialToggles[source.id] = true;
      });
      setSourceToggles(initialToggles);
    }
  }, [alphaContext.address]);

  // Handlers for projection chart
  const handleSourceToggle = (sourceId: string) => {
    setSourceToggles(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId]
    }));
  };
  
  const handleAssetToggle = (assetSymbol: string) => {
    setAssetToggles(prev => ({
      ...prev,
      [assetSymbol]: !prev[assetSymbol]
    }));
  };

  // Show loading indicator during auth loading
  if (alphaContext.authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center animate-fade-in">
          <video 
            autoPlay 
            muted 
            loop 
            className="w-40 h-40 mx-auto mb-6 animate-pulse"
            style={{ filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.6))' }}
          >
                         <source src={neonLogoVideo} type="video/mp4" />
            {/* Fallback for browsers that don't support video */}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          </video>
          <p className="text-white text-lg font-medium mb-2">Loading your dashboard...</p>
          <p className="text-gray-400 text-sm">Preparing your Alpha Points experience</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Balances */}
        <div className="space-y-7 animate-slide-up flex flex-col">
          <UserBalancesCard />
          <PointsDisplay />
        </div>
        
        {/* Column 2: Performance Metrics - Replaces StakeCard */}
        <div className="animate-slide-up animation-delay-200 flex flex-col">
          <PerformanceTodayCard />
        </div>
        
        {/* Column 3: Staked Positions */}
        <div className="animate-slide-up animation-delay-400 flex flex-col">
          <StakedPositionsList />
        </div>
      </div>

      {/* Key Engagement Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up animation-delay-600">
        {/* Engagement Tracking - Stretched out more */}
        <EngagementTracker />

        {/* Recent Activity */}
        <RecentActivityCard />
      </div>
    </div>
  );
};

export default DashboardPage;