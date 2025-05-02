// src/utils/transaction-helpers.js
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { toBcsCompatible } from './bcs-helpers';

/**
 * Error categories for transaction failures
 */
export const ErrorTypes = {
  USER_REJECTED: 'user_rejected',
  GAS_INSUFFICIENT: 'gas_insufficient',
  OBJECT_NOT_FOUND: 'object_not_found',
  OBJECT_OWNED_BY_OTHER: 'object_owned_by_other',
  OBJECT_IMMUTABLE: 'object_immutable',
  MOVE_ABORT: 'move_abort',
  MOVE_TYPE_ERROR: 'move_type_error',
  DEADLINE_EXCEEDED: 'deadline_exceeded',
  SIMULATION_FAILURE: 'simulation_failure',
  NETWORK_ERROR: 'network_error',
  UNKNOWN: 'unknown'
};

/**
 * Parses a transaction error to determine its type and message
 * @param {Error} error - The error object
 * @returns {object} - Object with error type and message
 */
export function parseTransactionError(error) {
  if (!error) {
    return { type: ErrorTypes.UNKNOWN, message: 'Unknown error' };
  }
  
  // Extract message from different error formats
  const errorMessage = error.message || error.error?.message || error.details || error.toString();
  
  // User rejection
  if (
    error.code === 4001 || 
    error.code === 'UserRejectedError' ||
    errorMessage.includes('User rejected') ||
    errorMessage.includes('user rejected') ||
    errorMessage.includes('cancelled')
  ) {
    return { 
      type: ErrorTypes.USER_REJECTED, 
      message: 'Transaction rejected by user' 
    };
  }
  
  // Gas issues
  if (
    errorMessage.includes('insufficient gas') ||
    errorMessage.includes('gas budget') ||
    errorMessage.includes('out of gas')
  ) {
    return { 
      type: ErrorTypes.GAS_INSUFFICIENT, 
      message: 'Insufficient gas for transaction' 
    };
  }
  
  // Object issues
  if (errorMessage.includes('object not found')) {
    return { 
      type: ErrorTypes.OBJECT_NOT_FOUND, 
      message: 'One or more objects not found' 
    };
  }
  
  if (errorMessage.includes('not owned by sender')) {
    return { 
      type: ErrorTypes.OBJECT_OWNED_BY_OTHER, 
      message: 'Object not owned by sender' 
    };
  }
  
  if (errorMessage.includes('immutable object')) {
    return { 
      type: ErrorTypes.OBJECT_IMMUTABLE, 
      message: 'Cannot modify immutable object' 
    };
  }
  
  // Move errors
  if (errorMessage.includes('Move abort') || errorMessage.includes('AbortCode')) {
    // Try to extract the abort code and module
    const abortMatch = errorMessage.match(/Move abort in ([\w:]+)::(\w+): (\d+)/);
    if (abortMatch) {
      const [, module, function_, code] = abortMatch;
      return {
        type: ErrorTypes.MOVE_ABORT,
        message: `Move abort in ${module}::${function_} with code ${code}`,
        data: { module, function: function_, code }
      };
    }
    
    return { 
      type: ErrorTypes.MOVE_ABORT, 
      message: 'Transaction aborted by Move code' 
    };
  }
  
  if (errorMessage.includes('type error')) {
    return { 
      type: ErrorTypes.MOVE_TYPE_ERROR, 
      message: 'Move type error in transaction' 
    };
  }
  
  // Network issues
  if (
    errorMessage.includes('deadline exceeded') ||
    errorMessage.includes('timeout')
  ) {
    return { 
      type: ErrorTypes.DEADLINE_EXCEEDED, 
      message: 'Transaction timed out' 
    };
  }
  
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    error.code === 'NETWORK_ERROR'
  ) {
    return { 
      type: ErrorTypes.NETWORK_ERROR, 
      message: 'Network error occurred' 
    };
  }
  
  // Simulation failures
  if (errorMessage.includes('simulation failed')) {
    return { 
      type: ErrorTypes.SIMULATION_FAILURE, 
      message: 'Transaction simulation failed' 
    };
  }
  
  // Default unknown error
  return {
    type: ErrorTypes.UNKNOWN,
    message: `Transaction failed: ${errorMessage}`
  };
}

/**
 * Formats a user-friendly error message
 * @param {object|Error} error - The error object or result from parseTransactionError
 * @param {string} defaultMessage - Default error message if parsing fails
 * @returns {string} - User-friendly error message
 */
export function formatErrorMessage(error, defaultMessage = 'Transaction failed') {
  if (!error) {
    return defaultMessage;
  }
  
  // If already parsed, use the message
  if (error.type && error.message) {
    return error.message;
  }
  
  // Parse the error
  const parsedError = parseTransactionError(error);
  return parsedError.message || defaultMessage;
}

/**
 * Creates a transaction block for staking
 * @param {object} params - Staking parameters
 * @returns {TransactionBlock} - Transaction block object
 */
export function createStakeTransaction({
  packageId,
  configId,
  escrowId,
  amount,
  tokenType,
  duration = 30, // Default duration in epochs
  decimals = 9
}) {
  const tx = new TransactionBlock();
  
  // Convert amount to BCS compatible format
  const amountBcs = toBcsCompatible(amount, decimals);
  
  // Split coin from gas coin
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(amountBcs.toString())]);
  
  // Add system clock object
  const clockObj = tx.object('0x6');
  
  // Call the stake function
  tx.moveCall({
    target: `${packageId}::integration::route_stake`,
    arguments: [
      tx.object(configId),    // Config object
      tx.object(escrowId),    // Escrow vault
      clockObj,               // Clock
      coin,                   // Coin to stake
      tx.pure(duration),      // Duration in epochs
    ],
    typeArguments: [tokenType],
  });
  
  return tx;
}

/**
 * Creates a transaction block for unstaking
 * @param {object} params - Unstaking parameters
 * @returns {TransactionBlock} - Transaction block object
 */
export function createUnstakeTransaction({
  packageId,
  configId,
  ledgerId,
  escrowId,
  stakeObjectId,
  tokenType
}) {
  const tx = new TransactionBlock();
  
  // Add system clock object
  const clockObj = tx.object('0x6');
  
  // Call the unstake function
  tx.moveCall({
    target: `${packageId}::integration::redeem_stake`,
    arguments: [
      tx.object(configId),           // Config object
      tx.object(ledgerId),           // Ledger object
      tx.object(escrowId),           // Escrow vault
      tx.object(stakeObjectId),      // Stake position to redeem
      clockObj,                      // Clock
    ],
    typeArguments: [tokenType],
  });
  
  return tx;
}

/**
 * Creates a transaction block for claiming points
 * @param {object} params - Claim parameters
 * @returns {TransactionBlock} - Transaction block object
 */
export function createClaimPointsTransaction({
  packageId,
  configId,
  ledgerId
}) {
  const tx = new TransactionBlock();
  
  // Call the claim points function
  tx.moveCall({
    target: `${packageId}::integration::claim_points`,
    arguments: [
      tx.object(configId),    // Config object
      tx.object(ledgerId),    // Ledger object
    ],
    typeArguments: [],
  });
  
  return tx;
}

/**
 * Creates a transaction block for redeeming points
 * @param {object} params - Redemption parameters
 * @returns {TransactionBlock} - Transaction block object
 */
export function createRedeemPointsTransaction({
  packageId,
  configId,
  ledgerId,
  escrowId,
  oracleId,
  amount,
  tokenType,
  decimals = 9
}) {
  const tx = new TransactionBlock();
  
  // Convert amount to BCS compatible format
  const amountBcs = toBcsCompatible(amount, decimals);
  
  // Add system clock object
  const clockObj = tx.object('0x6');
  
  // Call the redeem points function
  tx.moveCall({
    target: `${packageId}::integration::redeem_points`,
    arguments: [
      tx.object(configId),           // Config object
      tx.object(ledgerId),           // Ledger object
      tx.object(escrowId),           // Escrow vault
      tx.object(oracleId),           // Rate oracle
      tx.pure(amountBcs.toString()), // Points amount
      clockObj,                      // Clock
    ],
    typeArguments: [tokenType],
  });
  
  return tx;
}

/**
 * Creates a transaction block for creating a loan
 * @param {object} params - Loan parameters
 * @returns {TransactionBlock} - Transaction block object
 */
export function createLoanTransaction({
  packageId,
  configId,
  loanConfigId,
  ledgerId,
  stakeObjectId,
  oracleId,
  amount,
  tokenType,
  decimals = 9
}) {
  const tx = new TransactionBlock();
  
  // Convert amount to BCS compatible format
  const amountBcs = toBcsCompatible(amount, decimals);
  
  // Add system clock object
  const clockObj = tx.object('0x6');
  
  // Call the open loan function
  tx.moveCall({
    target: `${packageId}::loan::open_loan`,
    arguments: [
      tx.object(configId),           // Config object
      tx.object(loanConfigId),       // Loan config
      tx.object(ledgerId),           // Ledger object
      tx.object(stakeObjectId),      // Stake position
      tx.object(oracleId),           // Rate oracle
      tx.pure(amountBcs.toString()), // Points amount
      clockObj,                      // Clock
    ],
    typeArguments: [tokenType],
  });
  
  return tx;
}

/**
 * Creates a transaction block for repaying a loan
 * @param {object} params - Loan repayment parameters
 * @returns {TransactionBlock} - Transaction block object
 */
export function createRepayLoanTransaction({
  packageId,
  configId,
  ledgerId,
  loanObjectId,
  stakeObjectId,
  tokenType
}) {
  const tx = new TransactionBlock();
  
  // Add system clock object
  const clockObj = tx.object('0x6');
  
  // Call the repay loan function
  tx.moveCall({
    target: `${packageId}::loan::repay_loan`,
    arguments: [
      tx.object(configId),           // Config object
      tx.object(ledgerId),           // Ledger object
      tx.object(loanObjectId),       // Loan object
      tx.object(stakeObjectId),      // Stake position
      clockObj,                      // Clock
    ],
    typeArguments: [tokenType],
  });
  
  return tx;
}

/**
 * Execute a transaction block with appropriate options
 * @param {object} params - Execution parameters
 * @returns {Promise} - Promise that resolves with transaction result
 */
export async function executeTransaction({
  walletAdapter,
  transactionBlock,
  options = {}
}) {
  // Default options
  const defaultOptions = {
    showEffects: true,
    showEvents: true,
    showInput: false,
    showObjectChanges: true,
  };
  
  // Merge options
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    // Sign and execute transaction
    const result = await walletAdapter.signAndExecuteTransactionBlock({
      transactionBlock,
      options: mergedOptions,
    });
    
    // Check for success
    if (result.effects?.status?.status !== 'success') {
      const error = result.effects?.status?.error || 'Transaction failed';
      throw new Error(error);
    }
    
    return result;
  } catch (error) {
    // Parse the error
    const parsedError = parseTransactionError(error);
    throw parsedError;
  }
}

/**
 * Extract events from transaction result
 * @param {object} result - Transaction execution result
 * @param {string} eventType - Event type to filter (optional)
 * @returns {Array} - Extracted events
 */
export function extractEvents(result, eventType = null) {
  if (!result || !result.events || !Array.isArray(result.events)) {
    return [];
  }
  
  // Filter events by type if specified
  if (eventType) {
    return result.events.filter(event => 
      event.type && event.type.includes(eventType)
    );
  }
  
  return result.events;
}

/**
 * Extract created objects from transaction result
 * @param {object} result - Transaction execution result
 * @returns {Array} - Created objects
 */
export function extractCreatedObjects(result) {
  if (!result || !result.effects || !result.effects.created) {
    return [];
  }
  
  return result.effects.created;
}

/**
 * Determines if a transaction is in progress by checking transaction digests
 * @param {string} digest - Transaction digest to check
 * @param {object} provider - Sui provider
 * @returns {Promise<boolean>} - True if transaction is still in progress
 */
export async function isTransactionInProgress(digest, provider) {
  if (!digest || !provider) {
    return false;
  }
  
  try {
    const txData = await provider.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
      },
    });
    
    if (!txData || !txData.effects || !txData.effects.status) {
      return true; // Assume in progress if can't determine status
    }
    
    return txData.effects.status.status !== 'success' && 
           txData.effects.status.status !== 'failure';
  } catch (error) {
    // If not found, it's probably still being processed
    if (error.message && error.message.includes('not found')) {
      return true;
    }
    
    console.error('Error checking transaction status:', error);
    return false;
  }
}

/**
 * Wait for transaction to complete
 * @param {string} digest - Transaction digest
 * @param {object} provider - Sui provider
 * @param {object} options - Options for waiting
 * @returns {Promise<object>} - Transaction data when complete
 */
export async function waitForTransaction(digest, provider, options = {}) {
  const {
    timeoutMs = 60000,    // Default 60 second timeout
    pollIntervalMs = 2000 // Default 2 second poll interval
  } = options;
  
  if (!digest || !provider) {
    throw new Error('Transaction digest and provider are required');
  }
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const txData = await provider.getTransactionBlock({
        digest,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });
      
      if (txData && txData.effects && txData.effects.status) {
        if (txData.effects.status.status === 'success' || 
            txData.effects.status.status === 'failure') {
          return txData;
        }
      }
    } catch (error) {
      // Ignore not found errors - transaction still processing
      if (!error.message || !error.message.includes('not found')) {
        console.warn('Error checking transaction status:', error);
      }
    }
    
    // Wait for next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  // Timeout reached
  throw new Error(`Transaction ${digest} did not complete within ${timeoutMs}ms timeout`);
}