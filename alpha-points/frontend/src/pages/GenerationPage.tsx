import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Define a generation method interface
interface GenerationMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'inactive' | 'coming-soon';
  details?: React.ReactNode;
}

export const GenerationPage: React.FC = () => {
  const [expandedMethod, setExpandedMethod] = useState<string | null>('stake-alpha');
  
  // Generation methods data
  const generationMethods: GenerationMethod[] = [
    {
      id: 'stake-sui',
      name: 'Stake SUI',
      description: 'Earn Alpha Points by staking SUI tokens in the protocol.',
      icon: '🟦',
      status: 'active',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">SUI Staking Details</h3>
          <p className="text-gray-300 mb-3">
            Stake your SUI tokens to earn Alpha Points over time. The longer you stake, the better the rate.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">7-Day Stake</div>
              <div className="text-white font-medium">5% APY</div>
              <div className="text-green-400 text-sm mt-1">+{500 .toLocaleString()} αP/day per {1} SUI</div>
            </div>
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">30-Day Stake</div>
              <div className="text-white font-medium">10% APY</div>
              <div className="text-green-400 text-sm mt-1">+{650 .toLocaleString()} αP/day per {1} SUI</div>
            </div>
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">90-Day Stake</div>
              <div className="text-white font-medium">15% APY</div>
              <div className="text-green-400 text-sm mt-1">+{800 .toLocaleString()} αP/day per {1} SUI</div>
            </div>
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">365-Day Stake</div>
              <div className="text-white font-medium">25% APY</div>
              <div className="text-green-400 text-sm mt-1">+{1200 .toLocaleString()} αP/day per {1} SUI</div>
            </div>
          </div>
          <div className="text-center">
            <a href="/dashboard">
              <button className="bg-primary hover:bg-primary-dark text-white py-2 px-6 rounded transition-colors">
                Go to SUI Staking
              </button>
            </a>
          </div>
        </div>
      ),
    },
    {
      id: 'partner-pool',
      name: 'Partner Pool',
      description: 'Earn Alpha Points by participating in partner-managed DeFi pools or protocols.',
      icon: '🌉',
      status: 'inactive',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <div className="text-center text-gray-400 py-6">
            <div className="text-4xl mb-2">🌉</div>
            <h3 className="text-lg font-medium text-white mb-2">Partner Pool Opportunities</h3>
            <p>
              Alpha Points can be earned by providing liquidity or participating in DeFi pools managed by our ecosystem partners. For example, a partner may offer bonus Alpha Points for staking USDT, ETH, or other assets in their protocol. These opportunities are created, managed, and distributed by partners, and may have unique requirements or reward structures.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Check back regularly for new partner pool campaigns and special events.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'ecosystem-activity',
      name: 'Ecosystem Activity',
      description: 'Earn points by participating in activities, quests, or beta programs run by Alpha4 partners.',
      icon: '🧪',
      status: 'inactive',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <div className="text-center text-gray-400 py-6">
            <div className="text-4xl mb-2">🧪</div>
            <h3 className="text-lg font-medium text-white mb-2">Partner-Managed Activities & Quests</h3>
            <p className="mb-3">
              Partners may offer Alpha Points for completing ecosystem quests, participating in beta tests, or engaging in community campaigns. For example, you might earn points for testing a new dApp, joining a governance vote, or completing a learning module. Each activity is managed by the respective partner and may have its own rules and rewards.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Explore the Alpha4 ecosystem for new ways to earn points through partner-led initiatives.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'airdrop-campaign',
      name: 'Airdrop Campaign',
      description: 'Earn Alpha Points by participating in special airdrop events organized by Alpha4 or partners.',
      icon: '🎁',
      status: 'inactive',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <div className="text-center text-gray-400 py-6">
            <div className="text-4xl mb-2">🎁</div>
            <h3 className="text-lg font-medium text-white mb-2">Airdrop Opportunities</h3>
            <p>
              Alpha4 and its partners may periodically distribute Alpha Points through airdrop campaigns. For example, you might receive points for holding certain tokens, completing on-chain actions, or being an early adopter of a new protocol. Each airdrop will have its own eligibility criteria and distribution rules, managed by the organizing team.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Watch for announcements about upcoming airdrop events and how to qualify.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'staking-lp-tokens',
      name: 'Stake LP Tokens',
      description: 'Earn Alpha Points by staking liquidity provider (LP) tokens in supported partner pools.',
      icon: '💧',
      status: 'inactive',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <div className="text-center text-gray-400 py-6">
            <div className="text-4xl mb-2">💧</div>
            <h3 className="text-lg font-medium text-white mb-2">LP Staking Rewards</h3>
            <p>
              Partners may offer Alpha Points for staking LP tokens from popular DEXs or DeFi protocols. For example, you could earn points by providing liquidity to a SUI/USDT pool and then staking your LP tokens in a partner vault. Each program is managed by the respective partner and may have unique reward rates or lockup periods.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Explore available LP staking programs from Alpha4 partners for more ways to earn.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'referral-program',
      name: 'Referral Program',
      description: 'Invite friends and earn Alpha Points for each successful referral, as managed by Alpha4 or partners.',
      icon: '🤝',
      status: 'inactive',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <div className="text-center text-gray-400 py-6">
            <div className="text-4xl mb-2">🤝</div>
            <h3 className="text-lg font-medium text-white mb-2">Referral Rewards</h3>
            <p>
              Alpha4 and its partners may run referral programs where you can earn Alpha Points by inviting new users. For example, you might receive points when a referred friend signs up, completes a transaction, or stakes assets. Each referral campaign will have its own rules and reward structure, managed by the organizing team.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Share your referral link and help grow the Alpha4 ecosystem to earn more points.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Earn Alpha Points</h1>
        <p className="text-gray-400">Explore ways to generate points across the ecosystem.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {generationMethods.map((method) => (
          <div 
            key={method.id}
            className="bg-background-card rounded-lg shadow-lg overflow-hidden"
          >
            <div 
              className="p-4 flex justify-between items-center cursor-pointer"
              onClick={() => setExpandedMethod(expandedMethod === method.id ? null : method.id)}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center bg-background rounded-full mr-3 text-xl">
                  {method.icon}
                </div>
                <div className="font-medium text-white">{method.name}</div>
              </div>
              <div className={`w-6 h-6 flex items-center justify-center rounded-full ${
                method.status === 'active' ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {expandedMethod === method.id ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            </div>
            
            {expandedMethod === method.id && (
              <div className="border-t border-gray-700">
                {method.details}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="text-center text-gray-400">
        More generation methods coming soon!
      </div>
    </>
  );
};