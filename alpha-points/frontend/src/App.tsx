import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZkLoginCallback } from './components/ZkLoginCallback';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NETWORK_TYPE, CURRENT_NETWORK } from './config/network';

// Import your pages
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { GenerationPage } from './pages/GenerationPage';
import { LoanPage } from './pages/LoanPage';
import { AlphaProvider } from './context/AlphaContext';
import { PartnerOnboardingPage } from './pages/PartnerOnboardingPage';

// Create a client for React Query
const queryClient = new QueryClient();

// Add console logs for debugging network configuration
console.log('[App.tsx Debug] NETWORK_TYPE:', NETWORK_TYPE);
console.log('[App.tsx Debug] CURRENT_NETWORK.rpcUrl:', CURRENT_NETWORK.rpcUrl);

// Setup network configuration
const { networkConfig } = createNetworkConfig({
  [NETWORK_TYPE]: {
    url: CURRENT_NETWORK.rpcUrl,
    network: NETWORK_TYPE as any, // Ensure SuiClient receives network key so it isn't 'unknown'
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={NETWORK_TYPE}>
        <WalletProvider autoConnect={true}>
          <AlphaProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<MainLayout children={undefined} />} >
                  <Route index element={<WelcomePage />} />
                  <Route path="callback" element={<ZkLoginCallback />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout children={undefined} />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/marketplace" element={<MarketplacePage />} />
                    <Route path="/generation" element={<GenerationPage />} />
                    <Route path="/loans" element={<LoanPage />} />
                    <Route path="/partner-onboarding" element={<PartnerOnboardingPage />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AlphaProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;