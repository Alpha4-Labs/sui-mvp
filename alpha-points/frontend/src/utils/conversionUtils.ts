/**
 * Centralized Unit Conversion Utilities
 * 
 * DISPLAY STRATEGY:
 * - For user display: Always use correct 1 USD = 1000 Alpha Points
 * - For smart contract: Use oracle conversion only when required by backend
 * - Users should see consistent 1:1000 conversion everywhere in UI
 * 
 * CONVERSION RATES:
 * - 1 USD = 1,000,000 micro-USDC (6 decimal places)
 * - 1 USD = 1,000 Alpha Points (CORRECT for UI display)
 * - 1 SUI = 3.28 USDC (via oracle)
 * - 1 SUI = 3,280 Alpha Points (3.28 * 1000)
 */

// Core conversion rates
export const CONVERSION_RATES = {
  USD_TO_MICRO_USDC: 1_000_000,   // 1 USD = 1,000,000 micro-USDC
  USD_TO_ALPHA_POINTS: 1_000,     // 1 USD = 1,000 Alpha Points (CORRECT)
  SUI_TO_USDC: 3.28,              // 1 SUI = 3.28 USDC (via oracle)
  SUI_TO_ALPHA_POINTS: 3_280,     // 1 SUI = 3,280 Alpha Points (calculated)
  ORACLE_RATE: 328_000_000,       // Oracle rate (only for backend compatibility)
  ORACLE_DECIMALS: 9,             // Oracle decimal places
  BUFFER_USD: 0.01,               // Small buffer to avoid off-by-one errors
} as const;

/**
 * DISPLAY CONVERSIONS: Use these for all UI display purposes
 * These functions use the correct 1 USD = 1000 Alpha Points conversion
 */

/**
 * Convert USD to Alpha Points for display (CORRECT: 1 USD = 1000 AP)
 */
export function usdToAlphaPointsDisplay(usdAmount: number): number {
  return Math.floor(usdAmount * CONVERSION_RATES.USD_TO_ALPHA_POINTS);
}

/**
 * Convert Alpha Points to USD for display (CORRECT: 1000 AP = 1 USD)
 */
export function alphaPointsToUSDDisplay(alphaPoints: number): number {
  return alphaPoints / CONVERSION_RATES.USD_TO_ALPHA_POINTS;
}

/**
 * Convert SUI to Alpha Points for display (using correct oracle rate)
 * 1 SUI = 3.28 USD = 3,280 Alpha Points
 */
export function suiToAlphaPointsDisplay(suiAmount: number): number {
  return Math.floor(suiAmount * CONVERSION_RATES.SUI_TO_ALPHA_POINTS);
}

/**
 * Convert Alpha Points to SUI for display
 */
export function alphaPointsToSUIDisplay(alphaPoints: number): number {
  return alphaPoints / CONVERSION_RATES.SUI_TO_ALPHA_POINTS;
}

/**
 * Simple micro-USDC to USD conversion
 */
export function microUSDCToUSD(microUSDC: number): number {
  return microUSDC / CONVERSION_RATES.USD_TO_MICRO_USDC;
}

/**
 * Simple USD to micro-USDC conversion
 */
export function usdToMicroUSDC(usd: number): number {
  return Math.floor(usd * CONVERSION_RATES.USD_TO_MICRO_USDC);
}

/**
 * CORRECT: Simple Alpha Points conversion (what it should be)
 */
export function usdToAlphaPoints(usdAmount: number): number {
  return Math.floor(usdAmount * CONVERSION_RATES.USD_TO_ALPHA_POINTS);
}

/**
 * CORRECT: Alpha Points to USD conversion
 */
export function alphaPointsToUSD(alphaPoints: number): number {
  return alphaPoints / CONVERSION_RATES.USD_TO_ALPHA_POINTS;
}

/**
 * BACKEND COMPATIBILITY ONLY: Oracle conversion (matches smart contract behavior)
 * ⚠️ DO NOT USE FOR DISPLAY - Use usdToAlphaPointsDisplay() instead
 */
export function usdToAlphaPointsViaOracle(usdAmount: number): number {
  const asset = Math.floor(usdAmount * CONVERSION_RATES.USD_TO_MICRO_USDC);
  const points = (asset * Math.pow(10, CONVERSION_RATES.ORACLE_DECIMALS)) / CONVERSION_RATES.ORACLE_RATE;
  return Math.floor(points);
}

/**
 * BACKEND COMPATIBILITY ONLY: Oracle conversion back to USD
 * ⚠️ DO NOT USE FOR DISPLAY - Use alphaPointsToUSDDisplay() instead
 */
export function alphaPointsToUSDViaOracle(alphaPoints: number): number {
  const asset = (alphaPoints * CONVERSION_RATES.ORACLE_RATE) / Math.pow(10, CONVERSION_RATES.ORACLE_DECIMALS);
  return asset / CONVERSION_RATES.USD_TO_MICRO_USDC;
}

/**
 * WORKAROUND: Oracle conversion with buffer for settings storage
 */
export function usdToAlphaPointsForSettingsViaOracle(usdAmount: number): number {
  return usdToAlphaPointsViaOracle(usdAmount + CONVERSION_RATES.BUFFER_USD);
}

// Settings conversion interface
export interface SettingsConversion {
  userInputUSD: number;
  storedAlphaPoints: number;
  displayUSD: number;
  bufferAmount: number;
  hasBuffer: boolean;
}

/**
 * WORKAROUND: Convert user settings for storage (using oracle + buffer)
 */
export function convertSettingsForStorage(userInputUSD: number): SettingsConversion {
  const bufferedUSD = userInputUSD + CONVERSION_RATES.BUFFER_USD;
  const storedAlphaPoints = usdToAlphaPointsViaOracle(bufferedUSD);
  
  return {
    userInputUSD,
    storedAlphaPoints,
    displayUSD: userInputUSD, // Show original user intent
    bufferAmount: CONVERSION_RATES.BUFFER_USD,
    hasBuffer: true,
  };
}

/**
 * WORKAROUND: Convert stored settings for display (remove buffer, show user intent)
 */
export function convertSettingsForDisplay(storedAlphaPoints: number): SettingsConversion {
  // Convert back via oracle to get buffered USD
  const bufferedUSD = alphaPointsToUSDViaOracle(storedAlphaPoints);
  
  // Remove buffer to get original user input
  const userInputUSD = Math.max(0, bufferedUSD - CONVERSION_RATES.BUFFER_USD);
  
  // Detect if this is oracle-stored data (very large AP values) or legacy data
  const isOracleData = storedAlphaPoints > 1_000_000; // More than 1M suggests oracle conversion
  
  if (isOracleData) {
    return {
      userInputUSD,
      storedAlphaPoints,
      displayUSD: userInputUSD,
      bufferAmount: CONVERSION_RATES.BUFFER_USD,
      hasBuffer: true,
    };
  } else {
    // Legacy data: stored as simple 1000:1 conversion
    const legacyUSD = alphaPointsToUSD(storedAlphaPoints);
    return {
      userInputUSD: legacyUSD,
      storedAlphaPoints,
      displayUSD: legacyUSD,
      bufferAmount: 0,
      hasBuffer: false,
    };
  }
}

/**
 * Predicts smart contract validation (oracle-based)
 */
export function predictSmartContractValidation(userInputUSD: number, microUSDCSent: number, settingsLimitAlphaPoints: number): SettingsConversion & {
  microUSDCSent: number;
  estimatedAlphaPoints: number;
  shouldPass: boolean;
  conversionHypotheses: Record<string, { value: number; passes: boolean; description: string }>;
} {
  // Most likely: USD * 1000 (what we expect)
  const hypothesis1 = usdToAlphaPoints(userInputUSD);
  
  // Edge case: Micro-USDC treated as Alpha Points directly
  const hypothesis2 = microUSDCSent;
  
  // Unlikely: USD * 1 (too low)
  const hypothesis3 = userInputUSD;
  
  const conversionHypotheses = {
    hypothesis1_USDx1000: {
      value: hypothesis1,
      passes: hypothesis1 <= settingsLimitAlphaPoints,
      description: 'USD × 1000 (most likely)'
    },
    hypothesis2_MicroUSDCDirect: {
      value: hypothesis2,
      passes: hypothesis2 <= settingsLimitAlphaPoints,
      description: 'Micro-USDC as Alpha Points (1:1)'
    },
    hypothesis3_USDx1: {
      value: hypothesis3,
      passes: hypothesis3 <= settingsLimitAlphaPoints,
      description: 'USD × 1 (unlikely)'
    }
  };
  
  return {
    userInputUSD,
    microUSDCSent,
    estimatedAlphaPoints: hypothesis1, // Most likely conversion
    storedAlphaPoints: settingsLimitAlphaPoints,
    displayUSD: userInputUSD,
    bufferAmount: CONVERSION_RATES.BUFFER_USD,
    hasBuffer: true,
    shouldPass: hypothesis1 <= settingsLimitAlphaPoints,
    conversionHypotheses,
  };
}

/**
 * Debug logging helper (only for development)
 */
export function logConversionDebug(label: string, conversion: SettingsConversion & { [key: string]: any }) {
  // Only log in development or when explicitly needed
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 ${label} Conversion Debug:`, conversion);
  }
}

/**
 * Validation helpers
 */
export function validateUSDAmount(amount: number): boolean {
  return amount >= 0 && amount <= 10000 && !isNaN(amount);
}

export function validateAlphaPointsAmount(amount: number): boolean {
  return amount >= 0 && amount <= 10_000_000_000 && !isNaN(amount); // Increased for oracle values
}

/**
 * Format currencies for display
 */
export function formatUSD(amount: number, decimals: number = 2): string {
  return `$${amount.toFixed(decimals)}`;
}

export function formatAlphaPoints(amount: number): string {
  return `${amount.toLocaleString()} AP`;
}

export function formatMicroUSDC(amount: number): string {
  return `${amount.toLocaleString()} µUSDC`;
}

// DEPRECATED: Legacy functions kept for backward compatibility
export function usdToAlphaPointsForSettings(usdAmount: number, includeBuffer: boolean = true): number {
  console.warn('⚠️ Using deprecated usdToAlphaPointsForSettings. Use convertSettingsForStorage instead.');
  const bufferedAmount = includeBuffer ? usdAmount + CONVERSION_RATES.BUFFER_USD : usdAmount;
  return usdToAlphaPoints(bufferedAmount);
}

export function alphaPointsToUSDForDisplay(alphaPoints: number, removeBuffer: boolean = true): number {
  console.warn('⚠️ Using deprecated alphaPointsToUSDForDisplay. Use convertSettingsForDisplay instead.');
  const usdAmount = alphaPoints / CONVERSION_RATES.USD_TO_ALPHA_POINTS;
  return removeBuffer ? Math.max(0, usdAmount - CONVERSION_RATES.BUFFER_USD) : usdAmount;
} 