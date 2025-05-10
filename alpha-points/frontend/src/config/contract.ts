import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment 85Nb36...
export const PACKAGE_ID = '0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a';

// Shared object IDs - Updated with latest deployment fallbacks
// !! IMPORTANT: Verify loanConfig, oracle, and escrowVault fallbacks match your latest initialization results !!
export const SHARED_OBJECTS = {
  // Latest Config ID from deployment 85Nb36...
  config: '0xf180290c291c7c9628e90e04484ec9e5688802273997e9a05df5431798342f05',
  // Latest Ledger ID from deployment 85Nb36...
  ledger: '0x46d8bcb53f05d758b4b77924095a8358da5b7005a9b3e08a4e970ef617690335',
  // StakingManager ID from deployment 85Nb36...
  stakingManager: '0xf4f96a8211465553dd477e0471f4a57dc5ec3f1810d457e90d9bf9f9539262eb',
  // IDs to be updated after separate initialization if not part of main package init
  // Default to environment variable, or an empty string if the env var is not set.
  escrowVault: import.meta.env.VITE_ESCROW_ID || '', 
  loanConfig: import.meta.env.VITE_LOAN_ID || '', 
  oracle: import.meta.env.VITE_ORACLE_ID || '',   
  // You might need to add/update other shared objects like StakingManager if used globally
  // stakingManager: '0x4948056098666ae9d5fc052ce7d59ef175baa7d43521d259b1bd9aadab23b712', // Example if needed
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';