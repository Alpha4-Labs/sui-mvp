// src/packages/config.js

// --- Core Package & Token Configuration ---

// Package ID of the deployed Alpha Points contract
export const PACKAGE_ID = "0x8a9f4a2782b503191a6f6687a43c14daccbe435165480a2cd40229b63dc9b59a";

// Define the SUI token type constant
export const SUI_TOKEN_TYPE = '0x2::sui::SUI';

// --- Module Names ---
// Mapping of conceptual module names to their actual names in the package
export const MODULES = {
  ADMIN: "admin",
  ESCROW: "escrow",
  INTEGRATION: "integration",
  LEDGER: "ledger",
  LOAN: "loan",
  LZ_BRIDGE: "lz_bridge", // Keep if LayerZero bridge functionality is used
  ORACLE: "oracle",
  PARTNER: "partner", // Keep if partner integrations are used
  STAKE_POSITION: "stake_position"
};

// --- Shared Object IDs ---
// IDs of the shared objects created after deploying and initializing the package
export const SHARED_OBJECTS = {
  LEDGER: "0xa5414dd6244e2545b214fb465409738902fb097de4d594056f227b3b31a83ddb", // From PDF (Ledger Type)
  CONFIG: "0x9d84ab24736eed3f3a972c71c4c4bc834739b28c64777503bba125026f206ee2", // From PDF (Config Type)
  ESCROW_VAULT: "0x5c2bf4937ec580ccd3ea83d32018ddde5c1dcf61e8931aa6ee16a36c167e84f7", // From create_escrow_vault results
  RATE_ORACLE: "0xfff818a09b1ce81ee223397296d9ee55f40909724d42c9168825fa1df883627a",  // From create_oracle results
  LOAN_CONFIG: "0x1e688df3ea9255eeca078a157406dae1eb58941f509e2d2ff86ed2068d3cb965"   // From init_loan_config results
};

// --- Type Arguments ---
// Defines common type arguments used in function calls
export const TYPE_ARGS = {
  SUI_TOKEN: SUI_TOKEN_TYPE // Use SUI token type
  // ALPHA_TOKEN is removed
};

// --- Function Mappings ---
// Maps frontend actions/concepts to specific Move functions and their required objects/types
export const FUNCTION_MAPPINGS = {
  // === Staking Functions ===
  stake: {
    module: MODULES.INTEGRATION,
    function: "route_stake", // Assumes integration module handles routing
    typeArgs: [TYPE_ARGS.SUI_TOKEN], // Specify SUI type
    requiredObjects: [SHARED_OBJECTS.CONFIG, SHARED_OBJECTS.ESCROW_VAULT] // Check if correct for SUI vault
  },
  unstake: {
    module: MODULES.INTEGRATION,
    function: "redeem_stake", // Assumes integration module handles redemption
    typeArgs: [TYPE_ARGS.SUI_TOKEN], // Specify SUI type
    requiredObjects: [SHARED_OBJECTS.CONFIG, SHARED_OBJECTS.LEDGER, SHARED_OBJECTS.ESCROW_VAULT]
  },

  // === Points Functions ===
  // Claiming points logic might reside in integration module or be handled differently
  // Add mapping if a claim_points function exists, e.g.:
  // claimPoints: {
  //   module: MODULES.INTEGRATION, // Or MODULES.LEDGER ? Check Move code
  //   function: "claim_points",
  //   typeArgs: [],
  //   requiredObjects: [SHARED_OBJECTS.CONFIG, SHARED_OBJECTS.LEDGER]
  // },
  redeemPoints: {
    module: MODULES.INTEGRATION, // Assumes integration handles redemption logic
    function: "redeem_points",
    typeArgs: [TYPE_ARGS.SUI_TOKEN], // Redeeming points for SUI
    requiredObjects: [
      SHARED_OBJECTS.CONFIG,
      SHARED_OBJECTS.LEDGER,
      SHARED_OBJECTS.ESCROW_VAULT, // Vault holding SUI for redemption
      SHARED_OBJECTS.RATE_ORACLE   // Oracle to determine SUI amount
    ]
  },

  // === Loan Functions ===
  // Add mappings for loan creation and repayment if they are called directly
  // Example:
  // createLoan: {
  //   module: MODULES.LOAN,
  //   function: "open_loan",
  //   typeArgs: [TYPE_ARGS.SUI_TOKEN], // Or the type of the stake position if generic
  //   requiredObjects: [SHARED_OBJECTS.CONFIG, SHARED_OBJECTS.LOAN_CONFIG, SHARED_OBJECTS.LEDGER, SHARED_OBJECTS.RATE_ORACLE]
  // },
  // repayLoan: {
  //   module: MODULES.LOAN,
  //   function: "repay_loan",
  //    typeArgs: [TYPE_ARGS.SUI_TOKEN], // Or the type of the stake position if generic
  //   requiredObjects: [SHARED_OBJECTS.CONFIG, SHARED_OBJECTS.LEDGER]
  // },

  // === View Functions Mappings (for RPC calls/devInspect) ===
  getPoints: { // Gets AVAILABLE points
    module: MODULES.LEDGER,
    function: "get_available_balance"
  },
  getLockedBalance: { // Gets LOCKED points
    module: MODULES.LEDGER,
    function: "get_locked_balance"
  },
  getStakedAmount: { // Gets total staked amount for the user (VERIFY MODULE/FUNCTION NAME)
    module: MODULES.LEDGER, // Or MODULES.INTEGRATION? Check your Move code.
    function: "get_staked_amount" // Verify this function exists and its arguments
  },
  getRateOracleInfo: { // Gets the rate (u128) and decimals (u8) tuple
    module: MODULES.ORACLE,
    function: "get_rate"
  },
  // Add view functions for loan details if needed, e.g.,
  // getLoanDetails: { module: MODULES.LOAN, function: "get_loan_details" },
  // getMaxLoanAmount: { module: MODULES.LOAN, function: "calculate_max_loan" },
};

// Function to get a specific mapping (optional helper)
export function getFunctionMapping(key) {
  return FUNCTION_MAPPINGS[key];
}