// === DashboardPage.tsx (Corrected) ===
import React, { useEffect } from 'react';
// Import the hook correctly
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useNavigate } from 'react-router-dom';
import { StakeCard } from '../components/StakeCard';
import { PointsDisplay } from '../components/PointsDisplay';
import { StakedPositionsList } from '../components/StakedPositionsList';
import { MainLayout } from '../layouts/MainLayout';
// Import the type if needed for explicit typing or complex checks
// import { WalletAccount } from '@mysten/wallet-standard';

export const DashboardPage: React.FC = () => {
  // Correct: Get the account object (or null) directly from the hook
  const currentAccount /*: WalletAccount | null */ = useCurrentAccount();
  const navigate = useNavigate();

  // Redirect to welcome page if not connected
  useEffect(() => {
    // Check the account object itself
    if (!currentAccount) {
      console.log("DashboardPage: No current account, redirecting to /"); // Optional log
      navigate('/');
    }
    // Add navigate to dependency array as per React hook rules
  }, [currentAccount, navigate]);

  // // Mock data for points projection chart - Commented out as it's unused
  // const projectionData = Array.from({ length: 31 }, (_, i) => ({
  //   day: i,
  //   points: 8000 + (i * 500), // Example calculation
  // }));

  // The useEffect handles redirection, so if we reach here and currentAccount is null,
  // it might briefly render before redirecting. Could add explicit check if needed:
  // if (!currentAccount) {
  //    return null; // Or a loading indicator while redirecting
  // }

  return (
    <MainLayout>
      {/* Grid for top cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* PointsDisplay likely uses context/hooks */}
        <PointsDisplay />

        {/* Placeholder for ALPHA Balance - TODO: Fetch real balance */}
        <div className="bg-background-card rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Your ALPHA Balance</h2>
          {/* TODO: Replace with actual fetched balance */}
          <div className="text-4xl font-bold text-yellow-400 mb-4">0.00</div>
          {/* TODO: Implement faucet functionality */}
          <button className="w-full bg-teal-500 hover:bg-teal-600 text-white py-2 px-4 rounded transition-colors">
            Get Test ALPHA (TODO)
          </button>
        </div>

        {/* StakeCard likely uses context/hooks */}
        <StakeCard />
      </div>

      {/* Projection Chart Section */}
      <div className="mb-6">
        <div className="bg-background-card rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">30-Day Points & Price Projection</h2>
          <div className="h-64 w-full">
            {/* Chart placeholder */}
            <div className="bg-background h-full flex items-center justify-center border border-gray-700 rounded-lg">
              <div className="text-gray-500">
                Points projection chart placeholder
                {/* TODO: Implement chart using a library like Recharts and projectionData */}
              </div>
            </div>
          </div>
          {/* Projection Sources Info - Static */}
          <div className="mt-4 bg-background-input p-4 rounded-lg">
            {/* ... sources details ... */}
             <div className="flex items-center mb-2">
               <h3 className="text-white font-medium">Projection Sources</h3>
               <div className="ml-1 w-4 h-4 rounded-full flex items-center justify-center bg-gray-700 text-xs cursor-help" title="Data sources for the projection">?</div>
             </div>
             <div className="flex items-center mb-2">
               <input type="checkbox" checked readOnly className="mr-2 form-checkbox text-primary bg-gray-700 border-gray-600 rounded" />
               <span className="text-gray-300">Stake ALPHA Tokens</span>
             </div>
             <div className="flex items-center text-gray-500">
               <input type="checkbox" disabled className="mr-2 form-checkbox bg-gray-700 border-gray-600 rounded" />
               <span>Ecosystem Activity (Beta)</span>
             </div>
          </div>
        </div>
      </div>

      {/* Staked Positions List Section */}
      <div>
        {/* StakedPositionsList likely uses context/hooks */}
        <StakedPositionsList />
      </div>
    </MainLayout>
  );
};