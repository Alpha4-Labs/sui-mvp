import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment
export const PACKAGE_ID = '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf';

// Shared object IDs - Updated with latest deployment
export const SHARED_OBJECTS = {
  config: import.meta.env.VITE_CONFIG_ID,
  ledger: import.meta.env.VITE_LEDGER_ID,
  stakingManager: import.meta.env.VITE_STAKING_MANAGER_ID,
  escrowVault: import.meta.env.VITE_ESCROW_VAULT_ID,
  loanConfig: import.meta.env.VITE_LOAN_CONFIG_ID,
  oracle: import.meta.env.VITE_ORACLE_ID,
  mintStats: import.meta.env.VITE_MINT_STATS_ID,
  supplyOracle: import.meta.env.VITE_SUPPLY_ORACLE_ID,
  partnerRegistry: import.meta.env.VITE_PARTNER_REGISTRY_ID,
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';