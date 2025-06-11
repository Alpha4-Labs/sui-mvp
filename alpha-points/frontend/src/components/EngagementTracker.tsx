import React, { useState, useEffect, useCallback } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { ALL_PACKAGE_IDS } from '../config/contract';

interface EngagementData {
  currentStreak: number;
  longestStreak: number;
  totalActivities: number;
  lastActiveEpoch: number;
  streakStatus: 'active' | 'broken' | 'new';
  recentMilestones: any[];
  isLoading: boolean;
}

export const EngagementTracker: React.FC = () => {
  const { address, isConnected, suiClient } = useAlphaContext();
  const [data, setData] = useState<EngagementData>({
    currentStreak: 0,
    longestStreak: 0,
    totalActivities: 0,
    lastActiveEpoch: 0,
    streakStatus: 'new',
    recentMilestones: [],
    isLoading: true
  });

  // Function to fetch user's engagement data from on-chain events
  const fetchEngagementData = useCallback(async () => {
    if (!suiClient || !address) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setData(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('📊 Fetching engagement data for:', address);
      
      // Get all packages to query for engagement events
      const packageId = import.meta.env['VITE_PACKAGE_ID'];
      const packagesToQuery = [packageId, ...ALL_PACKAGE_IDS].filter(Boolean);
      
      let allActivities = 0;
      let allStreakUpdates: any[] = [];
      let allMilestones: any[] = [];
      
      // Query engagement events from all packages
      for (const pkgId of packagesToQuery) {
        try {
          // Query engagement activity events
          const activityEvents = await suiClient.queryEvents({
            query: { MoveEventType: `${pkgId}::engagement::EngagementActivity` },
            order: 'descending',
            limit: 100
          });
          
          // Count user's activities
          const userActivities = activityEvents.data.filter(
            (event: any) => event.parsedJson?.user === address
          );
          allActivities += userActivities.length;
          
          // Query streak update events
          const streakEvents = await suiClient.queryEvents({
            query: { MoveEventType: `${pkgId}::engagement::EngagementStreakUpdated` },
            order: 'descending',
            limit: 50
          });
          
          const userStreakUpdates = streakEvents.data.filter(
            (event: any) => event.parsedJson?.user === address
          );
          allStreakUpdates.push(...userStreakUpdates);
          
          // Query milestone events
          const milestoneEvents = await suiClient.queryEvents({
            query: { MoveEventType: `${pkgId}::engagement::EngagementMilestone` },
            order: 'descending',
            limit: 50
          });
          
          const userMilestones = milestoneEvents.data.filter(
            (event: any) => event.parsedJson?.user === address
          );
          allMilestones.push(...userMilestones);
          
        } catch (error) {
          console.warn(`Failed to query engagement events for package ${pkgId}:`, error);
        }
      }
      
      // Process streak updates to get current stats
      let currentStreak = 0;
      let longestStreak = 0;
      let lastActiveEpoch = 0;
      
      if (allStreakUpdates.length > 0) {
        // Sort by epoch descending to get most recent
        allStreakUpdates.sort((a, b) => {
          const epochA = parseInt(a.parsedJson?.epoch || '0');
          const epochB = parseInt(b.parsedJson?.epoch || '0');
          return epochB - epochA;
        });
        
        const latestUpdate = allStreakUpdates[0].parsedJson;
        currentStreak = parseInt(latestUpdate?.current_streak || '0');
        longestStreak = parseInt(latestUpdate?.longest_streak || '0');
        lastActiveEpoch = parseInt(latestUpdate?.epoch || '0');
      }
      
      // Determine streak status based on current epoch
      const currentEpoch = Math.floor(Date.now() / (24 * 60 * 60 * 1000)); // Simple epoch calculation
      let streakStatus: 'active' | 'broken' | 'new' = 'new';
      
      if (currentStreak > 0) {
        if (currentEpoch - lastActiveEpoch <= 1) {
          streakStatus = 'active';
        } else {
          streakStatus = 'broken';
        }
      }
      
      // Process milestones (keep recent 5)
      const recentMilestones = allMilestones
        .sort((a, b) => {
          const epochA = parseInt(a.parsedJson?.epoch || '0');
          const epochB = parseInt(b.parsedJson?.epoch || '0');
          return epochB - epochA;
        })
        .slice(0, 5)
        .map(event => event.parsedJson);
      
      setData({
        currentStreak,
        longestStreak,
        totalActivities: allActivities,
        lastActiveEpoch,
        streakStatus,
        recentMilestones,
        isLoading: false
      });
      
      console.log('✅ Engagement data loaded:', {
        currentStreak,
        longestStreak,
        totalActivities: allActivities,
        milestones: recentMilestones.length,
        streakStatus
      });
      
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [suiClient, address]);

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
        <h3 className="text-base font-semibold text-white mb-4">Engagement Tracker</h3>
        <div className="text-center py-8">
          <p className="text-gray-400">Connect your wallet to view engagement stats</p>
        </div>
      </div>
    );
  }

  const streakStyle = getStreakStatusStyle();

  return (
    <div className="card-modern p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Engagement Tracker</h3>
        <button
          onClick={fetchEngagementData}
          disabled={data.isLoading}
          className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors disabled:opacity-50"
          title="Refresh engagement data"
        >
          <svg 
            className={`w-4 h-4 ${data.isLoading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Streak Status */}
      <div className={`bg-gradient-to-r ${streakStyle.bgClass} p-4 rounded-lg border ${streakStyle.borderClass} mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-lg">{streakStyle.icon}</span>
              <span className={`text-sm font-medium ${streakStyle.textClass}`}>{streakStyle.text}</span>
            </div>
            <div className="flex items-baseline space-x-3">
              <div>
                <span className={`text-2xl font-bold ${streakStyle.textClass}`}>
                  {data.isLoading ? '...' : data.currentStreak}
                </span>
                <span className={`text-xs ${streakStyle.textClass}/70 ml-1`}>current</span>
              </div>
              <div>
                <span className={`text-lg font-semibold ${streakStyle.textClass}`}>
                  {data.isLoading ? '...' : data.longestStreak}
                </span>
                <span className={`text-xs ${streakStyle.textClass}/70 ml-1`}>best</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-xs ${streakStyle.textClass}/70`}>Total Activities</p>
            <p className={`text-lg font-bold ${streakStyle.textClass}`}>
              {data.isLoading ? '...' : data.totalActivities}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Achievements */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300 flex items-center">
          <svg className="w-4 h-4 mr-2 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Recent Achievements
        </h4>

        {data.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-700/30 p-3 rounded-lg animate-pulse">
                <div className="h-4 w-3/4 bg-gray-600/50 rounded mb-2"></div>
                <div className="h-3 w-1/2 bg-gray-600/30 rounded"></div>
              </div>
            ))}
          </div>
        ) : data.recentMilestones.length > 0 ? (
          <div className="space-y-2">
            {data.recentMilestones.map((milestone, index) => {
              const milestoneInfo = getMilestoneInfo(parseInt(milestone.milestone_type));
              return (
                <div key={index} className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-3 rounded-lg border border-purple-500/20">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{milestoneInfo.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-400">{milestoneInfo.name}</p>
                      <p className="text-xs text-purple-300/70">{milestoneInfo.description}</p>
                      {milestone.streak_length > 0 && (
                        <p className="text-xs text-purple-300/50 mt-1">
                          Streak: {milestone.streak_length} epochs
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-700/20 p-4 rounded-lg border border-gray-600/20 text-center">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm text-gray-400 mb-1">No achievements yet</p>
            <p className="text-xs text-gray-500">
              Complete Alpha Points activities to start earning milestones!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 