// src/components/StakedPositionsList.jsx
import React, { useState, useEffect } from 'react';
import { useStakeProviders } from '../hooks/useStakeProviders';
import { useLoanManager } from '../hooks/useLoanManager';
import { formatAddress, formatBalance, formatTimestamp, getTimeRemaining } from '../utils/formatters';
import { 
  ClockIcon, 
  ArrowDownCircleIcon, 
  LockClosedIcon, 
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import Tooltip from './Tooltip';
import Spinner from './Spinner';

/**
 * Component that displays a list of staked positions
 */
const StakedPositionsList = ({ 
  provider, 
  walletAdapter, 
  userAddress, 
  refreshData,
  className = ''
}) => {
  // Use stake providers hook
  const {
    getAllStakeObjects,
    getProviderById,
    unstakeFromProvider,
    isUnstaking,
    isLoadingProviders
  } = useStakeProviders(provider, walletAdapter, userAddress, refreshData);

  // Use loan manager hook to check if positions are encumbered
  const {
    isStakeEncumbered,
    selectStakeForLoan,
    isLoadingLoans
  } = useLoanManager(provider, walletAdapter, userAddress, refreshData);

  // Local state for stake objects and timeouts
  const [stakes, setStakes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [encumberedStakes, setEncumberedStakes] = useState({});
  const [expandedStakeId, setExpandedStakeId] = useState(null);

  // Load stake objects
  useEffect(() => {
    const loadStakes = async () => {
      setIsLoading(true);
      try {
        const stakeObjects = getAllStakeObjects();
        
        // Format stake objects for display
        const formattedStakes = await Promise.all(stakeObjects.map(async (stakeObj) => {
          if (!stakeObj?.data?.content?.fields) return null;
          
          const {
            owner,
            principal,
            start_epoch,
            unlock_epoch,
            duration_epochs
          } = stakeObj.data.content.fields;
          
          // Extract stake ID and determine provider
          const id = stakeObj.objectId;
          const providerId = 'alpha_native'; // Default to alpha_native for now
          const provider = getProviderById(providerId);
          
          // Format values
          const formattedPrincipal = formatBalance(principal, 9);
          
          return {
            id,
            owner,
            principal: formattedPrincipal,
            principalRaw: principal,
            startEpoch: start_epoch,
            unlockEpoch: unlock_epoch,
            durationEpochs: duration_epochs,
            providerId,
            providerName: provider?.name || 'Unknown Provider',
            providerType: provider?.type || 'Unknown Type',
            assetSymbol: 'ALPHA', // Default for now
            logoUrl: provider?.logoUrl || null
          };
        }));
        
        // Filter out nulls
        setStakes(formattedStakes.filter(Boolean));
        
        // Check encumbered status for each stake
        const encumberedMap = {};
        for (const stake of formattedStakes) {
          if (stake) {
            encumberedMap[stake.id] = await isStakeEncumbered(stake.id);
          }
        }
        setEncumberedStakes(encumberedMap);
      } catch (err) {
        console.error('Error loading stakes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStakes();
  }, [getAllStakeObjects, getProviderById, isStakeEncumbered, userAddress]);

  // Helper to handle unstake
  const handleUnstake = async (stakeId) => {
    await unstakeFromProvider(stakeId, 'alpha');
    // Refresh will be handled by context
  };

  // Helper to handle loan selection
  const handleSelectForLoan = async (stakeId) => {
    await selectStakeForLoan(stakeId);
    // Redirect or open modal would happen in parent component
  };

  // If loading, show spinner
  if (isLoading || isLoadingProviders || isLoadingLoans) {
    return (
      <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 text-center py-8 ${className}`}>
        <Spinner size="normal" />
        <p className="text-gray-400 mt-4">Loading staked positions...</p>
      </div>
    );
  }
  
  // If no stakes, show empty state
  if (!stakes || stakes.length === 0) {
    return (
      <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 text-center py-8 ${className}`}>
        <div className="text-5xl mb-4">🔒</div>
        <h3 className="text-xl font-medium text-gray-300 mb-2">No Staked Positions</h3>
        <p className="text-gray-400 mb-4">You don't have any staked positions yet.</p>
        <p className="text-sm text-gray-500">
          Stake ALPHA or other supported assets to start earning points.
        </p>
      </div>
    );
  }
  
  return (
    <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 ${className}`}>
      <h3 className="text-xl font-medium text-gray-100 mb-4">Your Staked Positions</h3>
      
      <div className="space-y-4">
        {stakes.map(stake => (
          <StakePositionCard 
            key={stake.id}
            stake={stake}
            onUnstake={handleUnstake}
            onSelectForLoan={handleSelectForLoan}
            isEncumbered={encumberedStakes[stake.id] || false}
            isExpanded={expandedStakeId === stake.id}
            onToggleExpand={() => setExpandedStakeId(expandedStakeId === stake.id ? null : stake.id)}
            isUnstaking={isUnstaking}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Individual stake position card
 */
const StakePositionCard = ({ 
  stake, 
  onUnstake, 
  onSelectForLoan, 
  isEncumbered, 
  isExpanded,
  onToggleExpand,
  isUnstaking
}) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [unstakingThisPosition, setUnstakingThisPosition] = useState(false);
  
  // Update time remaining
  useEffect(() => {
    const updateTimeLeft = () => {
      if (stake.unlockEpoch) {
        const unlockTimestampMs = parseInt(stake.unlockEpoch) * 86400000; // Convert epochs to ms
        setTimeLeft(getTimeRemaining(Math.floor(unlockTimestampMs / 1000)));
      }
    };
    
    updateTimeLeft();
    const intervalId = setInterval(updateTimeLeft, 1000);
    
    return () => clearInterval(intervalId);
  }, [stake.unlockEpoch]);
  
  // Calculate maturity progress
  const calculateProgress = () => {
    if (!stake.startEpoch || !stake.unlockEpoch) return 0;
    
    // Convert epochs to timestamps
    const startTimestampMs = parseInt(stake.startEpoch) * 86400000;
    const unlockTimestampMs = parseInt(stake.unlockEpoch) * 86400000;
    const nowMs = Date.now();
    
    // Calculate progress
    const totalDuration = unlockTimestampMs - startTimestampMs;
    if (totalDuration <= 0) return 0;
    
    const elapsed = nowMs - startTimestampMs;
    const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    
    return progress;
  };
  
  // Handle unstake button click
  const handleUnstake = async () => {
    setUnstakingThisPosition(true);
    try {
      await onUnstake(stake.id);
    } finally {
      setUnstakingThisPosition(false);
    }
  };
  
  // Handle loan button click
  const handleSelectForLoan = () => {
    onSelectForLoan(stake.id);
  };
  
  const progress = calculateProgress();
  const isMature = progress >= 100;
  const canUnstake = isMature && !isEncumbered;
  
  // Calculate unlock date
  const unlockDate = stake.unlockEpoch
    ? new Date(parseInt(stake.unlockEpoch) * 86400000)
    : null;
  
  // Format start date
  const startDate = stake.startEpoch
    ? new Date(parseInt(stake.startEpoch) * 86400000)
    : null;
  
  return (
    <div 
      className={`relative border rounded-lg transition-all duration-300 ${
        isEncumbered 
          ? 'border-yellow-600 bg-yellow-900/20' 
          : isMature 
            ? 'border-green-600 bg-green-900/20' 
            : 'border-gray-700 bg-gray-900/50'
      }`}
    >
      {/* Main Content */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
          {/* Provider Info */}
          <div className="flex items-center mb-3 sm:mb-0">
            {stake.logoUrl && (
              <img 
                src={stake.logoUrl} 
                alt={stake.providerName} 
                className="w-6 h-6 mr-2 rounded-full"
              />
            )}
            <div>
              <h4 className="text-lg font-medium text-gray-200">{stake.providerName}</h4>
              <p className="text-sm text-gray-400">{stake.providerType}</p>
            </div>
          </div>
          
          {/* Amount Info */}
          <div className="text-right">
            <div className="text-xl font-semibold text-gray-100">
              {stake.principal} <span className="text-sm text-gray-400">{stake.assetSymbol || 'ALPHA'}</span>
            </div>
            <div className="text-sm text-gray-400">
              Duration: {stake.durationEpochs || 0} days
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-2 mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Maturity Progress</span>
            <span>{Math.min(100, Math.max(0, Math.round(progress)))}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                isEncumbered ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        {/* Status Info */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-3 text-sm">
          <div className="flex items-center mb-2 sm:mb-0">
            <ClockIcon className="h-4 w-4 mr-1 text-gray-400" />
            <span className="text-gray-400 mr-1">Status:</span>
            {isEncumbered ? (
              <span className="text-yellow-400 flex items-center">
                <LockClosedIcon className="h-4 w-4 mr-1" />
                Encumbered (Loan)
              </span>
            ) : isMature ? (
              <span className="text-green-400">Ready to Unstake</span>
            ) : (
              <span className="text-blue-400">
                {timeLeft ? `Unlocks in ${timeLeft.formatted}` : 'Staked'}
              </span>
            )}
          </div>
          
          <div className="text-xs text-gray-400">
            ID: {formatAddress(stake.id, 4, 4)}
          </div>
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
            <div>
              <p className="text-gray-400 mb-1">Start Date</p>
              <p className="text-gray-200">{startDate ? startDate.toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Unlock Date</p>
              <p className="text-gray-200">{unlockDate ? unlockDate.toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Owner</p>
              <p className="text-gray-200">{formatAddress(stake.owner, 6, 4)}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Asset</p>
              <p className="text-gray-200">{stake.assetSymbol || 'ALPHA'}</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            {/* Unstake Button */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent toggling expanded state
                handleUnstake();
              }}
              disabled={!canUnstake || unstakingThisPosition}
              className={`px-3 py-2 rounded-md text-sm font-medium transition flex-1 flex items-center justify-center ${
                !canUnstake || unstakingThisPosition
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {unstakingThisPosition ? (
                <><Spinner size="small" /> Unstaking...</>
              ) : (
                <><ArrowDownCircleIcon className="h-4 w-4 mr-1" /> Unstake</>
              )}
            </button>
            
            {/* Loan Button */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent toggling expanded state
                handleSelectForLoan();
              }}
              disabled={isEncumbered || !stake.principal}
              className={`px-3 py-2 rounded-md text-sm font-medium transition flex-1 flex items-center justify-center ${
                isEncumbered || !stake.principal
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              <><ArrowsRightLeftIcon className="h-4 w-4 mr-1" /> Get Loan</>
            </button>
          </div>
          
          {/* Status Messages */}
          {isEncumbered && (
            <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-700 rounded-md text-xs text-yellow-300">
              <div className="flex items-start">
                <ExclamationCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                <p>This position has an outstanding loan. You must repay the loan before unstaking.</p>
              </div>
            </div>
          )}
          
          {!isMature && !isEncumbered && (
            <div className="mt-3 p-2 bg-blue-900/30 border border-blue-700 rounded-md text-xs text-blue-300">
              <div className="flex items-start">
                <ClockIcon className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                <p>This position is still maturing. You can take a loan against it or wait until maturity to unstake.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StakedPositionsList;