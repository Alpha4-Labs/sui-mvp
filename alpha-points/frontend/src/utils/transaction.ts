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
      tx.object(stakedSuiObjectId),  // Pass the StakedSui object ID as an object argument
      tx.pure(bcs.U64.serialize(durationDays).toBytes()),
      tx.pure(bcs.option(bcs.Address).serialize(null).toBytes()) // Referrer (Option<address>)
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
    target: `${PACKAGE_ID}::integration::redeem_stake`,
    typeArguments: [SUI_TYPE], // NOTE: Verify if this should be StakedSui or something else after refactor
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.escrowVault),
      tx.object(stakeId),
      tx.object(CLOCK_ID)
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
  const amountBigInt = BigInt(pointsAmount);
  const tx = new Transaction();
  const serializedAmountBytes = bcs.U64.serialize(amountBigInt).toBytes();

  tx.moveCall({
    target: `${PACKAGE_ID}::integration::redeem_points`,
    typeArguments: [SUI_TYPE], // NOTE: Verify this type argument
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.escrowVault),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure(serializedAmountBytes),
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
  if (
    typeof pointsAmount !== 'number' ||
    !Number.isInteger(pointsAmount) ||
    pointsAmount < 0
  ) {
    throw new Error(`Invalid pointsAmount for BCS serialization: must be a non-negative integer. Received type: ${typeof pointsAmount}, value: ${pointsAmount}`);
  }

  const tx = new Transaction();
  // Convert the JavaScript number to a BigInt before serializing for u64.
  const pointsAmountAsBigInt = BigInt(pointsAmount);
  const serializedPointsAmountBytes = bcs.U64.serialize(pointsAmountAsBigInt).toBytes();

  tx.moveCall({
    target: `${PACKAGE_ID}::loan::open_loan`,
    // The type argument T for open_loan<T> is the type of the asset STAKED,
    // which is 0x3::staking_pool::StakedSui for native SUI stakes.
    typeArguments: ['0x3::staking_pool::StakedSui'], 
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.loanConfig),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(stakeId),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure(serializedPointsAmountBytes),
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
 * @returns Transaction object ready for execution
 */
export const buildRepayLoanTransaction = (
  loanId: string,
  stakeId: string
) => {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::loan::repay_loan`,
    // Corrected type argument: T should be the type of the staked asset (e.g., StakedSui)
    typeArguments: ['0x3::staking_pool::StakedSui'],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(loanId),
      tx.object(stakeId),
      tx.object(CLOCK_ID)
    ]
  });
  
  return tx;
};