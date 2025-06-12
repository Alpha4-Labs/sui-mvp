import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ZkLoginCallback } from './components/ZkLoginCallback';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NETWORK_TYPE, CURRENT_NETWORK } from './config/network';

// Import your pages
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { GenerationPage } from './pages/GenerationPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LoanPage } from './pages/LoanPage';
import { AlphaProvider } from './context/AlphaContext';
import { PartnerOnboardingPage } from './pages/PartnerOnboardingPage';
import { PartnersPage } from './pages/PartnersPage';

// Create a client for React Query
const queryClient = new QueryClient();

// Add console logs for debugging network configuration


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
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/loans" element={<LoanPage />} />
                    <Route path="/partners" element={<PartnersPage />} />
                    <Route path="/partners/overview" element={<PartnersPage />} />
                    <Route path="/partners/perks" element={<PartnersPage />} />
                    <Route path="/partners/analytics" element={<PartnersPage />} />
                    <Route path="/partners/settings" element={<PartnersPage />} />
                    <Route path="/partners/create" element={<PartnerOnboardingPage />} />
                    <Route path="/partner-onboarding" element={<Navigate to="/partners" replace />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            
            {/* Toast Notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1f2937',
                  color: '#f9fafb',
                  border: '1px solid #374151',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#f9fafb',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#f9fafb',
                  },
                },
              }}
            />
          </AlphaProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App;