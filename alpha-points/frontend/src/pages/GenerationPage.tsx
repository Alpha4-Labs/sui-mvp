import React, { useState } from 'react';
import { MainLayout } from '../layouts/MainLayout';

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
      id: 'stake-alpha',
      name: 'Stake ALPHA Tokens',
      description: 'Earn Alpha Points by staking ALPHA tokens in the protocol.',
      icon: 'α',
      status: 'active',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <h3 className="text-lg font-medium text-white mb-3">Staking Details</h3>
          <p className="text-gray-300 mb-3">
            Stake your ALPHA tokens to earn Alpha Points over time. The longer you stake, the better the rate.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">7-Day Stake</div>
              <div className="text-white font-medium">5% APY</div>
              <div className="text-green-400 text-sm mt-1">+500 Points/day per 1000 ALPHA</div>
            </div>
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">30-Day Stake</div>
              <div className="text-white font-medium">10% APY</div>
              <div className="text-green-400 text-sm mt-1">+650 Points/day per 1000 ALPHA</div>
            </div>
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">90-Day Stake</div>
              <div className="text-white font-medium">15% APY</div>
              <div className="text-green-400 text-sm mt-1">+800 Points/day per 1000 ALPHA</div>
            </div>
            <div className="bg-background-card p-3 rounded-lg">
              <div className="text-gray-400 mb-1">365-Day Stake</div>
              <div className="text-white font-medium">25% APY</div>
              <div className="text-green-400 text-sm mt-1">+1200 Points/day per 1000 ALPHA</div>
            </div>
          </div>
          <div className="text-center">
            <button className="bg-primary hover:bg-primary-dark text-white py-2 px-6 rounded transition-colors">
              Go to Staking
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'partner-pool',
      name: 'Partner Pool: Stargate USDT',
      description: 'Earn Alpha Points by providing liquidity to partner protocols.',
      icon: '🌉',
      status: 'inactive',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <div className="text-center text-gray-400 py-6">
            <div className="text-4xl mb-2">🔜</div>
            <h3 className="text-lg font-medium text-white mb-2">Partner Pool Coming Soon</h3>
            <p>
              Partner integrations will allow you to earn Alpha Points by participating in other DeFi protocols.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'ecosystem-activity',
      name: 'Ecosystem Activity: Beta Testing',
      description: 'Earn points by participating in Alpha ecosystem activities.',
      icon: '🧪',
      status: 'inactive',
      details: (
        <div className="p-4 bg-background rounded-lg">
          <div className="text-center text-gray-400 py-6">
            <div className="text-4xl mb-2">👨‍💻</div>
            <h3 className="text-lg font-medium text-white mb-2">Beta Testing Program</h3>
            <p className="mb-3">
              Our beta testing program will allow active community members to earn Alpha Points through participation.
            </p>
            <button className="bg-gray-700 text-gray-300 py-2 px-6 rounded cursor-not-allowed opacity-70">
              Join Waitlist (Coming Soon)
            </button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
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
    </MainLayout>
  );
};