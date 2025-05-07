/**
 * Transaction builder utilities for Alpha Points operations
 * Updated with proper BCS serialization for Sui SDK v1.0+
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';

/**
 * Builds a transaction for staking SUI
 * 
 * @param amount Amount in MIST (SUI * 10^9)
 * @param durationDays Duration in days for the stake
 * @returns Transaction object ready for execution
 */
export const buildStakeTransaction = (
  amount: bigint,
  durationDays: number
) => {
  // Create a new Transaction object
  const tx = new Transaction();
  
  // For splitCoins, use direct values as they are automatically converted
  const [coinToStake] = tx.splitCoins(tx.gas, [amount]);
  
  // Call the route_stake function with properly typed arguments
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::route_stake`,
    typeArguments: [SUI_TYPE],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.escrowVault),
      tx.object(CLOCK_ID),
      coinToStake,
      tx.pure(bcs.U64.serialize(durationDays).toBytes()),
      tx.pure(bcs.option(bcs.Address).serialize(null).toBytes())
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
    typeArguments: [SUI_TYPE],
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
  // Convert string to BigInt for proper BCS handling
  const amountBigInt = BigInt(pointsAmount);
  
  const tx = new Transaction();
  
  // Serialize the amount to BCS bytes for u64
  const serializedAmountBytes = bcs.U64.serialize(amountBigInt).toBytes();

  tx.moveCall({
    target: `${PACKAGE_ID}::integration::redeem_points`,
    typeArguments: [SUI_TYPE],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.escrowVault),
      tx.object(SHARED_OBJECTS.oracle),
      tx.pure(serializedAmountBytes), // Pass BCS serialized bytes
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
  // Defensive check: Ensure pointsAmount is a valid non-negative integer
  if (
    typeof pointsAmount !== 'number' ||
    !Number.isInteger(pointsAmount) || // Use isInteger to ensure no floats
    pointsAmount < 0
  ) {
    // Provide more context in the error message
    throw new Error(`Invalid pointsAmount for BCS serialization: must be a non-negative integer. Received type: ${typeof pointsAmount}, value: ${pointsAmount}`);
  }

  const tx = new Transaction();

  // Explicitly serialize the number to BCS bytes for u64
  const serializedPointsAmountBytes = bcs.U64.serialize(pointsAmount).toBytes();

  // Log the serialized bytes for debugging if needed
  // console.log('Serialized pointsAmount (bytes):', serializedPointsAmountBytes);

  tx.moveCall({
    target: `${PACKAGE_ID}::loan::open_loan`,
    typeArguments: [SUI_TYPE],
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.loanConfig),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(stakeId),
      tx.object(SHARED_OBJECTS.oracle),
      // Pass the BCS-serialized bytes directly
      tx.pure(serializedPointsAmountBytes), // NOTE: No second 'u64' argument needed here!
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
    typeArguments: [SUI_TYPE],
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