// src/hooks/useSuiTransactions.js
import { useState, useCallback } from 'react';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { PACKAGE_ID, SHARED_OBJECTS, FUNCTION_MAPPINGS } from '../packages/config';

export function useSuiTransactions(provider, walletAdapter, userAddress, refreshData) {
  // Transaction status states
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  
  // Combined state for transaction processing
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  
  // Transaction messaging
  const [txMessage, setTxMessage] = useState('');
  
  // Helper to format error messages
  const formatErrorMessage = useCallback((error, defaultMsg) => {
    let reason = error?.message || defaultMsg;
    if (error?.data?.error) reason = error.data.error;
    
    // Handle common error types
    if (error?.code === 'UserRejectedError') {
      reason = "Transaction rejected by user.";
    }
    
    return `❌ ${defaultMsg} failed: ${reason}`;
  }, []);
  
  // Check if wallet is ready
  const checkWalletReady = useCallback(() => {
    if (!provider || !walletAdapter || !userAddress) {
      setTxMessage("Wallet not connected");
      return false;
    }
    return true;
  }, [provider, walletAdapter, userAddress]);
  
  // Function to get owned stake objects for a user
  const getOwnedStakeObjects = useCallback(async () => {
    if (!provider || !userAddress) {
      return [];
    }
    
    try {
      // Query for owned stake objects
      // This is a placeholder implementation - actual filtering may depend on your object structure
      const objects = await provider.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${PACKAGE_ID}::stake_position::StakePosition`,
        },
        options: { showContent: true },
      });
      
      return objects.data || [];
    } catch (error) {
      console.error("Error fetching owned stake objects:", error);
      return [];
    }
  }, [provider, userAddress]);
  
  // === Transaction Handlers ===
  
  // Stake ALPHA tokens
  const handleStake = useCallback(async (stakeAmount) => {
    if (!checkWalletReady()) return false;
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setTxMessage("Enter valid positive amount to stake");
      return false;
    }
    
    setTxMessage('');
    setIsStaking(true);
    setIsProcessingTx(true);
    
    try {
      // 1. Build transaction
      const tx = new TransactionBlock();
      
      // 2. Add stake function call
      const mapping = FUNCTION_MAPPINGS.stake;
      const amountMicroAlpha = Math.floor(parseFloat(stakeAmount) * 1_000_000_000); // Convert to correct decimal precision
      
      // Split coin and pass to route_stake
      // This is a simplified implementation - adjust based on actual function signatures
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(amountMicroAlpha)]);
      
      // Add objects needed by the function
      const objects = mapping.requiredObjects.map(objId => tx.object(objId));
      
      // Add other arguments (clock, etc)
      const clockObj = tx.object('0x6'); // System clock object
      
      // Call the Move function
      tx.moveCall({
        target: `${PACKAGE_ID}::${mapping.module}::${mapping.function}`,
        arguments: [
          ...objects, // Config, Escrow
          clockObj,   // Clock
          coin,       // Coin to stake
          tx.pure(30), // Duration (e.g., 30 days)
        ],
        typeArguments: mapping.typeArgs,
      });
      
      // 3. Execute transaction
      setTxMessage(`Staking ${stakeAmount} ALPHA...`);
      const result = await walletAdapter.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });
      
      // 4. Handle result
      console.log("Stake transaction result:", result);
      
      // Check if transaction succeeded
      if (result.effects?.status?.status === "success") {
        setTxMessage("✅ Staking successful! Updating balances...");
        // Refresh data after successful transaction
        await refreshData();
        setTxMessage("Balances updated.");
        setTimeout(() => setTxMessage(''), 3000);
        return true;
      } else {
        throw new Error(result.effects?.status?.error || "Transaction failed");
      }
    } catch (error) {
      console.error("Staking failed:", error);
      setTxMessage(formatErrorMessage(error, 'Staking'));
      return false;
    } finally {
      setIsStaking(false);
      setIsProcessingTx(false);
    }
  }, [checkWalletReady, walletAdapter, refreshData, formatErrorMessage]);
  
  // Unstake ALPHA tokens
  const handleUnstake = useCallback(async (unstakeAmount) => {
    if (!checkWalletReady()) return false;
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      setTxMessage("Enter valid positive amount to unstake");
      return false;
    }
    
    setTxMessage('');
    setIsUnstaking(true);
    setIsProcessingTx(true);
    
    try {
      // 1. Get user's stake objects
      const stakeObjects = await getOwnedStakeObjects();
      if (!stakeObjects.length) {
        throw new Error("No stake positions found");
      }
      
      // Find a suitable stake object matching the amount
      // This is simplified - you may need more complex logic based on actual implementation
      const stakeObj = stakeObjects[0]; // Just using the first one for this example
      
      // 2. Build transaction
      const tx = new TransactionBlock();
      
      // 3. Add unstake function call
      const mapping = FUNCTION_MAPPINGS.unstake;
      
      // Add objects needed by the function
      const objects = mapping.requiredObjects.map(objId => tx.object(objId));
      
      // Add user's stake object
      const stakePosition = tx.object(stakeObj.objectId);
      
      // Add clock
      const clockObj = tx.object('0x6'); // System clock object
      
      // Call the Move function
      tx.moveCall({
        target: `${PACKAGE_ID}::${mapping.module}::${mapping.function}`,
        arguments: [
          ...objects,     // Config, Ledger, Escrow
          stakePosition,  // The stake object to redeem
          clockObj,       // Clock
        ],
        typeArguments: mapping.typeArgs,
      });
      
      // 4. Execute transaction
      setTxMessage(`Unstaking ${unstakeAmount} ALPHA...`);
      const result = await walletAdapter.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });
      
      // 5. Handle result
      console.log("Unstake transaction result:", result);
      
      // Check if transaction succeeded
      if (result.effects?.status?.status === "success") {
        setTxMessage("✅ Unstaking successful! Updating balances...");
        // Refresh data after successful transaction
        await refreshData();
        setTxMessage("Balances updated.");
        setTimeout(() => setTxMessage(''), 3000);
        return true;
      } else {
        throw new Error(result.effects?.status?.error || "Transaction failed");
      }
    } catch (error) {
      console.error("Unstaking failed:", error);
      setTxMessage(formatErrorMessage(error, 'Unstaking'));
      return false;
    } finally {
      setIsUnstaking(false);
      setIsProcessingTx(false);
    }
  }, [checkWalletReady, walletAdapter, getOwnedStakeObjects, refreshData, formatErrorMessage]);
  
  // Claim accrued points
  const handleClaimPoints = useCallback(async () => {
    if (!checkWalletReady()) return false;
    
    setTxMessage('');
    setIsClaiming(true);
    setIsProcessingTx(true);
    
    try {
      // 1. Build transaction
      const tx = new TransactionBlock();
      
      // 2. Add claim points function call
      const mapping = FUNCTION_MAPPINGS.claimPoints;
      
      // Add objects needed by the function
      const objects = mapping.requiredObjects.map(objId => tx.object(objId));
      
      // Call the Move function
      tx.moveCall({
        target: `${PACKAGE_ID}::${mapping.module}::${mapping.function}`,
        arguments: [
          ...objects, // Config, Ledger
        ],
        typeArguments: mapping.typeArgs,
      });
      
      // 3. Execute transaction
      setTxMessage("Claiming accrued points...");
      const result = await walletAdapter.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });
      
      // 4. Handle result
      console.log("Claim transaction result:", result);
      
      // Check if transaction succeeded
      if (result.effects?.status?.status === "success") {
        setTxMessage("✅ Points claimed! Updating balances...");
        // Refresh data after successful transaction
        await refreshData();
        setTxMessage("Points balance updated.");
        setTimeout(() => setTxMessage(''), 3000);
        return true;
      } else {
        throw new Error(result.effects?.status?.error || "Transaction failed");
      }
    } catch (error) {
      console.error("Claiming points failed:", error);
      setTxMessage(formatErrorMessage(error, 'Claim points'));
      return false;
    } finally {
      setIsClaiming(false);
      setIsProcessingTx(false);
    }
  }, [checkWalletReady, walletAdapter, refreshData, formatErrorMessage]);
  
  // Redeem points for ALPHA tokens
  const handleRedeemPoints = useCallback(async (pointsToSpend) => {
    if (!checkWalletReady()) return false;
    if (!pointsToSpend || parseFloat(pointsToSpend) <= 0) {
      setTxMessage("Enter valid positive amount of points to redeem");
      return false;
    }
    
    setTxMessage('');
    setIsRedeeming(true);
    setIsProcessingTx(true);
    
    try {
      // 1. Build transaction
      const tx = new TransactionBlock();
      
      // 2. Add redeem points function call
      const mapping = FUNCTION_MAPPINGS.redeemPoints;
      
      // Convert points to proper decimal precision
      const amountMicroPoints = Math.floor(parseFloat(pointsToSpend) * 1_000_000_000);
      
      // Add objects needed by the function
      const objects = mapping.requiredObjects.map(objId => tx.object(objId));
      
      // Add clock
      const clockObj = tx.object('0x6'); // System clock object
      
      // Call the Move function
      tx.moveCall({
        target: `${PACKAGE_ID}::${mapping.module}::${mapping.function}`,
        arguments: [
          ...objects,               // Config, Ledger, Escrow, Oracle
          tx.pure(amountMicroPoints), // Points amount
          clockObj,                 // Clock
        ],
        typeArguments: mapping.typeArgs,
      });
      
      // 3. Execute transaction
      setTxMessage(`Redeeming ${pointsToSpend} Alpha Points...`);
      const result = await walletAdapter.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });
      
      // 4. Handle result
      console.log("Redeem transaction result:", result);
      
      // Check if transaction succeeded
      if (result.effects?.status?.status === "success") {
        setTxMessage("✅ Points redeemed! Updating balances...");
        // Refresh data after successful transaction
        await refreshData();
        setTxMessage("Balances updated.");
        setTimeout(() => setTxMessage(''), 3000);
        return true;
      } else {
        throw new Error(result.effects?.status?.error || "Transaction failed");
      }
    } catch (error) {
      console.error("Redeeming points failed:", error);
      setTxMessage(formatErrorMessage(error, 'Redeem points'));
      return false;
    } finally {
      setIsRedeeming(false);
      setIsProcessingTx(false);
    }
  }, [checkWalletReady, walletAdapter, refreshData, formatErrorMessage]);
  
  // Function to handle activation/deactivation of generation sources
  // This is simulated for now
  const handleToggleActivationRequest = useCallback((sourceId, currentStatus) => {
    // This would be implemented with actual Sui transactions in production
    console.log(`Toggle source ${sourceId} from ${currentStatus} to ${!currentStatus}`);
    return { action: currentStatus ? 'deactivate' : 'activate', sourceId };
  }, []);
  
  const handleConfirmActivation = useCallback(async (sourceId, action, amount) => {
    // This would be implemented with actual Sui transactions in production
    console.log(`Confirming ${action} for source ${sourceId} with amount: ${amount || 'N/A'}`);
    setTxMessage(`${action.charAt(0).toUpperCase() + action.slice(1)}ing source ${sourceId}...`);
    
    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setTxMessage(`✅ Source ${sourceId} ${action}d successfully!`);
    setTimeout(() => setTxMessage(''), 3000);
    
    return true;
  }, []);
  
  return {
    // Transaction handlers
    handleStake,
    handleUnstake,
    handleClaimPoints,
    handleRedeemPoints,
    handleToggleActivationRequest,
    handleConfirmActivation,
    
    // Transaction states
    isApproving,
    isStaking,
    isUnstaking,
    isClaiming,
    isRedeeming,
    isProcessingTx,
    
    // Transaction messaging
    txMessage,
    setTxMessage
  };
}