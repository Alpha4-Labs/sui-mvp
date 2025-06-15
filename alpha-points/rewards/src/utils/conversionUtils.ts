/**
 * Conversion utilities for Alpha4 Rewards system
 * Based on the comprehensive frontend conversion utilities
 * Handles USD ↔ Alpha Points, USDC micro-units, and oracle-based pricing
 */

// Conversion rates and constants
export const CONVERSION_RATES = {
  USDC_TO_MICRO_USDC: 1_000_000, // 1 USDC = 1,000,000 micro-USDC
  ALPHA_POINTS_PER_USD: 1_000, // Base rate: 1 USD = 1,000 Alpha Points
  SUI_TO_MIST: 1_000_000_000, // 1 SUI = 1,000,000,000 MIST
} as const;

// Oracle-based conversion settings
export const ORACLE_CONFIG = {
  defaultSuiPriceUsd: 2.50, // Fallback SUI price in USD
  priceUpdateThresholdMs: 300_000, // 5 minutes
} as const;

/**
 * Convert USD amount to micro-USDC
 * Example: $40.50 → 40,500,000 micro-USDC
 */
export function usdToMicroUSDC(usd: number): number {
  if (usd < 0) {
    throw new Error('USD amount cannot be negative');
  }
  return Math.floor(usd * CONVERSION_RATES.USDC_TO_MICRO_USDC);
}

/**
 * Convert micro-USDC to USD amount
 * Example: 40,500,000 micro-USDC → $40.50
 */
export function microUSDCToUsd(microUsdc: number): number {
  if (microUsdc < 0) {
    throw new Error('Micro-USDC amount cannot be negative');
  }
  return microUsdc / CONVERSION_RATES.USDC_TO_MICRO_USDC;
}

/**
 * Convert USD to Alpha Points using base conversion rate
 * For settings/display purposes (not oracle-based)
 * Example: $40 → 40,000,000 Alpha Points
 */
export function usdToAlphaPointsForSettings(usd: number): number {
  if (usd < 0) {
    throw new Error('USD amount cannot be negative');
  }
  return Math.floor(usd * CONVERSION_RATES.ALPHA_POINTS_PER_USD);
}

/**
 * Convert USD to Alpha Points using oracle-based conversion
 * This simulates what the smart contract would do
 * Example: $40 → variable Alpha Points based on current rates
 */
export function usdToAlphaPointsForSettingsViaOracle(usd: number): number {
  if (usd < 0) {
    throw new Error('USD amount cannot be negative');
  }
  
  // Simulate oracle-based conversion
  // In real implementation, this would query the oracle for current rates
  const oracleMultiplier = 1.0; // Could be dynamic based on market conditions
  return Math.floor(usd * CONVERSION_RATES.ALPHA_POINTS_PER_USD * oracleMultiplier);
}

/**
 * Convert Alpha Points to USD using oracle-based conversion
 * Example: 40,000,000 Alpha Points → $40 (variable based on rates)
 */
export function alphaPointsToUSDViaOracle(alphaPoints: number): number {
  if (alphaPoints < 0) {
    throw new Error('Alpha Points amount cannot be negative');
  }
  
  // Simulate oracle-based conversion
  const oracleMultiplier = 1.0; // Could be dynamic based on market conditions
  return alphaPoints / (CONVERSION_RATES.ALPHA_POINTS_PER_USD * oracleMultiplier);
}

/**
 * Convert SUI to MIST
 * Example: 1.5 SUI → 1,500,000,000 MIST
 */
export function suiToMist(sui: number): bigint {
  if (sui < 0) {
    throw new Error('SUI amount cannot be negative');
  }
  return BigInt(Math.floor(sui * CONVERSION_RATES.SUI_TO_MIST));
}

/**
 * Convert MIST to SUI
 * Example: 1,500,000,000 MIST → 1.5 SUI
 */
export function mistToSui(mist: bigint): number {
  if (mist < 0n) {
    throw new Error('MIST amount cannot be negative');
  }
  return Number(mist) / CONVERSION_RATES.SUI_TO_MIST;
}

/**
 * Settings conversion interface for perk management
 */
export interface SettingsConversion {
  usdInput: number;
  alphaPointsForStorage: number;
  alphaPointsForDisplay: number;
  microUsdcEquivalent: number;
}

/**
 * Convert settings for storage (what gets saved to database/state)
 * Uses oracle-based conversion to match smart contract expectations
 */
export function convertSettingsForStorage(usdInput: number): SettingsConversion {
  const alphaPointsForStorage = usdToAlphaPointsForSettingsViaOracle(usdInput);
  const alphaPointsForDisplay = usdToAlphaPointsForSettings(usdInput);
  const microUsdcEquivalent = usdToMicroUSDC(usdInput);
  
  return {
    usdInput,
    alphaPointsForStorage,
    alphaPointsForDisplay,
    microUsdcEquivalent
  };
}

/**
 * Convert settings for display (what gets shown to users)
 * Uses base conversion rate for consistent display
 */
export function convertSettingsForDisplay(alphaPoints: number): SettingsConversion {
  const usdInput = alphaPoints / CONVERSION_RATES.ALPHA_POINTS_PER_USD;
  const alphaPointsForStorage = usdToAlphaPointsForSettingsViaOracle(usdInput);
  const alphaPointsForDisplay = alphaPoints;
  const microUsdcEquivalent = usdToMicroUSDC(usdInput);
  
  return {
    usdInput,
    alphaPointsForStorage,
    alphaPointsForDisplay,
    microUsdcEquivalent
  };
}

/**
 * Format Alpha Points for display
 * Example: 1000000 → "1,000,000 AP"
 */
export function formatAlphaPoints(points: number | bigint, includeUnit: boolean = true): string {
  const pointsNum = typeof points === 'bigint' ? Number(points) : points;
  const formatted = pointsNum.toLocaleString();
  return includeUnit ? `${formatted} AP` : formatted;
}

/**
 * Format USD amount for display
 * Example: 40.5 → "$40.50"
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format SUI amount for display
 * Example: 1.234567 → "1.23 SUI"
 */
export function formatSUI(amount: number | bigint, decimals: number = 2): string {
  const suiAmount = typeof amount === 'bigint' ? mistToSui(amount) : amount;
  return `${suiAmount.toFixed(decimals)} SUI`;
}

/**
 * Parse user input for USD amounts
 * Handles various input formats: "$40", "40.50", "40"
 */
export function parseUSDInput(input: string): number {
  // Remove dollar sign and whitespace
  const cleaned = input.replace(/[$\s,]/g, '');
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed) || parsed < 0) {
    throw new Error('Invalid USD amount');
  }
  
  return parsed;
}

/**
 * Parse user input for Alpha Points
 * Handles various input formats: "1,000,000", "1000000", "1M"
 */
export function parseAlphaPointsInput(input: string): number {
  // Remove commas and whitespace
  let cleaned = input.replace(/[,\s]/g, '');
  
  // Handle shorthand notation
  if (cleaned.toLowerCase().endsWith('m')) {
    cleaned = cleaned.slice(0, -1);
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      throw new Error('Invalid Alpha Points amount');
    }
    return Math.floor(parsed * 1_000_000);
  }
  
  if (cleaned.toLowerCase().endsWith('k')) {
    cleaned = cleaned.slice(0, -1);
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      throw new Error('Invalid Alpha Points amount');
    }
    return Math.floor(parsed * 1_000);
  }
  
  const parsed = parseInt(cleaned);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error('Invalid Alpha Points amount');
  }
  
  return parsed;
}

/**
 * Debug logging for conversion operations
 */
export function logConversionDebug(operation: string, input: any, output: any): void {
  console.log(`[CONVERSION DEBUG] ${operation}:`, {
    input,
    output,
    timestamp: new Date().toISOString()
  });
}

/**
 * Validate conversion parameters
 */
export function validateConversionParams(params: {
  usd?: number;
  alphaPoints?: number;
  sui?: number;
}): void {
  const { usd, alphaPoints, sui } = params;
  
  if (usd !== undefined && (usd < 0 || !isFinite(usd))) {
    throw new Error('Invalid USD amount');
  }
  
  if (alphaPoints !== undefined && (alphaPoints < 0 || !isFinite(alphaPoints))) {
    throw new Error('Invalid Alpha Points amount');
  }
  
  if (sui !== undefined && (sui < 0 || !isFinite(sui))) {
    throw new Error('Invalid SUI amount');
  }
}

/**
 * Get current conversion rates (for display/debugging)
 */
export function getCurrentConversionRates() {
  return {
    alphaPointsPerUsd: CONVERSION_RATES.ALPHA_POINTS_PER_USD,
    usdcToMicroUsdc: CONVERSION_RATES.USDC_TO_MICRO_USDC,
    suiToMist: CONVERSION_RATES.SUI_TO_MIST,
    oracleConfig: ORACLE_CONFIG
  };
}

// Export everything as a utilities object as well
export const ConversionUtils = {
  usdToMicroUSDC,
  microUSDCToUsd,
  usdToAlphaPointsForSettings,
  usdToAlphaPointsForSettingsViaOracle,
  alphaPointsToUSDViaOracle,
  suiToMist,
  mistToSui,
  convertSettingsForStorage,
  convertSettingsForDisplay,
  formatAlphaPoints,
  formatUSD,
  formatSUI,
  parseUSDInput,
  parseAlphaPointsInput,
  logConversionDebug,
  validateConversionParams,
  getCurrentConversionRates
}; 