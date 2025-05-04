// === DashboardPage.tsx (Adding Faucet Logic) ===
import React, { useEffect, useState } from 'react'; // Added useState
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'; // Added useSuiClient
import { useNavigate } from 'react-router-dom';
import { requestSuiFromFaucetV0, getFaucetHost } from '@mysten/sui/faucet'; // Import faucet functions
import { StakeCard } from '../components/StakeCard';
import { PointsDisplay } from '../components/PointsDisplay';
import { StakedPositionsList } from '../components/StakedPositionsList';
import { MainLayout } from '../layouts/MainLayout';

export const DashboardPage: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient(); // Get SuiClient instance
  const navigate = useNavigate();
  const [isFaucetLoading, setIsFaucetLoading] = useState(false); // Loading state for faucet

  useEffect(() => {
    if (!currentAccount) {
      navigate('/');
    }
  }, [currentAccount, navigate]);

  const handleFaucetRequest = async () => {
    if (!currentAccount?.address) {
      alert("Please connect your wallet first.");
      return;
    }
    setIsFaucetLoading(true);
    console.log("Requesting SUI from faucet for:", currentAccount.address);
    try {
      // --- Faucet Logic ---
      // Adjust 'testnet' if using a different network like 'devnet' or 'localnet'
      const faucetHost = getFaucetHost('testnet');
      await requestSuiFromFaucetV0({
        host: faucetHost,
        recipient: currentAccount.address,
      });
      alert("Faucet request successful! Testnet SUI should arrive shortly.");
      // Optionally refresh balances after a short delay if needed
      // setTimeout(() => refreshData(), 5000); // If refreshData is from context
    } catch (error) {
      console.error("Faucet request failed:", error);
      alert(`Faucet request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFaucetLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <PointsDisplay />

        <div className="bg-background-card rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Your SUI Balance</h2> {/* Changed Title */}
          {/* TODO: Replace with actual fetched SUI balance */}
          <div className="text-4xl font-bold text-primary mb-4">0.00 SUI</div>
          <button
            onClick={handleFaucetRequest} // Attach handler
            disabled={isFaucetLoading || !currentAccount} // Disable while loading or not connected
            className="w-full bg-teal-500 hover:bg-teal-600 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFaucetLoading ? 'Requesting...' : 'Get Testnet SUI'} {/* Updated Text */}
          </button>
        </div>

        <StakeCard />
      </div>

      {/* ... rest of DashboardPage ... */}
      <div className="mb-6"> {/* Projection Section */}
         <div className="bg-background-card rounded-lg p-6 shadow-lg">
            {/* ... projection content ... */}
         </div>
      </div>
      <div> {/* Staked Positions List Section */}
        <StakedPositionsList />
      </div>

    </MainLayout>
  );
};