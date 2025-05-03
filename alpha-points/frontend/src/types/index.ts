/**
 * Core types used throughout the application
 */

// Re-export transaction types
export * from '../utils/transaction-types';

export interface StakePosition {
  id: string;
  owner: string;
  principal: string;
  startEpoch: string;
  unlockEpoch: string;
  durationEpochs: string;
  encumbered: boolean;
  maturityPercentage: number;
}

export interface PointBalance {
  available: number;
  locked: number;
  total: number;
}

export interface Loan {
  id: string;
  borrower: string;
  stakeId: string;
  principalPoints: string;
  interestOwedPoints: string;
  openedEpoch: string;
  estimatedRepayment: string;
}

export interface DurationOption {
  days: number;
  label: string;
  apy: number;
}

export interface RateInfo {
  rate: number;
  decimals: number;
  lastUpdate: number;
}

export interface PointsTransaction {
  id: string;
  type: 'earned' | 'spent' | 'locked' | 'unlocked';
  amount: number;
  timestamp: number;
  txId: string;
}

// Type guard to check if a value is a string
export function isString(value: any): value is string {
  return typeof value === 'string';
}

// Type guard to check if a value is a number
export function isNumber(value: any): value is number {
  return typeof value === 'number';
}