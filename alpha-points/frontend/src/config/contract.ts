import { bcs } from '@mysten/sui/bcs';

// --- Contract Configuration ---
export const PACKAGE_ID_V20 = import.meta.env['VITE_PACKAGE_ID_V20'];
export const PACKAGE_ID_V19 = import.meta.env['VITE_PACKAGE_ID_V19'];
export const PACKAGE_ID_V17 = import.meta.env['VITE_PACKAGE_ID_V17'];
export const PACKAGE_ID_V18 = import.meta.env['VITE_PACKAGE_ID_V18'];
export const PACKAGE_ID_V16 = import.meta.env['VITE_PACKAGE_ID_V16'];
export const PACKAGE_ID_V15 = import.meta.env['VITE_PACKAGE_ID_V15'];
export const PACKAGE_ID_V14 = import.meta.env['VITE_PACKAGE_ID_V14'];
export const PACKAGE_ID_V13 = import.meta.env['VITE_PACKAGE_ID_V13'];
export const PACKAGE_ID_V12 = import.meta.env['VITE_PACKAGE_ID_V12'];
export const PACKAGE_ID_V11 = import.meta.env['VITE_PACKAGE_ID_V11'];
export const PACKAGE_ID_V10 = import.meta.env['VITE_PACKAGE_ID_V10'];
export const PACKAGE_ID_V9 = import.meta.env['VITE_PACKAGE_ID_V9'];
export const PACKAGE_ID_V8 = import.meta.env['VITE_PACKAGE_ID_V8']; // New v8 package
export const PACKAGE_ID_V7 = import.meta.env['VITE_PACKAGE_ID_V7']; // New v7 package
export const PACKAGE_ID_V6 = import.meta.env['VITE_PACKAGE_ID_V6']; // New v6 package
export const PACKAGE_ID_V5 = import.meta.env['VITE_PACKAGE_ID_V5']; // Ensure .env is up-to-date if used.
export const PACKAGE_ID_V4 = import.meta.env['VITE_PACKAGE_ID_V4']; // Still exported for direct use if needed, but ensure VITE_PACKAGE_ID_V4 in .env is also up-to-date if used.
export const PACKAGE_ID_V3 = import.meta.env['VITE_PACKAGE_ID_V3']; // Ensure .env is up-to-date if used.
export const PACKAGE_ID_V2 = import.meta.env['VITE_PACKAGE_ID_V2']; // Ensure .env is up-to-date if used.
export const PACKAGE_ID_V1 = import.meta.env['VITE_PACKAGE_ID_V1']; // Ensure .env is up-to-date if used.
export const PACKAGE_ID = import.meta.env['VITE_PACKAGE_ID']; // THIS IS THE SOLE INTENDED SOURCE FOR THE LATEST PACKAGE ID

// Aggregate all known package IDs, newest first
export const ALL_PACKAGE_IDS = [
  PACKAGE_ID,        // Latest (should be V8)
  PACKAGE_ID_V20,
  PACKAGE_ID_V19,
  PACKAGE_ID_V18,
  PACKAGE_ID_V17,
  PACKAGE_ID_V16,
  PACKAGE_ID_V15,
  PACKAGE_ID_V14,
  PACKAGE_ID_V13,
  PACKAGE_ID_V12,
  PACKAGE_ID_V11,
  PACKAGE_ID_V10,
  PACKAGE_ID_V9,     // V9 explicitly
  PACKAGE_ID_V8,     // V8 explicitly
  PACKAGE_ID_V7,     // V7
  PACKAGE_ID_V6,     // V6  
  PACKAGE_ID_V5,     // V5
  PACKAGE_ID_V4,     // V4
  PACKAGE_ID_V3,     // V3,
  PACKAGE_ID_V2,     // V2
  PACKAGE_ID_V1,     // V1
  // Additional known packages that created PartnerCapFlex objects
  '0xf933e69aeeeebb9d1fc50b6324070d8f2bdc2595162b0616142a509c90e3cd16', // Package that created user's PartnerCapFlex
].filter(Boolean);



// --- Load Core Object IDs from Environment Variables ---

// Helper function to validate Sui Object IDs
const isValidSuiObjectId = (id: string | undefined): boolean => {
  return typeof id === 'string' && id.startsWith('0x') && id.length === 66;
};

// Helper function to handle invalid IDs
const handleInvalidId = (name: string, id: string | undefined): string => {
  console.error(
    `CRITICAL: ${name} is not defined, not a string, or not a valid Sui Object ID. Using placeholder.`
  );
  return `0xINVALID_${name}_FALLBACK`;
};

// Ensure the primary PACKAGE_ID is correctly set
if (!isValidSuiObjectId(PACKAGE_ID)) {
  throw new Error(
    'CRITICAL: VITE_PACKAGE_ID (main PACKAGE_ID) is not defined or invalid. Application cannot start.'
  );
}

// Validate and load all required object IDs
const VITE_CONFIG_ID = import.meta.env['VITE_CONFIG_ID'];
const VITE_LEDGER_ID = import.meta.env['VITE_LEDGER_ID'];
const VITE_STAKING_MANAGER_ID = import.meta.env['VITE_STAKING_MANAGER_ID'];
const VITE_ORACLE_ID = import.meta.env['VITE_ORACLE_ID'];
const VITE_LOAN_ID = import.meta.env['VITE_LOAN_ID'];
const VITE_ESCROW_VAULT_ID = import.meta.env['VITE_ESCROW_ID'];
const VITE_PARTNER_CAP = import.meta.env['VITE_PARTNER_CAP'];
// Note: ENGAGEMENT_TRACKER_ID is dynamically discovered, not from environment

// === TVL-Backed PartnerCapFlex System ===
export const SHARED_OBJECTS = {
  config: isValidSuiObjectId(VITE_CONFIG_ID) ? VITE_CONFIG_ID : handleInvalidId('CONFIG_ID', VITE_CONFIG_ID),
  ledger: isValidSuiObjectId(VITE_LEDGER_ID) ? VITE_LEDGER_ID : handleInvalidId('LEDGER_ID', VITE_LEDGER_ID),
  stakingManager: isValidSuiObjectId(VITE_STAKING_MANAGER_ID) ? VITE_STAKING_MANAGER_ID : handleInvalidId('STAKING_MANAGER_ID', VITE_STAKING_MANAGER_ID),
  escrowVault: isValidSuiObjectId(VITE_ESCROW_VAULT_ID) ? VITE_ESCROW_VAULT_ID : handleInvalidId('ESCROW_VAULT_ID', VITE_ESCROW_VAULT_ID),
  loanConfig: isValidSuiObjectId(VITE_LOAN_ID) ? VITE_LOAN_ID : handleInvalidId('LOAN_ID', VITE_LOAN_ID),
  oracle: isValidSuiObjectId(VITE_ORACLE_ID) ? VITE_ORACLE_ID : handleInvalidId('ORACLE_ID', VITE_ORACLE_ID),
  partnerCap: isValidSuiObjectId(VITE_PARTNER_CAP) ? VITE_PARTNER_CAP : handleInvalidId('PARTNER_CAP_ID', VITE_PARTNER_CAP)
  // Note: engagementTracker is dynamically discovered via findEngagementTracker() utility
} as const;

// Type for the shared objects
export type SharedObjectIds = typeof SHARED_OBJECTS;

// Validate that all required objects are present
const missingObjects = Object.entries(SHARED_OBJECTS)
  .filter(([_, id]) => id.startsWith('0xINVALID_'))
  .map(([name]) => name);

if (missingObjects.length > 0) {
  console.error('Missing or invalid object IDs:', missingObjects.join(', '));
}

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';

// === Sponsorship Configuration ===
export const SPONSOR_CONFIG = {
  // Platform sponsor address for perk-related transactions
  PLATFORM_SPONSOR_ADDRESS: import.meta.env['VITE_PLATFORM_SPONSOR_ADDRESS'] || null,
  // Deployer/Admin wallet address for partner operations sponsorship
  DEPLOYER_SPONSOR_ADDRESS: import.meta.env['VITE_DEPLOYER_SPONSOR_ADDRESS'] || import.meta.env['VITE_PLATFORM_SPONSOR_ADDRESS'] || null,
  // Enable/disable sponsorship features
  ENABLE_PERK_SPONSORSHIP: import.meta.env['VITE_ENABLE_PERK_SPONSORSHIP'] === 'true',
  ENABLE_PARTNER_CAP_SPONSORSHIP: import.meta.env['VITE_ENABLE_PARTNER_CAP_SPONSORSHIP'] === 'true',
  // Enable all partner transactions sponsorship (overrides individual settings)
  ENABLE_ALL_PARTNER_SPONSORSHIP: import.meta.env['VITE_ENABLE_ALL_PARTNER_SPONSORSHIP'] === 'true',
  // Gas budget for sponsored transactions (in MIST)
  DEFAULT_SPONSORED_GAS_BUDGET: BigInt(import.meta.env['VITE_DEFAULT_SPONSORED_GAS_BUDGET'] || '10000000'), // 0.01 SUI
};