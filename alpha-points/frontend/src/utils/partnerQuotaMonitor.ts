/**
 * Partner Quota Monitor for Dynamic Milestone Rewards
 * Monitors the Alpha4 PartnerCap to enable percentage-based reward calculations
 */

import { SuiClient } from '@mysten/sui/client';
import { PartnerQuotaInfo } from './engagementProcessor';

// Alpha4 PartnerCap ID provided by user
export const ALPHA4_PARTNER_CAP_ID = '0x979ed615c2c48c665aa96aefe051b31179d82cc9cdeb2aee1e1bac725da01a48';

export interface PartnerCapData {
  id: string;
  partner_name: string;
  daily_quota_pts: string;
  mint_remaining_today: string;
  collateral_value_usdc_at_creation: string;
  last_epoch: string;
  paused: boolean;
}

/**
 * Fetch current Alpha4 PartnerCap quota information
 * Note: Daily Quota = 3% of Lifetime Quota
 * daily_quota_pts is in MIST format (1 Alpha Point = 1,000,000 MIST)
 */
export async function fetchAlpha4Quota(suiClient: SuiClient, enableDebugLogs: boolean = false): Promise<PartnerQuotaInfo | null> {
  try {
    const response = await suiClient.getObject({
      id: ALPHA4_PARTNER_CAP_ID,
      options: { showContent: true }
    });

    if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
      if (enableDebugLogs) {
        console.error('Failed to fetch Alpha4 PartnerCap data');
      }
      return null;
    }

    const fields = (response.data.content as any).fields;
    
    // Convert from MIST to Alpha Points (divide by 1,000,000)
    const MIST_TO_AP = 1_000_000;
    
    const dailyQuotaMist = parseInt(fields.daily_quota_pts || '0');
    const remainingTodayMist = parseInt(fields.mint_remaining_today || '0');
    const collateralValueUsdc = parseInt(fields.collateral_value_usdc_at_creation || '0');
    
    // Convert to Alpha Points
    const dailyQuota = Math.floor(dailyQuotaMist / MIST_TO_AP);
    const remainingToday = Math.floor(remainingTodayMist / MIST_TO_AP);
    const utilizationPercentage = dailyQuota > 0 ? ((dailyQuota - remainingToday) / dailyQuota) * 100 : 0;
    
    // Calculate lifetime quota: Daily quota represents 3% of lifetime
    const dailyReplenishmentRate = 3; // 3% per day
    const lifetimeQuota = Math.floor(dailyQuota / (dailyReplenishmentRate / 100)); // dailyQuota / 0.03
    const lifetimeUsed = lifetimeQuota - Math.floor(lifetimeQuota * (dailyReplenishmentRate / 100)) + (dailyQuota - remainingToday);
    const lifetimeRemainingPercentage = lifetimeQuota > 0 ? ((lifetimeQuota - lifetimeUsed) / lifetimeQuota) * 100 : 0;

    // Only log debug info when explicitly requested (e.g., in partner dashboard)
    if (enableDebugLogs) {
      console.log('Alpha4 Quota Debug:', {
        dailyQuotaMist,
        remainingTodayMist,
        dailyQuota,
        remainingToday,
        lifetimeQuota,
        collateralValueUsdc
      });
    }

    return {
      dailyQuota,
      remainingToday: Math.max(0, remainingToday), // Ensure no negative values
      utilizationPercentage,
      lifetimeQuota,
      lifetimeUsed,
      lifetimeRemainingPercentage,
      dailyReplenishmentRate
    };
  } catch (error) {
    if (enableDebugLogs) {
      console.error('Error fetching Alpha4 quota:', error);
    }
    return null;
  }
}

/**
 * Calculate if milestone rewards are sustainable given current quota usage
 * Considers both daily and lifetime quota constraints
 */
export function assessRewardSustainability(
  quotaInfo: PartnerQuotaInfo,
  estimatedDailyUsers: number = 100
): {
  canSustainRewards: boolean;
  recommendedUserCap: number;
  quotaUtilizationForecast: number;
  riskLevel: 'low' | 'medium' | 'high';
  lifetimeImpact: {
    daysUntilDepletion: number;
    lifetimeUsagePercentage: number;
    sustainableForYears: number;
  };
} {
  // Estimate worst-case: all users claim 7-day reward (0.15% of quota each)
  const worstCaseRewardPerUser = Math.floor((quotaInfo.dailyQuota * 15) / 10000); // 0.15%
  const worstCaseUsage = estimatedDailyUsers * worstCaseRewardPerUser;
  
  const quotaUtilizationForecast = (worstCaseUsage / quotaInfo.dailyQuota) * 100;
  
  // Determine sustainability
  const canSustainRewards = quotaUtilizationForecast < 80; // Keep 20% buffer
  const recommendedUserCap = Math.floor((quotaInfo.dailyQuota * 0.8) / worstCaseRewardPerUser);
  
  let riskLevel: 'low' | 'medium' | 'high';
  if (quotaUtilizationForecast > 60) riskLevel = 'high';
  else if (quotaUtilizationForecast > 30) riskLevel = 'medium';
  else riskLevel = 'low';

  // Lifetime impact analysis
  const dailyNetConsumption = worstCaseUsage - (quotaInfo.lifetimeQuota * (quotaInfo.dailyReplenishmentRate / 100));
  const lifetimeRemaining = quotaInfo.lifetimeQuota - quotaInfo.lifetimeUsed;
  
  let daysUntilDepletion = Infinity;
  if (dailyNetConsumption > 0) {
    daysUntilDepletion = Math.floor(lifetimeRemaining / dailyNetConsumption);
  }
  
  const lifetimeUsagePercentage = (quotaInfo.lifetimeUsed / quotaInfo.lifetimeQuota) * 100;
  const sustainableForYears = daysUntilDepletion === Infinity ? Infinity : daysUntilDepletion / 365;

  return {
    canSustainRewards,
    recommendedUserCap,
    quotaUtilizationForecast,
    riskLevel,
    lifetimeImpact: {
      daysUntilDepletion,
      lifetimeUsagePercentage,
      sustainableForYears
    }
  };
}

/**
 * Create a monitoring hook for quota changes
 */
export class PartnerQuotaMonitor {
  private suiClient: SuiClient;
  private currentQuota: PartnerQuotaInfo | null = null;
  private listeners: ((quota: PartnerQuotaInfo | null) => void)[] = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private enableDebugLogs: boolean = false;

  constructor(suiClient: SuiClient, enableDebugLogs: boolean = false) {
    this.suiClient = suiClient;
    this.enableDebugLogs = enableDebugLogs;
  }

  /**
   * Start monitoring quota changes
   */
  startMonitoring(intervalMs: number = 60000) { // Default: 1 minute
    this.stopMonitoring(); // Clear any existing interval

    this.pollInterval = setInterval(async () => {
      const newQuota = await fetchAlpha4Quota(this.suiClient, this.enableDebugLogs);
      
      // Only notify if quota significantly changed
      if (this.hasSignificantChange(this.currentQuota, newQuota)) {
        this.currentQuota = newQuota;
        this.notifyListeners(newQuota);
      }
    }, intervalMs);

    // Initial fetch
    this.fetchAndNotify();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Add listener for quota changes
   */
  onQuotaChange(callback: (quota: PartnerQuotaInfo | null) => void) {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback: (quota: PartnerQuotaInfo | null) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Get current quota (cached)
   */
  getCurrentQuota(): PartnerQuotaInfo | null {
    return this.currentQuota;
  }

  private async fetchAndNotify() {
    const quota = await fetchAlpha4Quota(this.suiClient, this.enableDebugLogs);
    this.currentQuota = quota;
    this.notifyListeners(quota);
  }

  private notifyListeners(quota: PartnerQuotaInfo | null) {
    this.listeners.forEach(listener => listener(quota));
  }

  private hasSignificantChange(
    oldQuota: PartnerQuotaInfo | null, 
    newQuota: PartnerQuotaInfo | null
  ): boolean {
    if (!oldQuota || !newQuota) return true;
    
    // Consider it significant if remaining quota changed by more than 1%
    const threshold = oldQuota.dailyQuota * 0.01;
    return Math.abs(oldQuota.remainingToday - newQuota.remainingToday) > threshold;
  }
}

/**
 * Format quota information for display
 */
export function formatQuotaInfo(quota: PartnerQuotaInfo): {
  dailyQuotaFormatted: string;
  remainingTodayFormatted: string;
  utilizationFormatted: string;
  utilizationColor: string;
  lifetimeQuotaFormatted: string;
  lifetimeUsedFormatted: string;
  lifetimeRemainingFormatted: string;
  lifetimePercentageFormatted: string;
  replenishmentInfo: string;
} {
  const dailyQuotaFormatted = (quota.dailyQuota / 1000000).toFixed(1) + 'M';
  const remainingTodayFormatted = (quota.remainingToday / 1000000).toFixed(1) + 'M';
  const utilizationFormatted = quota.utilizationPercentage.toFixed(1) + '%';
  
  const lifetimeQuotaFormatted = (quota.lifetimeQuota / 1000000000).toFixed(1) + 'B';
  const lifetimeUsedFormatted = (quota.lifetimeUsed / 1000000000).toFixed(1) + 'B';
  const lifetimeRemainingFormatted = ((quota.lifetimeQuota - quota.lifetimeUsed) / 1000000000).toFixed(1) + 'B';
  const lifetimePercentageFormatted = quota.lifetimeRemainingPercentage.toFixed(1) + '%';
  const replenishmentInfo = `${quota.dailyReplenishmentRate}% daily (${dailyQuotaFormatted} per day)`;
  
  let utilizationColor = 'text-green-400';
  if (quota.utilizationPercentage > 70) utilizationColor = 'text-red-400';
  else if (quota.utilizationPercentage > 40) utilizationColor = 'text-yellow-400';
  
  return {
    dailyQuotaFormatted,
    remainingTodayFormatted,
    utilizationFormatted,
    utilizationColor,
    lifetimeQuotaFormatted,
    lifetimeUsedFormatted,
    lifetimeRemainingFormatted,
    lifetimePercentageFormatted,
    replenishmentInfo
  };
} 