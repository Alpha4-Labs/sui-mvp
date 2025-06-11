/**
 * Enhanced transaction builders that use engagement-aware ledger functions
 * These functions automatically track user engagement when performing Alpha Points operations
 */

import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, SHARED_OBJECTS, CLOCK_ID } from '../config/contract';
import { ACTIVITY_TYPES, findEngagementTracker } from './engagement';
import { SuiClient } from '@mysten/sui.js/client';

/**
 * Builds a transaction for earning Alpha Points with engagement tracking
 * Uses the enhanced ledger function that automatically records engagement
 * 
 * @param suiClient SuiClient instance for dynamic object discovery
 * @param userAddress The user's address  
 * @param pointsAmount Amount of Alpha Points to earn
 * @param partnerCapId Optional partner cap ID for partner operations
 * @param sourceInfo Optional source information
 * @returns Transaction object ready for execution
 */
export const buildEarnPointsWithEngagementTransaction = async (
  suiClient: SuiClient,
  userAddress: string,
  pointsAmount: bigint,
  partnerCapId?: string,
  sourceInfo?: string
): Promise<Transaction | null> => {
  const tx = new Transaction();
  
  // Dynamically find the engagement tracker
  const engagementTrackerId = await findEngagementTracker(suiClient, PACKAGE_ID);
  if (!engagementTrackerId) {
    console.warn('EngagementTracker not found, using regular earn function');
    // Fallback to regular ledger function without engagement
    tx.moveCall({
      target: `${PACKAGE_ID}::ledger::internal_earn`,
      arguments: [
        tx.object(SHARED_OBJECTS.ledger),
        tx.pure.address(userAddress),
        tx.pure.u64(pointsAmount),
        tx.object(CLOCK_ID)
      ]
    });
    return tx;
  }
  
  // Use the enhanced earn function that includes engagement tracking
  tx.moveCall({
    target: `${PACKAGE_ID}::ledger::internal_earn_with_engagement`,
    arguments: [
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(engagementTrackerId), // Dynamically discovered engagement tracker
      tx.pure.address(userAddress),
      tx.pure.u64(pointsAmount),
      tx.object(CLOCK_ID)
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for spending Alpha Points with engagement tracking
 * Uses the enhanced ledger function that automatically records engagement
 * 
 * @param userAddress The user's address
 * @param pointsAmount Amount of Alpha Points to spend
 * @param description Optional description of what the points are being spent on
 * @returns Transaction object ready for execution
 */
export const buildSpendPointsWithEngagementTransaction = (
  userAddress: string,
  pointsAmount: bigint,
  description?: string
) => {
  const tx = new Transaction();
  
  // Use the enhanced spend function that includes engagement tracking
  tx.moveCall({
    target: `${PACKAGE_ID}::ledger::internal_spend_with_engagement`,
    arguments: [
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.engagementTracker),
      tx.pure.address(userAddress),
      tx.pure.u64(pointsAmount),
      tx.object(CLOCK_ID)
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for locking Alpha Points with engagement tracking
 * Uses the enhanced ledger function that automatically records engagement
 * 
 * @param userAddress The user's address
 * @param pointsAmount Amount of Alpha Points to lock
 * @param lockDurationMs Duration to lock points in milliseconds
 * @returns Transaction object ready for execution
 */
export const buildLockPointsWithEngagementTransaction = (
  userAddress: string,
  pointsAmount: bigint,
  lockDurationMs: bigint
) => {
  const tx = new Transaction();
  
  // Use the enhanced lock function that includes engagement tracking
  tx.moveCall({
    target: `${PACKAGE_ID}::ledger::internal_lock_with_engagement`,
    arguments: [
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.engagementTracker),
      tx.pure.address(userAddress),
      tx.pure.u64(pointsAmount),
      tx.pure.u64(lockDurationMs),
      tx.object(CLOCK_ID)
    ]
  });
  
  return tx;
};

/**
 * Builds a transaction for unlocking Alpha Points with engagement tracking
 * Uses the enhanced ledger function that automatically records engagement
 * 
 * @param userAddress The user's address
 * @param pointsAmount Amount of Alpha Points to unlock
 * @returns Transaction object ready for execution
 */
export const buildUnlockPointsWithEngagementTransaction = (
  userAddress: string,
  pointsAmount: bigint
) => {
  const tx = new Transaction();
  
  // Use the enhanced unlock function that includes engagement tracking
  tx.moveCall({
    target: `${PACKAGE_ID}::ledger::internal_unlock_with_engagement`,
    arguments: [
      tx.object(SHARED_OBJECTS.ledger),
      tx.object(SHARED_OBJECTS.engagementTracker),
      tx.pure.address(userAddress),
      tx.pure.u64(pointsAmount),
      tx.object(CLOCK_ID)
    ]
  });
  
  return tx;
};

/**
 * Build a manual engagement recording transaction (for testing or admin purposes)
 * 
 * @param userAddress The user's address
 * @param activityType Type of activity (EARN, SPEND, STAKE, CLAIM)
 * @returns Transaction object ready for execution
 */
export const buildRecordEngagementTransaction = (
  userAddress: string,
  activityType: number
) => {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::engagement::record_engagement_activity`,
    arguments: [
      tx.object(SHARED_OBJECTS.engagementTracker),
      tx.pure.address(userAddress),
      tx.pure.u8(activityType),
      tx.object(CLOCK_ID)
    ]
  });
  
  return tx;
};

/**
 * Utility function to get the current epoch for engagement tracking
 * 
 * @returns Current epoch number (simplified day-based calculation)
 */
export const getCurrentEngagementEpoch = (): number => {
  return Math.floor(Date.now() / (24 * 60 * 60 * 1000));
};

// Export activity types for convenience
export { ACTIVITY_TYPES } from './engagement'; 