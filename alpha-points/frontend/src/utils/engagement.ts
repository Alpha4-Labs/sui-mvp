/**
 * Engagement tracking utilities for Alpha Points
 */
import { SuiClient } from '@mysten/sui.js/client';

export interface UserEngagement {
  user: string;
  current_streak: number;
  longest_streak: number;
  last_active_epoch: number;
  total_activities: number;
  activity_types: number[]; // Bitmap of activity types
  milestones: string[]; // JSON array of milestone types
}

export interface EngagementActivity {
  user: string;
  activity_type: number;
  epoch: number;
  timestamp: number;
}

export interface EngagementStreakUpdate {
  user: string;
  current_streak: number;
  longest_streak: number;
  epoch: number;
  new_record: boolean;
}

export interface EngagementMilestone {
  user: string;
  milestone_type: string;
  streak_length: number;
  epoch: number;
}

export const ACTIVITY_TYPES = {
  EARN: 1,
  SPEND: 2,
  STAKE: 3,
  CLAIM: 4
} as const;

export const MILESTONE_TYPES = {
  FIRST_ACTIVITY: 'first_activity',
  STREAK_10: 'streak_10',
  STREAK_30: 'streak_30',
  STREAK_100: 'streak_100',
  NEW_RECORD: 'new_record'
} as const;

/**
 * Get the current epoch number (simplified calculation)
 */
export function getCurrentEpoch(): number {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
}

/**
 * Find the EngagementTracker shared object dynamically
 */
export async function findEngagementTracker(
  suiClient: SuiClient,
  packageId: string
): Promise<string | null> {
  try {
    // Query events for EngagementTracker creation to find the object ID
    const creationEvents = await suiClient.queryEvents({
      query: { MoveEventType: `${packageId}::engagement::EngagementTrackerCreated` },
      order: 'ascending',
      limit: 1
    });

    if (creationEvents.data && creationEvents.data.length > 0) {
      const event = creationEvents.data[0];
      const eventData = event.parsedJson as any;
      return eventData?.tracker_id || null;
    }

    // Fallback: Try to find by querying objects with the EngagementTracker type
    // This is less reliable but can work if the creation event is not available
    try {
      const objects = await suiClient.queryEvents({
        query: { MoveEventType: `${packageId}::engagement::EngagementActivity` },
        order: 'descending',
        limit: 1
      });

      if (objects.data && objects.data.length > 0) {
        // The engagement tracker ID might be extractable from activity events
        // This is implementation-specific and may need adjustment
        return null; // For now, return null if creation event not found
      }
    } catch (fallbackError) {
      console.warn('Fallback EngagementTracker discovery failed:', fallbackError);
    }

    return null;
  } catch (error) {
    console.error('Error finding EngagementTracker:', error);
    return null;
  }
}

/**
 * Get user's current engagement data
 */
export async function getUserEngagement(
  suiClient: SuiClient,
  packageId: string,
  userAddress: string,
  trackerObjectId?: string
): Promise<UserEngagement | null> {
  try {
    const trackerId = trackerObjectId || await findEngagementTracker(suiClient, packageId);
    if (!trackerId) {
      return null;
    }

    const currentEpoch = getCurrentEpoch();

    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: {
        kind: 'programmableTransaction',
        inputs: [
          { type: 'object', objectType: 'immOrOwned', objectId: trackerId },
          { type: 'pure', valueType: 'address', value: userAddress }
        ],
        transactions: [{
          kind: 'moveCall',
          target: `${packageId}::engagement::get_user_engagement`,
          arguments: ['Input(0)', 'Input(1)']
        }]
      },
      sender: userAddress
    });

    if (result.results?.[0]?.returnValues?.[0]) {
      // Parse the returned UserEngagement struct
      const returnValue = result.results[0].returnValues[0];
      // This would need proper parsing based on the actual return format
      return parseUserEngagement(returnValue);
    }

    return null;
  } catch (error) {
    console.error('Error getting user engagement:', error);
    return null;
  }
}

/**
 * Get user's current streak with validation
 */
export async function getUserStreak(
  suiClient: SuiClient,
  packageId: string,
  userAddress: string,
  trackerObjectId?: string
): Promise<number> {
  try {
    const trackerId = trackerObjectId || await findEngagementTracker(suiClient, packageId);
    if (!trackerId) {
      return 0;
    }

    const currentEpoch = getCurrentEpoch();

    const result = await suiClient.devInspectTransactionBlock({
      transactionBlock: {
        kind: 'programmableTransaction',
        inputs: [
          { type: 'object', objectType: 'immOrOwned', objectId: trackerId },
          { type: 'pure', valueType: 'address', value: userAddress },
          { type: 'pure', valueType: 'u64', value: currentEpoch.toString() }
        ],
        transactions: [{
          kind: 'moveCall',
          target: `${packageId}::engagement::get_current_streak_validated`,
          arguments: ['Input(0)', 'Input(1)', 'Input(2)']
        }]
      },
      sender: userAddress
    });

    if (result.results?.[0]?.returnValues?.[0]) {
      const streakValue = result.results[0].returnValues[0][0];
      return parseInt(streakValue) || 0;
    }

    return 0;
  } catch (error) {
    console.error('Error getting user streak:', error);
    return 0;
  }
}

/**
 * Get recent engagement events for a user
 */
export async function getRecentEngagementEvents(
  suiClient: SuiClient,
  packageId: string,
  userAddress: string,
  limit: number = 50
): Promise<{
  activities: EngagementActivity[];
  streakUpdates: EngagementStreakUpdate[];
  milestones: EngagementMilestone[];
}> {
  try {
    const [activityEvents, streakEvents, milestoneEvents] = await Promise.all([
      suiClient.queryEvents({
        query: { MoveEventType: `${packageId}::engagement::EngagementActivity` },
        order: 'descending',
        limit
      }).catch(() => ({ data: [] })),
      
      suiClient.queryEvents({
        query: { MoveEventType: `${packageId}::engagement::EngagementStreakUpdated` },
        order: 'descending',
        limit
      }).catch(() => ({ data: [] })),
      
      suiClient.queryEvents({
        query: { MoveEventType: `${packageId}::engagement::EngagementMilestone` },
        order: 'descending',
        limit
      }).catch(() => ({ data: [] }))
    ]);

    // Filter events for this user and parse them
    const activities = (activityEvents.data || [])
      .filter((event: any) => event.parsedJson?.user === userAddress)
      .map((event: any) => parseEngagementActivity(event.parsedJson));

    const streakUpdates = (streakEvents.data || [])
      .filter((event: any) => event.parsedJson?.user === userAddress)
      .map((event: any) => parseEngagementStreakUpdate(event.parsedJson));

    const milestones = (milestoneEvents.data || [])
      .filter((event: any) => event.parsedJson?.user === userAddress)
      .map((event: any) => parseEngagementMilestone(event.parsedJson));

    return { activities, streakUpdates, milestones };
  } catch (error) {
    console.error('Error getting engagement events:', error);
    return { activities: [], streakUpdates: [], milestones: [] };
  }
}

/**
 * Get engagement statistics for display
 */
export async function getEngagementStats(
  suiClient: SuiClient,
  packageId: string,
  userAddress: string
): Promise<{
  currentStreak: number;
  longestStreak: number;
  totalActivities: number;
  recentMilestones: EngagementMilestone[];
  streakStatus: 'active' | 'broken' | 'new';
}> {
  try {
    const [engagement, events] = await Promise.all([
      getUserEngagement(suiClient, packageId, userAddress),
      getRecentEngagementEvents(suiClient, packageId, userAddress, 20)
    ]);

    const currentEpoch = getCurrentEpoch();
    const currentStreak = engagement?.current_streak || 0;
    const longestStreak = engagement?.longest_streak || 0;
    const totalActivities = engagement?.total_activities || 0;
    const lastActiveEpoch = engagement?.last_active_epoch || 0;

    // Determine streak status
    let streakStatus: 'active' | 'broken' | 'new' = 'new';
    if (currentStreak > 0) {
      if (currentEpoch - lastActiveEpoch <= 1) {
        streakStatus = 'active';
      } else {
        streakStatus = 'broken';
      }
    }

    return {
      currentStreak,
      longestStreak,
      totalActivities,
      recentMilestones: events.milestones.slice(0, 5),
      streakStatus
    };
  } catch (error) {
    console.error('Error getting engagement stats:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalActivities: 0,
      recentMilestones: [],
      streakStatus: 'new'
    };
  }
}

// Helper parsing functions
function parseUserEngagement(returnValue: any): UserEngagement {
  // This would need to be implemented based on the actual return format from Sui
  // For now, return a default structure
  return {
    user: '',
    current_streak: 0,
    longest_streak: 0,
    last_active_epoch: 0,
    total_activities: 0,
    activity_types: [],
    milestones: []
  };
}

function parseEngagementActivity(eventData: any): EngagementActivity {
  return {
    user: eventData.user || '',
    activity_type: parseInt(eventData.activity_type) || 0,
    epoch: parseInt(eventData.epoch) || 0,
    timestamp: parseInt(eventData.timestamp) || 0
  };
}

function parseEngagementStreakUpdate(eventData: any): EngagementStreakUpdate {
  return {
    user: eventData.user || '',
    current_streak: parseInt(eventData.current_streak) || 0,
    longest_streak: parseInt(eventData.longest_streak) || 0,
    epoch: parseInt(eventData.epoch) || 0,
    new_record: eventData.new_record || false
  };
}

function parseEngagementMilestone(eventData: any): EngagementMilestone {
  return {
    user: eventData.user || '',
    milestone_type: eventData.milestone_type || '',
    streak_length: parseInt(eventData.streak_length) || 0,
    epoch: parseInt(eventData.epoch) || 0
  };
} 