import { ParsedEvent, queryUserEvents, QueryEventsOptions } from './eventQuerying';

// Engagement activity types (matching the smart contract)
export const ENGAGEMENT_ACTIVITY_TYPES = {
  EARN: 1,
  SPEND: 2,
  STAKE: 3,
  CLAIM: 4
} as const;

export interface EngagementActivity {
  type: number; // 1=EARN, 2=SPEND, 3=STAKE, 4=CLAIM
  timestamp: Date;
  amount?: number;
  txDigest?: string;
}

export interface EngagementStats {
  currentStreak: number;
  longestStreak: number;
  totalActivities: number;
  lastActivityTimestamp?: number;
  streakStatus: 'active' | 'broken' | 'new';
  activitiesByType: {
    earn: number;
    spend: number;
    stake: number;
    claim: number;
  };
}

// Milestone reward definitions - NOW PERCENTAGE-BASED
export interface MilestoneReward {
  day: number;
  name: string;
  icon: string;
  rewardPercentage: number; // Percentage of daily quota (in basis points, e.g. 100 = 1%)
  description: string;
  color: string;
}

export const MILESTONE_REWARDS: MilestoneReward[] = [
  { day: 1, name: 'First Step', icon: '⚡', rewardPercentage: 3, description: 'Complete your first day of engagement', color: 'text-blue-400' }, // 0.03% of daily quota (~1 AP)
  { day: 3, name: 'Getting Warm', icon: '🔥', rewardPercentage: 8, description: '3 days of consistent activity', color: 'text-orange-400' }, // 0.08% (~2.5 AP)
  { day: 7, name: 'Weekly Warrior', icon: '💪', rewardPercentage: 15, description: 'One full week of engagement', color: 'text-green-400' }, // 0.15% (~5 AP)
  { day: 14, name: 'Momentum', icon: '🚀', rewardPercentage: 25, description: 'Two weeks of dedication', color: 'text-purple-400' }, // 0.25% (~8 AP)
  { day: 30, name: 'Consistency King', icon: '👑', rewardPercentage: 40, description: 'One month of excellence', color: 'text-yellow-400' }, // 0.40% (~13 AP)
  { day: 50, name: 'Diamond Hands', icon: '💎', rewardPercentage: 60, description: '50 days of unwavering commitment', color: 'text-cyan-400' }, // 0.60% (~20 AP)
  { day: 100, name: 'Legend', icon: '🏆', rewardPercentage: 100, description: '100 days - True legend status', color: 'text-amber-400' }, // 1.00% (~33 AP)
];

export interface MilestoneRewardStatus {
  milestone: MilestoneReward;
  isUnlocked: boolean;
  isRewarded: boolean; // Has the user already claimed this reward?
  canClaim: boolean; // Is eligible to claim now
  dynamicReward: number; // Actual Alpha Points amount based on current quota
}

// Calculate dynamic reward based on partner's daily quota
export function calculateDynamicReward(rewardPercentage: number, dailyQuota: number): number {
  // Convert basis points to actual percentage and calculate reward
  return Math.floor((dailyQuota * rewardPercentage) / 10000);
}

// Get partner quota info for calculations
export interface PartnerQuotaInfo {
  dailyQuota: number;
  remainingToday: number;
  utilizationPercentage: number;
  lifetimeQuota: number;
  lifetimeUsed: number;
  lifetimeRemainingPercentage: number;
  dailyReplenishmentRate: number; // Always 3% for Alpha4
}

// Check which milestones are eligible for rewards with dynamic calculations
export function getMilestoneRewardStatus(
  currentStreak: number, 
  longestStreak: number,
  rewardedMilestones: number[] = [], // Array of milestone days already rewarded
  partnerQuota?: PartnerQuotaInfo // Current partner quota information
): MilestoneRewardStatus[] {
  const defaultQuota = 328; // Default to Alpha4's current quota in AP (328 AP = 328M MIST)
  const dailyQuota = partnerQuota?.dailyQuota || defaultQuota;
  
  return MILESTONE_REWARDS.map(milestone => {
    const isUnlocked = longestStreak >= milestone.day;
    const isRewarded = rewardedMilestones.includes(milestone.day);
    const dynamicReward = calculateDynamicReward(milestone.rewardPercentage, dailyQuota);
    
    // Check if there's enough quota remaining for this reward
    const canAfford = !partnerQuota || partnerQuota.remainingToday >= dynamicReward;
    const canClaim = isUnlocked && !isRewarded && canAfford;
    
    return {
      milestone,
      isUnlocked,
      isRewarded,
      canClaim,
      dynamicReward
    };
  });
}

// Calculate total pending rewards with dynamic amounts
export function calculatePendingRewards(
  longestStreak: number,
  rewardedMilestones: number[] = [],
  partnerQuota?: PartnerQuotaInfo
): number {
  const rewardStatuses = getMilestoneRewardStatus(0, longestStreak, rewardedMilestones, partnerQuota);
  
  return rewardStatuses
    .filter(status => status.canClaim)
    .reduce((total, status) => total + status.dynamicReward, 0);
}

// Estimate daily quota impact of all potential milestone claims
export function estimateDailyQuotaImpact(
  userCount: number, 
  averageLongestStreak: number,
  partnerQuota: PartnerQuotaInfo
): {
  totalPotentialRewards: number;
  quotaImpactPercentage: number;
  sustainabilityRating: 'low' | 'medium' | 'high';
} {
  // Calculate average rewards per user
  const avgRewardStatuses = getMilestoneRewardStatus(0, averageLongestStreak, [], partnerQuota);
  const avgRewardsPerUser = avgRewardStatuses
    .filter(status => status.canClaim)
    .reduce((total, status) => total + status.dynamicReward, 0);
  
  const totalPotentialRewards = userCount * avgRewardsPerUser;
  const quotaImpactPercentage = (totalPotentialRewards / partnerQuota.dailyQuota) * 100;
  
  let sustainabilityRating: 'low' | 'medium' | 'high';
  if (quotaImpactPercentage > 50) sustainabilityRating = 'low';
  else if (quotaImpactPercentage > 20) sustainabilityRating = 'medium';
  else sustainabilityRating = 'high';
  
  return {
    totalPotentialRewards,
    quotaImpactPercentage,
    sustainabilityRating
  };
}

// Get next milestone to achieve
export function getNextMilestone(longestStreak: number): MilestoneReward | null {
  return MILESTONE_REWARDS.find(milestone => longestStreak < milestone.day) || null;
}

// Convert parsed events to engagement activities
export const mapEventsToEngagementActivities = (events: ParsedEvent[]): EngagementActivity[] => {
  const activities: EngagementActivity[] = [];

  events.forEach(event => {
    let activityType: number | null = null;

    // Map event types to engagement activity types
    switch (event.type) {
      case 'points_earned':
        activityType = ENGAGEMENT_ACTIVITY_TYPES.EARN;
        break;
      case 'points_spent':
      case 'perk_claimed': // Perk purchases count as SPEND
        activityType = ENGAGEMENT_ACTIVITY_TYPES.SPEND;
        break;
      case 'stake_created':
        activityType = ENGAGEMENT_ACTIVITY_TYPES.STAKE;
        break;
      case 'early_unstake':
      case 'stake_unlocked':
        activityType = ENGAGEMENT_ACTIVITY_TYPES.CLAIM;
        break;
    }

    if (activityType !== null) {
      activities.push({
        type: activityType,
        timestamp: event.timestamp,
        amount: event.amount,
        txDigest: event.txDigest
      });
    }
  });

  // Sort by timestamp (newest first)
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return activities;
};

// Calculate engagement streaks based on daily activity
export const calculateEngagementStreaks = (activities: EngagementActivity[]): {
  currentStreak: number;
  longestStreak: number;
  streakStatus: 'active' | 'broken' | 'new';
} => {
  if (activities.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streakStatus: 'broken' };
  }

  // Sort activities by timestamp (oldest first) for streak calculation
  const sortedActivities = [...activities].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Group activities by day (UTC)
  const dailyActivities = new Map<string, EngagementActivity[]>();
  
  sortedActivities.forEach(activity => {
    const dayKey = activity.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!dailyActivities.has(dayKey)) {
      dailyActivities.set(dayKey, []);
    }
    dailyActivities.get(dayKey)!.push(activity);
  });

  const activeDays = Array.from(dailyActivities.keys()).sort();
  
  if (activeDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streakStatus: 'broken' };
  }

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Calculate longest streak by checking consecutive days
  for (let i = 1; i < activeDays.length; i++) {
    const prevDay = new Date(activeDays[i - 1]);
    const currentDay = new Date(activeDays[i]);
    const dayDiff = Math.floor((currentDay.getTime() - prevDay.getTime()) / (24 * 60 * 60 * 1000));
    
    if (dayDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);
  
  // Calculate current streak (working backwards from today/yesterday)
  const latestActivityDay = activeDays[activeDays.length - 1];
  
  if (latestActivityDay === today || latestActivityDay === yesterday) {
    // User is active today or yesterday, calculate current streak
    currentStreak = 1;
    
    // Work backwards to find consecutive days
    for (let i = activeDays.length - 2; i >= 0; i--) {
      const currentDay = new Date(activeDays[i + 1]);
      const prevDay = new Date(activeDays[i]);
      const dayDiff = Math.floor((currentDay.getTime() - prevDay.getTime()) / (24 * 60 * 60 * 1000));
      
      if (dayDiff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
  
  // Determine streak status
  let streakStatus: 'active' | 'broken' | 'new';
  if (latestActivityDay === today) {
    streakStatus = currentStreak === 1 ? 'new' : 'active';
  } else if (latestActivityDay === yesterday && currentStreak > 0) {
    streakStatus = 'active';
  } else {
    streakStatus = 'broken';
    currentStreak = 0; // Reset current streak if broken
  }

  return { currentStreak, longestStreak, streakStatus };
};

// Calculate comprehensive engagement statistics
export const calculateEngagementStats = (activities: EngagementActivity[]): EngagementStats => {
  const { currentStreak, longestStreak, streakStatus } = calculateEngagementStreaks(activities);
  
  // Count activities by type
  const activitiesByType = activities.reduce((counts, activity) => {
    switch (activity.type) {
      case ENGAGEMENT_ACTIVITY_TYPES.EARN:
        counts.earn++;
        break;
      case ENGAGEMENT_ACTIVITY_TYPES.SPEND:
        counts.spend++;
        break;
      case ENGAGEMENT_ACTIVITY_TYPES.STAKE:
        counts.stake++;
        break;
      case ENGAGEMENT_ACTIVITY_TYPES.CLAIM:
        counts.claim++;
        break;
    }
    return counts;
  }, { earn: 0, spend: 0, stake: 0, claim: 0 });

  const lastActivityTimestamp = activities.length > 0 
    ? activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0].timestamp.getTime()
    : undefined;

  return {
    currentStreak,
    longestStreak,
    totalActivities: activities.length,
    lastActivityTimestamp,
    streakStatus,
    activitiesByType
  };
};

// Main function to process user engagement from events
export const processUserEngagement = async (options: QueryEventsOptions): Promise<EngagementStats> => {
  try {
    // Query events for the user
    const events = await queryUserEvents({
      ...options,
      onlyUserActivity: true, // Only count activities where user is the actor
      limit: 200 // Get more events for comprehensive engagement tracking
    });

    // Convert events to engagement activities
    const activities = mapEventsToEngagementActivities(events);

    // Calculate engagement statistics
    const stats = calculateEngagementStats(activities);

    return stats;
  } catch (error) {
    console.error('Error processing user engagement:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActivities: 0,
      streakStatus: 'broken',
      activitiesByType: {
        earn: 0,
        spend: 0,
        stake: 0,
        claim: 0
      }
    };
  }
}; 