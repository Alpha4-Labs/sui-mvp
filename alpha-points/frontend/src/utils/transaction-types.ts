/**
 * Type declarations for Sui transaction-related interfaces
 */

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
    transactionBlock: SuiTransaction;
    options?: {
      showEffects?: boolean;
      showEvents?: boolean;
      showInput?: boolean;
      showObjectChanges?: boolean;
    };
  }