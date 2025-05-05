// src/utils/sui-utils.ts
// This file centralizes all Sui SDK imports to avoid circular dependencies

// Import from the updated @mysten/sui package (not sui.js)
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';

// Export what's needed by the rest of your application
export { Transaction, SuiClient };

// Add any utility functions for transaction building that don't depend on your app's state
export function createBasicTransaction() {
  return new Transaction();
}