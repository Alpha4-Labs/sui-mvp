/**
 * Transaction builder utilities for Alpha Points operations
 * Updated with proper BCS serialization for Sui SDK v1.0+
 */

import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS, SUI_TYPE, CLOCK_ID } from '../config/contract';

// Define constant for Sui System State Object ID
const SUI_SYSTEM_STATE_ID = '0x5';

/**
 * Builds a transaction for staking SUI
 * 
 * @param amount Amount in MIST (SUI * 10^9)
 * @param durationDays Duration in days for the stake
 * @param validatorAddress Validator's address
 * @returns Transaction object ready for execution
 */
export const buildStakeSuiTransaction = (
  amount: bigint,
  durationDays: number,
  validatorAddress: string
) => {
  const tx = new Transaction();
  
  // 1. Split SUI coin for staking
  const [coinToStake] = tx.splitCoins(tx.gas, [amount]);
  
  // 2. Request to add stake to a validator (returns StakedSui object)
  const stakedSui = tx.moveCall({
    target: `0x3::sui_system::request_add_stake`, // Use 0x3 for sui_system module on mainnet/testnet
    arguments: [
      tx.object(SUI_SYSTEM_STATE_ID), // SuiSystemState object ID
      coinToStake,                    // The Coin<SUI> to stake
      tx.pure(validatorAddress),      // Validator's address
    ]
  });
  
  // 3. Call the integration module's route_stake_sui function
  //    passing the StakedSui object from the previous step.
  tx.moveCall({
    target: `${PACKAGE_ID}::integration::route_stake_sui`,
    arguments: [
      tx.object(SHARED_OBJECTS.config),
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.stakingManager),
      tx.object(CLOCK_ID),
      stakedSui,  // Pass the StakedSui object from the previous call
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
  const amountBigInt = BigInt(pointsAmount);
  const tx = new Transaction();
  const serializedAmountBytes = bcs.U64.serialize(amountBigInt).toBytes();

  tx.moveCall({
    target: `${PACKAGE_ID}::integration::redeem_points`,
    typeArguments: [SUI_TYPE],
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
  const serializedPointsAmountBytes = bcs.U64.serialize(pointsAmount).toBytes();

  tx.moveCall({
    target: `${PACKAGE_ID}::loan::open_loan`,
    typeArguments: [SUI_TYPE],
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