import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment
export const PACKAGE_ID = '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf';

// Shared object IDs - Updated with latest deployment
export const SHARED_OBJECTS = {
  config: '0x1a5dee16d572830a43e86cad2562be36c6b7350600cff1dcb4496fafaa203ef9',
  ledger: '0xc6e43029177ccc41afe2c4836fae1843492e8477cd95f7d2465e27d7722bc31d',
  stakingManager: '0xa16cefcddf869a44b74a859b2f77b0d00d48cf0cb57b804802a750e8283dbee2',
  escrowVault: '', // TODO: Update after initialization
  loanConfig: '',  // TODO: Update after initialization
  oracle: '',      // TODO: Update after initialization
  mintStats: 'PLACEHOLDER_MINT_STATS_ID',
  supplyOracle: 'PLACEHOLDER_SUPPLY_ORACLE_ID',
  partnerRegistry: '', // TODO: Update after initialization
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';