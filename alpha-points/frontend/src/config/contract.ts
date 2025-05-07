import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment 85Nb36...
export const PACKAGE_ID = '0x3a1be8e089de0f39587577c575e19f01b2458966a634eaa63f8c2dde5e08515f';

// Shared object IDs - Updated with latest deployment fallbacks
// !! IMPORTANT: Verify loanConfig, oracle, and escrowVault fallbacks match your latest initialization results !!
export const SHARED_OBJECTS = {
  // Latest Config ID from deployment 85Nb36...
  config: '0xa540c2c983d62f08f287f1b3362fd11d3fefd7c79e136be22dcae9b40f152716',
  // Latest Ledger ID from deployment 85Nb36...
  ledger: '0x8bf7c5a86e5f3d551f628825a44e84b23cd58e95f3959c79ce0d27b1ee9bd2e0',
  // StakingManager ID from deployment 85Nb36...
  stakingManager: '0x5193ca5ab52d9503a6c3c22a5cb455a70dea279492a41ffc1758b15198b088df',
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