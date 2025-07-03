import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { getEngagementStats, MILESTONE_TYPES, ACTIVITY_TYPES, EngagementMilestone } from '../utils/engagement';

interface EngagementStats {
  currentStreak: number;
  longestStreak: number;
  totalActivities: number;
  recentMilestones: EngagementMilestone[];
  streakStatus: 'active' | 'broken' | 'new';
  isLoading: boolean;
}

export const EngagementMilestonesCard: React.FC = () => {
  const { address, isConnected, suiClient } = useAlphaContext();
  const [stats, setStats] = useState<EngagementStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalActivities: 0,
    recentMilestones: [],
    streakStatus: 'new',
    isLoading: true
  });

  // Load engagement stats
  useEffect(() => {
    if (!isConnected || !address || !suiClient) {
      setStats(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const loadEngagementStats = async () => {
      setStats(prev => ({ ...prev, isLoading: true }));

      const packageId = import.meta.env['VITE_PACKAGE_ID'];
      if (!packageId) {
        console.warn('Package ID not configured, cannot fetch engagement stats');
        setStats(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const engagementStats = await getEngagementStats(suiClient, packageId, address);
        setStats({
          ...engagementStats,
          isLoading: false
        });
      } catch (error) {
        console.error('Error loading engagement stats:', error);
        setStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadEngagementStats();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadEngagementStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isConnected, address, suiClient]);

  // Get streak status styling
  const getStreakStatusStyle = () => {
    switch (stats.streakStatus) {
      case 'active':
        return { color: 'emerald', icon: '🔥', text: 'Active Streak' };
      case 'broken':
        return { color: 'orange', icon: '💔', text: 'Streak Broken' };
      default:
        return { color: 'blue', icon: '🌟', text: 'Start Your Streak' };
    }
  };

  // Get milestone icon and description
  const getMilestoneInfo = (milestoneType: string) => {
    switch (milestoneType) {
      case MILESTONE_TYPES.FIRST_ACTIVITY:
        return { icon: '🎯', name: 'First Steps', description: 'First Alpha Points activity' };
      case MILESTONE_TYPES.STREAK_10:
        return { icon: '⚡', name: 'Momentum Builder', description: '10-day activity streak' };
      case MILESTONE_TYPES.STREAK_30:
        return { icon: '🚀', name: 'Consistency Master', description: '30-day activity streak' };
      case MILESTONE_TYPES.STREAK_100:
        return { icon: '💎', name: 'Legend Status', description: '100-day activity streak' };
      case MILESTONE_TYPES.NEW_RECORD:
        return { icon: '🏆', name: 'New Record', description: 'Personal best streak' };
      default:
        return { icon: '🏅', name: 'Achievement', description: 'Engagement milestone' };
    }
  };

  // Get activity type name
  const getActivityTypeName = (activityType: number) => {
    switch (activityType) {
      case ACTIVITY_TYPES.EARN:
        return 'Earning';
      case ACTIVITY_TYPES.SPEND:
        return 'Spending';
      case ACTIVITY_TYPES.STAKE:
        return 'Staking';
      case ACTIVITY_TYPES.CLAIM:
        return 'Claiming';
      default:
        return 'Activity';
    }
  };

  const streakStyle = getStreakStatusStyle();

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

  return (
    <div className="card-modern p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Engagement Tracker</h3>
        <div className="relative group">
          <svg className="w-4 h-4 text-blue-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black/95 backdrop-blur-lg border border-blue-500/30 rounded-lg text-xs text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] w-72">
            <div className="font-medium text-blue-400 mb-2">🔥 Engagement System</div>
            <div className="text-gray-300 mb-3">Track your Alpha Points activity and build engagement streaks for exclusive benefits.</div>
            
            <div className="font-medium text-blue-400 mb-1">💡 How to Build Streaks:</div>
            <ul className="text-blue-300/90 space-y-1 pl-3 list-disc text-xs mb-3">
              <li>Earn Alpha Points through staking</li>
              <li>Spend points on platform features</li>
              <li>Claim rewards or use early unstaking</li>
              <li>Stay active every epoch (24 hours)</li>
            </ul>

            <div className="font-medium text-yellow-400 mb-1">🏆 Unlock Achievements:</div>
            <div className="text-yellow-300/90 text-xs space-y-1">
              <div>• 🎯 First Steps - Complete your first activity</div>
              <div>• ⚡ 10-day streak - Momentum Builder status</div>
              <div>• 🚀 30-day streak - Consistency Master</div>
              <div>• 💎 100-day streak - Legend Status</div>
            </div>

            {stats.streakStatus === 'broken' && stats.longestStreak > 0 && (
              <div className="mt-3 pt-2 border-t border-orange-500/30">
                <div className="font-medium text-orange-400 mb-1">🔄 Restart Your Streak:</div>
                <div className="text-orange-300/90 text-xs">
                  Your best was {stats.longestStreak} epochs. Complete any activity to start fresh!
                </div>
              </div>
            )}

            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/95"></div>
          </div>
        </div>
      </div>

      {/* Streak Status */}
      <div className={`bg-gradient-to-r from-${streakStyle.color}-500/10 to-${streakStyle.color}-600/10 p-4 rounded-lg border border-${streakStyle.color}-500/20 mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-lg">{streakStyle.icon}</span>
              <span className={`text-sm font-medium text-${streakStyle.color}-400`}>{streakStyle.text}</span>
            </div>
            <div className="flex items-baseline space-x-3">
              <div>
                <span className={`text-2xl font-bold text-${streakStyle.color}-400`}>
                  {stats.isLoading ? '...' : stats.currentStreak}
                </span>
                <span className={`text-xs text-${streakStyle.color}-400/70 ml-1`}>current</span>
              </div>
              <div>
                <span className={`text-lg font-semibold text-${streakStyle.color}-300`}>
                  {stats.isLoading ? '...' : stats.longestStreak}
                </span>
                <span className={`text-xs text-${streakStyle.color}-300/70 ml-1`}>best</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-xs text-${streakStyle.color}-400/70`}>Total Activities</p>
            <p className={`text-lg font-bold text-${streakStyle.color}-400`}>
              {stats.isLoading ? '...' : stats.totalActivities}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Milestones */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300 flex items-center">
          <svg className="w-4 h-4 mr-2 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Recent Achievements
        </h4>

        {stats.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-700/30 p-3 rounded-lg animate-pulse">
                <div className="h-4 w-3/4 bg-gray-600/50 rounded mb-2"></div>
                <div className="h-3 w-1/2 bg-gray-600/30 rounded"></div>
              </div>
            ))}
          </div>
        ) : stats.recentMilestones.length > 0 ? (
          <div className="space-y-2">
            {stats.recentMilestones.map((milestone, index) => {
              const milestoneInfo = getMilestoneInfo(milestone.milestone_type);
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