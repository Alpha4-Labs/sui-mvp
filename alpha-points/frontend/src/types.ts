// /**
//  * Centralized re-export of core type definitions.
//  *
//  * This file should ONLY re-export from './types/index.ts'.
//  * All actual interface definitions (StakePosition, PointBalance, etc.)
//  * must reside in './types/index.ts' to ensure a single source of truth
//  * and prevent type conflicts.
//  */

// // Re-export all types from the main types directory/index file
export * from './types/index';

// // All other content, especially local interface definitions like StakePosition
// // and PointBalance, has been removed from this file.

// // Add other types as needed (e.g., Loan, PointBalance)

// export interface StakePosition {
//   id: string;
//   owner: string;
//   principal: string;
//   // Remove old epoch fields if they exist
//   // startEpoch?: string;
//   // unlockEpoch?: string;
//   // durationEpochs?: string;
  
//   // Add new timestamp-based fields
//   startTimeMs: string;    // Store as string from source
//   unlockTimeMs: string;   // Store as string from source
//   durationDays: string;   // Store as string from source
  
//   encumbered: boolean;
//   maturityPercentage: number;
//   calculatedUnlockDate: string | null; // Holds ISO string derived from unlockTimeMs
// } 

// // Add PointBalance type definition
// export interface PointBalance {
//   available: number;
//   locked: number;
//   total: number;
// } 