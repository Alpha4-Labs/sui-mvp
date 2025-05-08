/**
 * Core types used throughout the application
 */

// Re-export transaction types
export * from '../utils/transaction-types';

/**
 * Interface representing a staking position with added properties
 * for better date handling
 */
export interface StakePosition {
  id: string;
  owner: string;
  principal: string;
  startEpoch?: string;
  unlockEpoch?: string;
  durationEpochs?: string;
  durationDays: string;
  encumbered: boolean;
  maturityPercentage: number;
  apy: number;
  
  // New field for improved date handling
  calculatedUnlockDate?: string;

  // Fields required by PointsDisplay.tsx
  lastClaimEpoch: string; 
  amount: string; // Corresponds to 'principal'
  startTimeMs: string;
  unlockTimeMs: string;
  assetType: string;
}

/**
 * Interface representing a user's Alpha Points balance
 */
export interface PointBalance {
  available: number;
  locked: number;
  total: number;
}

/**
 * Interface representing a loan against a staked position
 */
export interface Loan {
  id: string;
  borrower: string;
  stakeId: string;
  principalPoints: string;
  interestOwedPoints: string;
  openedEpoch: string;
  estimatedRepayment: string;
}

/**
 * Interface representing a staking duration option
 */
export interface DurationOption {
  days: number;
  label: string;
  apy: number;
}

/**
 * Interface representing oracle rate information
 */
export interface RateInfo {
  rate: number;
  decimals: number;
  lastUpdate: number;
}

/**
 * Interface representing a transaction in the points system
 */
export interface PointsTransaction {
  id: string;
  type: 'earned' | 'spent' | 'locked' | 'unlocked';
  amount: number;
  timestamp: number;
  txId: string;
}

// Type guards to improve type safety throughout the application

/**
 * Type guard to check if a value is a string
 */
export function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a number
 */
export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is a valid StakePosition
 */
export function isStakePosition(value: any): value is StakePosition {
  return (
    value &&
    typeof value === 'object' &&
    isString(value.id) &&
    isString(value.owner) &&
    isString(value.principal) &&
    (value.startEpoch === undefined || isString(value.startEpoch)) &&
    (value.unlockEpoch === undefined || isString(value.unlockEpoch)) &&
    (value.durationEpochs === undefined || isString(value.durationEpochs)) &&
    isString(value.durationDays) &&
    typeof value.encumbered === 'boolean' &&
    isNumber(value.maturityPercentage) &&
    isNumber(value.apy) &&
    isString(value.lastClaimEpoch) &&
    isString(value.amount) &&
    isString(value.startTimeMs) &&
    isString(value.unlockTimeMs) &&
    isString(value.assetType)
  );
}

/**
 * Type guard to check if a value is a valid PointBalance
 */
export function isPointBalance(value: any): value is PointBalance {
  return (
    value &&
    typeof value === 'object' &&
    isNumber(value.available) &&
    isNumber(value.locked) &&
    isNumber(value.total)
  );
}

/**
 * Type guard to check if a value is a valid Loan
 */
export function isLoan(value: any): value is Loan {
  return (
    value &&
    typeof value === 'object' &&
    isString(value.id) &&
    isString(value.borrower) &&
    isString(value.stakeId) &&
    isString(value.principalPoints) &&
    isString(value.interestOwedPoints) &&
    isString(value.openedEpoch) &&
    isString(value.estimatedRepayment)
  );
}

