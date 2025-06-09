import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlphaContext } from '../context/AlphaContext';
import ProjectionChart from '../components/ProjectionChart';
import { formatPoints, formatSui, formatAddress, formatTimeAgo } from '../utils/format';

export const AnalyticsPage: React.FC = () => {
  const alphaContext = useAlphaContext();
  const navigate = useNavigate();
  
  // Redirect to welcome page if not connected
  useEffect(() => {
    if (alphaContext.authLoading) return;
    if (!alphaContext.isConnected) {
      navigate('/'); 
    }
  }, [alphaContext.isConnected, alphaContext.authLoading, navigate]);

  // Mock data for additional analytics
  const [lifetimeStats, setLifetimeStats] = useState({
    totalPointsEarned: 2_450_890,
    totalPointsSpent: 426_653,
    totalStakingRewards: 1_824_237,
    firstStakeDate: new Date('2024-01-15'),
    totalStakingDays: 95,
    averageDailyEarnings: 19_213,
    highestSingleReward: 45_680,
    totalTransactions: 127,
    perksRedeemed: 8,
    referralEarnings: 156_420
  });

  const [recentActivity, setRecentActivity] = useState([
    { id: 1, type: 'earned', amount: 12_430, description: 'Staking rewards', timestamp: Date.now() - 3600000 },
    { id: 2, type: 'spent', amount: 8_500, description: 'Marketplace redemption', timestamp: Date.now() - 7200000 },
    { id: 3, type: 'earned', amount: 25_000, description: 'Referral bonus', timestamp: Date.now() - 14400000 },
    { id: 4, type: 'earned', amount: 9_870, description: 'Staking rewards', timestamp: Date.now() - 28800000 },
    { id: 5, type: 'spent', amount: 15_000, description: 'Perk redemption', timestamp: Date.now() - 86400000 }
  ]);

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState('all');

  // Query real transaction data
  const [transactionData, setTransactionData] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const suiClient = alphaContext.suiClient;

  const queryTransactionsByType = useCallback(async (eventType: string) => {
    if (!alphaContext.address || !suiClient?.queryEvents) {
      return [];
    }

    setLoadingTransactions(true);
    try {
      const transactions: any[] = [];

      if (eventType === 'all' || eventType === 'staking') {
        // Query staking-related events
        try {
          const stakingEvents = await suiClient.queryEvents({
            query: { MoveEventType: `alpha_points::integration::StakeDeposited` },
            order: 'descending',
            limit: 50
          });

          stakingEvents.data?.forEach((event: any, index: number) => {
            if (event.parsedJson && event.parsedJson.staker === alphaContext.address) {
              const amount = parseInt(event.parsedJson.amount_staked || '0') / 1_000_000_000;
              const alphaPointsEarned = amount * 3280; // SUI to Alpha Points conversion
              transactions.push({
                id: `stake-${event.id || index}`,
                type: 'staking',
                subtype: 'deposit',
                amount: alphaPointsEarned,
                description: `Staked ${amount.toFixed(2)} SUI`,
                timestamp: parseInt(event.timestampMs || Date.now().toString()),
                txHash: event.digest || 'N/A',
                status: 'completed'
              });
            }
          });
        } catch (error) {
          console.warn('Error querying staking events:', error);
        }
      }

      if (eventType === 'all' || eventType === 'marketplace') {
        // Query marketplace transactions (Alpha Points spent)
        try {
          const spendEvents = await suiClient.queryEvents({
            query: { MoveEventType: `alpha_points::ledger::Spent` },
            order: 'descending',
            limit: 50
          });

          spendEvents.data?.forEach((event: any, index: number) => {
            if (event.parsedJson && event.parsedJson.user === alphaContext.address) {
              transactions.push({
                id: `spend-${event.id || index}`,
                type: 'marketplace',
                subtype: 'purchase',
                amount: -parseInt(event.parsedJson.amount || '0'),
                description: 'Marketplace purchase',
                timestamp: parseInt(event.timestampMs || Date.now().toString()),
                txHash: event.digest || 'N/A',
                status: 'completed'
              });
            }
          });
        } catch (error) {
          console.warn('Error querying spend events:', error);
        }
      }

      if (eventType === 'all' || eventType === 'perks') {
        // Currently no perk events in the system - show empty state
      }

      if (eventType === 'loans') {
        // Query loan-related transactions
        alphaContext.loans?.forEach((loan, index) => {
          transactions.push({
            id: `loan-${loan.id || index}`,
            type: 'loans',
            subtype: loan.isRepaid ? 'repayment' : 'borrow',
            amount: loan.isRepaid ? -parseInt(loan.amount) : parseInt(loan.amount),
            description: loan.isRepaid ? 'Loan repayment' : 'Loan borrowed',
            timestamp: loan.timestamp || Date.now(),
            txHash: loan.txHash || 'N/A',
            status: loan.isRepaid ? 'completed' : 'active'
          });
        });
      }

      if (eventType === 'revenue') {
        // Query revenue/earnings events
        try {
          const earnedEvents = await suiClient.queryEvents({
            query: { MoveEventType: `alpha_points::ledger::Earned` },
            order: 'descending',
            limit: 50
          });

          earnedEvents.data?.forEach((event: any, index: number) => {
            if (event.parsedJson && event.parsedJson.user === alphaContext.address) {
              transactions.push({
                id: `earn-${event.id || index}`,
                type: 'revenue',
                subtype: 'staking_reward',
                amount: parseInt(event.parsedJson.amount || '0'),
                description: 'Staking rewards earned',
                timestamp: parseInt(event.timestampMs || Date.now().toString()),
                txHash: event.digest || 'N/A',
                status: 'completed'
              });
            }
          });
        } catch (error) {
          console.warn('Error querying earned events:', error);
        }
      }

      // Add stake positions as transaction history
      if (eventType === 'all' || eventType === 'staking') {
        alphaContext.stakePositions?.forEach((position, index) => {
          const principal = parseFloat(position.principal || '0') / 1_000_000_000;
          if (principal > 0) {
            transactions.push({
              id: `position-${position.id || index}`,
              type: 'staking',
              subtype: 'active_stake',
              amount: principal * 3280, // Convert to Alpha Points equivalent
              description: `Active stake: ${principal.toFixed(2)} SUI`,
              timestamp: position.createdAt ? new Date(position.createdAt).getTime() : Date.now(),
              txHash: position.stakedSuiObjectId || 'N/A',
              status: position.status || 'active'
            });
          }
        });
      }

      return transactions.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error querying transactions:', error);
      return [];
    } finally {
      setLoadingTransactions(false);
    }
  }, [alphaContext.address, alphaContext.stakePositions, alphaContext.loans, suiClient]);

  const allTransactions = transactionData;

  const eventTypes = [
    { id: 'all', label: 'All Transactions', icon: 'M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h8m-8 0V9m0 4v6a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2h-2m0 0V5a2 2 0 00-2-2H9z', color: 'text-white' },
    { id: 'staking', label: 'Staking', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', color: 'text-emerald-400' },
    { id: 'marketplace', label: 'Marketplace', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z', color: 'text-blue-400' },
    { id: 'perks', label: 'Perks', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', color: 'text-purple-400' },
    { id: 'referral', label: 'Referrals', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', color: 'text-pink-400', isConstructing: true },
    { id: 'revenue', label: 'Revenue', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1', color: 'text-amber-400' },
    { id: 'loans', label: 'Loans', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'text-cyan-400' }
  ];

  const getFilteredTransactions = () => {
    if (selectedEventType === 'all') return allTransactions;
    return allTransactions.filter(tx => tx.type === selectedEventType);
  };

  const getTransactionIcon = (transaction: any) => {
    const eventType = eventTypes.find(et => et.id === transaction.type);
    return eventType ? eventType.icon : eventTypes[0].icon;
  };

  const getTransactionColor = (transaction: any) => {
    if (transaction.amount > 0) return 'text-emerald-400';
    return 'text-red-400';
  };

  // Load transactions when modal opens or event type changes
  useEffect(() => {
    if (showActivityModal) {
      queryTransactionsByType(selectedEventType).then(setTransactionData);
    }
  }, [showActivityModal, selectedEventType, queryTransactionsByType]);

  // Banner layout - no state needed
  
  const statsCards = [
    {
      gradient: 'bg-gradient-to-r from-emerald-500 to-green-600',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      value: formatPoints(lifetimeStats.totalPointsEarned),
      label: 'Total Points Earned',
      subtitle: `Avg: ${formatPoints(lifetimeStats.averageDailyEarnings)}/day`,
      accentColor: 'text-emerald-400'
    },
    {
      gradient: 'bg-gradient-to-r from-blue-500 to-cyan-600',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1',
      value: formatPoints(lifetimeStats.totalPointsSpent),
      label: 'Total Points Spent',
      subtitle: `${lifetimeStats.perksRedeemed} perks redeemed`,
      accentColor: 'text-blue-400'
    },
    {
      gradient: 'bg-gradient-to-r from-purple-500 to-pink-600',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      value: lifetimeStats.totalStakingDays.toString(),
      label: 'Days Staking',
      subtitle: `Since ${lifetimeStats.firstStakeDate.toLocaleDateString()}`,
      accentColor: 'text-purple-400'
    },
    {
      gradient: 'bg-gradient-to-r from-amber-500 to-orange-600',
      icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
      value: formatPoints(lifetimeStats.highestSingleReward),
      label: 'Highest Single Reward',
      subtitle: 'Personal best αP',
      accentColor: 'text-amber-400'
    },
    {
      gradient: 'bg-gradient-to-r from-pink-500 to-rose-600',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      value: formatPoints(lifetimeStats.referralEarnings),
      label: 'Referral Earnings',
      subtitle: '12 active referrals',
      accentColor: 'text-pink-400',
      badge: 'Active',
      badgeColor: 'bg-pink-500/20 text-pink-400'
    },
    {
      gradient: 'bg-gradient-to-r from-yellow-500 to-amber-600',
      icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
      value: '#247',
      label: 'Platform Rank',
      subtitle: '↑ 12 this week',
      accentColor: 'text-amber-400',
      badge: 'Top 5%',
      badgeColor: 'bg-amber-500/20 text-amber-400'
    },
    {
      gradient: 'bg-gradient-to-r from-cyan-500 to-blue-600',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      value: '94.2%',
      label: 'Efficiency Score',
      subtitle: '+2.1% this month',
      accentColor: 'text-cyan-400',
      badge: 'Excellent',
      badgeColor: 'bg-cyan-500/20 text-cyan-400'
    },
    {
      gradient: 'bg-gradient-to-r from-indigo-500 to-violet-600',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      value: formatPoints(lifetimeStats.totalTransactions),
      label: 'Total Transactions',
      subtitle: `${Math.round(lifetimeStats.totalTransactions / lifetimeStats.totalStakingDays * 7)} per week`,
      accentColor: 'text-indigo-400',
      badge: 'Active',
      badgeColor: 'bg-indigo-500/20 text-indigo-400'
    },
    {
      gradient: 'bg-gradient-to-r from-emerald-500 to-teal-600',
      icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      value: '+287%',
      label: 'Portfolio Growth',
      subtitle: 'Last 90 days',
      accentColor: 'text-emerald-400',
      badge: 'Growing',
      badgeColor: 'bg-emerald-500/20 text-emerald-400'
    }
  ];

  // No longer needed for banner layout

  if (alphaContext.authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text">
            Analytics Dashboard
          </span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Comprehensive insights into your Alpha Points journey and platform engagement
        </p>
      </div>

      {/* Stats Banner - Full Width */}
      <div className="mb-6 animate-slide-up">
        <div className="card-modern p-1 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-white/20 w-full">
          <div className="grid grid-cols-9 gap-1.5 p-1 w-full">
            {statsCards.map((card, index) => (
              <div key={index} className="card-modern p-2.5 bg-gradient-to-br from-black/40 to-black/20 border border-white/10 hover:border-white/20 transition-all duration-300 group min-w-0 flex-1">
                <div className="flex flex-col h-full items-center text-center">
                                      <div className="flex items-center justify-center space-x-1.5 mb-1 w-full">
                      <div className={`w-7 h-7 ${card.gradient} rounded-md flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={card.icon} />
                      </svg>
                    </div>
                    {card.badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 font-medium ${card.badgeColor} ml-auto`}>
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                    <div className="text-base font-bold text-white bg-gradient-to-r from-white to-gray-300 bg-clip-text truncate w-full text-center">
                      {card.value}
                    </div>
                    <div className="text-sm text-gray-400 font-medium leading-tight truncate w-full text-center">{card.label}</div>
                    <div className={`text-sm ${card.accentColor} font-medium leading-tight truncate w-full text-center`}>
                      {card.subtitle}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Portfolio Projection Chart - Takes up 2 columns */}
        <div className="xl:col-span-2 animate-slide-up animation-delay-400">
          <ProjectionChart />
        </div>

        {/* Recent Activity */}
        <div className="animate-slide-up animation-delay-500">
          <div className="card-modern p-3 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Recent Activity</h3>
                  <p className="text-xs text-gray-400">Latest transactions</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-2 bg-black/20 backdrop-blur-lg border border-white/10 rounded-lg hover:bg-black/30 transition-all duration-300">
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                      activity.type === 'earned' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {activity.type === 'earned' ? '+' : '-'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {activity.type === 'earned' ? '+' : '-'}{formatPoints(activity.amount)} αP
                      </div>
                      <div className="text-xs text-gray-400">{activity.description}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 flex-shrink-0">
              <button 
                onClick={() => setShowActivityModal(true)}
                className="w-full btn-modern-secondary text-sm font-medium"
              >
                View All Transactions
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity History Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-modern p-6 max-w-4xl w-full max-h-[80vh] animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white">Transaction History</h3>
              </div>
              <button
                onClick={() => setShowActivityModal(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors duration-300 rounded-lg hover:bg-white/10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Event Type Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 p-1 bg-black/20 rounded-lg">
              {eventTypes.map((eventType) => (
                <button
                  key={eventType.id}
                  onClick={() => setSelectedEventType(eventType.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    selectedEventType === eventType.id
                      ? 'bg-white/10 border border-white/20 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg className={`w-4 h-4 ${eventType.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={eventType.icon} />
                  </svg>
                  <span>{eventType.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedEventType === eventType.id ? 'bg-white/20' : 'bg-black/20'
                  }`}>
                    {eventType.isConstructing ? '🚧' : 
                     eventType.id === 'all' ? allTransactions.length : allTransactions.filter(tx => tx.type === eventType.id).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Transaction List */}
            <div className="bg-black/10 backdrop-blur-lg border border-white/10 rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                {loadingTransactions ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <div className="text-gray-400">Loading transactions...</div>
                  </div>
                ) : selectedEventType === 'referral' ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-amber-400 font-semibold mb-2">🚧 Under Construction</div>
                    <div className="text-sm text-gray-500">Referral system is being built and will be available soon!</div>
                  </div>
                ) : getFilteredTransactions().length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-gray-400 mb-2">No transactions found</div>
                    <div className="text-sm text-gray-500">
                      {selectedEventType === 'all' 
                        ? 'No transaction history available yet' 
                        : `No ${selectedEventType} transactions found`}
                    </div>
                  </div>
                ) : (
                  getFilteredTransactions().map((transaction, index) => (
                  <div 
                    key={transaction.id} 
                    className={`flex items-center justify-between p-4 transition-all duration-300 hover:bg-white/5 ${
                      index !== getFilteredTransactions().length - 1 ? 'border-b border-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        transaction.amount > 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                      }`}>
                        <svg className={`w-5 h-5 ${getTransactionColor(transaction)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getTransactionIcon(transaction)} />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <div className={`text-sm font-semibold ${getTransactionColor(transaction)}`}>
                            {transaction.amount > 0 ? '+' : ''}{formatPoints(Math.abs(transaction.amount))} αP
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            transaction.status === 'completed' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {transaction.status}
                          </span>
                        </div>
                        <div className="text-white font-medium">{transaction.description}</div>
                        <div className="text-xs text-gray-400 font-mono">{transaction.txHash}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {formatTimeAgo(transaction.timestamp)}
                      </div>
                      <div className="text-xs text-gray-400 capitalize">
                        {transaction.subtype}
                      </div>
                                         </div>
                   </div>
                   ))
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
              <div className="text-sm text-gray-400">
                Showing {getFilteredTransactions().length} transactions
              </div>
              <button
                onClick={() => setShowActivityModal(false)}
                className="btn-modern-primary text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage; 