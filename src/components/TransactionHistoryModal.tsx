import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatTimeAgo } from '../utils/format';

interface ActivityItem {
  id: string;
  type: 'perk_created' | 'perk_claimed' | 'points_earned' | 'points_spent' | 'points_locked' | 'points_unlocked' | 'stake_created' | 'stake_unlocked' | 'loan_created' | 'loan_repaid' | 'early_unstake' | 'engagement_milestone' | 'package_upgrade' | 'partner_created';
  title: string;
  description: string;
  timestamp: Date;
  value?: string;
  badge?: string;
  icon: 'star' | 'zap' | 'coin' | 'users' | 'gift' | 'trending' | 'plus' | 'minus' | 'lock' | 'unlock' | 'fire' | 'trophy' | 'upgrade' | 'handshake';
  txDigest?: string;
  userAddress?: string;
  isUserActivity?: boolean;
}

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityItem[];
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
    ),
    fire: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
    ),
    trophy: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    upgrade: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
    handshake: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  };
  return icons[icon] || icons.star;
};

const getColorClasses = (type: ActivityItem['type'], isUserActivity?: boolean) => {
  // User activities get special highlight treatment
  if (isUserActivity) {
    return 'bg-blue-500/10 border-blue-500/30 text-blue-400 ring-1 ring-blue-500/20';
  }

  const colors = {
    perk_created: 'bg-purple-500/5 border-purple-500/20 text-purple-400',
    perk_claimed: 'bg-pink-500/5 border-pink-500/20 text-pink-400',
    points_earned: 'bg-green-500/5 border-green-500/20 text-green-400',
    points_spent: 'bg-red-500/5 border-red-500/20 text-red-400',
    points_locked: 'bg-orange-500/5 border-orange-500/20 text-orange-400',
    points_unlocked: 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400',
    stake_created: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400',
    stake_unlocked: 'bg-teal-500/5 border-teal-500/20 text-teal-400',
    loan_created: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400',
    loan_repaid: 'bg-lime-500/5 border-lime-500/20 text-lime-400',
    early_unstake: 'bg-amber-500/5 border-amber-500/20 text-amber-400',
    engagement_milestone: 'bg-violet-500/5 border-violet-500/20 text-violet-400',
    package_upgrade: 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400',
    partner_created: 'bg-rose-500/5 border-rose-500/20 text-rose-400'
  };
  return colors[type] || colors.points_earned;
};

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  isOpen,
  onClose,
  activities
}) => {
  const [selectedEventType, setSelectedEventType] = useState('all');

  const eventTypes = [
    { id: 'all', label: 'All Events', icon: '🌟' },
    { id: 'points_earned', label: 'Points Earned', icon: '+' },
    { id: 'points_spent', label: 'Points Spent', icon: '-' },
    { id: 'stake_created', label: 'Staking', icon: '📈' },
    { id: 'loan_created', label: 'Loans', icon: '💰' },
    { id: 'early_unstake', label: 'Early Unstake', icon: '⚡' },
    { id: 'perk_claimed', label: 'Perks', icon: '🎁' },
    { id: 'engagement_milestone', label: 'Achievements', icon: '🏆' }
  ];

  const getFilteredActivities = () => {
    if (selectedEventType === 'all') return activities;
    return activities.filter(activity => activity.type === selectedEventType);
  };

  const filteredActivities = getFilteredActivities();

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div>
            <h2 className="text-xl font-semibold text-white">All Activity</h2>
            <p className="text-sm text-gray-400 mt-1">
              {filteredActivities.length} {filteredActivities.length === 1 ? 'event' : 'events'} found
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-white transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
            {eventTypes.map((eventType) => (
              <button
                key={eventType.id}
                onClick={() => setSelectedEventType(eventType.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all duration-200 ${
                  selectedEventType === eventType.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-700/30 text-gray-400 hover:bg-gray-600/30 hover:text-gray-300'
                }`}
              >
                <span className="text-sm">{eventType.icon}</span>
                <span className="text-sm font-medium">{eventType.label}</span>
                {eventType.id === selectedEventType && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                    {filteredActivities.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] scrollbar-thin">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-600/20 rounded-lg mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h8m-8 0V9m0 4v6a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2h-2m0 0V5a2 2 0 00-2-2H9z" />
                </svg>
              </div>
              <p className="text-gray-400 font-medium">No events found</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedEventType === 'all' 
                  ? 'No recent activity to display' 
                  : `No ${eventTypes.find(et => et.id === selectedEventType)?.label.toLowerCase()} events found`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActivities.map((activity) => {
                const colorClasses = getColorClasses(activity.type, activity.isUserActivity);
                
                return (
                  <div key={activity.id} className={`flex items-center space-x-4 p-4 ${colorClasses} rounded-lg border transition-all hover:scale-[1.01]`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activity.isUserActivity ? 'bg-blue-500/20' : 'bg-gray-600/20'}`}>
                      {getIconSvg(activity.icon, `w-4 h-4 ${activity.isUserActivity ? 'text-blue-400' : 'text-gray-300'}`)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-1">
                        <p className={`text-base font-medium ${activity.isUserActivity ? 'text-blue-300' : 'text-white'}`}>
                          {activity.title}
                        </p>
                        {activity.isUserActivity && (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">You</span>
                        )}
                        {activity.badge && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-600/20 text-gray-300">
                            {activity.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{activity.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatTimeAgo(activity.timestamp)}</span>
                        {activity.txDigest && (
                          <a 
                            href={`https://suiscan.xyz/testnet/tx/${activity.txDigest}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-mono"
                            title="View on Suiscan"
                          >
                            {activity.txDigest.slice(0, 8)}...
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {activity.value && (
                      <div className="text-right">
                        <span className="text-lg font-semibold text-white">{activity.value}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}; 