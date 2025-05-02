// src/components/ProviderSelector.jsx
import React, { useState, useEffect } from 'react';
import { RadioGroup } from '@headlessui/react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  InformationCircleIcon
} from '@heroicons/react/24/solid';
import Tooltip from './Tooltip';
import Spinner from './Spinner';

// Default logos for known providers (to be replaced with actual imports)
const DEFAULT_ICONS = {
  'alpha_native': '/assets/alpha-logo.svg',
  'sui_native': '/assets/sui-logo.svg',
  'aftermath_lp': '/assets/aftermath-logo.svg',
  'suilend': '/assets/suilend-logo.svg',
};

/**
 * Component for selecting a stake provider
 */
const ProviderSelector = ({
  providers = [],
  selectedProviderId,
  onSelectProvider,
  assetType = 'alpha', // Default to alpha tokens
  estimatedPoints,
  isLoading = false,
  className = ''
}) => {
  const [selectedId, setSelectedId] = useState(selectedProviderId || (providers[0]?.id || null));
  const [showDetails, setShowDetails] = useState(false);
  
  // Update local state when props change
  useEffect(() => {
    if (selectedProviderId && selectedProviderId !== selectedId) {
      setSelectedId(selectedProviderId);
    }
  }, [selectedProviderId, selectedId]);
  
  // Filter providers by asset type and active status
  const filteredProviders = providers
    .filter(provider => 
      provider.active && 
      provider.supportedAssets.includes(assetType)
    );
  
  // Handle selection change
  const handleSelectionChange = (providerId) => {
    setSelectedId(providerId);
    if (onSelectProvider) {
      onSelectProvider(providerId);
    }
  };
  
  // Get the selected provider details
  const selectedProvider = providers.find(p => p.id === selectedId) || null;
  
  // If no providers available, show message
  if (filteredProviders.length === 0) {
    return (
      <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-4 rounded-lg border border-gray-700 ${className}`}>
        <div className="flex items-center text-gray-300 mb-2">
          <ExclamationCircleIcon className="h-5 w-5 text-yellow-500 mr-2" />
          <h3 className="font-medium">No Available Providers</h3>
        </div>
        <p className="text-sm text-gray-400">
          There are no active providers that support {assetType.toUpperCase()} tokens at this time.
        </p>
      </div>
    );
  }
  
  return (
    <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm rounded-lg border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-200">Select Staking Provider</h3>
          <Tooltip text="Choose a provider for staking your assets to earn Alpha Points. Different providers may offer different rates and features.">
            <InformationCircleIcon className="h-5 w-5 text-gray-400 hover:text-gray-300" />
          </Tooltip>
        </div>
      </div>

      {/* Provider Selection */}
      <RadioGroup value={selectedId} onChange={handleSelectionChange} className="p-4">
        <RadioGroup.Label className="sr-only">Staking Provider</RadioGroup.Label>
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-4">
              <Spinner />
              <p className="text-gray-400 mt-2">Loading providers...</p>
            </div>
          ) : (
            filteredProviders.map((provider) => (
              <RadioGroup.Option
                key={provider.id}
                value={provider.id}
                className={({ checked }) => `
                  relative rounded-lg p-3 cursor-pointer transition-all
                  ${checked ? 'bg-purple-900/30 border border-purple-500' : 'bg-gray-700/30 border border-gray-600 hover:border-gray-500'}
                `}
              >
                {({ checked }) => (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {/* Provider Logo */}
                        <div className="h-8 w-8 mr-3 flex-shrink-0 flex items-center justify-center bg-gray-800 rounded-full overflow-hidden">
                          {provider.logoUrl ? (
                            <img 
                              src={provider.logoUrl} 
                              alt={provider.name} 
                              className="h-6 w-6 object-contain"
                            />
                          ) : (
                            <img 
                              src={DEFAULT_ICONS[provider.id] || DEFAULT_ICONS.alpha_native} 
                              alt={provider.name} 
                              className="h-6 w-6 object-contain"
                            />
                          )}
                        </div>
                        
                        {/* Provider Name & Type */}
                        <div className="text-sm">
                          <RadioGroup.Label 
                            as="p" 
                            className={`font-medium ${checked ? 'text-white' : 'text-gray-200'}`}
                          >
                            {provider.name}
                          </RadioGroup.Label>
                          <RadioGroup.Description 
                            as="span" 
                            className={`${checked ? 'text-purple-200' : 'text-gray-400'}`}
                          >
                            {provider.type}
                          </RadioGroup.Description>
                        </div>
                      </div>
                      
                      {/* Selected Indicator */}
                      <div className={`flex-shrink-0 ${checked ? 'text-purple-500' : 'text-gray-500'}`}>
                        <CheckCircleIcon className="h-5 w-5" />
                      </div>
                    </div>
                    
                    {/* Points Rate */}
                    <div className={`mt-2 text-xs ${checked ? 'text-purple-200' : 'text-gray-400'}`}>
                      <div className="flex justify-between items-center">
                        <span>Earning Rate:</span>
                        <span className="font-medium">{provider.pointsMultiplier}x Base Rate</span>
                      </div>
                      <div className="mt-1">{provider.rate || "Standard earning rate"}</div>
                    </div>
                  </>
                )}
              </RadioGroup.Option>
            ))
          )}
        </div>
      </RadioGroup>

      {/* Provider Details (if a provider is selected) */}
      {selectedProvider && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
            <ChevronRightIcon 
              className={`h-4 w-4 transition-transform ${showDetails ? 'transform rotate-90' : ''}`} 
            />
          </button>
          
          {showDetails && (
            <div className="mt-2 p-3 bg-gray-700/30 rounded-lg text-sm">
              <p className="text-gray-300 mb-2">{selectedProvider.description}</p>
              
              {/* Provider-specific details */}
              <div className="space-y-2 mt-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Min Duration:</span>
                  <span className="text-gray-200">{selectedProvider.minDuration} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Duration:</span>
                  <span className="text-gray-200">{selectedProvider.maxDuration} days</span>
                </div>
                {estimatedPoints && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Est. Points (30d):</span>
                    <span className="text-green-400">{estimatedPoints.toLocaleString()} αP</span>
                  </div>
                )}
              </div>
              
              {/* External Link (if available) */}
              {selectedProvider.partnerUrl && (
                <a
                  href={selectedProvider.partnerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center mt-3 text-blue-400 hover:text-blue-300"
                >
                  Learn more
                  <ChevronRightIcon className="h-3 w-3 ml-1" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderSelector;