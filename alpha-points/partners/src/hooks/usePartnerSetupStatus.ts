import { useState, useEffect, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

interface PartnerSetupStatus {
  hasPartnerCap: boolean;
  hasStatsObject: boolean;
  isComplete: boolean;
  partnerCapId?: string;
  statsId?: string;
  needsUpgrade: boolean;
  isLoading: boolean;
  error?: string;
}

/**
 * Hook to detect and manage partner setup status
 * Checks if user has PartnerCapFlex and PartnerPerkStatsV2 objects
 */
export function usePartnerSetupStatus() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  
  const [status, setStatus] = useState<PartnerSetupStatus>({
    hasPartnerCap: false,
    hasStatsObject: false,
    isComplete: false,
    needsUpgrade: false,
    isLoading: true
  });

  /**
   * Check for user's PartnerCapFlex objects
   */
  const checkPartnerCapStatus = useCallback(async () => {
    if (!account?.address) {
      return { hasPartnerCap: false, partnerCapId: undefined };
    }

    try {
      // Query for PartnerCapFlex objects owned by user
      const response = await client.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${process.env.REACT_APP_PACKAGE_ID}::partner_flex::PartnerCapFlex`
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const partnerCaps = response.data;
      const hasPartnerCap = partnerCaps.length > 0;
      const partnerCapId = hasPartnerCap ? partnerCaps[0].data?.objectId : undefined;

      return { hasPartnerCap, partnerCapId };
    } catch (error) {
      console.error('Error checking PartnerCapFlex status:', error);
      return { hasPartnerCap: false, partnerCapId: undefined };
    }
  }, [account?.address, client]);

  /**
   * Check for PartnerPerkStatsV2 objects associated with user's PartnerCap
   */
  const checkStatsStatus = useCallback(async (partnerCapId?: string) => {
    if (!partnerCapId) {
      return { hasStatsObject: false, statsId: undefined };
    }

    try {
      // Query for PartnerPerkStatsV2 objects that reference this PartnerCap
      // Note: This is a simplified approach - in reality you'd need to query
      // shared objects and filter by partner_cap_id field
      
      // For now, we'll use a placeholder approach that would be replaced with proper querying
      const hasStatsObject = await checkForStatsObject(partnerCapId);
      const statsId = hasStatsObject ? `stats_${partnerCapId.substring(0, 8)}` : undefined;

      return { hasStatsObject, statsId };
    } catch (error) {
      console.error('Error checking PartnerPerkStatsV2 status:', error);
      return { hasStatsObject: false, statsId: undefined };
    }
  }, []);

  /**
   * Placeholder function for checking stats object existence
   * In a real implementation, this would query the blockchain properly
   */
  const checkForStatsObject = async (partnerCapId: string): Promise<boolean> => {
    // TODO: Implement proper blockchain query
    // This would involve:
    // 1. Querying shared objects of type PartnerPerkStatsV2
    // 2. Filtering by partner_cap_id field matching the provided partnerCapId
    // 3. Returning true if any matching objects are found
    
    console.log('Checking for stats object for partner cap:', partnerCapId);
    
    // Placeholder logic - in reality this would be a proper blockchain query
    // For demo purposes, we'll assume some partner caps have stats and others don't
    const hasStats = Math.random() > 0.5; // 50% chance for demo
    return hasStats;
  };

  /**
   * Refresh the setup status by re-checking all conditions
   */
  const refreshStatus = useCallback(async () => {
    if (!account?.address) {
      setStatus({
        hasPartnerCap: false,
        hasStatsObject: false,
        isComplete: false,
        needsUpgrade: false,
        isLoading: false
      });
      return;
    }

    setStatus(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      // Check PartnerCapFlex status
      const { hasPartnerCap, partnerCapId } = await checkPartnerCapStatus();
      
      // Check stats status if PartnerCap exists
      const { hasStatsObject, statsId } = await checkStatsStatus(partnerCapId);

      const isComplete = hasPartnerCap && hasStatsObject;
      const needsUpgrade = hasPartnerCap && !hasStatsObject;

      setStatus({
        hasPartnerCap,
        hasStatsObject,
        isComplete,
        partnerCapId,
        statsId,
        needsUpgrade,
        isLoading: false
      });

    } catch (error: any) {
      console.error('Error refreshing partner setup status:', error);
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to check setup status'
      }));
    }
  }, [account?.address, checkPartnerCapStatus, checkStatsStatus]);

  /**
   * Check if user needs to complete their setup
   */
  const getSetupRecommendation = useCallback(() => {
    if (!account?.address) {
      return {
        action: 'connect',
        message: 'Connect your wallet to get started'
      };
    }

    if (!status.hasPartnerCap) {
      return {
        action: 'full_onboarding',
        message: 'Start guided onboarding to create your PartnerCapFlex and Stats objects'
      };
    }

    if (!status.hasStatsObject) {
      return {
        action: 'create_stats',
        message: 'Create a Stats object to unlock V2 features and advanced analytics'
      };
    }

    return {
      action: 'complete',
      message: 'Setup complete! You have full V2 system access'
    };
  }, [account?.address, status]);

  // Auto-refresh when account changes
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    ...status,
    refreshStatus,
    getSetupRecommendation,
    // Convenience getters
    canCreatePerks: status.hasPartnerCap,
    canUseV2Features: status.isComplete,
    shouldShowSetupPrompt: !status.isLoading && (status.needsUpgrade || !status.hasPartnerCap)
  };
} 