import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { formatErrorForToast, parseErrorCode } from './errorCodes';
import { globalRateLimiter } from './globalRateLimiter';

interface SimulationResult {
  success: boolean;
  gasUsed?: string;
  error?: {
    title: string;
    message: string;
    code?: number;
  };
}

/**
 * Extract error information from a failed simulation
 */
function extractErrorFromSimulation(simulation: any): { message: string; code?: number } {
  const errorInfo = simulation.effects.status.error;
  if (typeof errorInfo === 'string') {
    return { message: errorInfo };
  }
  
  if (typeof errorInfo === 'object') {
    const errorStr = JSON.stringify(errorInfo);
    const codeMatch = errorStr.match(/\b(\d{3})\b/); // Extract 3-digit error codes
    return {
      message: errorStr,
      code: codeMatch ? parseInt(codeMatch[1]) : undefined
    };
  }
  
  return { message: 'Unknown simulation error' };
}

/**
 * Extract error information from simulation exceptions
 */
function extractSimulationError(error: any): { message: string; code?: number } {
  const errorMsg = error.message || error.toString();
  const codeMatch = errorMsg.match(/\b(\d{3})\b/); // Extract 3-digit error codes
  
  return {
    message: errorMsg,
    code: codeMatch ? parseInt(codeMatch[1]) : undefined
  };
}

/**
 * Simulates a transaction before execution to catch errors early
 * Includes retry logic for 429 rate limit errors
 */
export async function simulateTransaction(
  client: SuiClient,
  transaction: Transaction,
  senderAddress: string,
  maxRetries: number = 3
): Promise<SimulationResult> {
  try {
    // Validate sender address first
    if (!senderAddress) {
      return {
        success: false,
        error: {
          title: 'Missing Sender Address',
          message: 'Transaction sender address is required for simulation',
        },
      };
    }

    // Set the sender on the transaction before building
    transaction.setSender(senderAddress);

    // Build transaction for simulation
    const builtTransaction = await transaction.build({ client });
    
    // Retry logic for rate limiting
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const simulation = await client.dryRunTransactionBlock({
          transactionBlock: builtTransaction,
        });

        if (simulation.effects.status.status === 'success') {
          return {
            success: true,
            gasUsed: simulation.effects.gasUsed?.computationCost || '1000000',
          };
        } else {
          const errorInfo = extractErrorFromSimulation(simulation);
          return {
            success: false,
            error: {
              title: 'Simulation Error',
              message: errorInfo.message,
              code: errorInfo.code
            },
          };
        }
      } catch (err: any) {
        // Handle 429 rate limit errors with exponential backoff
        if (err.message?.includes('429') && attempt < maxRetries) {
          const backoffTime = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        
        throw err; // Re-throw non-429 errors or final attempt
      }
    }

    return {
      success: false,
      error: {
        title: 'Max Retries Exceeded',
        message: 'Max retries exceeded due to rate limiting',
      },
    };
  } catch (error: any) {
    const errorInfo = extractSimulationError(error);
    
    // Special handling for Error 112 (stale state after settings update)
    if (errorInfo.code === 112) {
      // Wait and retry once for potential state staleness
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        // Set sender on the transaction again for retry
        transaction.setSender(senderAddress);
        
        // Rebuild transaction and retry simulation
        const freshTransaction = await transaction.build({ client });
        const retrySimulation = await client.dryRunTransactionBlock({
          transactionBlock: freshTransaction,
        });

        if (retrySimulation.effects.status.status === 'success') {
          return {
            success: true,
            gasUsed: retrySimulation.effects.gasUsed?.computationCost || '1000000',
          };
        }
      } catch (retryErr) {
        // If retry fails, return original error
      }
    }

    return {
      success: false,
      error: {
        title: 'Simulation Error',
        message: errorInfo.message,
        code: errorInfo.code
      },
    };
  }
}

/**
 * Validates a transaction simulation result and throws if it would fail
 * Used to prevent execution of transactions that will definitely fail
 */
export function validateSimulationBeforeExecution(simulation: SimulationResult): void {
  if (!simulation.success) {
    throw new Error(`Simulation failed: ${simulation.error?.message}`);
  }
}

/**
 * Enhanced transaction execution with pre-simulation
 */
export async function executeWithSimulation(
  client: SuiClient,
  transaction: Transaction,
  senderAddress: string,
  signAndExecute: (params: any) => Promise<any>,
  onSimulationError?: (error: SimulationResult['error']) => void
): Promise<any> {
  // First, simulate the transaction
  const simulation = await simulateTransaction(client, transaction, senderAddress);
  
  if (!simulation.success && simulation.error) {
    // Call error handler if provided
    if (onSimulationError) {
      onSimulationError(simulation.error);
    }
    
    // Throw error to prevent execution
    throw new Error(`Simulation failed: ${simulation.error.message}`);
  }
  
  console.log(`✅ Simulation passed. Estimated gas: ${simulation.gasUsed}`);
  
  // If simulation passed, proceed with actual execution
  return await signAndExecute({
    transaction,
    chain: 'sui:testnet',
  });
} 