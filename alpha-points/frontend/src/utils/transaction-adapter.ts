/**
 * Transaction adapter utilities for Sui transactions
 * Converts between different transaction formats required by the SDK
 */

// Define a type for the PTB JSON structure returned by build functions
type ProgrammableTransactionBlockJson = any; // We'll use any for flexibility with various PTB formats

/**
 * Input type expected by the useSignAndExecuteTransaction hook
 * The key property holding the transaction data is 'transaction'
 */
export interface SignAndExecuteInput {
  transaction: ProgrammableTransactionBlockJson;
  options?: {
    showEffects?: boolean;
    showEvents?: boolean;
    showInput?: boolean;
    showObjectChanges?: boolean;
  };
  // Could include other properties like gasBudget if needed
}

/**
 * Gets the error message from a transaction response
 * Safe implementation that doesn't rely on type imports and uses explicit checks
 * 
 * @param result The transaction result or error object
 * @returns Error message from the transaction result, or null if no error
 */
export function getTransactionResponseError(result: unknown): string | null {
  if (!result) return null;
  
  // Only process if result is an object
  if (typeof result !== 'object' || result === null) return null;
  
  // Safely check for nested properties using type guards at each level
  const resultObj = result as Record<string, unknown>;
  
  // Check for effects object
  if (!('effects' in resultObj) || 
      typeof resultObj.effects !== 'object' || 
      resultObj.effects === null) {
    return null;
  }
  
  const effects = resultObj.effects as Record<string, unknown>;
  
  // Check for status object
  if (!('status' in effects) || 
      typeof effects.status !== 'object' || 
      effects.status === null) {
    return null;
  }
  
  const status = effects.status as Record<string, unknown>;
  
  // Check for status status
  if (!('status' in status) || typeof status.status !== 'string') {
    return null;
  }
  
  // Now we can safely check the status value
  if (status.status === 'failure') {
    // Check for error message
    if ('error' in status && status.error !== undefined) {
      return String(status.error);
    }
    return 'Transaction failed without specific error message';
  }
  
  return null;
}

/**
 * Adapts transaction objects in PTB JSON format to the format
 * expected by useSignAndExecuteTransaction hook
 * 
 * @param ptbJson The programmable transaction block JSON
 * @returns Properly structured input for useSignAndExecuteTransaction
 */
export function adaptPtbJsonForSignAndExecute(
  ptbJson: ProgrammableTransactionBlockJson
): SignAndExecuteInput {
  return {
    transaction: ptbJson, // Use the correct 'transaction' property name
    options: {
      showEffects: true,  // Show transaction effects by default
      showEvents: true,   // Show emitted events by default
      showObjectChanges: true, // Show object changes for better debugging
    }
  };
}

/**
 * Converts error responses from transaction execution into user-friendly messages
 * 
 * @param error The error object from a failed transaction
 * @returns A user-friendly error message
 */
export function getTransactionErrorMessage(error: unknown): string {
  // First check if it's a transaction response with error
  const responseError = getTransactionResponseError(error);
  if (responseError) {
    return `Transaction failed: ${responseError}`;
  }
  
  // Handle different error types with safe type checking
  if (error !== null && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    
    // Check for code and message properties (common in SDK errors)
    if ('code' in errorObj && 'message' in errorObj && 
        typeof errorObj.message === 'string') {
      return `Transaction error (${errorObj.code}): ${errorObj.message}`;
    }
  }
  
  // Convert error to string for pattern matching, safely
  const errorString = String(error).toLowerCase();
  
  // Check for common error patterns
  if (errorString.includes('insufficient gas')) {
    return 'Insufficient gas to execute transaction. Please ensure you have enough SUI.';
  }
  
  if (errorString.includes('authority')) {
    return 'Authorization failed. You may not have permission to execute this action.';
  }
  
  if (errorString.includes('object not found')) {
    return 'Required object not found. It may have been modified or deleted.';
  }
  
  if (errorString.includes('timeout')) {
    return 'Transaction timed out. The network may be congested, please try again later.';
  }
  
  if (errorString.includes('rejected')) {
    return 'Transaction was rejected by the wallet. Please check your wallet and try again.';
  }
  
  // Handle Error objects directly
  if (error instanceof Error) {
    return error.message;
  }
  
  // Default error message
  return typeof error === 'string' ? error : 'An unknown error occurred during transaction execution.';
}