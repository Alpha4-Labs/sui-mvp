// src/hooks/useStakeProviders.js
import { useState, useCallback, useEffect } from 'react';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { 
  STAKE_PROVIDERS, 
  getProviderById, 
  getActiveProviders,
  calculatePointsRate,
  getProviderTypeArgument
} from '../packages/stake-providers';
import { 
  createStakeTransaction, 
  createUnstakeTransaction,
  executeTransaction,
  formatErrorMessage
} from '../utils/transaction-helpers';
import { toBcsCompatible } from '../utils/bcs-helpers';
import { PACKAGE_ID, SHARED_OBJECTS } from '../packages/config';

/**
 * Hook for managing stake providers and routing stakes to different protocols
 */
export function useStakeProviders(provider, walletAdapter, userAddress, refreshData) {
  // Current provider selection
  const [selectedProviderId, setSelectedProviderId] = useState('alpha_native');
  
  // Available providers based on network and active status
  const [availableProviders, setAvailableProviders] = useState([]);
  
  // Provider-specific states
  const [providerBalances, setProviderBalances] = useState({});
  const [providerStakes, setProviderStakes] = useState({});
  
  // Loading states
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  
  // Error state
  const [error, setError] = useState(null);
  
  // Transaction message
  const [txMessage, setTxMessage] = useState('');
  
  // Initialize available providers
  useEffect(() => {
    // Get active providers (for testnet only in this implementation)
    const activeProviders = getActiveProviders(true, false);
    setAvailableProviders(activeProviders);
  }, []);
  
  // Fetch provider balances and stakes when provider or wallet changes
  useEffect(() => {
    if (!provider || !userAddress) return;
    
    const fetchProviderData = async () => {
      setIsLoadingProviders(true);
      
      try {
        const balances = {};
        const stakes = {};
        
        // For each available provider, fetch balance and stakes
        for (const providerConfig of availableProviders) {
          try {
            // Skip inactive providers
            if (!providerConfig.active) continue;
            
            // Call provider-specific balance function
            if (providerConfig.functions.getBalance) {
              const result = await provider.devInspectTransaction({
                packageObjectId: PACKAGE_ID,
                module: 'ledger', // Assuming all getBalance functions are in ledger module
                function: 'get_staked_amount',
                arguments: [SHARED_OBJECTS.LEDGER, userAddress],
                gasBudget: 10000,
              });
              
              if (result && result.results && result.results.length > 0) {
                // Parse the result
                const balanceValue = result.results[0].returnValues[0][0];
                balances[providerConfig.id] = balanceValue || '0';
              } else {
                balances[providerConfig.id] = '0';
              }
            }
            
            // Fetch stake objects for this provider
            // This is a simplified implementation - in a real app, you would fetch
            // and filter stake objects by provider
            const objects = await provider.getOwnedObjects({
              owner: userAddress,
              filter: {
                StructType: `${PACKAGE_ID}::stake_position::StakePosition`,
              },
              options: { showContent: true },
            });
            
            if (objects && objects.data) {
              // Store stake objects for this provider
              stakes[providerConfig.id] = objects.data;
            } else {
              stakes[providerConfig.id] = [];
            }
          } catch (err) {
            console.error(`Error fetching data for provider ${providerConfig.id}:`, err);
            balances[providerConfig.id] = 'Error';
            stakes[providerConfig.id] = [];
          }
        }
        
        setProviderBalances(balances);
        setProviderStakes(stakes);
      } catch (err) {
        console.error('Error fetching provider data:', err);
        setError('Failed to load provider data');
      } finally {
        setIsLoadingProviders(false);
      }
    };
    
    fetchProviderData();
  }, [provider, userAddress, availableProviders]);
  
  /**
   * Select a stake provider
   * @param {string} providerId - Provider ID to select
   */
  const selectProvider = useCallback((providerId) => {
    const provider = getProviderById(providerId);
    if (provider) {
      setSelectedProviderId(providerId);
      setError(null);
    } else {
      setError(`Unknown provider: ${providerId}`);
    }
  }, []);
  
  /**
   * Calculate points generation for a stake
   * @param {string} providerId - Provider ID
   * @param {number|string} amount - Stake amount
   * @param {number} duration - Stake duration in days
   * @returns {object} - Points generation data
   */
  const calculatePointsGeneration = useCallback((providerId, amount, duration) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return { daily: 0, total: 0, multiplier: 0 };
      }
      
      return calculatePointsRate(providerId, numAmount, duration);
    } catch (err) {
      console.error('Error calculating points generation:', err);
      return { daily: 0, total: 0, multiplier: 0 };
    }
  }, []);
  
  /**
   * Stake assets with the selected provider
   * @param {string} amount - Amount to stake
   * @param {number} duration - Duration in days (converted to epochs)
   * @param {string} assetType - Type of asset to stake
   * @returns {Promise<object>} - Transaction result
   */
  const stakeWithProvider = useCallback(async (amount, duration, assetType = 'alpha') => {
    if (!provider || !walletAdapter || !userAddress) {
      setError('Wallet not connected');
      return null;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Invalid amount');
      return null;
    }
    
    // Get the selected provider
    const stakeProvider = getProviderById(selectedProviderId);
    if (!stakeProvider) {
      setError('Invalid provider selected');
      return null;
    }
    
    // Check if provider supports the asset type
    if (!stakeProvider.supportedAssets.includes(assetType)) {
      setError(`Provider ${stakeProvider.name} does not support ${assetType}`);
      return null;
    }
    
    // Check duration limits
    if (duration < stakeProvider.minDuration || duration > stakeProvider.maxDuration) {
      setError(`Duration must be between ${stakeProvider.minDuration} and ${stakeProvider.maxDuration} days`);
      return null;
    }
    
    setError(null);
    setIsStaking(true);
    setTxMessage(`Preparing to stake ${amount} with ${stakeProvider.name}...`);
    
    try {
      // Convert duration from days to epochs (assuming 1 epoch = 1 day for simplicity)
      const durationEpochs = duration;
      
      // Get the type argument for this provider and asset
      const tokenType = getProviderTypeArgument(selectedProviderId, assetType);
      
      // Create transaction for staking
      const tx = createStakeTransaction({
        packageId: PACKAGE_ID,
        configId: SHARED_OBJECTS.CONFIG,
        escrowId: SHARED_OBJECTS.ESCROW_VAULT,
        amount,
        tokenType,
        duration: durationEpochs,
        decimals: 9 // Assuming 9 decimals for all assets
      });
      
      // Execute the transaction
      setTxMessage(`Staking ${amount} with ${stakeProvider.name}...`);
      const result = await executeTransaction({
        walletAdapter,
        transactionBlock: tx
      });
      
      // If successful, refresh data
      setTxMessage(`✅ Successfully staked ${amount} with ${stakeProvider.name}!`);
      
      // Refresh data
      await refreshData();
      
      // Clear message after a delay
      setTimeout(() => setTxMessage(''), 3000);
      
      return result;
    } catch (err) {
      console.error('Error staking with provider:', err);
      const errorMsg = formatErrorMessage(err, `Failed to stake with ${stakeProvider.name}`);
      setError(errorMsg);
      setTxMessage(`❌ ${errorMsg}`);
      return null;
    } finally {
      setIsStaking(false);
    }
  }, [provider, walletAdapter, userAddress, selectedProviderId, refreshData]);
  
  /**
   * Unstake assets from a provider
   * @param {string} stakeObjectId - ID of the stake object to unstake
   * @param {string} assetType - Type of asset being unstaked
   * @returns {Promise<object>} - Transaction result
   */
  const unstakeFromProvider = useCallback(async (stakeObjectId, assetType = 'alpha') => {
    if (!provider || !walletAdapter || !userAddress) {
      setError('Wallet not connected');
      return null;
    }
    
    if (!stakeObjectId) {
      setError('Invalid stake object ID');
      return null;
    }
    
    // Get the selected provider
    const stakeProvider = getProviderById(selectedProviderId);
    if (!stakeProvider) {
      setError('Invalid provider selected');
      return null;
    }
    
    setError(null);
    setIsUnstaking(true);
    setTxMessage(`Preparing to unstake from ${stakeProvider.name}...`);
    
    try {
      // Get the type argument for this provider and asset
      const tokenType = getProviderTypeArgument(selectedProviderId, assetType);
      
      // Create transaction for unstaking
      const tx = createUnstakeTransaction({
        packageId: PACKAGE_ID,
        configId: SHARED_OBJECTS.CONFIG,
        ledgerId: SHARED_OBJECTS.LEDGER,
        escrowId: SHARED_OBJECTS.ESCROW_VAULT,
        stakeObjectId,
        tokenType
      });
      
      // Execute the transaction
      setTxMessage(`Unstaking from ${stakeProvider.name}...`);
      const result = await executeTransaction({
        walletAdapter,
        transactionBlock: tx
      });
      
      // If successful, refresh data
      setTxMessage(`✅ Successfully unstaked from ${stakeProvider.name}!`);
      
      // Refresh data
      await refreshData();
      
      // Clear message after a delay
      setTimeout(() => setTxMessage(''), 3000);
      
      return result;
    } catch (err) {
      console.error('Error unstaking from provider:', err);
      const errorMsg = formatErrorMessage(err, `Failed to unstake from ${stakeProvider.name}`);
      setError(errorMsg);
      setTxMessage(`❌ ${errorMsg}`);
      return null;
    } finally {
      setIsUnstaking(false);
    }
  }, [provider, walletAdapter, userAddress, selectedProviderId, refreshData]);
  
  /**
   * Get all stake objects across providers
   * @returns {Array} - Array of stake objects
   */
  const getAllStakeObjects = useCallback(() => {
    // Flatten the stakes from all providers
    return Object.values(providerStakes).flat();
  }, [providerStakes]);
  
  /**
   * Get stake objects for a specific provider
   * @param {string} providerId - Provider ID
   * @returns {Array} - Array of stake objects
   */
  const getProviderStakes = useCallback((providerId) => {
    return providerStakes[providerId] || [];
  }, [providerStakes]);
  
  /**
   * Check if a user has active stakes with a provider
   * @param {string} providerId - Provider ID
   * @returns {boolean} - True if user has active stakes
   */
  const hasActiveStakes = useCallback((providerId) => {
    const stakes = providerStakes[providerId] || [];
    return stakes.length > 0;
  }, [providerStakes]);
  
  /**
   * Get the total staked amount across all providers
   * @returns {string} - Total staked amount
   */
  const getTotalStakedAmount = useCallback(() => {
    try {
      let total = BigInt(0);
      
      // Sum up balances across providers
      for (const [providerId, balance] of Object.entries(providerBalances)) {
        if (balance !== 'Error' && balance !== '---') {
          try {
            total += BigInt(balance);
          } catch (err) {
            console.error(`Error parsing balance for ${providerId}:`, err);
          }
        }
      }
      
      return total.toString();
    } catch (err) {
      console.error('Error calculating total staked amount:', err);
      return '0';
    }
  }, [providerBalances]);
  
  return {
    // Available providers
    providers: availableProviders,
    selectedProviderId,
    selectProvider,
    
    // Provider data
    providerBalances,
    providerStakes,
    isLoadingProviders,
    
    // Helper functions
    calculatePointsGeneration,
    getAllStakeObjects,
    getProviderStakes,
    hasActiveStakes,
    getTotalStakedAmount,
    
    // Transaction functions
    stakeWithProvider,
    unstakeFromProvider,
    
    // States
    isStaking,
    isUnstaking,
    error,
    txMessage,
    setTxMessage
  };
}