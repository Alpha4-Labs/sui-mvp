import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment Hp6r...
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x6e05b684cb57e05e959026fb149f0e1f7a4d56f0805fca59ee6d890b8e80a9b8';

// Shared object IDs - Updated with latest deployment fallbacks
// !! IMPORTANT: Verify loanConfig, oracle, and escrowVault fallbacks match your latest initialization results !!
export const SHARED_OBJECTS = {
  // Latest Config ID from deployment Hp6r...
  config: import.meta.env.VITE_CONFIG_ID || '0xe6210c93431498eb0fe03afbef965167bb396bc146f10bec61b30a961cc4b9dc',
  // Latest Ledger ID from deployment Hp6r...
  ledger: import.meta.env.VITE_LEDGER_ID || '0xe8e7402ce5a2559c9fb29d7d7c63379788cc55c01977c85506b3da7a26c037a7',
  // Final fallbacks based on latest initialization
  escrowVault: import.meta.env.VITE_ESCROW_ID || '0x7c8556877573fd350e61d75797578b64f6b56205a292b8d48f220ed26f91e749', 
  loanConfig: import.meta.env.VITE_LOAN_ID || '0x0d77e007b9c0f6e5a4b2ab884573084d16c516cd2f51e51e845ab98334e4eba1', 
  oracle: import.meta.env.VITE_ORACLE_ID || '0x46ac1e6987ed32387cb1cc565371c4d57e1064e744281b537366dde484660b2c'   
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';