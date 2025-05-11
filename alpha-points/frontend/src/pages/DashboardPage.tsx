import React, { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import { StakeCard } from '../components/StakeCard';
import { StakedPositionsList } from '../components/StakedPositionsList';
import { UserBalancesCard } from '../components/UserBalancesCard';
import { PointsDisplay } from '../components/PointsDisplay';
import { MainLayout } from '../layouts/MainLayout';
import { ProjectionChart } from '../components/ProjectionChart';

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
    if (!alphaContext.isConnected) {
      console.log("DashboardPage: Not connected (checked via AlphaContext), navigating to /welcome.");
      navigate('/');
    }
  }, [alphaContext.isConnected, navigate]);

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

  return (
    <MainLayout>
      {/* Top Row: UserBalancesCard, StakeCard, StakedPositionsList (Carousel) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Column 1: SUI Balance Card stacked above Points Display */}
        <div className="space-y-6 lg:col-span-1">
          <UserBalancesCard />
          <PointsDisplay />
        </div>

        {/* Column 2: Stake Management Card */}
        <div className="lg:col-span-1">
          <StakeCard />
        </div>

        {/* Column 3: Staked Positions Carousel */}
        <div className="lg:col-span-1">
          <StakedPositionsList />
        </div>
      </div>

      {/* Projection Chart (remains below the three cards) */}
      <div className="mb-0">
        <ProjectionChart 
          projectionData={projectionData}
          assetPriceData={assetPriceData}
          sources={sources}
          sourceToggles={sourceToggles}
          assetToggles={assetToggles}
          onSourceToggle={handleSourceToggle}
          onAssetToggle={handleAssetToggle}
        />
      </div>
    </MainLayout>
  );
};

export default DashboardPage;