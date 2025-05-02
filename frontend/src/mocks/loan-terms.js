// src/mocks/loan-terms.js

/**
 * Mock data for loan terms.
 * In a production scenario, these might be fetched from the LoanConfig object on-chain.
 * These values are used for display and potentially client-side validation.
 *
 * Note: Decimals (like BPS) should match the on-chain implementation.
 */

// LTV Ratio (Loan-to-Value) in Basis Points (e.g., 7000 = 70%)
const MOCK_MAX_LTV_BPS = 7000;

// Annual Interest Rate in Basis Points (e.g., 500 = 5%)
const MOCK_INTEREST_RATE_BPS = 500;

// Minimum loan amount (in points, smallest unit - e.g., 1 point)
const MOCK_MIN_LOAN_AMOUNT = 1 * (10**9); // Assuming 9 decimals for points

// Maximum loan duration (if applicable, in days or epochs)
// This might not be relevant if loans are open-ended until repaid.
const MOCK_MAX_LOAN_DURATION_DAYS = null; // Example: null for open-ended

// Liquidation threshold LTV (if applicable)
// Example: 85% LTV -> Liquidation might occur
const MOCK_LIQUIDATION_LTV_BPS = 8500; // Not currently implemented in provided hooks

export const mockLoanTerms = {
  maxLtvBps: MOCK_MAX_LTV_BPS,
  interestRateBps: MOCK_INTEREST_RATE_BPS,
  minLoanAmount: MOCK_MIN_LOAN_AMOUNT,
  maxLoanDurationDays: MOCK_MAX_LOAN_DURATION_DAYS,
  liquidationLtvBps: MOCK_LIQUIDATION_LTV_BPS,

  // Helper function to calculate LTV percentage
  calculateLtvPercent: (loanAmount, collateralValue) => {
    if (!collateralValue || collateralValue <= 0) return 0;
    return ((loanAmount / collateralValue) * 100).toFixed(2);
  },

  // Helper function to display interest rate as percentage
  getInterestRatePercent: () => {
    return (MOCK_INTEREST_RATE_BPS / 100).toFixed(2);
  },

   // Helper function to display max LTV as percentage
   getMaxLtvPercent: () => {
    return (MOCK_MAX_LTV_BPS / 100).toFixed(2);
  },
};

// You can also export individual constants if preferred
export {
  MOCK_MAX_LTV_BPS,
  MOCK_INTEREST_RATE_BPS,
  MOCK_MIN_LOAN_AMOUNT,
  MOCK_MAX_LOAN_DURATION_DAYS,
  MOCK_LIQUIDATION_LTV_BPS,
};