import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSuiClient } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatPoints, formatTimeAgo } from '../utils/format';

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  isOpen,
  onClose
}) => {
  const { address, stakePositions, loans } = useAlphaContext();
  const suiClient = useSuiClient();
  const [transactionData, setTransactionData] = useState<any[]>([]);
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Query real transaction data
  const queryTransactionsByType = useCallback(async (eventType: string) => {
    if (!address || !suiClient) return [];
    
    setLoadingTransactions(true);
    try {
      const transactions: any[] = [];

      if (eventType === 'all' || eventType === 'marketplace') {
        // Query marketplace transactions (Alpha Points spent)
        try {
          const spendEvents = await suiClient.queryEvents({
            query: { MoveEventType: `alpha_points::ledger::Spent` },
            order: 'descending',
            limit: 50
          });

          spendEvents.data?.forEach((event: any, index: number) => {
            if (event.parsedJson && event.parsedJson.user === address) {
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
        loans?.forEach((loan, index) => {
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
            if (event.parsedJson && event.parsedJson.user === address) {
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
        stakePositions?.forEach((position, index) => {
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
  }, [address, stakePositions, loans, suiClient]);

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
    if (selectedEventType === 'all') return transactionData;
    return transactionData.filter(tx => tx.type === selectedEventType);
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
    if (isOpen) {
      queryTransactionsByType(selectedEventType).then(setTransactionData);
    }
  }, [isOpen, selectedEventType, queryTransactionsByType]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" 
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div 
        className="card-modern p-6 max-w-4xl w-full max-h-[80vh] animate-fade-in" 
        onClick={(e) => e.stopPropagation()}
      >
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
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors duration-300 rounded-lg hover:bg-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Event Type Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl">
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
                 eventType.id === 'all' ? transactionData.length : transactionData.filter(tx => tx.type === eventType.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl">
          <div className="max-h-96 overflow-y-auto">
            {loadingTransactions ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <div className="text-gray-400">Loading transactions...</div>
              </div>
            ) : selectedEventType === 'referral' ? (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">🚧</div>
                <div className="text-gray-400 mb-2">Under Construction</div>
                <div className="text-sm text-gray-500">
                  Referral system is being developed
                </div>
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
            onClick={onClose}
            className="btn-modern-primary text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}; 