/**
 * Transaction builder utilities for Alpha Points operations
 * Updated with proper BCS serialization for Sui SDK v1.0+
 * Adjusted for two-transaction native staking flow.
 */

import { Transaction, TransactionArgument, TransactionObjectArgument } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';
import { SuinsClient, SuinsTransaction } from '@mysten/suins'; // Import actual SuiNS SDK components



// VITE_SUINS_PARENT_NFT_ID should be the OBJECT ID of your registered parent *.sui name NFT
const VITE_SUINS_PARENT_OBJECT_ID = import.meta.env.VITE_SUINS_PARENT_OBJECT_ID; // Renamed for clarity
// Add parent domain string (e.g., "alpha4.sui")
const VITE_SUINS_PARENT_DOMAIN_NAME = import.meta.env.VITE_SUINS_PARENT_DOMAIN_NAME || '';

// Define constant for Sui System State Object ID
const SUI_SYSTEM_STATE_ID = '0x5';

/**
 * Transaction 1: Builds a transaction to request adding stake to the Sui system.
 * This transaction, when executed, will result in a StakedSui object being
 * transferred to the sender.
 * 
 * @param amount Amount in MIST (SUI * 10^9)
 * @param validatorAddress Validator's address
 * @returns Transaction object ready for execution
 */
export const buildRequestAddStakeTransaction = (
  amount: bigint,
  validatorAddress: string
) => {
  const tx = new Transaction();
  
  // Create the coin for staking by splitting from tx.gas
  const stakeCoin = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  
  // 2. Request to add stake to a validator
  // This transfers the resulting StakedSui object to the sender.
  tx.moveCall({
    target: `0x3::sui_system::request_add_stake`, // Use 0x3 for sui_system module
    arguments: [
      tx.object(SUI_SYSTEM_STATE_ID), // SuiSystemState object ID
      stakeCoin,                    // The Coin<SUI> to stake (split from gas)
      tx.pure.address(validatorAddress)     // Validator's address, using tx.pure.address() helper
    ]
  });
  
  // Note: The StakedSui object is NOT returned as a result usable in the same PTB.
  // The user needs to find this object in their account after executing this transaction.
  return tx;
};

/**
 * Transaction 2: Builds a transaction to register a StakedSui object with our protocol
 * and receive a StakePosition NFT.
 * 
 * @param stakedSuiObjectId The Object ID of the StakedSui object obtained from Transaction 1.
 * @param durationDays The desired staking duration in days.
 * @returns Transaction object ready for execution
 */
export const buildRegisterStakeTransaction = (
  stakedSuiObjectId: string,
  durationDays: number
) => {
  const tx = new Transaction();

  // Call the integration module's function, passing the StakedSui object by ID.
  // The function expects the object itself, so we pass the object ID as an argument.
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::route_stake_sui`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.stakingManager),
      tx.object(CLOCK_ID),
      tx.object(stakedSuiObjectId),
      tx.pure.u64(BigInt(durationDays)),
      tx.pure(bcs.option(bcs.Address).serialize(null))
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for unstaking a position
 * 
 * @param stakeId Object ID of the stake position
 * @returns Transaction object ready for execution
 */
export const buildUnstakeTransaction = (
  stakeId: string
) => {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::request_unstake_native_sui`,
    arguments: [
      tx.object(SHARED_OBJECTS.stakingManager), // Arg0
      tx.object(SHARED_OBJECTS.config),         // Arg1
      tx.object(SUI_SYSTEM_STATE_ID),           // Arg2
      tx.object(stakeId),                       // Arg3
      tx.object(CLOCK_ID),                      // Arg4 - Added Clock
      tx.object(SHARED_OBJECTS.ledger)          // Arg5 - Added Ledger
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for redeeming Alpha Points for tokens
 * 
 * @param pointsAmount Amount of Alpha Points to redeem
 * @returns Transaction object ready for execution
 */
export const buildRedeemPointsTransaction = (pointsToRedeem: string): Transaction => {
  const ALPHA_POINTS_PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID; // Use the main package ID
  const ALPHA_POINTS_LEDGER_ID = SHARED_OBJECTS.ledger; // Use the ledger from shared objects

  if (!ALPHA_POINTS_PACKAGE_ID || !ALPHA_POINTS_LEDGER_ID) {
    throw new Error("Alpha Points package or ledger ID is not configured.");
  }
  const tx = new Transaction();
  tx.moveCall({
    // Assuming redeem_points_for_sui is in the integration module for consistency
    target: `${ALPHA_POINTS_PACKAGE_ID}::integration::redeem_points_for_sui`,
    arguments: [
      tx.object(SHARED_OBJECTS.config), // Config might be needed
      tx.object(ALPHA_POINTS_LEDGER_ID),
      tx.object(SHARED_OBJECTS.escrowVault), // EscrowVault<SUI> is needed
      tx.object(SHARED_OBJECTS.oracle), // Oracle might be needed
      tx.pure.u64(BigInt(pointsToRedeem)),
      tx.object(CLOCK_ID) // Clock is often needed
    ],
  });
  return tx;
};

/**
 * Builds a transaction for creating a loan against a staked position
 * 
 * @param stakeId Object ID of the stake position to use as collateral
 * @param pointsAmount Amount of Alpha Points to borrow
 * @returns Transaction object ready for execution
 */
export const buildCreateLoanTransaction = (
  stakeId: string,
  pointsAmount: number
) => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::loan::open_loan`,
    typeArguments: ['0x3::staking_pool::StakedSui'],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.loanConfig),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(stakeId),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.u64(BigInt(pointsAmount)),
      tx.object(CLOCK_ID)
    ]
  });
  return tx;
};

/**
 * Builds a transaction for repaying a loan
 * 
 * @param loanId Object ID of the loan
 * @param stakeId Object ID of the stake position used as collateral
 * @param pointsToRepay Amount of points to repay for the loan principal
 * @returns Transaction object ready for execution
 */
export const buildRepayLoanTransaction = (
  loanId: string,
  stakeId: string,
  pointsToRepay: string | bigint
) => {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::loan::repay_loan`,
    typeArguments: ['0x3::staking_pool::StakedSui'],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(loanId),
      tx.object(stakeId),
      tx.pure.u64(BigInt(pointsToRepay))
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction to purchase an Alpha Perk from the marketplace.
 * This calls the `purchase_marketplace_perk` function in `integration.move`.
 * If the perk is a role perk, it also creates a SuiNS subname.
 * 
 * @param pointsToSpend The amount of Alpha Points the user is spending.
 * @param partnerCapId The Object ID of the PartnerCap for the perk provider.
 * @param perkIdentifier Optional string to identify the perk for on-chain events.
 * @param uniqueCode The subname to register if it's a role perk.
 * @param userAddress The user's Sui address.
 * @param suinsClientInstance An instance of SuinsClient for SuiNS operations.
 * @returns A Transaction object ready for signing and execution.
 */
export const buildPurchaseAlphaPerkTransaction = (
  amount: number, 
  partnerCapId: string, 
  perkId: string, 
  uniqueCode: string, 
  userAddress: string,
  suinsClientInstance: SuinsClient // Use the actual SuinsClient type
): Transaction => {
  if (!PACKAGE_ID) {
    throw new Error("PACKAGE_ID is not configured in your contract config.");
  }
  if (!SHARED_OBJECTS.config) {
    throw new Error("SHARED_OBJECTS.config is not configured in your contract config.");
  }
  if (!SHARED_OBJECTS.ledger) {
    throw new Error("SHARED_OBJECTS.ledger (Ledger ID) is not configured in your contract config. Cannot build transaction.");
  }
  if (!CLOCK_ID) {
    throw new Error("CLOCK_ID is not configured in your contract config.");
  }
  if (!partnerCapId) {
    throw new Error("partnerCapId is missing. Cannot build transaction.");
  }

  const tx = new Transaction();

  // 1. Call the purchase_marketplace_perk function from integration.move
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::purchase_marketplace_perk`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(partnerCapId),
      tx.pure.u64(BigInt(amount)),
      tx.object(CLOCK_ID),
    ],
  });

  // 2. If it's a role perk, create SuiNS subname and set metadata
  if ((perkId === 'alpha4-tester-role' || perkId === 'alpha4-veteran-role') && 
      uniqueCode && VITE_SUINS_PARENT_OBJECT_ID && userAddress && suinsClientInstance) {
    
    if (!VITE_SUINS_PARENT_OBJECT_ID) {
      throw new Error("VITE_SUINS_PARENT_OBJECT_ID is not configured in .env for SuiNS subname creation.");
    }

    const suinsTx = new SuinsTransaction(suinsClientInstance, tx);

    // Calculate subname expiration: 30 days from now (safer than 1 year)
    const thirtyDaysFromNowMs = Date.now() + 30 * 24 * 60 * 60 * 1000;

    // Test: Check if VITE_SUINS_PARENT_DOMAIN_NAME is set
    console.log('[SuiNS Debug] VITE_SUINS_PARENT_DOMAIN_NAME:', VITE_SUINS_PARENT_DOMAIN_NAME);
    if (!VITE_SUINS_PARENT_DOMAIN_NAME) {
      console.warn('[SuiNS Debug] WARNING: VITE_SUINS_PARENT_DOMAIN_NAME is not set in environment variables!');
      console.warn('[SuiNS Debug] This might be causing name validation issues. Expected format: "alpha4.sui"');
    }

    // Create the subname
    console.log('[SuiNS Debug] Attempting to create subname with params:');
    console.log('[SuiNS Debug] Parent NFT Object ID:', VITE_SUINS_PARENT_OBJECT_ID);
    console.log('[SuiNS Debug] Transaction sender:', userAddress);
    console.log('[SuiNS Debug] Label only (uniqueCode):', uniqueCode);
    console.log('[SuiNS Debug] Expiration Timestamp (ms):', thirtyDaysFromNowMs);
    console.log('[SuiNS Debug] Expiration Date:', new Date(thirtyDaysFromNowMs).toISOString());
    console.log('[SuiNS Debug] SuinsClient instance:', suinsClientInstance);
    console.log('[SuiNS Debug] SuinsClient config:', suinsClientInstance.config);
    console.log('[SuiNS Debug] SuinsClient config.packageId:', suinsClientInstance.config.packageId);
    // Note: suinsObjectId might not exist on the config type

    let subnameNftObjectArg;
    
    // SuiNS SDK expects the full subname including .sui (e.g., "test.alpha4.sui")
    const fullNameWithSui = `${uniqueCode}.alpha4.sui`;
    console.log('[SuiNS Debug] Creating leaf subname with full name:', fullNameWithSui);
    console.log('[SuiNS Debug] Target address for leaf subname:', userAddress);
    
    try {
      // Use createLeafSubName instead - this doesn't require parent ownership
      // and doesn't create an NFT, just associates the name with the user's address
      suinsTx.createLeafSubName({
        parentNft: VITE_SUINS_PARENT_OBJECT_ID,
        name: fullNameWithSui, // Full name including .sui
        targetAddress: userAddress // The user's address
      });
      console.log('[SuiNS Debug] createLeafSubName succeeded!');
      
      // Since leaf subnames don't create NFTs, we don't need to transfer anything
      // Comment out the transfer line
      // tx.transferObjects([subnameNftObjectArg], tx.pure.address(userAddress));
    } catch (error: any) {
      console.error('[SuiNS Debug] createLeafSubName failed:', error);
      console.error('[SuiNS Debug] Error message:', error.message);
      console.error('[SuiNS Debug] Error stack:', error.stack);
      throw error;
    }

    // Remove the NFT transfer since leaf subnames don't create NFTs
  }

  return tx;
};