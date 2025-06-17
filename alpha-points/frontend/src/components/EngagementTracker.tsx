import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAlphaContext } from '../context/AlphaContext';
import { processUserEngagement, EngagementStats, getMilestoneRewardStatus, calculatePendingRewards, getNextMilestone, MilestoneRewardStatus, PartnerQuotaInfo } from '../utils/engagementProcessor';
import { fetchAlpha4Quota, formatQuotaInfo, assessRewardSustainability } from '../utils/partnerQuotaMonitor';
import { usePartnerDetection } from '../hooks/usePartnerDetection';

interface EngagementData extends EngagementStats {
  recentMilestones: any[];
  isLoading: boolean;
  milestoneRewards: MilestoneRewardStatus[];
  pendingRewards: number;
  rewardedMilestones: number[];
  partnerQuota: PartnerQuotaInfo | null;
  sustainabilityInfo: any;
}

// Add icon SVG components
const getIconSvg = (icon: string, className: string = "w-4 h-4") => {
  const icons = {
    start: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3l14 9-14 9V3z" />
      </svg>
    ),
    fire: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
    ),
    target: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    trophy: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    shield: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    diamond: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    crown: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M5 16L3 3l5.5 5L12 4l3.5 4L21 3l-2 13H5zm2.7-2h8.6l.9-5.4-2.1 1.4L12 8l-3.1 2L6.8 8.6L7.7 14z"/>
      </svg>
    ),
    star: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    lightning: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    rocket: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
    lock: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    gift: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    info: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    check: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    )
  };
  return icons[icon] || icons.star;
};

export const EngagementTracker: React.FC = () => {
  const { address, isConnected, suiClient } = useAlphaContext();
  const { isPartner } = usePartnerDetection(); // Detect if user is a partner
  const [data, setData] = useState<EngagementData>({
    currentStreak: 0,
    longestStreak: 0,
    totalActivities: 0,
    lastActivityTimestamp: undefined,
    streakStatus: 'new',
    activitiesByType: { earn: 0, spend: 0, stake: 0, claim: 0 },
    recentMilestones: [],
    isLoading: true,
    milestoneRewards: [],
    pendingRewards: 0,
    rewardedMilestones: [],
    partnerQuota: null,
    sustainabilityInfo: null
  });

  // Function to fetch user's engagement data using event-based processing
  const fetchEngagementData = useCallback(async () => {
    if (!suiClient || !address) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setData(prev => ({ ...prev, isLoading: true }));

    try {
      // Use the new event-based engagement processor
      const engagementStats = await processUserEngagement({
        userAddress: address,
        suiClient,
        limit: 200 // Get comprehensive history for accurate streaks
      });
      
      // Only fetch Alpha4 partner quota if user is actually a partner
      // This prevents unnecessary console spam for regular users
      let partnerQuota: PartnerQuotaInfo | null = null;
      if (isPartner) {
        partnerQuota = await fetchAlpha4Quota(suiClient, false); // No debug logs for user dashboard
      }
      
      // TODO: Load rewardedMilestones from user's local storage or smart contract state
      const rewardedMilestones: number[] = JSON.parse(localStorage.getItem(`rewards-${address}`) || '[]');
      
      const milestoneRewards = getMilestoneRewardStatus(
        engagementStats.currentStreak,
        engagementStats.longestStreak,
        rewardedMilestones,
        partnerQuota || undefined
      );
      
      const pendingRewards = calculatePendingRewards(
        engagementStats.longestStreak,
        rewardedMilestones,
        partnerQuota || undefined
      );
      
      // Assess sustainability for admin insights (only if partner quota available)
      const sustainabilityInfo = partnerQuota ? assessRewardSustainability(partnerQuota, 500) : null;
      
      setData({
        ...engagementStats,
        recentMilestones: [], // TODO: Add milestone detection to event processor
        milestoneRewards,
        pendingRewards,
        rewardedMilestones,
        partnerQuota,
        sustainabilityInfo,
        isLoading: false
      });
      
    } catch (error) {
      console.error('Error processing user engagement:', error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [suiClient, address, isPartner]);

  // Function to claim milestone rewards
  const claimMilestoneReward = useCallback(async (milestoneDay: number) => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    // Get reward details for toast
    const rewardStatus = data.milestoneRewards.find(r => r.milestone.day === milestoneDay);
    if (!rewardStatus?.canClaim) {
      toast.error('This milestone reward is not available to claim');
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading(`Claiming ${rewardStatus.milestone.name} reward...`);
    
    try {
      /* 
      TODO: SMART CONTRACT INTEGRATION
      
      1. CONTRACT FUNCTION NEEDED:
         public entry fun claim_milestone_reward(
           partner_cap: &mut PartnerCap,
           milestone_day: u64,
           recipient: address,
           ctx: &mut TxContext
         ) {
           // Verify user eligibility by checking on-chain engagement events
           // Verify user hasn't already claimed this milestone (check user's milestone_claims object)
           // Verify partner cap has sufficient daily quota remaining
           // Calculate dynamic reward amount based on current quota and milestone percentage
           // Mint Alpha Points to user using partner_cap
           // Update partner_cap daily quota usage
           // Create/update user's milestone_claims tracking object
           // Emit MilestoneRewardClaimed event
         }
      
      2. VERIFICATION SYSTEM:
         - Query user's engagement events from blockchain to verify streak
         - Check user's milestone_claims object to prevent double-claiming
         - Validate reward amount matches current quota percentage
      
      3. TRANSACTION STRUCTURE:
         const tx = new TransactionBlock();
         tx.moveCall({
           target: `${ALPHA_POINTS_PACKAGE_ID}::milestone_rewards::claim_milestone_reward`,
           arguments: [
             tx.object(ALPHA4_PARTNER_CAP_ID),
             tx.pure(milestoneDay),
             tx.pure(address),
           ],
         });
         
         const result = await suiClient.signAndExecuteTransactionBlock({
           signer: wallet,
           transactionBlock: tx,
         });
      
      4. STATE MANAGEMENT:
         - Replace localStorage with on-chain milestone_claims object
         - Query claimed milestones from user's on-chain state
         - Listen for MilestoneRewardClaimed events for real-time updates
      
      5. ERROR HANDLING:
         - Handle insufficient quota errors
         - Handle already claimed errors  
         - Handle engagement verification failures
         - Provide user-friendly error messages
      */
      
      console.log(`[FRONTEND SIMULATION] Claiming reward for ${milestoneDay}-day milestone`);
      console.log(`[FRONTEND SIMULATION] Reward amount: ${rewardStatus.dynamicReward} AP`);
      console.log(`[FRONTEND SIMULATION] User: ${address}`);
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For now, just update local storage (will be replaced with on-chain state)
      const currentRewarded = JSON.parse(localStorage.getItem(`rewards-${address}`) || '[]');
      const updatedRewarded = [...currentRewarded, milestoneDay];
      localStorage.setItem(`rewards-${address}`, JSON.stringify(updatedRewarded));
      
      // Refresh data to update UI
      await fetchEngagementData();
      
      // Success toast
      toast.success(
        `???? Claimed ${rewardStatus.dynamicReward} AP for ${rewardStatus.milestone.name}!`,
        { 
          id: loadingToast,
          duration: 5000,
        }
      );
      
    } catch (error) {
      console.error('Error claiming milestone reward:', error);
      toast.error(
        'Failed to claim reward. Please try again.',
        { id: loadingToast }
      );
    }
  }, [address, data.milestoneRewards, fetchEngagementData]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (isConnected && address) {
      fetchEngagementData();
      
      // Refresh every 2 minutes
      const interval = setInterval(fetchEngagementData, 2 * 60 * 1000);
      return () => clearInterval(interval);
    } else {
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [isConnected, address, fetchEngagementData]);

  // Get streak status styling
  const getStreakStatusStyle = () => {
    if (data.currentStreak > 0 && data.currentStreak === data.longestStreak) {
      return { color: 'emerald', icon: 'fire', text: 'Active Streak', bgClass: 'from-emerald-500/10 to-emerald-600/10', borderClass: 'border-emerald-500/20', textClass: 'text-emerald-400' };
    } else if (data.currentStreak === 0 && data.longestStreak > 0) {
      return { color: 'orange', icon: 'warning', text: 'Streak Broken', bgClass: 'from-orange-500/10 to-orange-600/10', borderClass: 'border-orange-500/20', textClass: 'text-orange-400' };
    } else if (data.currentStreak > 0) {
      return { color: 'purple', icon: 'lightning', text: 'New Streak', bgClass: 'from-purple-500/10 to-purple-600/10', borderClass: 'border-purple-500/20', textClass: 'text-purple-400' };
    } else {
      return { color: 'blue', icon: 'star', text: 'Start Your Streak', bgClass: 'from-blue-500/10 to-blue-600/10', borderClass: 'border-blue-500/20', textClass: 'text-blue-400' };
    }
  };

  // Get milestone info
  const getMilestoneInfo = (milestoneType: number) => {
    switch (milestoneType) {
      case 1:
        return { icon: 'target', name: 'First Steps', description: 'First Alpha Points activity' };
      case 2:
        return { icon: 'lightning', name: 'Momentum Builder', description: '10-day activity streak' };
      case 3:
        return { icon: 'shield', name: 'Consistency Master', description: '30-day activity streak' };
      case 4:
        return { icon: 'crown', name: 'Legend Status', description: '100-day activity streak' };
      case 5:
        return { icon: 'trophy', name: 'New Record', description: 'Personal best streak' };
      default:
        return { icon: 'star', name: 'Achievement', description: 'Engagement milestone' };
    }
  };

  if (!isConnected) {
    return (
      <div className="card-modern p-4">
        <div className="text-center py-8">
          <p className="text-gray-400">Connect your wallet to view engagement stats</p>
        </div>
      </div>
    );
  }

  const streakStyle = getStreakStatusStyle();

  // Define milestone roadmap - split into two tiers
  // Unlocked based on longest streak (achievements), but progress shows current streak
  const tierOneMilestones = [
    { day: 0, icon: 'start', name: 'Start', unlocked: true, color: 'text-gray-400', currentProgress: data.currentStreak >= 0 },
    { day: 1, icon: 'fire', name: 'First Step', unlocked: data.longestStreak >= 1, color: 'text-blue-400', currentProgress: data.currentStreak >= 1 },
    { day: 3, icon: 'target', name: 'Getting Warm', unlocked: data.longestStreak >= 3, color: 'text-orange-400', currentProgress: data.currentStreak >= 3 },
    { day: 7, icon: 'shield', name: 'Weekly Warrior', unlocked: data.longestStreak >= 7, color: 'text-green-400', currentProgress: data.currentStreak >= 7 },
  ];

  const tierTwoMilestones = [
    { day: 14, icon: 'lightning', name: 'Momentum', unlocked: data.longestStreak >= 14, color: 'text-purple-400', currentProgress: data.currentStreak >= 14 },
    { day: 30, icon: 'crown', name: 'Consistency King', unlocked: data.longestStreak >= 30, color: 'text-yellow-400', currentProgress: data.currentStreak >= 30 },
    { day: 50, icon: 'diamond', name: 'Diamond Hands', unlocked: data.longestStreak >= 50, color: 'text-cyan-400', currentProgress: data.currentStreak >= 50 },
    { day: 100, icon: 'trophy', name: 'Legend', unlocked: data.longestStreak >= 100, color: 'text-amber-400', currentProgress: data.currentStreak >= 100 },
  ];

  // Calculate progress percentage for each tier based on current streak
  // Progress shows how far along the current segment between milestones
  const getTierOneProgress = () => {
    const currentStreak = data.currentStreak;
    const milestones = tierOneMilestones.map(m => m.day).sort((a, b) => a - b);
    
    // Find which segment we're in
    for (let i = 0; i < milestones.length - 1; i++) {
      const currentMilestone = milestones[i];
      const nextMilestone = milestones[i + 1];
      
      if (currentStreak >= currentMilestone && currentStreak <= nextMilestone) {
        // Calculate progress within this segment
        const segmentProgress = (currentStreak - currentMilestone) / (nextMilestone - currentMilestone);
        // Convert to overall progress (each segment is 1/3 of the total bar)
        const segmentSize = 100 / (milestones.length - 1);
        return (i * segmentSize) + (segmentProgress * segmentSize);
      }
    }
    
    // If beyond all milestones, show 100%
    return currentStreak >= milestones[milestones.length - 1] ? 100 : 0;
  };

  const getTierTwoProgress = () => {
    const currentStreak = data.currentStreak;
    if (currentStreak < 14) return 0;
    
    const milestones = tierTwoMilestones.map(m => m.day).sort((a, b) => a - b);
    
    // Find which segment we're in
    for (let i = 0; i < milestones.length - 1; i++) {
      const currentMilestone = milestones[i];
      const nextMilestone = milestones[i + 1];
      
      if (currentStreak >= currentMilestone && currentStreak <= nextMilestone) {
        // Calculate progress within this segment
        const segmentProgress = (currentStreak - currentMilestone) / (nextMilestone - currentMilestone);
        // Convert to overall progress (each segment is 1/3 of the total bar)
        const segmentSize = 100 / (milestones.length - 1);
        return (i * segmentSize) + (segmentProgress * segmentSize);
      }
    }
    
    // If beyond all milestones, show 100%
    return currentStreak >= milestones[milestones.length - 1] ? 100 : 0;
  };

  return (
    <div className="card-modern p-4">

      {data.isLoading ? (
        <div className="space-y-4">
          <div className="h-12 bg-gray-800/20 rounded-lg animate-pulse"></div>
          <div className="h-20 bg-gray-800/20 rounded-lg animate-pulse"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Elegant Stats Display */}
          <div className={`relative overflow-hidden rounded-2xl border ${streakStyle.borderClass} bg-gradient-to-r ${streakStyle.bgClass} backdrop-blur-sm`}>
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent"></div>
            
            <div className="relative p-4">
              <div className="flex items-center justify-between">
                {/* Left Section - Streak Stats */}
                <div className="flex items-center space-x-4">
                  {/* Status Icon with subtle glow */}
                  <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                    bg-gradient-to-br from-white/10 to-white/5 border border-white/10
                    shadow-lg backdrop-blur-sm
                  `}>
                    {getIconSvg(streakStyle.icon, "w-6 h-6")}
                  </div>
                  
                  {/* Streak Numbers */}
                  <div className="flex items-center space-x-6">
                    <div className="text-center group">
                      <div className="text-2xl font-bold text-white mb-0.5 transition-transform group-hover:scale-105">
                        {data.currentStreak}
                      </div>
                      <div className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Current
                      </div>
                    </div>
                    
                    {/* Elegant separator */}
                    <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                    
                    <div className="text-center group relative">
                      <div className="text-2xl font-bold text-white mb-0.5 transition-transform group-hover:scale-105">
                        {data.longestStreak}
                      </div>
                      <div className="flex items-center justify-center space-x-1">
                        <div className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                          Best
                        </div>
                        {/* Quota Info Tooltip */}
                        {data.partnerQuota && data.sustainabilityInfo && (
                          <div className="relative group/tooltip">
                            <div className="w-3 h-3 rounded-full bg-blue-500/30 border border-blue-400/50 flex items-center justify-center cursor-help">
                              <span className="text-xs text-blue-300">i</span>
                            </div>
                            
                            {/* Tooltip Content */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                              <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3 shadow-xl min-w-[280px]">
                                <div className="text-xs font-medium text-gray-200 mb-2 flex items-center space-x-1">
                                  {getIconSvg('gift', "w-3 h-3")}
                                  <span>Reward System Status</span>
                                </div>
                                
                                <div className="space-y-2">
                                  {/* Daily Quota */}
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <div className="text-gray-400">Daily Quota</div>
                                      <div className="text-white font-medium">
                                        {formatQuotaInfo(data.partnerQuota).dailyQuotaFormatted}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-gray-400">Remaining</div>
                                      <div className={`font-medium ${formatQuotaInfo(data.partnerQuota).utilizationColor}`}>
                                        {formatQuotaInfo(data.partnerQuota).remainingTodayFormatted}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Sustainability */}
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <div className="text-gray-400">Sustainability</div>
                                      <div className={`font-medium ${
                                        data.sustainabilityInfo.riskLevel === 'low' ? 'text-green-400' :
                                        data.sustainabilityInfo.riskLevel === 'medium' ? 'text-yellow-400' : 'text-red-400'
                                      }`}>
                                        {data.sustainabilityInfo.riskLevel.toUpperCase()}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-gray-400">Pool Health</div>
                                      <div className="text-white font-medium">
                                        {formatQuotaInfo(data.partnerQuota).lifetimePercentageFormatted}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Tooltip Arrow */}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-600/50"></div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Section - Total Activities */}
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">
                    Total Activities
                  </div>
                  <div className="flex items-center justify-end space-x-2">
                    <div className="text-3xl font-bold text-white">
                      {data.totalActivities}
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

                                {/* Achievement Tracker */}
          <div className="space-y-4">
            {/* Pending Rewards Indicator with Quota Info */}
            {data.pendingRewards > 0 && (
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg px-3 py-1">
                  {getIconSvg('warning', "w-4 h-4 text-yellow-400")}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-yellow-300">
                      {data.pendingRewards.toLocaleString()} AP to claim!
                    </span>
                    {data.partnerQuota && (
                      <span className="text-xs text-yellow-400/70">
                        Dynamic rewards • {formatQuotaInfo(data.partnerQuota).remainingTodayFormatted} quota left
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Tier 1: Early Days (0-7) */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 font-medium">Early Days</span>
                <div className="h-px bg-gray-600/50 flex-1"></div>
              </div>
              
              <div className="relative">
                {/* Progress Bar Background */}
                <div className="absolute top-6 left-4 right-4 h-1 bg-gray-700/50 rounded-full"></div>
                
                {/* Progress Bar Fill */}
                <div 
                  className="absolute top-6 left-4 h-1 bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `calc(${getTierOneProgress()}% - 2rem)` }}
                ></div>
                
                {/* Milestone Points */}
                <div className="flex justify-between items-start relative">
                  {tierOneMilestones.map((milestone, index) => {
                    const rewardStatus = data.milestoneRewards.find(r => r.milestone.day === milestone.day);
                    
                    return (
                      <div key={milestone.day} className="flex flex-col items-center space-y-1 group">
                        {/* Milestone Circle */}
                        <div className={`
                          relative w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-300
                          ${milestone.currentProgress 
                            ? 'bg-gradient-to-r from-green-500 to-blue-500 border-green-400 shadow-lg shadow-green-500/25' 
                            : milestone.unlocked
                            ? 'bg-gradient-to-r from-gray-500 to-gray-400 border-gray-400 shadow-lg shadow-gray-500/25'
                            : 'bg-gray-700/50 border-gray-600 text-gray-500'
                          }
                        `}>
                          {milestone.currentProgress ? getIconSvg(milestone.icon, "w-5 h-5") : milestone.unlocked ? getIconSvg(milestone.icon, "w-5 h-5") : getIconSvg('lock', "w-4 h-4")}
                          
                          {/* Reward Available Indicator */}
                          {rewardStatus?.canClaim && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                              <span className="text-xs">{getIconSvg('check', "w-3 h-3")}</span>
                            </div>
                          )}
                          
                          {/* Already Rewarded Indicator */}
                          {rewardStatus?.isRewarded && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full flex items-center justify-center">
                              <span className="text-xs">???</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Milestone Info */}
                        <div className="text-center">
                          <div className={`text-xs font-medium ${
                            milestone.currentProgress ? milestone.color : 
                            milestone.unlocked ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {milestone.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {milestone.day === 0 ? 'Start' : `${milestone.day}d`}
                          </div>
                          
                          {/* Dynamic Reward Amount */}
                          {rewardStatus && milestone.day > 0 && (
                            <div className="text-xs text-yellow-400 mt-1">
                              {rewardStatus.dynamicReward.toLocaleString()} AP
                            </div>
                          )}
                        </div>
                        
                        {/* Claim Button (appears on hover) */}
                        {rewardStatus?.canClaim && (
                          <button
                            onClick={() => claimMilestoneReward(milestone.day)}
                            className="
                              opacity-0 group-hover:opacity-100 transition-opacity duration-200
                              absolute top-12 bg-gradient-to-r from-yellow-500 to-orange-500 
                              text-white text-xs px-2 py-1 rounded-full shadow-lg
                              hover:shadow-yellow-500/25 transform hover:scale-105
                              z-10 whitespace-nowrap
                            "
                          >
                            Claim Reward
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tier 2: Master Level (14-100) */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 font-medium">Master Level</span>
                <div className="h-px bg-gray-600/50 flex-1"></div>
              </div>
              
              <div className="relative">
                {/* Progress Bar Background */}
                <div className="absolute top-6 left-4 right-4 h-1 bg-gray-700/50 rounded-full"></div>
                
                {/* Progress Bar Fill */}
                <div 
                  className="absolute top-6 left-4 h-1 bg-gradient-to-r from-purple-500 to-amber-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `calc(${getTierTwoProgress()}% - 2rem)` }}
                ></div>
                
                                 {/* Milestone Points */}
                 <div className="flex justify-between items-start relative">
                   {tierTwoMilestones.map((milestone, index) => {
                     const rewardStatus = data.milestoneRewards.find(r => r.milestone.day === milestone.day);
                     
                     return (
                       <div key={milestone.day} className="flex flex-col items-center space-y-1 group">
                         {/* Milestone Circle */}
                         <div className={`
                           relative w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-300
                           ${milestone.currentProgress 
                             ? 'bg-gradient-to-r from-purple-500 to-amber-500 border-purple-400 shadow-lg shadow-purple-500/25' 
                             : milestone.unlocked
                             ? 'bg-gradient-to-r from-gray-500 to-gray-400 border-gray-400 shadow-lg shadow-gray-500/25'
                             : 'bg-gray-700/50 border-gray-600 text-gray-500'
                           }
                         `}>
                           {milestone.currentProgress ? getIconSvg(milestone.icon, "w-5 h-5") : milestone.unlocked ? getIconSvg(milestone.icon, "w-5 h-5") : getIconSvg('lock', "w-4 h-4")}
                           
                           {/* Reward Available Indicator */}
                           {rewardStatus?.canClaim && (
                             <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                               <span className="text-xs">{getIconSvg('check', "w-3 h-3")}</span>
                             </div>
                           )}
                           
                           {/* Already Rewarded Indicator */}
                           {rewardStatus?.isRewarded && (
                             <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full flex items-center justify-center">
                               <span className="text-xs">???</span>
                             </div>
                           )}
                         </div>
                         
                         {/* Milestone Info */}
                         <div className="text-center">
                           <div className={`text-xs font-medium ${
                             milestone.currentProgress ? milestone.color : 
                             milestone.unlocked ? 'text-gray-400' : 'text-gray-500'
                           }`}>
                             {milestone.name}
                           </div>
                           <div className="text-xs text-gray-500">
                             {milestone.day}d
                           </div>
                           
                           {/* Dynamic Reward Amount */}
                           {rewardStatus && (
                             <div className="text-xs text-yellow-400 mt-1">
                               {rewardStatus.dynamicReward.toLocaleString()} AP
                             </div>
                           )}
                         </div>
                         
                         {/* Claim Button (appears on hover) */}
                         {rewardStatus?.canClaim && (
                           <button
                             onClick={() => claimMilestoneReward(milestone.day)}
                             className="
                               opacity-0 group-hover:opacity-100 transition-opacity duration-200
                               absolute top-12 bg-gradient-to-r from-yellow-500 to-orange-500 
                               text-white text-xs px-2 py-1 rounded-full shadow-lg
                               hover:shadow-yellow-500/25 transform hover:scale-105
                               z-10 whitespace-nowrap
                             "
                           >
                             Claim Reward
                           </button>
                         )}
                       </div>
                     );
                   })}
                 </div>
              </div>
            </div>
          </div>


        </div>
      )}
    </div>
  );
}; 
