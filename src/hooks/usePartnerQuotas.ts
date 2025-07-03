import { useState, useEffect } from 'react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';

export interface PartnerCapFlexQuotas {
  currentEffectiveUsdcValue: number;
  totalLifetimeQuotaPoints: number;
  totalPointsMintedLifetime: number;
  dailyMintThrottleCapPoints: number;
  pointsMintedToday: number;
  availableQuotaToday: number;
  remainingLifetimeQuota: number;
  lastThrottleResetMs: number;
}

export interface PartnerCapFlexInfo {
  id: string;
  partnerName: string;
  partnerAddress: string;
  isPaused: boolean;
  lockedSuiVaultId: string | null;
  quotas: PartnerCapFlexQuotas;
}

export function usePartnerQuotas() {
  const { currentWallet } = useCurrentWallet();
  const { suiClient } = useAlphaContext();
  const [partnerCapFlexInfo, setPartnerCapFlexInfo] = useState<PartnerCapFlexInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches PartnerCapFlex information including quota details
   * @param partnerCapFlexId Object ID of the PartnerCapFlex to query
   */
  const fetchPartnerCapFlexInfo = async (partnerCapFlexId: string) => {
    if (!suiClient || !partnerCapFlexId) {
      setError('Missing client or PartnerCapFlex ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch the PartnerCapFlex object
      const response = await suiClient.getObject({
        id: partnerCapFlexId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!response.data) {
        throw new Error('PartnerCapFlex object not found');
      }

      const content = response.data.content;
      if (!content || content.dataType !== 'moveObject') {
        throw new Error('Invalid PartnerCapFlex object structure');
      }

      const fields = (content as any).fields;
      
      // Extract quota information from the object fields
      const quotas: PartnerCapFlexQuotas = {
        currentEffectiveUsdcValue: parseInt(fields.current_effective_usdc_value || '0'),
        totalLifetimeQuotaPoints: parseInt(fields.total_lifetime_quota_points || '0'),
        totalPointsMintedLifetime: parseInt(fields.total_points_minted_lifetime || '0'),
        dailyMintThrottleCapPoints: parseInt(fields.daily_throttle_points || '0'),
        pointsMintedToday: parseInt(fields.points_minted_today || '0'),
        availableQuotaToday: Math.max(0, parseInt(fields.daily_throttle_points || '0') - parseInt(fields.points_minted_today || '0')),
        remainingLifetimeQuota: Math.max(0, parseInt(fields.total_lifetime_quota_points || '0') - parseInt(fields.total_points_minted_lifetime || '0')),
        lastThrottleResetMs: parseInt(fields.last_throttle_reset_ms || '0'),
      };

      const info: PartnerCapFlexInfo = {
        id: partnerCapFlexId,
        partnerName: fields.partner_name || 'Unknown',
        partnerAddress: fields.partner_address || '',
        isPaused: fields.is_yield_opted_in || false, // Note: is_yield_opted_in is used as paused flag
        lockedSuiVaultId: fields.yield_escrow_ticket_id?.fields || null,
        quotas,
      };

      setPartnerCapFlexInfo(info);
    } catch (err: any) {
      console.error('Error fetching PartnerCapFlex info:', err);
      setError(err.message || 'Failed to fetch PartnerCapFlex information');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Calculates the maximum points that can be minted based on current TVL
   * @param usdcValue Current effective USDC value
   * @returns Object with lifetime and daily quotas
   */
  const calculateQuotasFromTVL = (usdcValue: number) => {
    const POINTS_PER_USDC = 10000; // 1 USDC = 10,000 Alpha Points
    const DAILY_THROTTLE_PERCENT = 0.03; // 3% per day

    const lifetimeQuota = usdcValue * POINTS_PER_USDC;
    const dailyQuota = Math.floor(lifetimeQuota * DAILY_THROTTLE_PERCENT);

    return {
      lifetimeQuota,
      dailyQuota,
    };
  };

  /**
   * Checks if a specific amount can be minted without exceeding quotas
   * @param pointsToMint Amount of points to mint
   * @returns Object indicating if minting is possible and reasons if not
   */
  const canMintPoints = (pointsToMint: number) => {
    if (!partnerCapFlexInfo) {
      return {
        canMint: false,
        reason: 'PartnerCapFlex information not available',
      };
    }

    const { quotas } = partnerCapFlexInfo;

    if (partnerCapFlexInfo.isPaused) {
      return {
        canMint: false,
        reason: 'PartnerCapFlex is currently paused',
      };
    }

    if (pointsToMint > quotas.availableQuotaToday) {
      return {
        canMint: false,
        reason: `Exceeds daily quota. Available today: ${quotas.availableQuotaToday.toLocaleString()}`,
      };
    }

    if (pointsToMint > quotas.remainingLifetimeQuota) {
      return {
        canMint: false,
        reason: `Exceeds lifetime quota. Remaining: ${quotas.remainingLifetimeQuota.toLocaleString()}`,
      };
    }

    return {
      canMint: true,
      reason: 'Minting allowed within quotas',
    };
  };

  /**
   * Formats quota information for display
   * @returns Formatted quota strings
   */
  const getFormattedQuotas = () => {
    if (!partnerCapFlexInfo) {
      return {
        tvl: 'N/A',
        dailyQuota: 'N/A',
        lifetimeQuota: 'N/A',
        dailyUsed: 'N/A',
        lifetimeUsed: 'N/A',
      };
    }

    const { quotas } = partnerCapFlexInfo;

    return {
      tvl: `$${quotas.currentEffectiveUsdcValue.toLocaleString()}`,
      dailyQuota: `${quotas.availableQuotaToday.toLocaleString()} / ${quotas.dailyMintThrottleCapPoints.toLocaleString()}`,
      lifetimeQuota: `${quotas.remainingLifetimeQuota.toLocaleString()} / ${quotas.totalLifetimeQuotaPoints.toLocaleString()}`,
      dailyUsed: `${((quotas.pointsMintedToday / quotas.dailyMintThrottleCapPoints) * 100).toFixed(1)}%`,
      lifetimeUsed: `${((quotas.totalPointsMintedLifetime / quotas.totalLifetimeQuotaPoints) * 100).toFixed(1)}%`,
    };
  };

  return {
    partnerCapFlexInfo,
    isLoading,
    error,
    fetchPartnerCapFlexInfo,
    calculateQuotasFromTVL,
    canMintPoints,
    getFormattedQuotas,
  };
} 