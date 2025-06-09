import React, { useState, useEffect } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { TransactionHistoryModal } from './TransactionHistoryModal';

interface ActivityItem {
  id: string;
  type: 'perk' | 'generation' | 'stake_matured' | 'milestone' | 'opportunity' | 'earned' | 'spent' | 'locked' | 'unlocked';
  title: string;
  description: string;
  timestamp: Date;
  value?: string;
  badge?: string;
  icon: 'star' | 'zap' | 'coin' | 'users' | 'gift' | 'trending' | 'plus' | 'minus' | 'lock' | 'unlock';
}

const getIconSvg = (icon: ActivityItem['icon'], className: string) => {
  const icons = {
    star: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    zap: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    coin: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    users: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    gift: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    trending: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    plus: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    minus: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
      </svg>
    ),
    lock: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    unlock: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0v4m-4 8v-2m-6 2h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    )
  };
  return icons[icon] || icons.star;
};

const getColorClasses = (type: ActivityItem['type']) => {
  const colors = {
    perk: 'bg-purple-500/5 border-purple-500/20 text-purple-400',
    generation: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
    stake_matured: 'bg-green-500/5 border-green-500/20 text-green-400',
    milestone: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400',
    opportunity: 'bg-pink-500/5 border-pink-500/20 text-pink-400',
    earned: 'bg-green-500/5 border-green-500/20 text-green-400',
    spent: 'bg-red-500/5 border-red-500/20 text-red-400',
    locked: 'bg-orange-500/5 border-orange-500/20 text-orange-400',
    unlocked: 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400'
  };
  return colors[type] || colors.perk;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const formatPoints = (amount: number): string => {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K`;
  }
  return amount.toLocaleString();
};

export const RecentActivityCard: React.FC = () => {
  const { address, stakePositions, points, isConnected } = useAlphaContext();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Generate activity data from wallet state
  useEffect(() => {
    if (!isConnected || !address) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    const generateActivities = () => {
      setIsLoading(true);
      
      try {
        const allActivities: ActivityItem[] = [];
        const now = Date.now();

        // Add stake position activities (real data from wallet)
        stakePositions.forEach((position, index) => {
          const principal = parseFloat(position.principal || '0') / 1_000_000_000;
          const createdAt = position.createdAt ? new Date(position.createdAt).getTime() : now - (index + 1) * 60 * 60 * 1000;
          
          if (position.status === 'matured') {
            allActivities.push({
              id: `stake-matured-${position.id || index}`,
              type: 'stake_matured',
              title: 'Stake Position Matured',
              description: `${principal.toFixed(2)} SUI stake ready for claim`,
              timestamp: new Date(createdAt + (30 * 24 * 60 * 60 * 1000)), // Matured 30 days after creation
              value: `+${position.rewards || '0'} αP`,
              icon: 'coin'
            });
          }
          
          if (position.status === 'active') {
            allActivities.push({
              id: `stake-created-${position.id || index}`,
              type: 'locked',
              title: 'Stake Position Created',
              description: `${principal.toFixed(2)} SUI staked for ${position.durationDays || 30} days`,
              timestamp: new Date(createdAt),
              value: `${principal.toFixed(2)} SUI`,
              icon: 'lock',
              badge: 'Active'
            });
          }
        });

        // Add Alpha Points balance activity
        if (points.total > 0) {
          allActivities.push({
            id: 'points-earned-latest',
            type: 'earned',
            title: 'Alpha Points Earned',
            description: 'Staking rewards accumulated',
            timestamp: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
            value: `+${formatPoints(Math.floor(points.total * 0.1))} αP`,
            icon: 'plus'
          });
        }

        // Add wallet connection activity
        allActivities.push({
          id: 'wallet-connected',
          type: 'milestone',
          title: 'Wallet Connected',
          description: 'Successfully connected to Alpha Points protocol',
          timestamp: new Date(now - 30 * 60 * 1000), // 30 minutes ago
          icon: 'zap',
          badge: 'Connected'
        });

        // Add welcome activity for new users
        if (stakePositions.length === 0) {
          allActivities.push({
            id: 'welcome-bonus',
            type: 'earned',
            title: 'Welcome Bonus',
            description: 'New user registration reward',
            timestamp: new Date(now - 10 * 60 * 1000), // 10 minutes ago
            value: '+1,000 αP',
            icon: 'gift',
            badge: 'Welcome'
          });
        } else {
          // Add recent earning activity for existing users
          allActivities.push({
            id: 'daily-rewards',
            type: 'earned',
            title: 'Daily Staking Rewards',
            description: 'Automatic rewards from active positions',
            timestamp: new Date(now - 4 * 60 * 60 * 1000), // 4 hours ago
            value: `+${formatPoints(Math.floor(stakePositions.length * 150))} αP`,
            icon: 'coin'
          });
        }

        // Sort by timestamp (newest first) and limit to 5 items
        allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(allActivities.slice(0, 5));
        
      } catch (error) {
        console.error('Error generating activities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateActivities();
    
    // Refresh activities every 5 minutes
    const interval = setInterval(generateActivities, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isConnected, address, stakePositions, points]);

  return (
    <div className="card-modern p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-white">Recent Activity</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`}></div>
          <span className={`text-xs ${isLoading ? 'text-yellow-400' : 'text-green-400'}`}>
            {isLoading ? 'Loading' : 'Live'}
          </span>
          {/* Under Construction Warning */}
          <div className="relative group">
            <svg className="w-4 h-4 text-orange-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-black/90 backdrop-blur-lg border border-orange-500/20 rounded-lg text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              ⚠️ Under Construction - Live wallet integration in progress
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-3 p-2 bg-gray-800/20 rounded-lg animate-pulse">
              <div className="w-5 h-5 bg-gray-600 rounded-md"></div>
              <div className="flex-1">
                <div className="h-3 bg-gray-600 rounded mb-2"></div>
                <div className="h-2 bg-gray-700 rounded w-3/4"></div>
              </div>
              <div className="w-8 h-4 bg-gray-600 rounded"></div>
            </div>
          ))
        ) : activities.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-6 h-6 bg-gray-600 rounded-md mx-auto mb-2 flex items-center justify-center">
              {getIconSvg('star', 'w-3 h-3 text-gray-400')}
            </div>
            <p className="text-sm text-gray-400">No recent activity</p>
            <p className="text-xs text-gray-500">Your wallet transactions will appear here</p>
          </div>
        ) : (
          activities.map((activity) => {
            const colorClasses = getColorClasses(activity.type);
            const [bgClass, borderClass, iconColorClass] = colorClasses.split(' ');
            
            return (
              <div key={activity.id} className={`flex items-center space-x-3 p-2 ${bgClass} border ${borderClass} rounded-lg`}>
                <div className={`w-5 h-5 ${iconColorClass.replace('text-', 'bg-').replace('-400', '-500/20')} rounded-md flex items-center justify-center`}>
                  {getIconSvg(activity.icon, `w-3 h-3 ${iconColorClass}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                  <p className="text-xs text-gray-400 truncate">{activity.description} • {formatTimeAgo(activity.timestamp)}</p>
                </div>
                {activity.value && (
                  <span className="text-sm font-semibold text-white">{activity.value}</span>
                )}
                {activity.badge && (
                  <span className={`text-xs px-2 py-1 rounded-full ${iconColorClass.replace('text-', 'bg-').replace('-400', '-500/20')} ${iconColorClass}`}>
                    {activity.badge}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {activities.length > 0 && (
        <div className="mt-3 text-center">
          <button 
            onClick={() => setShowTransactionModal(true)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            View All Transactions
          </button>
        </div>
      )}

      {/* Transaction History Modal */}
      <TransactionHistoryModal 
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />
    </div>
  );
}; 