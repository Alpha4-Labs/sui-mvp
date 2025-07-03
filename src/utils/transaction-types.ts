// Ensure this file is placed in the src/types/ folder or adjust imports accordingly
/**
 * Type declarations for Sui transaction-related interfaces
 * These types ensure proper handling of transaction results and parameters
 */

// Define SuiTransactionBlockEffects type to properly handle status and errors
export interface SuiTransactionBlockEffects {
  status: {
    status: string;  // 'success' | 'failure'
    error?: string;  // Error message present when status is 'failure'
  };
  gasUsed?: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
  };
  transactionDigest?: string;
  // Additional fields that might be present
  // but are not necessary for our error handling
}

// Define SuiTransactionBlockResponse to properly type the result returned from signAndExecuteTransaction
export interface SuiTransactionBlockResponse {
  digest: string;
  transaction?: any;
  effects: SuiTransactionBlockEffects;
  events?: any[];
  objectChanges?: any[];
  balanceChanges?: any[];
  timestampMs?: number;
  checkpoint?: string;
}

// Type for the transaction block used in devInspectTransactionBlock
export interface DevInspectTransactionBlockParams {
  sender: string;
  transactionBlock: {
    kind: string;
    inputs: {
      kind: string;
      value: string;
      type: string;
    }[];
    transactions: {
      kind: string;
      target: string;
      arguments: {
        kind: string;
        index: number;
      }[];
    }[];
  };
}

// Extended type for Transaction to include the required properties
export interface SuiTransaction {
  kind: string;
  data: {
    transaction: {
      inputs: any[];
      transactions: any[];
    };
    sender?: string;
    gasConfig?: {
      budget?: string | number;
      price?: string | number;
    };
  };
}

// Type for the transaction input expected by signAndExecuteTransactionBlock
export interface SuiTransactionBlockInput {
  transaction: SuiTransaction;
  options?: {
    showEffects?: boolean;
    showEvents?: boolean;
    showInput?: boolean;
    showObjectChanges?: boolean;
  };
}

// Type guard to check if an object is a SuiTransactionBlockResponse
export function isSuiTransactionBlockResponse(obj: any): obj is SuiTransactionBlockResponse {
  return obj && typeof obj === 'object' && 'digest' in obj && 'effects' in obj;
}