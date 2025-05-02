// src/hooks/useSuiObjects.js
import { useState, useEffect, useCallback } from 'react';
import { bcs } from '@mysten/sui.js/bcs';
import { PACKAGE_ID, SHARED_OBJECTS, FUNCTION_MAPPINGS } from '../packages/config';

export function useSuiObjects(provider, userAddress) {
  // State for various data fetching
  const [alphaPoints, setAlphaPoints] = useState('---');
  const [accruedPoints, setAccruedPoints] = useState('0');
  const [alphaBalance, setAlphaBalance] = useState('---');
  const [stakedAlphaBalance, setStakedAlphaBalance] = useState('---');
  const [redemptionRate, setRedemptionRate] = useState('...');
  const [lastPointsUpdateTimestamp, setLastPointsUpdateTimestamp] = useState(null);
  
  // Loading states
  const [isFetchingPoints, setIsFetchingPoints] = useState(false);
  const [isFetchingAlpha, setIsFetchingAlpha] = useState(false);
  const [isFetchingStakedAlpha, setIsFetchingStakedAlpha] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  
  // Generation sources state
  const [generationSources, setGenerationSources] = useState([
    { id: 1, name: 'Stake ALPHA Tokens', type: 'Native Staking', rate: 'Dynamic (1 per 100/hr)', active: true, details: 'Stake your ALPHA tokens directly...', icon: 'alpha', stakedAmount: 0, assetSymbol: 'ALPHA', lockEndDate: null, unlockDuration: null },
    { id: 2, name: 'Partner Pool: Stargate USDT', type: 'LP Staking', rate: '0.5 αP / day / $100 LP Value', active: false, details: 'Provide USDT liquidity on Stargate...', icon: 'stargate', stakedAmount: 0, assetSymbol: 'USDT LP', lockEndDate: null, unlockDuration: null },
    { id: 4, name: 'Ecosystem Activity: Beta Testing', type: 'Participation', rate: 'Variable (Bonus Drops)', active: false, details: 'Participate in beta testing programs...', icon: 'participation', stakedAmount: null, assetSymbol: null, lockEndDate: null, unlockDuration: null },
  ]);
  
  // Helper function to format BCS values
  const formatBcsValue = useCallback((value, decimals = 9) => {
    if (!value) return '0';
    // Convert BCS value to string with proper decimal formatting
    const numValue = Number(value);
    return (numValue / Math.pow(10, decimals)).toString();
  }, []);
  
  // Fetch points balance
  const fetchPointsBalance = useCallback(async () => {
    if (!provider || !userAddress) {
      setAlphaPoints('---');
      setAccruedPoints('0');
      setLastPointsUpdateTimestamp(null);
      return;
    }
    
    setIsFetchingPoints(true);
    
    try {
      // Call Sui Move view function for points balance
      const pointsMapping = FUNCTION_MAPPINGS.getPoints;
      const pointsResult = await provider.devInspectTransaction({
        packageObjectId: PACKAGE_ID,
        module: pointsMapping.module,
        function: pointsMapping.function,
        arguments: [SHARED_OBJECTS.LEDGER, userAddress],
        gasBudget: 10000,
      });
      
      // Call Move view function for accrued points
      const accruedMapping = FUNCTION_MAPPINGS.getAccruedPoints;
      const accruedResult = await provider.devInspectTransaction({
        packageObjectId: PACKAGE_ID,
        module: accruedMapping.module,
        function: accruedMapping.function,
        arguments: [SHARED_OBJECTS.LEDGER, userAddress],
        gasBudget: 10000,
      });
      
      // Get last update timestamp from ledger object
      const ledgerObject = await provider.getObject({
        id: SHARED_OBJECTS.LEDGER,
        options: { showContent: true }
      });
      
      // Extract and deserialize BCS return values
      if (pointsResult.result && accruedResult.result) {
        // Parse the returned points
        const pointsValue = pointsResult.result.returnValues[0][0];
        const accruedValue = accruedResult.result.returnValues[0][0];
        
        setAlphaPoints(formatBcsValue(pointsValue));
        setAccruedPoints(formatBcsValue(accruedValue));
        
        // Extract the last update timestamp from ledger fields (implementation depends on the Move struct)
        // This is a placeholder - actual implementation would extract from ledger object
        const timestamp = Math.floor(Date.now() / 1000); // For now, use current time as placeholder
        setLastPointsUpdateTimestamp(timestamp);
      } else {
        throw new Error("Failed to get points data");
      }
    } catch (error) {
      console.error("Error fetching points data:", error);
      setAlphaPoints('Error');
      setAccruedPoints('Error');
      setLastPointsUpdateTimestamp(null);
    } finally {
      setIsFetchingPoints(false);
    }
  }, [provider, userAddress, formatBcsValue]);
  
  // Fetch ALPHA balance
  const fetchAlphaBalance = useCallback(async () => {
    if (!provider || !userAddress) {
      setAlphaBalance('---');
      return;
    }
    
    setIsFetchingAlpha(true);
    
    try {
      // Get coins of type ALPHA
      const coins = await provider.getCoins({
        owner: userAddress,
        coinType: PACKAGE_ID + '::alpha_token::ALPHA',
      });
      
      // Sum up balance
      let totalBalance = 0n;
      for (const coin of coins.data) {
        totalBalance += BigInt(coin.balance);
      }
      
      setAlphaBalance(formatBcsValue(totalBalance.toString()));
    } catch (error) {
      console.error("Error fetching ALPHA balance:", error);
      setAlphaBalance('Error');
    } finally {
      setIsFetchingAlpha(false);
    }
  }, [provider, userAddress, formatBcsValue]);
  
  // Fetch staked ALPHA balance
  const fetchStakedAlphaBalance = useCallback(async () => {
    if (!provider || !userAddress) {
      setStakedAlphaBalance('---');
      return;
    }
    
    setIsFetchingStakedAlpha(true);
    
    try {
      // Call Move view function
      const mapping = FUNCTION_MAPPINGS.getStakedAmount;
      const result = await provider.devInspectTransaction({
        packageObjectId: PACKAGE_ID,
        module: mapping.module,
        function: mapping.function,
        arguments: [SHARED_OBJECTS.LEDGER, userAddress],
        gasBudget: 10000,
      });
      
      if (result.result) {
        const stakedValue = result.result.returnValues[0][0];
        const formattedStaked = formatBcsValue(stakedValue);
        
        setStakedAlphaBalance(formattedStaked);
        // Also update the first generation source with this value
        setGenerationSources(prev => prev.map(s => 
          s.id === 1 ? { ...s, stakedAmount: parseFloat(formattedStaked) } : s
        ));
      } else {
        throw new Error("Failed to get staked amount");
      }
    } catch (error) {
      console.error("Error fetching staked balance:", error);
      setStakedAlphaBalance('Error');
      setGenerationSources(prev => prev.map(s => 
        s.id === 1 ? { ...s, stakedAmount: 'Error' } : s
      ));
    } finally {
      setIsFetchingStakedAlpha(false);
    }
  }, [provider, userAddress, formatBcsValue]);
  
  // Fetch redemption rate from oracle
  const fetchRedemptionRate = useCallback(async () => {
    if (!provider) {
      setRedemptionRate('N/A');
      return;
    }
    
    setIsFetchingRate(true);
    
    try {
      // Call Move view function
      const mapping = FUNCTION_MAPPINGS.getRateOracleInfo;
      const result = await provider.devInspectTransaction({
        packageObjectId: PACKAGE_ID,
        module: mapping.module,
        function: mapping.function,
        arguments: [SHARED_OBJECTS.RATE_ORACLE],
        gasBudget: 10000,
      });
      
      if (result.result) {
        // Extract rate and decimals from the returned tuple
        const rate = result.result.returnValues[0][0];
        const decimals = result.result.returnValues[0][1];
        
        // Format the rate with proper decimals
        const rateNum = Number(rate) / Math.pow(10, Number(decimals));
        setRedemptionRate(rateNum.toLocaleString(undefined, { maximumFractionDigits: 0 }));
      } else {
        throw new Error("Failed to get redemption rate");
      }
    } catch (error) {
      console.error("Error fetching redemption rate:", error);
      setRedemptionRate('Error');
    } finally {
      setIsFetchingRate(false);
    }
  }, [provider]);
  
  // Effect to fetch all data when address changes
  useEffect(() => {
    if (userAddress && provider) {
      fetchPointsBalance();
      fetchAlphaBalance();
      fetchStakedAlphaBalance();
      fetchRedemptionRate();
    }
  }, [userAddress, provider, fetchPointsBalance, fetchAlphaBalance, fetchStakedAlphaBalance, fetchRedemptionRate]);
  
  // Combined loading state
  const isFetchingAny = isFetchingPoints || isFetchingAlpha || isFetchingStakedAlpha || isFetchingRate;
  
  return {
    // Data
    alphaPoints,
    accruedPoints,
    lastPointsUpdateTimestamp,
    alphaBalance,
    stakedAlphaBalance,
    redemptionRate,
    generationSources,
    
    // Loading states
    isFetchingPoints,
    isFetchingAlpha,
    isFetchingStakedAlpha,
    isFetchingRate,
    isFetchingAny,
    
    // Fetch functions
    fetchPointsBalance,
    fetchAlphaBalance,
    fetchStakedAlphaBalance,
    fetchRedemptionRate,
    
    // Refresh all data
    refreshAllData: useCallback(() => {
      if (userAddress && provider) {
        fetchPointsBalance();
        fetchAlphaBalance();
        fetchStakedAlphaBalance();
        fetchRedemptionRate();
      }
    }, [userAddress, provider, fetchPointsBalance, fetchAlphaBalance, fetchStakedAlphaBalance, fetchRedemptionRate])
  };
}