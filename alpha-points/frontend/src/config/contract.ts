export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x8a9f4a2782b503191a6f6687a43c14daccbe435165480a2cd40229b63dc9b59a';

// Shared object IDs
export const SHARED_OBJECTS = {
  config: import.meta.env.VITE_CONFIG_ID || '0x9d84ab24736eed3f3a972c71c4c4bc834739b28c64777503bba125026f206ee2',
  ledger: import.meta.env.VITE_LEDGER_ID || '0xa5414dd6244e2545b214fb465409738902fb097de4d594056f227b3b31a83ddb',
  // These would need to be updated with actual values after deployment
  escrowVault: '0x5c2bf4937ec580ccd3ea83d32018ddde5c1dcf61e8931aa6ee16a36c167e84f7',
  loanConfig: '0x1e688df3ea9255eeca078a157406dae1eb58941f509e2d2ff86ed2068d3cb965',
  oracle: '0xfff818a09b1ce81ee223397296d9ee55f40909724d42c9168825fa1df883627a'
};

// Sui coin type
export const SUI_TYPE = '0x2::sui::SUI';

// Global clock ID
export const CLOCK_ID = '0x6';