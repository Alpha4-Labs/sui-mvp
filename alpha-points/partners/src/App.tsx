import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFullnodeUrl } from '@mysten/sui/client';
import { createNetworkConfig } from '@mysten/dapp-kit';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Partner-specific imports
import { AlphaProvider, useAlphaContext } from './context/AlphaContext';
import MainLayout from './layouts/MainLayout';
import WelcomePage from './pages/WelcomePage';
import PartnersPage from './pages/PartnersPage';
import PartnerOnboardingPage from './pages/PartnerOnboardingPage';

// Network configuration for Sui
const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

// Create QueryClient for react-query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    },
  },
});

// Protected Route component to ensure wallet is connected
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, authLoading } = useAlphaContext();
  
  console.log('[ProtectedRoute] Connection state:', { isConnected, authLoading });
  
  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading Partner Dashboard...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to welcome page if not connected
  if (!isConnected) {
    console.log('[ProtectedRoute] Not connected, redirecting to welcome page');
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Dark/Light theme provider component
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    // Check if user has a saved preference
    const saved = localStorage.getItem('partner-dashboard-theme');
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  });

  // Theme toggle function
  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('partner-dashboard-theme', JSON.stringify(newMode));
  };

  // Apply theme class to document
  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      {React.cloneElement(children as React.ReactElement, { 
        darkMode, 
        toggleTheme 
      })}
    </div>
  );
};

// App Routes component (inside AlphaProvider to use context)
const AppRoutes: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary transition-colors duration-300">
      <Routes>
        {/* Entry point - Welcome Page */}
        <Route path="/" element={<WelcomePage />} />
        
        {/* Partner Dashboard Routes (simplified - no /partners prefix) */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <MainLayout>
              <PartnersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/overview" element={
          <ProtectedRoute>
            <MainLayout>
              <PartnersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/perks" element={
          <ProtectedRoute>
            <MainLayout>
              <PartnersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/analytics" element={
          <ProtectedRoute>
            <MainLayout>
              <PartnersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/generations" element={
          <ProtectedRoute>
            <MainLayout>
              <PartnersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <MainLayout>
              <PartnersPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        {/* Partner Onboarding */}
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <MainLayout>
              <PartnerOnboardingPage />
            </MainLayout>
          </ProtectedRoute>
        } />
        
        {/* Catch all route - redirect to welcome */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Toast notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        className="!z-[9999]"
      />
    </div>
  );
};

// Main App component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider>
          <AlphaProvider>
            <ThemeProvider>
              <Router>
                <AppRoutes />
              </Router>
            </ThemeProvider>
          </AlphaProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

export default App; 