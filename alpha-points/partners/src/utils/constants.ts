/**
 * Alpha Points Platform Constants
 * 
 * Centralized constants for Alpha Points conversion rates and calculations
 * to ensure consistency across all components.
 */

// Core conversion rates
export const SUI_PRICE_USD = 3.28; // Current SUI price in USD
export const ALPHA_POINTS_PER_USD = 1000; // Fixed ratio: $1 = 1000 Alpha Points
export const ALPHA_POINTS_PER_SUI = SUI_PRICE_USD * ALPHA_POINTS_PER_USD; // 3,280 AP per SUI

// Transaction fees
export const EARLY_UNSTAKE_FEE_RATE = 0.001; // 0.1% fee for early unstaking
export const EARLY_UNSTAKE_RETENTION_RATE = 1 - EARLY_UNSTAKE_FEE_RATE; // 99.9% retention after fee

// Time constants
export const DAYS_PER_YEAR = 365;
export const EPOCHS_PER_DAY = 1; // Sui Testnet epochs are 24 hours
export const MIST_PER_SUI = 1_000_000_000; // 1 SUI = 1,000,000,000 MIST

// Conversion helper functions
export const convertMistToSui = (mist: string | number): number => {
  const mistNum = typeof mist === 'string' ? parseInt(mist, 10) : mist;
  return mistNum / MIST_PER_SUI;
};

export const convertSuiToAlphaPoints = (sui: number): number => {
  return Math.floor(sui * ALPHA_POINTS_PER_SUI);
};

export const convertSuiToAlphaPointsWithFee = (sui: number): number => {
  return Math.floor(sui * ALPHA_POINTS_PER_SUI * EARLY_UNSTAKE_RETENTION_RATE);
};

export const calculateDailyAlphaPointsRewards = (principalSui: number, apy: number): number => {
  return (principalSui * ALPHA_POINTS_PER_SUI * (apy / 100)) / DAYS_PER_YEAR;
};

export const calculateTotalAlphaPointsRewards = (principalSui: number, apy: number, durationDays: number): number => {
  const dailyRewards = calculateDailyAlphaPointsRewards(principalSui, apy);
  return dailyRewards * durationDays;
}; 