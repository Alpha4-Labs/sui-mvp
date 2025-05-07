import React, { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient, useDisconnectWallet } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import { formatSui } from '../utils/format';
import { StakeCard } from '../components/StakeCard';
import { PointsDisplay } from '../components/PointsDisplay';
import { StakedPositionsList } from '../components/StakedPositionsList';
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
  
  // State for SUI balance
  const [suiBalance, setSuiBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
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

  // Fetch SUI balance
  const fetchBalance = useCallback(async () => {
    if (!alphaContext.address) return;

    setIsLoadingBalance(true);
    try {
      const { totalBalance } = await client.getBalance({
        owner: alphaContext.address,
        coinType: '0x2::sui::SUI'
      });
      setSuiBalance(totalBalance);
    } catch (err) {
      console.error('Error fetching SUI balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [client, alphaContext.address]);

  // Initialize data
  useEffect(() => {
    if (alphaContext.address) {
      fetchBalance();
      
      // Generate mock projection data
      const mockProjectionData: ProjectionDataPoint[] = Array.from({ length: 31 }, (_, i) => {
        // Generate increasing points with some randomness
        const basePoints = 10000 + (i * 1500);
        const randomFactor = 0.1; // 10% randomness
        const randomVariation = basePoints * randomFactor * (Math.random() - 0.5);
        const points = Math.max(0, Math.round(basePoints + randomVariation));
        
        return { day: i, points };
      });
      setProjectionData(mockProjectionData);
      
      // Generate mock asset price data with points included
      const mockAssetPriceData: ProjectionDataPoint[] = Array.from({ length: 31 }, (_, i) => {
        return {
          day: i,
          points: 0, // Include points property (required by interface)
          ALPHA: 12 + (i * 0.05) + (Math.random() - 0.5),
          ETH: 3000 + (i * 25) + (Math.random() - 0.5) * 100
        };
      });
      setAssetPriceData(mockAssetPriceData);
      
      // Set mock sources
      const mockSources: Source[] = [
        { id: 'stake-alpha', name: 'Staked ALPHA', stakedAmount: 1000, type: 'Staking' },
        { id: 'stake-sui', name: 'Staked SUI', stakedAmount: 500, type: 'Staking' },
        { id: 'referrals', name: 'Referral Program', type: 'Participation' }
      ];
      setSources(mockSources);
      
      // Initialize source toggles
      const initialToggles: Record<string, boolean> = {};
      mockSources.forEach(source => {
        initialToggles[source.id] = true;
      });
      setSourceToggles(initialToggles);
    }
  }, [alphaContext.address, client, fetchBalance]);

  // Handler for opening the faucet in a new tab
  const handleOpenFaucet = () => {
    window.open('https://faucet.sui.io/?network=testnet', '_blank');
  };
  
  // Handler for disconnecting the wallet
  const handleDisconnect = () => {
    console.log("DashboardPage: handleDisconnect called, calling alphaContext.logout().");
    alphaContext.logout(); // Use the unified logout from context
    navigate('/'); // Navigate to welcome page after logout actions are initiated
  };
  
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
      {/* Top Row: Points Display, SUI Balance, Stake Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <PointsDisplay />

        <div className="bg-background-card rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Your SUI Balance</h2>
          <div className="text-4xl font-bold text-primary mb-4">
            {isLoadingBalance ? (
              <span className="text-2xl text-gray-500">Loading...</span>
            ) : (
              formatSui(suiBalance)
            )} SUI
          </div>
          
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleOpenFaucet}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white py-2 px-4 rounded transition-colors"
            >
              Get Testnet SUI
            </button>
            
            <button
              onClick={handleDisconnect}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded transition-colors"
            >
              {alphaContext.provider === 'google' ? 'Sign Out' : 'Disconnect Wallet'} 
            </button>
          </div>
        </div>

        <StakeCard />
      </div>

      {/* Projection Chart */}
      <div className="mb-6">
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
      
      {/* Staked Positions List */}
      <div className="mb-6">
        <StakedPositionsList />
      </div>
    </MainLayout>
  );
};

export default DashboardPage;