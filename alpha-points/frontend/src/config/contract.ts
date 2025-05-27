import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment
export const PACKAGE_ID = '0xfd761a2a5979db53f7f3176c0778695f6abafbb7c0eec8ce03136ae10dc2b47d';

// Attempt to load VITE_ORACLE_ID from environment variables
const VITE_ORACLE_ID = import.meta.env.VITE_ORACLE_ID;

if (!VITE_ORACLE_ID || typeof VITE_ORACLE_ID !== 'string' || !VITE_ORACLE_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_ORACLE_ID is not defined in your .env file, is not a string, or is not a valid Sui Object ID. '
    + 'Please ensure VITE_ORACLE_ID is set correctly (e.g., VITE_ORACLE_ID=0xyouroracleid). '
    + 'Using a placeholder, which will likely cause runtime errors.'
  );
}

// Attempt to load VITE_LOAN_ID from environment variables
const VITE_LOAN_ID = import.meta.env.VITE_LOAN_ID;

if (!VITE_LOAN_ID || typeof VITE_LOAN_ID !== 'string' || !VITE_LOAN_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_LOAN_ID is not defined in your .env file, is not a string, or is not a valid Sui Object ID. '
    + 'Please ensure VITE_LOAN_ID is set correctly (e.g., VITE_LOAN_ID=0xyourloanid). '
    + 'Using a placeholder, which will likely cause runtime errors.'
  );
}

// Shared object IDs - Updated with latest deployment
export const SHARED_OBJECTS = {
  config: '0x0a2655cc000b24a316390753253f59de6691ec0b418d38bb6bca535c4c66e9bb',
  ledger: '0x90f17af41623cdeccbeb2b30b5df435135247e34526d56c40c491b017452dc00',
  stakingManager: '0x3fa797fcbc0bec7390910311f432329e68e4fdf23f1a55033410e81f3ebd08f4',
  escrowVault: 'YOUR_ESCROW_VAULT_ID_IF_APPLICABLE',
  loanConfig: VITE_LOAN_ID || '0xINVALID_LOAN_ID_FALLBACK',
  oracle: VITE_ORACLE_ID || '0xINVALID_ORACLE_ID_FALLBACK',
  partnerCap: 'YOUR_GENERIC_PARTNER_CAP_ID_IF_APPLICABLE'
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';