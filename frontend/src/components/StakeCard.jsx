// src/components/StakeCard.jsx
import React, { useState, useEffect } from 'react';
import {
  ArrowUpCircleIcon,
  InformationCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useStakeProviders } from '../hooks/useStakeProviders';
import ProviderSelector from './ProviderSelector';
import Tooltip from './Tooltip';
import Spinner from './Spinner';

/**
 * Component for staking assets with selected providers
 */
const StakeCard = ({ 
  provider, 
  walletAdapter, 
  userAddress, 
  refreshData, 
  alphaBalance,
  isFetchingAlpha = false,
  className = ''
}) => {
  // State for the form
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState(30); // Default 30 days
  const [assetType, setAssetType] = useState('alpha'); // Default to ALPHA tokens
  const [estimatedPoints, setEstimatedPoints] = useState(null);
  
  // Use the stake providers hook
  const {
    providers,
    selectedProviderId,
    selectProvider,
    stakeWithProvider,
    calculatePointsGeneration,
    isStaking,
    isLoadingProviders,
    error
  } = useStakeProviders(provider, walletAdapter, userAddress, refreshData);
  
  // Get the selected provider
  const selectedProvider = providers.find(p => p.id === selectedProviderId) || null;
  
  // Update estimated points when inputs change
  useEffect(() => {
    if (selectedProviderId && amount && !isNaN(parseFloat(amount)) && duration) {
      const pointsInfo = calculatePointsGeneration(selectedProviderId, amount, duration);
      setEstimatedPoints(pointsInfo);
    } else {
      setEstimatedPoints(null);
    }
  }, [selectedProviderId, amount, duration, calculatePointsGeneration]);
  
  // Handle provider selection
  const handleProviderSelect = (providerId) => {
    selectProvider(providerId);
    
    // Reset duration to min duration of selected provider
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setDuration(provider.minDuration);
    }
  };
  
  // Handle staking
  const handleStake = async () => {
    if (!selectedProviderId || !amount || !duration) return;
    
    const success = await stakeWithProvider(amount, duration, assetType);
    if (success) {
      // Reset form on success
      setAmount('');
    }
  };
  
  // Format balance for display
  const formattedBalance = isFetchingAlpha 
    ? <Spinner size="small" /> 
    : (alphaBalance === '---' || alphaBalance === 'Error' || !alphaBalance) 
      ? alphaBalance 
      : parseFloat(alphaBalance).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4
        });
  
  // Calculate max amount user can stake (account for decimals)
  const maxAmount = alphaBalance && alphaBalance !== '---' && alphaBalance !== 'Error'
    ? parseFloat(alphaBalance)
    : 0;
  
  return (
    <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 transition duration-300 hover:border-blue-500 hover:shadow-blue-500/20 ${className}`}>
      <h3 className="text-xl font-medium text-gray-100 mb-4 flex items-center justify-between">
        <span>Stake Assets</span>
        {error && (
          <span className="text-xs text-red-400 font-normal">{error}</span>
        )}
      </h3>
      
      {/* Provider Selection */}
      <div className="mb-5">
        <ProviderSelector
          providers={providers}
          selectedProviderId={selectedProviderId}
          onSelectProvider={handleProviderSelect}
          assetType={assetType}
          estimatedPoints={estimatedPoints?.total}
          isLoading={isLoadingProviders}
        />
      </div>
      
      {/* Form Inputs */}
      <div className="space-y-4">
        {/* Asset Type Selection (disabled for now, as we only support ALPHA) */}
        {/* <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Asset Type
          </label>
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            disabled={true} // Disabled for MVP
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="alpha">ALPHA (Alpha Token)</option>
            <option value="sui" disabled>SUI (Coming Soon)</option>
          </select>
        </div> */}
        
        {/* Amount Input */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="stakeAmount" className="block text-sm font-medium text-gray-300">
              Amount to Stake
            </label>
            <div className="text-xs text-gray-400">
              Balance: {formattedBalance}
            </div>
          </div>
          <div className="flex items-center">
            <input
              id="stakeAmount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              disabled={isStaking}
              min="0"
              step="any"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-l-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 disabled:opacity-50"
            />
            <button
              onClick={() => setAmount(maxAmount.toString())}
              disabled={isStaking || maxAmount <= 0}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-r-md border-t border-r border-b border-gray-600 focus:outline-none disabled:opacity-50 disabled:hover:bg-gray-700"
            >
              Max
            </button>
          </div>
        </div>
        
        {/* Duration Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="stakeDuration" className="block text-sm font-medium text-gray-300">
              Duration: {duration} Days
            </label>
            <Tooltip text="Longer durations typically earn more points but lock your assets for longer periods.">
              <InformationCircleIcon className="h-4 w-4 text-gray-400" />
            </Tooltip>
          </div>
          <input
            id="stakeDuration"
            type="range"
            min={selectedProvider?.minDuration || 7}
            max={selectedProvider?.maxDuration || 365}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            disabled={isStaking}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{selectedProvider?.minDuration || 7}d</span>
            <span>{selectedProvider?.maxDuration || 365}d</span>
          </div>
        </div>
        
        {/* Points Estimation Display */}
        {estimatedPoints && (
          <div className="bg-gray-700/30 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2 text-sm">
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-1 text-blue-400" />
                <span className="text-gray-300">Estimated Points</span>
              </div>
              <Tooltip text="These estimates are based on current rates and may vary based on network conditions and other factors.">
                <InformationCircleIcon className="h-4 w-4 text-gray-400" />
              </Tooltip>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800/50 p-2 rounded">
                <span className="text-gray-400">Daily Earnings:</span>
                <p className="text-green-400 font-medium">{estimatedPoints.daily.toLocaleString(undefined, { maximumFractionDigits: 2 })} αP</p>
              </div>
              <div className="bg-gray-800/50 p-2 rounded">
                <span className="text-gray-400">Total ({duration} days):</span>
                <p className="text-green-400 font-medium">{estimatedPoints.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} αP</p>
              </div>
              <div className="bg-gray-800/50 p-2 rounded">
                <span className="text-gray-400">Rate Multiplier:</span>
                <p className="text-blue-400 font-medium">{estimatedPoints.multiplier.toFixed(2)}x</p>
              </div>
              <div className="bg-gray-800/50 p-2 rounded">
                <span className="text-gray-400">Unlock Date:</span>
                <p className="text-yellow-400 font-medium">
                  {new Date(Date.now() + (duration * 24 * 60 * 60 * 1000)).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Stake Button */}
        <button
          onClick={handleStake}
          disabled={
            isStaking || 
            !amount || 
            !duration || 
            parseFloat(amount) <= 0 || 
            (maxAmount > 0 && parseFloat(amount) > maxAmount)
          }
          className={`w-full px-6 py-3 rounded-lg text-white font-medium shadow-md transition duration-300 ease-in-out flex items-center justify-center gap-2 ${
            isStaking || !amount || !duration || parseFloat(amount) <= 0 || (maxAmount > 0 && parseFloat(amount) > maxAmount)
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 transform hover:scale-105 active:scale-100'
          }`}
        >
          {isStaking ? (
            <><Spinner size="small" /> Staking...</>
          ) : (
            <><ArrowUpCircleIcon className="h-5 w-5" /> Stake {assetType.toUpperCase()}</>
          )}
        </button>
        
        {/* Additional Info */}
        <p className="text-xs text-gray-400 text-center">
          Staking locks your assets for the selected duration. You'll earn Alpha Points continuously during this period.
        </p>
      </div>
    </div>
  );
};

export default StakeCard;