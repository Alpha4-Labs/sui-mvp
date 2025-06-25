/**
 * Utility functions for determining stake position states
 * These functions help correctly identify whether a stake is:
 * - Regular staking
 * - Loan collateral
 * - Early withdrawn
 * - Mature/ready to unstake
 */

export interface StakeStateInfo {
  isStaking: boolean;
  isLoanCollateral: boolean;
  isEarlyWithdrawn: boolean;
  isMature: boolean;
  canUnstake: boolean;
  displayStatus: string;
}

export interface StakePosition {
  id: string;
  encumbered: boolean;
  maturityPercentage: number;
  [key: string]: any;
}

export interface Loan {
  id: string;
  stakeId: string;
  [key: string]: any;
}

/**
 * Determines the state of a stake position based on its properties and associated loans
 * @param position The stake position object
 * @param loans Array of active loans
 * @param stakeId The stake ID to check (may be prefixed)
 * @returns StakeStateInfo object with all state information
 */
export function determineStakeState(
  position: StakePosition,
  loans: Loan[],
  stakeId: string
): StakeStateInfo {
  const isEncumbered = position.encumbered === true;
  const isMature = position.maturityPercentage >= 100;
  
  // Extract original ID from prefixed display ID
  const originalId = extractOriginalId(stakeId);
  
  // Check if there's an active loan for this stake
  const hasActiveLoan = loans.some(loan => loan.stakeId === originalId);
  
  // Determine states
  const isLoanCollateral = isEncumbered && hasActiveLoan;
  const isEarlyWithdrawn = isEncumbered && !hasActiveLoan;
  const isStaking = !isEncumbered; // Not encumbered means it's in normal staking state
  const canUnstake = isMature && !isEncumbered;
  
  // Determine display status
  let displayStatus = '';
  if (isLoanCollateral) {
    displayStatus = 'Collateral';
  } else if (isEarlyWithdrawn) {
    displayStatus = 'Withdrawn';
  } else if (isMature) {
    displayStatus = 'Mature';
  } else {
    displayStatus = 'Staking';
  }
  
  return {
    isStaking,
    isLoanCollateral,
    isEarlyWithdrawn,
    isMature,
    canUnstake,
    displayStatus
  };
}

/**
 * Extracts the original stake ID from a potentially prefixed display ID
 * @param displayId The display ID which may have prefixes like 'stake-' or 'orphaned-'
 * @returns The original stake ID without prefixes
 */
export function extractOriginalId(displayId: string): string {
  if (displayId.startsWith('orphaned-')) {
    return displayId.replace('orphaned-', '');
  }
  if (displayId.startsWith('stake-')) {
    return displayId.replace('stake-', '');
  }
  return displayId;
}

/**
 * Checks if a stake position should be considered as loan collateral
 * This is a more robust version that handles data synchronization issues
 * @param position The stake position
 * @param loans Array of active loans
 * @param stakeId The stake ID to check
 * @returns True if the stake is currently serving as loan collateral
 */
export function isStakeLoanCollateral(
  position: StakePosition,
  loans: Loan[],
  stakeId: string
): boolean {
  const isEncumbered = position.encumbered === true;
  
  // If not encumbered, it's definitely not loan collateral
  if (!isEncumbered) return false;
  
  // Check if there's an active loan for this stake
  const originalId = extractOriginalId(stakeId);
  const hasActiveLoan = loans.some(loan => loan.stakeId === originalId);
  
  // If encumbered and has an active loan, it's loan collateral
  if (hasActiveLoan) return true;
  
  // If encumbered but no active loan, this could be a data sync issue
  // In this case, we'll be conservative and return false
  // This prevents showing stakes as "collateral" when they're actually free
  return false;
} 