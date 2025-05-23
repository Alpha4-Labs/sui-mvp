import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZkLoginCallback } from './components/ZkLoginCallback';

// Import your pages
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { GenerationPage } from './pages/GenerationPage';
import { LoanPage } from './pages/LoanPage';
import { AlphaProvider } from './context/AlphaContext';

// Create a client for React Query
const queryClient = new QueryClient();

// Setup network configuration
const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getFullnodeUrl('testnet'),
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <AlphaProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<WelcomePage />} />
                <Route path="/callback" element={<ZkLoginCallback />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/generation" element={<GenerationPage />} />
                <Route path="/loans" element={<LoanPage />} />
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