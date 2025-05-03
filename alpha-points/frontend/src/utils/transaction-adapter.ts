// === utils/transaction-adapter.ts (Corrected) ===

// Define a type for the PTB JSON structure returned by your build... functions
// Using 'any' is generally discouraged, replace with a more specific type if possible
// based on the actual structure in transaction.ts or transaction-types.ts
type ProgrammableTransactionBlockJson = any;

/**
 * Input type expected by the useSignAndExecuteTransaction hook,
 * based on the TypeScript error message.
 * The key property holding the transaction data is 'transaction'.
 */
export interface SignAndExecuteInput {
    transaction: ProgrammableTransactionBlockJson; // Correct property name
    options?: {
        showEffects?: boolean;
        showEvents?: boolean;
        showInput?: boolean;
        showObjectChanges?: boolean;
        // Add other options supported by the hook if needed
    };
    // Include other potential top-level properties like gasBudget, requestType if needed
}

/**
 * Adapts our transaction objects (specifically the PTB JSON from utils/transaction.ts)
 * to the format expected by useSignAndExecuteTransaction.
 * Renamed for clarity.
 */
export function adaptPtbJsonForSignAndExecute(
    ptbJson: ProgrammableTransactionBlockJson
): SignAndExecuteInput {
    return {
        transaction: ptbJson, // Use the 'transaction' property name
        options: { // Set default options as desired
            showEffects: true,
            showEvents: true,
        }
    };
}