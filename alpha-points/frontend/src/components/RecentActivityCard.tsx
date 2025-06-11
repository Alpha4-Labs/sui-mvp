import React, { useState, useEffect, useCallback } from 'react';
import { useAlphaContext } from '../context/AlphaContext';
import { TransactionHistoryModal } from './TransactionHistoryModal';

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
  isUserActivity?: boolean; // True if this activity belongs to the current user
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

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const formatPoints = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

const shortenAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const RecentActivityCard: React.FC = () => {
  const { address, suiClient, isConnected } = useAlphaContext();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);

  // Helper function to create unique activity ID based on transaction digest
  const createUniqueId = (eventType: string, event: any): string => {
    const eventSeq = event.id?.eventSeq;
    const txDigest = event.id?.txDigest;
    const timestamp = event.timestampMs || Date.now();
    
    // Use transaction digest as primary identifier to prevent duplicates
    if (txDigest) {
      return `${eventType}-${txDigest}`;
    }
    
    // Fallback for events without digest - use eventSeq if available
    if (eventSeq) {
      return `${eventType}-seq-${eventSeq}`;
    }
    
    // Final fallback
    return `${eventType}-${timestamp}-${Math.random().toString(36).substr(2, 5)}`;
  };

  // Helper function to validate activity data
  const isValidActivity = (activity: ActivityItem): boolean => {
    // Basic validation - must have title and description
    if (!activity.title || !activity.description) {
      return false;
    }
    
    // For activities with values (points), ensure they're not "0 αP" or similar invalid values
    if (activity.value) {
      // Check for "0 αP", "+0 αP", "-0 αP" patterns
      if (activity.value.match(/^[+-]?0(\.\d+)?\s*αP$/)) {
        return false;
      }
    }
    
    // For early unstake activities, ensure they have meaningful data
    if (activity.type === 'early_unstake') {
      // Reject if description contains "0.00 SUI" or "0 αP"
      if (activity.description.includes('0.00 SUI') || activity.description.includes('0 αP')) {
        return false;
      }
    }
    
    // For loan activities, ensure amount is meaningful
    if ((activity.type === 'loan_created' || activity.type === 'loan_repaid') && 
        activity.description.includes('0.00 SUI')) {
      return false;
    }
    
    // For points activities, ensure non-zero amounts
    if (['points_earned', 'points_spent', 'points_locked', 'points_unlocked'].includes(activity.type)) {
      if (activity.description.includes('0 αP')) {
        return false;
      }
    }
    
    return true;
  };

  // Query on-chain events for recent Alpha Points activities
  const fetchRecentEvents = useCallback(async () => {
    if (!suiClient) return;

    setIsLoading(true);
    const packageId = import.meta.env['VITE_PACKAGE_ID'];
    
    if (!packageId) {
      console.warn('Package ID not configured, cannot fetch events');
      setIsLoading(false);
      return;
    }

    try {
      // Query multiple event types in parallel
      const eventQueries = await Promise.allSettled([
        // Ledger events
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::ledger::Earned` },
          order: 'descending',
          limit: 20
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::ledger::Spent` },
          order: 'descending',
          limit: 20
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::ledger::Locked` },
          order: 'descending',
          limit: 10
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::ledger::Unlocked` },
          order: 'descending',
          limit: 10
        }),

        // Integration events (staking)
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::integration::StakeDeposited` },
          order: 'descending',
          limit: 15
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::integration::StakeWithdrawn` },
          order: 'descending',
          limit: 10
        }),

        // Loan events
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::loan::LoanOpened` },
          order: 'descending',
          limit: 10
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::loan::LoanRepaid` },
          order: 'descending',
          limit: 10
        }),

        // Early unstake events
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::integration::EarlyUnstakeForAlphaPoints` },
          order: 'descending',
          limit: 10
        }),

        // Perk events
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::perk::PerkDefinitionCreated` },
          order: 'descending',
          limit: 15
        }),
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::perk::PerkClaimed` },
          order: 'descending',
          limit: 20
        }),

        // Partner events
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::partner::PartnerCapFlexCreated` },
          order: 'descending',
          limit: 10
        }),

        // Engagement events
        suiClient.queryEvents({
          query: { MoveEventType: `${packageId}::engagement::EngagementMilestone` },
          order: 'descending',
          limit: 15
        })
      ]);

      const allActivities: ActivityItem[] = [];
      const seenIds = new Set<string>(); // Track seen activity IDs to prevent duplicates

      // Process each event type
      eventQueries.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.data) {
          const events = result.value.data;
          
          events.forEach((event: any) => {
            const eventData = event.parsedJson;
            const timestamp = new Date(parseInt(event.timestampMs) || Date.now());
            const txDigest = event.id?.txDigest;
            const isUserActivity = eventData?.user === address || eventData?.staker === address || eventData?.borrower === address;

            let activity: ActivityItem | null = null;

            switch (index) {
              case 0: // Earned events
                const earnedAmount = eventData?.amount;
                if (earnedAmount && earnedAmount > 0) {
                  activity = {
                    id: createUniqueId('earned', event),
                    type: 'points_earned',
                    title: isUserActivity ? 'You Earned Alpha Points' : 'Alpha Points Earned',
                    description: isUserActivity 
                      ? `Earned ${formatPoints(earnedAmount)} αP`
                      : `${shortenAddress(eventData?.user || '')} earned ${formatPoints(earnedAmount)} αP`,
                    timestamp,
                    value: `+${formatPoints(earnedAmount)} αP`,
                    icon: 'plus',
                    txDigest,
                    userAddress: eventData?.user,
                    isUserActivity
                  };
                }
                break;

              case 1: // Spent events
                const spentAmount = eventData?.amount;
                if (spentAmount && spentAmount > 0) {
                  activity = {
                    id: createUniqueId('spent', event),
                    type: 'points_spent',
                    title: isUserActivity ? 'You Spent Alpha Points' : 'Alpha Points Spent',
                    description: isUserActivity
                      ? `Spent ${formatPoints(spentAmount)} αP`
                      : `${shortenAddress(eventData?.user || '')} spent ${formatPoints(spentAmount)} αP`,
                    timestamp,
                    value: `-${formatPoints(spentAmount)} αP`,
                    icon: 'minus',
                    txDigest,
                    userAddress: eventData?.user,
                    isUserActivity
                  };
                }
                break;

              case 2: // Locked events
                activity = {
                  id: createUniqueId('locked', event),
                  type: 'points_locked',
                  title: isUserActivity ? 'You Locked Alpha Points' : 'Alpha Points Locked',
                  description: isUserActivity
                    ? `Locked ${formatPoints(eventData?.amount || 0)} αP`
                    : `${shortenAddress(eventData?.user || '')} locked ${formatPoints(eventData?.amount || 0)} αP`,
                  timestamp,
                  value: `🔒 ${formatPoints(eventData?.amount || 0)} αP`,
                  icon: 'lock',
                  txDigest,
                  userAddress: eventData?.user,
                  isUserActivity
                };
                break;

              case 3: // Unlocked events  
                activity = {
                  id: createUniqueId('unlocked', event),
                  type: 'points_unlocked',
                  title: isUserActivity ? 'You Unlocked Alpha Points' : 'Alpha Points Unlocked',
                  description: isUserActivity
                    ? `Unlocked ${formatPoints(eventData?.amount || 0)} αP`
                    : `${shortenAddress(eventData?.user || '')} unlocked ${formatPoints(eventData?.amount || 0)} αP`,
                  timestamp,
                  value: `🔓 ${formatPoints(eventData?.amount || 0)} αP`,
                  icon: 'unlock',
                  txDigest,
                  userAddress: eventData?.user,
                  isUserActivity
                };
                break;

              case 4: // Stake deposited
                activity = {
                  id: createUniqueId('stake', event),
                  type: 'stake_created',
                  title: isUserActivity ? 'You Created a Stake Position' : 'New Stake Position',
                  description: isUserActivity
                    ? `Staked ${((eventData?.principal || 0) / 1_000_000_000).toFixed(2)} SUI`
                    : `${shortenAddress(eventData?.staker || '')} staked ${((eventData?.principal || 0) / 1_000_000_000).toFixed(2)} SUI`,
                  timestamp,
                  badge: `${eventData?.duration_days || 0}d`,
                  icon: 'trending',
                  txDigest,
                  userAddress: eventData?.staker,
                  isUserActivity
                };
                break;

              case 5: // Stake withdrawn
                activity = {
                  id: createUniqueId('unstake', event),
                  type: 'stake_unlocked',
                  title: isUserActivity ? 'You Withdrew Stake' : 'Stake Withdrawn',
                  description: isUserActivity
                    ? 'Withdrew matured stake position'
                    : `${shortenAddress(eventData?.staker || '')} withdrew stake`,
                  timestamp,
                  icon: 'unlock',
                  txDigest,
                  userAddress: eventData?.staker,
                  isUserActivity
                };
                break;

              case 6: // Loan opened
                activity = {
                  id: createUniqueId('loan', event),
                  type: 'loan_created',
                  title: isUserActivity ? 'You Created a Loan' : 'New Loan Created',
                  description: isUserActivity
                    ? `Borrowed ${formatPoints(eventData?.principal_points || 0)} αP`
                    : `${shortenAddress(eventData?.borrower || '')} borrowed ${formatPoints(eventData?.principal_points || 0)} αP`,
                  timestamp,
                  value: `💰 ${formatPoints(eventData?.principal_points || 0)} αP`,
                  icon: 'coin',
                  txDigest,
                  userAddress: eventData?.borrower,
                  isUserActivity
                };
                break;

              case 7: // Loan repaid
                activity = {
                  id: createUniqueId('repay', event),
                  type: 'loan_repaid',
                  title: isUserActivity ? 'You Repaid a Loan' : 'Loan Repaid',
                  description: isUserActivity
                    ? `Repaid ${formatPoints(eventData?.total_paid_points || 0)} αP`
                    : `${shortenAddress(eventData?.borrower || '')} repaid ${formatPoints(eventData?.total_paid_points || 0)} αP`,
                  timestamp,
                  value: `-${formatPoints(eventData?.total_paid_points || 0)} αP`,
                  icon: 'unlock',
                  txDigest,
                  userAddress: eventData?.borrower,
                  isUserActivity
                };
                break;

              case 8: // Early unstake for Alpha Points
                // Only process if we have valid data
                const alphaPointsAwarded = eventData?.alpha_points_awarded;
                const principal = eventData?.principal;
                
                if (alphaPointsAwarded && principal && alphaPointsAwarded > 0 && principal > 0) {
                  activity = {
                    id: createUniqueId('early-unstake', event),
                    type: 'early_unstake',
                    title: isUserActivity ? 'You Early Unstaked for αP' : 'Early Unstake for αP',
                    description: isUserActivity
                      ? `Received ${formatPoints(alphaPointsAwarded)} αP for ${(principal / 1_000_000_000).toFixed(2)} SUI`
                      : `${shortenAddress(eventData?.staker || '')} early unstaked for αP`,
                    timestamp,
                    value: `+${formatPoints(alphaPointsAwarded)} αP`,
                    badge: 'Early',
                    icon: 'zap',
                    txDigest,
                    userAddress: eventData?.staker,
                    isUserActivity
                  };
                }
                break;

              case 9: // Perk created
                activity = {
                  id: createUniqueId('perk-created', event),
                  type: 'perk_created',
                  title: 'New Perk Available',
                  description: `"${eventData?.name || 'New Perk'}" added to store`,
                  timestamp,
                  badge: 'New',
                  icon: 'gift',
                  txDigest
                };
                break;

              case 10: // Perk claimed
                activity = {
                  id: createUniqueId('perk-claim', event),
                  type: 'perk_claimed',
                  title: isUserActivity ? 'You Claimed a Perk' : 'Perk Claimed',
                  description: isUserActivity
                    ? `Claimed "${eventData?.perk_name || 'perk'}"`
                    : `${shortenAddress(eventData?.claimer || '')} claimed a perk`,
                  timestamp,
                  icon: 'gift',
                  txDigest,
                  userAddress: eventData?.claimer,
                  isUserActivity
                };
                break;

              case 11: // Partner created
                activity = {
                  id: createUniqueId('partner', event),
                  type: 'partner_created',
                  title: 'New Partner Joined',
                  description: `${eventData?.partner_name || 'New Partner'} joined Alpha Points`,
                  timestamp,
                  badge: 'Partner',
                  icon: 'handshake',
                  txDigest
                };
                break;

              case 12: // Engagement milestone
                activity = {
                  id: createUniqueId('milestone', event),
                  type: 'engagement_milestone',
                  title: isUserActivity ? 'You Earned an Achievement!' : 'Achievement Unlocked',
                  description: isUserActivity
                    ? `Unlocked "${eventData?.milestone_type || 'achievement'}"`
                    : `${shortenAddress(eventData?.user || '')} unlocked an achievement`,
                  timestamp,
                  badge: `${eventData?.streak_length || 0} streak`,
                  icon: 'trophy',
                  txDigest,
                  userAddress: eventData?.user,
                  isUserActivity
                };
                break;
            }

            // Add to activities if we created one, haven't seen this ID before, and has valid data
            if (activity && !seenIds.has(activity.id) && isValidActivity(activity)) {
              seenIds.add(activity.id);
              allActivities.push(activity);
            } else if (activity && seenIds.has(activity.id)) {
              console.log(`🔄 Skipped duplicate activity: ${activity.id}`);
            }
          });
        }
      });

      // Sort by timestamp (newest first)
      allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Keep only the most recent 50 activities
      setActivities(allActivities.slice(0, 50));
      
      if (allActivities.length > 0) {
        console.log(`✅ Processed ${allActivities.length} valid activities, displaying ${Math.min(4, allActivities.length)}`);
      }
      setLastRefresh(Date.now());
        
    } catch (error) {
      console.error('Error fetching recent events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [suiClient, address]);

  // Refresh function for manual refresh
  const handleRefresh = () => {
    fetchRecentEvents();
  };

  // Initial load and periodic refresh
  useEffect(() => {
    fetchRecentEvents();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRecentEvents, 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchRecentEvents]);

  // Get the first 4 activities for display
  const displayedActivities = activities.slice(0, 4);
  const hasMoreActivities = activities.length > 4;

  return (
    <div className="card-modern p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-white">Recent Activity</h3>
        <div className="flex items-center space-x-2">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors disabled:opacity-50"
            title="Refresh events"
          >
            <svg 
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Status Indicator */}
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
          <span className={`text-xs ${isLoading ? 'text-yellow-400' : 'text-green-400'}`}>
            {isLoading ? 'Loading' : 'Live'}
          </span>

          {/* Last Refresh Time */}
          {lastRefresh > 0 && (
            <span className="text-xs text-gray-500">
              {formatTimeAgo(new Date(lastRefresh))}
            </span>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        {isLoading && displayedActivities.length === 0 ? (
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
        ) : displayedActivities.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-6 h-6 bg-gray-600 rounded-md mx-auto mb-2 flex items-center justify-center">
              {getIconSvg('zap', 'w-3 h-3 text-gray-400')}
            </div>
            <p className="text-sm text-gray-400">No recent activity</p>
            <p className="text-xs text-gray-500">On-chain events will appear here</p>
          </div>
        ) : (
          displayedActivities.map((activity) => {
            const colorClasses = getColorClasses(activity.type, activity.isUserActivity);
            
            return (
              <div key={activity.id} className={`flex items-center space-x-3 p-2 ${colorClasses} rounded-lg transition-all hover:scale-[1.02]`}>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${activity.isUserActivity ? 'bg-blue-500/20' : 'bg-gray-600/20'}`}>
                  {getIconSvg(activity.icon, `w-3 h-3 ${activity.isUserActivity ? 'text-blue-400' : 'text-gray-300'}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className={`text-sm font-medium truncate ${activity.isUserActivity ? 'text-blue-300' : 'text-white'}`}>
                      {activity.title}
                    </p>
                    {activity.isUserActivity && (
                      <span className="text-xs px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">You</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{activity.description} • {formatTimeAgo(activity.timestamp)}</p>
                </div>
                {activity.value && (
                  <span className="text-sm font-semibold text-white">{activity.value}</span>
                )}
                {activity.badge && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-600/20 text-gray-300">
                    {activity.badge}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Show "View All" button if there are more than 4 activities */}
      {hasMoreActivities && (
        <div className="mt-3 text-center">
          <button 
            onClick={() => setShowTransactionModal(true)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            View All Events ({activities.length})
          </button>
        </div>
      )}

      {/* Transaction History Modal */}
      <TransactionHistoryModal 
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        activities={activities}
      />
    </div>
  );
}; 