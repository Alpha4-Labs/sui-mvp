import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAlphaContext } from '../context/AlphaContext';
import { processUserEngagement, EngagementStats, getMilestoneRewardStatus, calculatePendingRewards, getNextMilestone, MilestoneRewardStatus, PartnerQuotaInfo } from '../utils/engagementProcessor';
import { fetchAlpha4Quota, formatQuotaInfo, assessRewardSustainability } from '../utils/partnerQuotaMonitor';

interface EngagementData extends EngagementStats {
  recentMilestones: any[];
  isLoading: boolean;
  milestoneRewards: MilestoneRewardStatus[];
  pendingRewards: number;
  rewardedMilestones: number[];
  partnerQuota: PartnerQuotaInfo | null;
  sustainabilityInfo: any;
}

export const EngagementTracker: React.FC = () => {
  const { address, isConnected, suiClient } = useAlphaContext();
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
      
      // Fetch Alpha4 partner quota for dynamic rewards
      const partnerQuota = await fetchAlpha4Quota(suiClient);
      
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
      
      // Assess sustainability for admin insights
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
  }, [suiClient, address]);

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
        `🎉 Claimed ${rewardStatus.dynamicReward} AP for ${rewardStatus.milestone.name}!`,
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
    switch (data.streakStatus) {
      case 'active':
        return { color: 'emerald', icon: '🔥', text: 'Active Streak', bgClass: 'from-emerald-500/10 to-emerald-600/10', borderClass: 'border-emerald-500/20', textClass: 'text-emerald-400' };
      case 'broken':
        return { color: 'orange', icon: '💔', text: 'Streak Broken', bgClass: 'from-orange-500/10 to-orange-600/10', borderClass: 'border-orange-500/20', textClass: 'text-orange-400' };
      case 'new':
        return { color: 'purple', icon: '🌟', text: 'New Streak', bgClass: 'from-purple-500/10 to-purple-600/10', borderClass: 'border-purple-500/20', textClass: 'text-purple-400' };
      default:
        return { color: 'blue', icon: '🌟', text: 'Start Your Streak', bgClass: 'from-blue-500/10 to-blue-600/10', borderClass: 'border-blue-500/20', textClass: 'text-blue-400' };
    }
  };

  // Get milestone info
  const getMilestoneInfo = (milestoneType: number) => {
    switch (milestoneType) {
      case 1: // FIRST_ACTIVITY
        return { icon: '🎯', name: 'First Steps', description: 'First Alpha Points activity' };
      case 2: // STREAK_10
        return { icon: '⚡', name: 'Momentum Builder', description: '10-day activity streak' };
      case 3: // STREAK_30
        return { icon: '🚀', name: 'Consistency Master', description: '30-day activity streak' };
      case 4: // STREAK_100
        return { icon: '💎', name: 'Legend Status', description: '100-day activity streak' };
      case 5: // NEW_RECORD
        return { icon: '🏆', name: 'New Record', description: 'Personal best streak' };
      default:
        return { icon: '🏅', name: 'Achievement', description: 'Engagement milestone' };
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
  const tierOneMilestones = [
    { day: 0, icon: '🌱', name: 'Start', unlocked: true, color: 'text-gray-400' },
    { day: 1, icon: '⚡', name: 'First Step', unlocked: data.longestStreak >= 1, color: 'text-blue-400' },
    { day: 3, icon: '🔥', name: 'Getting Warm', unlocked: data.longestStreak >= 3, color: 'text-orange-400' },
    { day: 7, icon: '💪', name: 'Weekly Warrior', unlocked: data.longestStreak >= 7, color: 'text-green-400' },
  ];

  const tierTwoMilestones = [
    { day: 14, icon: '🚀', name: 'Momentum', unlocked: data.longestStreak >= 14, color: 'text-purple-400' },
    { day: 30, icon: '👑', name: 'Consistency King', unlocked: data.longestStreak >= 30, color: 'text-yellow-400' },
    { day: 50, icon: '💎', name: 'Diamond Hands', unlocked: data.longestStreak >= 50, color: 'text-cyan-400' },
    { day: 100, icon: '🏆', name: 'Legend', unlocked: data.longestStreak >= 100, color: 'text-amber-400' },
  ];

  // Calculate progress percentage for each tier
  const getTierOneProgress = () => {
    const maxTierOne = tierOneMilestones[tierOneMilestones.length - 1].day;
    return Math.min((data.longestStreak / maxTierOne) * 100, 100);
  };

  const getTierTwoProgress = () => {
    if (data.longestStreak < 14) return 0;
    const minTierTwo = tierTwoMilestones[0].day;
    const maxTierTwo = tierTwoMilestones[tierTwoMilestones.length - 1].day;
    return Math.min(((data.longestStreak - minTierTwo) / (maxTierTwo - minTierTwo)) * 100, 100);
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
                    {streakStyle.icon}
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
                                  <span>📊</span>
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
                  <span className="text-yellow-400 text-sm">🎁</span>
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
                          ${milestone.unlocked 
                            ? 'bg-gradient-to-r from-green-500 to-blue-500 border-green-400 shadow-lg shadow-green-500/25' 
                            : 'bg-gray-700/50 border-gray-600 text-gray-500'
                          }
                        `}>
                          {milestone.unlocked ? milestone.icon : '🔒'}
                          
                          {/* Reward Available Indicator */}
                          {rewardStatus?.canClaim && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                              <span className="text-xs">!</span>
                            </div>
                          )}
                          
                          {/* Already Rewarded Indicator */}
                          {rewardStatus?.isRewarded && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full flex items-center justify-center">
                              <span className="text-xs">✓</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Milestone Info */}
                        <div className="text-center">
                          <div className={`text-xs font-medium ${milestone.unlocked ? milestone.color : 'text-gray-500'}`}>
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
                           ${milestone.unlocked 
                             ? 'bg-gradient-to-r from-purple-500 to-amber-500 border-purple-400 shadow-lg shadow-purple-500/25' 
                             : 'bg-gray-700/50 border-gray-600 text-gray-500'
                           }
                         `}>
                           {milestone.unlocked ? milestone.icon : '🔒'}
                           
                           {/* Reward Available Indicator */}
                           {rewardStatus?.canClaim && (
                             <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                               <span className="text-xs">!</span>
                             </div>
                           )}
                           
                           {/* Already Rewarded Indicator */}
                           {rewardStatus?.isRewarded && (
                             <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full flex items-center justify-center">
                               <span className="text-xs">✓</span>
                             </div>
                           )}
                         </div>
                         
                         {/* Milestone Info */}
                         <div className="text-center">
                           <div className={`text-xs font-medium ${milestone.unlocked ? milestone.color : 'text-gray-500'}`}>
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