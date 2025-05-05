export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0xee8d09ee18824fbf8a97e6e68f1ec908fca16d5e6dbcbd2b81b6852e4f2f45fe';

// Shared object IDs - Updated with latest deployment fallbacks
// !! IMPORTANT: Verify loanConfig, oracle, and escrowVault fallbacks match your latest initialization results !!
export const SHARED_OBJECTS = {
  config: import.meta.env.VITE_CONFIG_ID || '0xf6c5877f49fcda89b23842ee45f1816e2d103b92ceeda308b3f035c953c18b82',
  ledger: import.meta.env.VITE_LEDGER_ID || '0x1e1b486b0a5295b11839e102aee1d8e209e7840d8389093752b596826e32c861',
  // !! Verify these fallbacks against your latest init transaction outputs !!
  escrowVault: import.meta.env.VITE_ESCROW_VAULT_SUI_ID || '0x6841af638ddd36433b2a3507add2ccc25461225be4c7900db7b4a665d2839aa1',
  loanConfig: import.meta.env.VITE_LOAN_CONFIG_ID || '0x1e688df3ea9255eeca078a157406dae1eb58941f509e2d2ff86ed2068d3cb965',
  oracle: import.meta.env.VITE_SUI_USD_ORACLE_ID || '0x90e7114e5cb593985fe984e89e7b2fce6095134edc853345dab7516a574a5294'
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';