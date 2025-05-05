/**
 * Transaction adapter utilities for Sui transactions
 * Updates to align with Sui SDK v1.0+
 */

/**
 * Input type expected by the useSignAndExecuteTransaction hook
 * Updated to match the latest SDK interface
 */
export interface SignAndExecuteInput {
  transaction: Record<string, any>;
  options?: {
    showEffects?: boolean;
    showEvents?: boolean;
    showInput?: boolean;
    showObjectChanges?: boolean;
  };
  // Optional gas budget
  gasBudget?: number;
}

/**
 * Gets error message directly from a transaction response
 * Safely navigates the nested structure without assumptions about types
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
  
  // Check for status field
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
 * Adapts transaction objects to the format expected by useSignAndExecuteTransaction hook
 * Updated to use the new transaction format in Sui SDK v1.0+
 */
export function adaptPtbJsonForSignAndExecute(
  transaction: Record<string, any>,
  options?: {
    showEffects?: boolean;
    showEvents?: boolean;
    showObjectChanges?: boolean;
    gasBudget?: number;
  }
): SignAndExecuteInput {
  // Default options merged with provided options
  const defaultOptions = {
    showEffects: true,
    showEvents: true,
    showObjectChanges: true,
    ...options
  };

  // Build the final input structure
  const result: SignAndExecuteInput = {
    transaction,
    options: {
      showEffects: defaultOptions.showEffects,
      showEvents: defaultOptions.showEvents,
      showObjectChanges: defaultOptions.showObjectChanges,
    }
  };
  
  // Add optional gas budget if provided
  if (defaultOptions.gasBudget !== undefined) {
    result.gasBudget = defaultOptions.gasBudget;
  }
  
  return result;
}

/**
 * Converts error responses from transaction execution into user-friendly messages
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
    
    // Check for SDK error format
    if ('code' in errorObj && 'message' in errorObj && 
        typeof errorObj.message === 'string') {
      return `Error ${errorObj.code}: ${errorObj.message}`;
    }
    
    // Check for nested error objects
    if ('error' in errorObj && errorObj.error !== null && 
        typeof errorObj.error === 'object') {
      const nestedError = errorObj.error as Record<string, unknown>;
      if ('message' in nestedError && typeof nestedError.message === 'string') {
        return nestedError.message;
      }
    }
  }
  
  // Convert error to string for pattern matching, safely
  const errorString = String(error).toLowerCase();
  
  // Check for common error patterns with more detailed user feedback
  if (errorString.includes('insufficient gas') || errorString.includes('gas budget')) {
    return 'Insufficient gas to execute transaction. Please ensure you have enough SUI balance.';
  }
  
  if (errorString.includes('authority') || errorString.includes('unauthorized')) {
    return 'Authorization failed. You may not have permission to execute this action.';
  }
  
  if (errorString.includes('object not found') || errorString.includes('missing')) {
    return 'Required object not found. It may have been modified or deleted by another transaction.';
  }
  
  if (errorString.includes('timeout')) {
    return 'Transaction timed out. The network may be congested, please try again later.';
  }
  
  if (errorString.includes('rejected') || errorString.includes('denied')) {
    return 'Transaction was rejected by the wallet. Please check your wallet and try again.';
  }
  
  // Handle Error objects directly
  if (error instanceof Error) {
    return error.message;
  }
  
  // Default error message
  return typeof error === 'string' 
    ? error 
    : 'An unknown error occurred during transaction execution.';
}