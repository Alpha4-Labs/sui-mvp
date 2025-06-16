# Alpha Points Conversion Rate Updates

## Overview
This document summarizes the comprehensive updates made to ensure proper Alpha Points conversion tracking throughout the application, implementing the correct conversion rates:
- **$1 = 1,000 Alpha Points**
- **1 SUI = $3.28 = 3,280 Alpha Points**

## Changes Made

### 1. Created Centralized Constants File
**File:** `frontend/src/utils/constants.ts`

Created a new constants file to centralize all Alpha Points conversion rates and calculations:

```typescript
// Core conversion rates
export const SUI_PRICE_USD = 3.28; // Current SUI price in USD
export const ALPHA_POINTS_PER_USD = 1000; // Fixed ratio: $1 = 1000 Alpha Points
export const ALPHA_POINTS_PER_SUI = SUI_PRICE_USD * ALPHA_POINTS_PER_USD; // 3,280 AP per SUI

// Transaction fees
export const EARLY_UNSTAKE_FEE_RATE = 0.001; // 0.1% fee for early unstaking
export const EARLY_UNSTAKE_RETENTION_RATE = 1 - EARLY_UNSTAKE_FEE_RATE; // 99.9% retention after fee

// Helper functions
export const convertMistToSui = (mist: string | number): number => { ... }
export const convertSuiToAlphaPoints = (sui: number): number => { ... }
export const convertSuiToAlphaPointsWithFee = (sui: number): number => { ... }
export const calculateDailyAlphaPointsRewards = (principalSui: number, apy: number): number => { ... }
export const calculateTotalAlphaPointsRewards = (principalSui: number, apy: number, durationDays: number): number => { ... }
```

### 2. Updated StakedPositionsList.tsx
**File:** `frontend/src/components/StakedPositionsList.tsx`

**Changes:**
- Replaced hardcoded `3280` values with `ALPHA_POINTS_PER_SUI` constant
- Updated `handleEarlyUnstake()` to use centralized conversion functions
- Updated `handleReclaimPrincipal()` to use centralized conversion functions  
- Updated `calculateEstAlphaPointRewards()` to use helper functions
- Added imports for centralized constants and helper functions

**Before:**
```typescript
const expectedAlphaPoints = Math.floor(principalSui * 3280 * 0.999);
```

**After:**
```typescript
const expectedAlphaPoints = convertSuiToAlphaPointsWithFee(principalSui);
```

### 3. Updated PerformanceTodayCard.tsx
**File:** `frontend/src/components/PerformanceTodayCard.tsx`

**Changes:**
- Removed duplicate constant definitions
- Updated `calculateCapitalEfficiency()` to use centralized constants
- Updated `calculateHourlyRate()` to use centralized constants and helper functions
- Added imports for centralized constants

**Before:**
```typescript
const SUI_PRICE_USD = 3.28;
const ALPHA_POINTS_PER_USD = 1000;
const ALPHA_POINTS_PER_SUI = SUI_PRICE_USD * ALPHA_POINTS_PER_USD;
const principal = parseFloat(position.principal || '0') / 1_000_000_000;
```

**After:**
```typescript
// Uses imported constants
const principal = convertMistToSui(position.principal || '0');
```

### 4. Updated LoanPanel.tsx
**File:** `frontend/src/components/LoanPanel.tsx`

**Changes:**
- Removed duplicate constant definitions
- Updated loan value calculations to use centralized constants
- Updated MIST to SUI conversion to use helper function
- Added imports for centralized constants

**Before:**
```typescript
const SUI_PRICE_USD_FOR_LOAN = 3.28;
const ALPHA_POINTS_PER_USD = 1000;
const ALPHA_POINTS_PER_SUI_FOR_LOAN = SUI_PRICE_USD_FOR_LOAN * ALPHA_POINTS_PER_USD;
const principalSuiValue = Number(selectedPosition.principal) / 1_000_000_000;
const stakeValueInAlphaPoints = principalSuiValue * ALPHA_POINTS_PER_SUI_FOR_LOAN;
```

**After:**
```typescript
// Uses imported constants
const principalSuiValue = convertMistToSui(selectedPosition.principal);
const stakeValueInAlphaPoints = principalSuiValue * ALPHA_POINTS_PER_SUI;
```

### 5. Updated AnalyticsPage.tsx
**File:** `frontend/src/pages/AnalyticsPage.tsx`

**Changes:**
- Updated staking calculations to use centralized constants
- Updated transaction event processing to use helper functions
- Replaced hardcoded `3280` values with `ALPHA_POINTS_PER_SUI`
- Added imports for centralized constants

**Before:**
```typescript
const principal = position?.principal ? parseFloat(position.principal) : 0;
return sum + (principal / 1_000_000_000);
const stakingPointsEquivalent = Math.floor(totalStakedSui * 3280) || 0;
```

**After:**
```typescript
const principal = position?.principal ? convertMistToSui(position.principal) : 0;
return sum + principal;
const stakingPointsEquivalent = Math.floor(totalStakedSui * ALPHA_POINTS_PER_SUI) || 0;
```

### 6. Updated MarketplacePage.tsx
**File:** `frontend/src/pages/MarketplacePage.tsx`

**Changes:**
- Updated price calculation to use centralized constants
- Simplified `alphaPointsPerSui` calculation
- Added imports for centralized constants

**Before:**
```typescript
const SUI_PRICE_USD = 3.28;
const ALPHA_POINT_PRICE_USD = 3.28 / 1191360;
const alphaPointsPerSui = useMemo(() => {
  if (ALPHA_POINT_PRICE_USD <= 0) return Infinity;
  return SUI_PRICE_USD / ALPHA_POINT_PRICE_USD;
}, []);
```

**After:**
```typescript
const ALPHA_POINT_PRICE_USD = SUI_PRICE_USD / ALPHA_POINTS_PER_SUI;
const alphaPointsPerSui = useMemo(() => {
  return ALPHA_POINTS_PER_SUI;
}, []);
```

## Benefits of These Changes

### 1. **Consistency**
- All components now use the same conversion rates
- No more discrepancies between hardcoded values
- Single source of truth for all Alpha Points calculations

### 2. **Maintainability**
- Easy to update conversion rates in one place
- Centralized helper functions reduce code duplication
- Clear documentation of conversion logic

### 3. **Accuracy**
- Proper implementation of $1 = 1,000 Alpha Points
- Correct SUI to Alpha Points conversion (1 SUI = 3,280 αP)
- Consistent fee calculations (0.1% early unstake fee)

### 4. **Developer Experience**
- Type-safe helper functions
- Clear function names that describe their purpose
- Comprehensive documentation and comments

## Conversion Rate Summary

| Conversion | Rate | Implementation |
|------------|------|----------------|
| USD to Alpha Points | $1 = 1,000 αP | `ALPHA_POINTS_PER_USD = 1000` |
| SUI to USD | 1 SUI = $3.28 | `SUI_PRICE_USD = 3.28` |
| SUI to Alpha Points | 1 SUI = 3,280 αP | `ALPHA_POINTS_PER_SUI = 3280` |
| Early Unstake Fee | 0.1% fee | `EARLY_UNSTAKE_FEE_RATE = 0.001` |
| Early Unstake Retention | 99.9% retained | `EARLY_UNSTAKE_RETENTION_RATE = 0.999` |

## Testing

All changes have been validated with TypeScript compilation:
```bash
npx tsc --noEmit --skipLibCheck
# ✅ No errors found
```

## Future Considerations

1. **Price Updates**: When SUI price changes, only update `SUI_PRICE_USD` in `constants.ts`
2. **Fee Changes**: Update fee rates in `constants.ts` to affect all components
3. **New Conversions**: Add new helper functions to `constants.ts` for consistency
4. **Rate Monitoring**: Consider implementing dynamic price fetching for real-time rates

## Files Modified

1. `frontend/src/utils/constants.ts` (NEW)
2. `frontend/src/components/StakedPositionsList.tsx`
3. `frontend/src/components/PerformanceTodayCard.tsx`
4. `frontend/src/components/LoanPanel.tsx`
5. `frontend/src/pages/AnalyticsPage.tsx`
6. `frontend/src/pages/MarketplacePage.tsx`

All components now properly track Alpha Points conversions using the correct rates:
- **$1 = 1,000 points**
- **1 SUI = $3.28 = 3,280 points** 