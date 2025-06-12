import React, { useEffect, useState } from 'react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { useLocation } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import { usePartnerDetection } from '../hooks/usePartnerDetection';
import { PartnerDashboard } from '../components/PartnerDashboard';
import { PartnerOnboardingPage } from './PartnerOnboardingPage';
import { toast } from 'react-toastify';

export function PartnersPage() {
  const { currentWallet } = useCurrentWallet();
  const location = useLocation();
  const { mode, partnerCaps, setPartnerCaps } = useAlphaContext();
  const {
    isLoading: isDetectionLoading,
    error: detectionError,
    detectPartnerCaps,
    forceDetectPartnerCaps,
    getPrimaryPartnerCap,
    hasPartnerCap,
  } = usePartnerDetection();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper function to get primary partner cap from global state
  const getPrimaryPartnerCapFromGlobal = () => {
    if (partnerCaps.length === 0) return null;
    // Prefer flex caps (though they're all flex now)
    return partnerCaps[0] || null;
  };

  // Determine current tab from URL (memoized to prevent unnecessary re-renders)
  const currentTab = React.useMemo((): 'overview' | 'perks' | 'analytics' | 'settings' => {
    const path = location.pathname;
    if (path.includes('/perks')) return 'perks';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/settings')) return 'settings';
    return 'overview'; // default
  }, [location.pathname]);

  // Handle detection errors
  useEffect(() => {
    if (detectionError) {
      toast.error(`Error detecting partner capabilities: ${detectionError}`);
    }
  }, [detectionError]);

  // Manual refresh function for dashboard (memoized to prevent re-renders)
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const detectedCaps = await detectPartnerCaps();
      if (detectedCaps.length > 0) {
        // Update global state with fresh caps
        setPartnerCaps(detectedCaps);
      }
      toast.success('Partner data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh partner data');
    } finally {
      setIsRefreshing(false);
    }
  }, [detectPartnerCaps, setPartnerCaps]);

  // Handler for when a partner cap is created - includes mode switching (memoized)
  const handlePartnerCreated = React.useCallback(async () => {
    try {
      // Use force detection with retries for newly created partner caps
      const detectedCaps = await forceDetectPartnerCaps(5, 3000); // 5 retries, 3 second delays
      
      if (detectedCaps.length > 0) {
        // Update global state with fresh caps
        setPartnerCaps(detectedCaps);
      } else {
        // Fallback to regular detection
        const fallbackCaps = await detectPartnerCaps();
        if (fallbackCaps.length > 0) {
          setPartnerCaps(fallbackCaps);
          return fallbackCaps;
        }
      }
      
      return detectedCaps; // Return the caps for the onboarding page to use
    } catch (error) {
      console.error('❌ Error detecting partner caps after creation:', error);
      return [];
    }
  }, [forceDetectPartnerCaps, detectPartnerCaps, setPartnerCaps]);

  // Loading state for initial partner detection
  if (isDetectionLoading && !isRefreshing) {
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

  // No wallet connected
  if (!currentWallet) {
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

  // Use global mode instead of hook state
  
  // User is in partner mode - show dashboard
  if (mode === 'partner') {
    const primaryPartnerCap = getPrimaryPartnerCapFromGlobal();
    if (!primaryPartnerCap) {
      return (
        <div className="h-full flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-semibold mb-4">Error Loading Partner Data</h2>
            <p className="text-gray-400 mb-4">
              Partner mode is active but couldn't load partner details.
            </p>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing || isDetectionLoading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Try Again'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <PartnerDashboard 
        partnerCap={primaryPartnerCap} 
        onRefresh={handleRefresh}
        currentTab={currentTab}
        onPartnerCreated={handlePartnerCreated}
      />
    );
  }

  // User is in user mode - show onboarding
  return <PartnerOnboardingPage onPartnerCreated={handlePartnerCreated} />;
} 