/**
 * TypeScript type definitions
 */

// Add other types as needed (e.g., Loan, PointBalance)

export interface StakePosition {
  id: string;
  owner: string;
  principal: string;
  // Remove old epoch fields if they exist
  // startEpoch?: string;
  // unlockEpoch?: string;
  // durationEpochs?: string;
  
  // Add new timestamp-based fields
  startTimeMs: string;    // Store as string from source
  unlockTimeMs: string;   // Store as string from source
  durationDays: string;   // Store as string from source
  
  encumbered: boolean;
  maturityPercentage: number;
  calculatedUnlockDate: string | null; // Holds ISO string derived from unlockTimeMs
} 