import React from 'react';
import { formatPercentage } from '../utils/format';

interface Provider {
  id: string;
  name: string;
  apy: number;
  logo: string;
  status: 'active' | 'inactive' | 'coming-soon';
}

interface ProviderSelectorProps {
  providers: Provider[];
  selectedProvider: string;
  onSelect: (providerId: string) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  selectedProvider,
  onSelect,
}) => {
  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Choose Staking Provider</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            onClick={() => provider.status === 'active' && onSelect(provider.id)}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedProvider === provider.id
                ? 'border-primary bg-primary bg-opacity-10'
                : 'border-gray-700 hover:border-gray-500'
            } ${provider.status !== 'active' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                {provider.logo ? (
                  <img src={provider.logo} alt={provider.name} className="w-6 h-6" />
                ) : (
                  <span className="text-white">{provider.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="text-white font-semibold">{provider.name}</h3>
                <p className="text-green-400 text-sm">{formatPercentage(provider.apy)} APY</p>
              </div>
            </div>
            
            {provider.status === 'coming-soon' && (
              <div className="text-xs text-gray-400 mt-2">Coming Soon</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};