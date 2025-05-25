import React, { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import { StakeCard } from '../components/StakeCard';
import { StakedPositionsList } from '../components/StakedPositionsList';
import { UserBalancesCard } from '../components/UserBalancesCard';
import { PointsDisplay } from '../components/PointsDisplay';
import { MainLayout } from '../layouts/MainLayout';
import ProjectionChart from '../components/ProjectionChart';

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
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Column 1: SUI Balance + Alpha Points Balance */}
        <div className="flex flex-col gap-6">
          <UserBalancesCard />
          <PointsDisplay />
        </div>
        {/* Column 2: Manage Stake */}
        <div>
          <StakeCard />
        </div>
        {/* Column 3: Staked Positions */}
        <div>
          <StakedPositionsList />
        </div>
      </div>
      {/* Chart: spans all columns */}
      <div className="mt-6">
        <ProjectionChart />
      </div>
    </div>
  );
};

export default DashboardPage;