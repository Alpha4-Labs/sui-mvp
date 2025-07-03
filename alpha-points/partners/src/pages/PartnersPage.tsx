import React, { useEffect, useState } from 'react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { useLocation } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import { usePartnerDetection } from '../hooks/usePartnerDetection';
import { PartnerDashboard } from '../components/PartnerDashboard';
import { PartnerOnboardingPage } from './PartnerOnboardingPage';
import { toast } from 'react-toastify';

export function PartnersPage() {
  console.log('[PartnersPage] Component starting to render');
  
  const { currentWallet } = useCurrentWallet();
  const location = useLocation();
  const { partnerCaps, setPartnerCaps } = useAlphaContext();
  const {
    isLoading: isDetectionLoading,
    error: detectionError,
    detectPartnerCaps,
    forceDetectPartnerCaps,
    hasPartnerCap,
  } = usePartnerDetection();
  
  console.log('[PartnersPage] Initial state:', {
    currentWallet: !!currentWallet,
    partnerCaps: partnerCaps?.length || 0,
    isDetectionLoading,
    detectionError,
    location: location.pathname,
    hasPartnerCap: hasPartnerCap()
  });
  
  // Try to detect partner caps when component mounts
  useEffect(() => {
    const runDetection = async () => {
      console.log('[PartnersPage] Running partner detection...');
      try {
        const detected = await detectPartnerCaps();
        console.log('[PartnersPage] Detection result:', detected);
        if (detected.length > 0) {
          setPartnerCaps(detected);
        }
      } catch (error) {
        console.error('[PartnersPage] Detection error:', error);
      }
    };
    
    if (currentWallet && partnerCaps?.length === 0) {
      runDetection();
    }
  }, [currentWallet, detectPartnerCaps, setPartnerCaps, partnerCaps?.length]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper function to get primary partner cap from global state
  const getPrimaryPartnerCapFromGlobal = () => {
    if (partnerCaps.length === 0) return null;
    return partnerCaps[0] || null;
  };

  // Determine current tab from URL (simplified routes)
  const currentTab = React.useMemo((): 'overview' | 'perks' | 'analytics' | 'settings' | 'generations' => {
    const path = location.pathname;
    console.log('[PartnersPage] Route changed to:', path);
    if (path === '/perks') return 'perks';
    if (path === '/analytics') return 'analytics';
    if (path === '/generations') return 'generations';
    if (path === '/settings') return 'settings';
    return 'overview'; // default for /dashboard, /overview, or any other route
  }, [location.pathname]);
  
  console.log('[PartnersPage] Current tab determined as:', currentTab);

  // Handle detection errors
  useEffect(() => {
    if (detectionError) {
      toast.error(`Error detecting partner capabilities: ${detectionError}`);
    }
  }, [detectionError]);

  // Manual refresh function for dashboard
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const detectedCaps = await detectPartnerCaps();
      if (detectedCaps.length > 0) {
        setPartnerCaps(detectedCaps);
      }
      toast.success('Partner data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh partner data');
    } finally {
      setIsRefreshing(false);
    }
  }, [detectPartnerCaps, setPartnerCaps]);

  // Handler for when a partner cap is created
  const handlePartnerCreated = React.useCallback(async () => {
    try {
      const detectedCaps = await forceDetectPartnerCaps(5, 3000);
      
      if (detectedCaps.length > 0) {
        setPartnerCaps(detectedCaps);
      } else {
        const fallbackCaps = await detectPartnerCaps();
        if (fallbackCaps.length > 0) {
          setPartnerCaps(fallbackCaps);
          return fallbackCaps;
        }
      }
      
      return detectedCaps;
    } catch (error) {
      console.error('❌ Error detecting partner caps after creation:', error);
      return [];
    }
  }, [forceDetectPartnerCaps, detectPartnerCaps, setPartnerCaps]);

  // Loading state for initial partner detection
  if (isDetectionLoading && !isRefreshing) {
    console.log('[PartnersPage] Showing loading state - isDetectionLoading:', isDetectionLoading, 'isRefreshing:', isRefreshing);
    return (
      <div className="h-full flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Detecting Partner Capabilities</h2>
          <p className="text-gray-400">Checking your wallet for existing partner credentials...</p>
        </div>
      </div>
    );
  }

  // No wallet connected - redirect to welcome page
  if (!currentWallet) {
    console.log('[PartnersPage] No wallet connected, showing connect wallet message');
    return (
      <div className="h-full flex flex-col items-center justify-center text-white p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Please connect your wallet to access partner features and manage your Alpha Points capabilities.
          </p>
          <div className="bg-background-card rounded-lg p-6 max-w-md mx-auto">
            <h3 className="font-semibold mb-4 text-lg">As a partner, you can:</h3>
            <ul className="text-left text-gray-300 space-y-2 text-sm">
              <li>• Create and manage marketplace perks for users</li>
              <li>• Mint Alpha Points with TVL-backed quotas</li>
              <li>• Earn revenue share from perk claims</li>
              <li>• Track your analytics and performance</li>
              <li>• Benefit from automated revenue recycling for growth</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has partner capabilities
  const primaryPartnerCap = getPrimaryPartnerCapFromGlobal();
  
  // TEMPORARY: Create a mock partner cap for testing navigation
  const mockPartnerCap = {
    id: 'mock-partner-cap-for-testing',
    type: 'flex' as const,
    partnerName: 'Test Partner',
    partnerAddress: currentWallet?.accounts?.[0]?.address || '',
    isPaused: false,
    packageId: '0x123...',
    currentEffectiveUsdcValue: 100,
    totalLifetimeQuotaPoints: 1000,
    totalPointsMintedLifetime: 100,
    dailyMintThrottleCapPoints: 100,
    pointsMintedToday: 10,
    availableQuotaToday: 90,
    remainingLifetimeQuota: 900,
    totalPerksCreated: 0,
  };
  
  console.log('[PartnersPage] Final render decision:', {
    currentWallet: !!currentWallet,
    partnerCaps: partnerCaps?.length || 0,
    primaryPartnerCap: !!primaryPartnerCap,
    isDetectionLoading,
    currentTab,
    primaryPartnerCapId: primaryPartnerCap?.id,
    usingMockCap: !primaryPartnerCap
  });
  
  const capToUse = primaryPartnerCap || mockPartnerCap;
  
  if (capToUse) {
    // User has partner capabilities (real or mock) - show dashboard
    console.log('[PartnersPage] Rendering PartnerDashboard with cap:', capToUse.id);
    return (
      <PartnerDashboard 
        partnerCap={capToUse} 
        onRefresh={handleRefresh}
        currentTab={currentTab}
        onPartnerCreated={handlePartnerCreated}
      />
    );
  } else {
    // User doesn't have partner capabilities - show onboarding
    console.log('[PartnersPage] No partner cap found, showing onboarding');
    return <PartnerOnboardingPage onPartnerCreated={handlePartnerCreated} />;
  }
}

export default PartnersPage; 