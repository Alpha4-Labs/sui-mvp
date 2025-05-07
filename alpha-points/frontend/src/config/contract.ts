import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment AfNV6x...
export const PACKAGE_ID = '0xb3e6495f4c66d5a8fd93c0036c3a9d11dd97428b786702432118666f3d508952';

// Shared object IDs - Updated with latest deployment fallbacks
// !! IMPORTANT: Verify loanConfig, oracle, and escrowVault fallbacks match your latest initialization results !!
export const SHARED_OBJECTS = {
  // Latest Config ID from deployment AfNV6x...
  config: '0xe13cf2841ab3771ec157024874a760e94e3645faad7b1e3aa91fb4c9a5db6c09',
  // Latest Ledger ID from deployment AfNV6x...
  ledger: '0x60a9691cd54d54ab6b467fe2f14fdf529b02d48dfb45991383b57ae6c0ba09a6',
  // StakingManager ID from deployment AfNV6x...
  stakingManager: '0x4948056098666ae9d5fc052ce7d59ef175baa7d43521d259b1bd9aadab23b712',
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