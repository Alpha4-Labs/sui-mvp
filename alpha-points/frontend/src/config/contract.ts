import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---

// Latest Package ID from deployment
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID;

// Old Package ID (if migrating or needing to read old objects)
export const OLD_PACKAGE_ID = import.meta.env.VITE_OLD_PACKAGE_ID;
if (!PACKAGE_ID && OLD_PACKAGE_ID) { // Check if new is undefined but old is defined
  console.warn(
    'WARNING: VITE_PACKAGE_ID is not defined, but VITE_OLD_PACKAGE_ID is. Ensure VITE_PACKAGE_ID is set for current operations.'
  );
} else if (PACKAGE_ID && !OLD_PACKAGE_ID) {
  console.info(
    'INFO: VITE_OLD_PACKAGE_ID is not defined. This is normal if there are no old package objects to query.'
  );
} else if (!PACKAGE_ID && !OLD_PACKAGE_ID) {
  console.error(
    'CRITICAL: Neither VITE_PACKAGE_ID nor VITE_OLD_PACKAGE_ID are defined. Application will likely not function.'
  );
}

// --- Load Core Object IDs from Environment Variables ---

const VITE_CONFIG_ID = import.meta.env.VITE_CONFIG_ID;
if (!VITE_CONFIG_ID || typeof VITE_CONFIG_ID !== 'string' || !VITE_CONFIG_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_CONFIG_ID is not defined, not a string, or not a valid Sui Object ID. Using placeholder.'
  );
}

const VITE_LEDGER_ID = import.meta.env.VITE_LEDGER_ID;
if (!VITE_LEDGER_ID || typeof VITE_LEDGER_ID !== 'string' || !VITE_LEDGER_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_LEDGER_ID is not defined, not a string, or not a valid Sui Object ID. Using placeholder.'
  );
}

const VITE_STAKING_MANAGER_ID = import.meta.env.VITE_STAKING_MANAGER_ID;
if (!VITE_STAKING_MANAGER_ID || typeof VITE_STAKING_MANAGER_ID !== 'string' || !VITE_STAKING_MANAGER_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_STAKING_MANAGER_ID is not defined, not a string, or not a valid Sui Object ID. Using placeholder.'
  );
}

const VITE_ORACLE_ID = import.meta.env.VITE_ORACLE_ID;
if (!VITE_ORACLE_ID || typeof VITE_ORACLE_ID !== 'string' || !VITE_ORACLE_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_ORACLE_ID is not defined, not a string, or not a valid Sui Object ID. Using placeholder.'
  );
}

const VITE_LOAN_ID = import.meta.env.VITE_LOAN_ID;
if (!VITE_LOAN_ID || typeof VITE_LOAN_ID !== 'string' || !VITE_LOAN_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_LOAN_ID is not defined, not a string, or not a valid Sui Object ID. Using placeholder.'
  );
}

const VITE_ESCROW_VAULT_ID = import.meta.env.VITE_ESCROW_ID; // Generic escrow, adjust if multiple needed
if (!VITE_ESCROW_VAULT_ID || typeof VITE_ESCROW_VAULT_ID !== 'string' || !VITE_ESCROW_VAULT_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_ESCROW_VAULT_ID is not defined, not a string, or not a valid Sui Object ID. Using placeholder.'
  );
}

const VITE_PARTNER_CAP_ID = import.meta.env.VITE_PARTNER_CAP;
if (!VITE_PARTNER_CAP_ID || typeof VITE_PARTNER_CAP_ID !== 'string' || !VITE_PARTNER_CAP_ID.startsWith('0x')) {
  console.error(
    'CRITICAL: VITE_PARTNER_CAP_ID is not defined, not a string, or not a valid Sui Object ID. Using placeholder.'
  );
}

// Shared object IDs - Updated with latest deployment
export const SHARED_OBJECTS = {
  config: VITE_CONFIG_ID || '0xINVALID_CONFIG_ID_FALLBACK',
  ledger: VITE_LEDGER_ID || '0xINVALID_LEDGER_ID_FALLBACK',
  stakingManager: VITE_STAKING_MANAGER_ID || '0xINVALID_STAKING_MANAGER_ID_FALLBACK',
  escrowVault: VITE_ESCROW_VAULT_ID || '0xINVALID_ESCROW_VAULT_ID_FALLBACK', // For general use, e.g. SUI redemptions
  loanConfig: VITE_LOAN_ID || '0xINVALID_LOAN_ID_FALLBACK',
  oracle: VITE_ORACLE_ID || '0xINVALID_ORACLE_ID_FALLBACK',
  partnerCap: VITE_PARTNER_CAP_ID || '0xINVALID_PARTNER_CAP_ID_FALLBACK' // A generic/platform partner cap
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';