/**
 * Transaction builder utilities for Alpha Points operations
 * Updated with proper BCS serialization for Sui SDK v1.0+
 * Adjusted for two-transaction native staking flow.
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';

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
      tx.pure.u64(durationDays),
      tx.pure.option('address', null)
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
export const buildRedeemPointsTransaction = (
  pointsAmount: string
) => {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::redeem_points`,
    typeArguments: [SUI_TYPE],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.escrowVault),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure.u64(BigInt(pointsAmount)),
      tx.object(CLOCK_ID)
    ]
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
      tx.pure.u64(pointsAmount),
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
 * 
 * @param pointsToSpend The amount of Alpha Points the user is spending.
 * @param partnerCapId The Object ID of the PartnerCap for the perk provider.
 *                     For platform-specific perks, this might be a dedicated platform PartnerCap ID.
 * @param perkIdentifier Optional string to identify the perk for on-chain events.
 * @returns A Transaction object ready for signing and execution.
 */
export const buildPurchaseAlphaPerkTransaction = (
  pointsToSpend: number,
  partnerCapId: string, // Object ID of the PartnerCap of the perk provider
  // perkIdentifier?: string // Optional: for more detailed event logging
): Transaction => {
  const tx = new Transaction();

  tx.moveCall({
    // Ensure SHARED_OBJECTS.config, SHARED_OBJECTS.ledger, and CLOCK_ID are correctly defined and imported
    target: `${PACKAGE_ID}::integration::purchase_marketplace_perk`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),       // config: &Config
      tx.object(SHARED_OBJECTS.ledger),       // ledger: &mut Ledger
      tx.object(partnerCapId),                // partner_cap_of_perk_provider: &PartnerCap
      tx.pure.u64(pointsToSpend),             // perk_cost_points: u64
      // If you add perk_identifier to Move struct, pass it here:
      // perkIdentifier ? tx.pure.string(perkIdentifier) : /* handle if not provided or make mandatory */,
      tx.object(CLOCK_ID)                     // clock: &Clock
      // ctx: &mut TxContext is automatically handled by the PTB execution
    ],
    // No typeArguments needed if your Move function doesn't have generic type parameters (e.g., purchase_marketplace_perk<T>)
  });

  return tx;
};