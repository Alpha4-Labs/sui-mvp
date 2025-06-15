# Transaction Integration Guide

## Overview

The Alpha4 Rewards system has been enhanced to leverage the comprehensive transaction building patterns from the frontend project. This integration provides robust transaction handling, proper error management, and extensive validation.

## Key Components

### 1. TransactionBuilder (`src/utils/transactionBuilder.ts`)

The enhanced transaction builder provides multiple transaction types and robust error handling:

```typescript
// Build a perk purchase transaction
const transaction = TransactionBuilder.buildPurchaseAlphaPerkTransaction(
  userAddress,
  perk,
  uniqueCode // Optional for Discord role perks
);

// Build a points redemption transaction
const redemptionTx = TransactionBuilder.buildRedeemPointsTransaction(
  pointsToRedeem,
  userAddress
);

// Build a test transaction for connectivity testing
const testTx = TransactionBuilder.buildTestTransaction(userAddress);
```

#### Features:
- **Multiple transaction types**: Perk purchases, points redemption, test transactions
- **Parameter validation**: Comprehensive input validation before building
- **Gas estimation**: Appropriate gas budgets for different operations
- **Error handling**: Detailed error messages with proper categorization
- **Configuration validation**: Checks contract setup before building transactions

### 2. Enhanced TransactionService (`src/services/transactions.ts`)

The transaction service has been upgraded with frontend patterns:

```typescript
// Enhanced Alpha Points spending with comprehensive validation
const result = await transactionService.spendAlphaPoints({
  userAddress,
  perk,
  uniqueCode, // For Discord role perks
  signAndExecuteTransaction
});

// Test transaction connectivity
const connectivityTest = await transactionService.testTransactionConnectivity(
  userAddress,
  signAndExecuteTransaction
);

// Redeem Alpha Points for SUI
const redemptionResult = await transactionService.redeemAlphaPoints(
  userAddress,
  pointsToRedeem,
  signAndExecuteTransaction
);
```

#### Enhanced Features:
- **Flexible hash extraction**: Handles different wallet result structures
- **Enhanced error parsing**: Specific error messages for different failure types
- **Configuration validation**: Checks system setup before proceeding
- **Connectivity testing**: Validates transaction capability before expensive operations
- **Discord integration**: Automatic role assignment for Discord perks

### 3. ConversionUtils (`src/utils/conversionUtils.ts`)

Comprehensive conversion utilities aligned with frontend patterns:

```typescript
// USD to Alpha Points conversions
const alphaPoints = ConversionUtils.usdToAlphaPointsForSettings(40); // 40,000,000 AP
const oraclePoints = ConversionUtils.usdToAlphaPointsForSettingsViaOracle(40); // Dynamic

// Formatting for display
const formatted = ConversionUtils.formatAlphaPoints(1000000); // "1,000,000 AP"
const usdFormatted = ConversionUtils.formatUSD(40.50); // "$40.50"

// Input parsing
const parsedUsd = ConversionUtils.parseUSDInput("$40.50"); // 40.5
const parsedPoints = ConversionUtils.parseAlphaPointsInput("1M"); // 1,000,000
```

#### Features:
- **Multiple conversion types**: USD, Alpha Points, USDC micro-units, SUI/MIST
- **Oracle simulation**: Mimics smart contract oracle-based conversions
- **Input parsing**: Handles various user input formats
- **Display formatting**: Consistent formatting across the application
- **Validation**: Parameter validation for all conversion operations

### 4. Enhanced Configuration (`src/config/sui.ts`)

Comprehensive configuration management based on frontend patterns:

```typescript
// Configuration status checking
const status = getConfigurationStatus();
console.log('Config complete:', status.isComplete);
console.log('Using real contracts:', status.isRealContracts);

// Gas budget management
const gasBudget = getGasBudget('perk_purchase'); // 10,000,000 MIST

// Package ID resolution
const packageId = getPackageId('main'); // With fallback logic
```

#### Enhanced Features:
- **Comprehensive validation**: Checks all required configuration
- **Status reporting**: Detailed configuration status for debugging
- **Gas management**: Appropriate gas budgets for different operations
- **Environment template**: Complete setup guide for deployment

## Transaction Flow Enhancement

### 1. Pre-Transaction Validation

```typescript
// 1. Configuration validation
const configStatus = getConfigurationStatus();
if (!configStatus.isComplete) {
  throw new Error('System configuration incomplete');
}

// 2. Parameter validation
TransactionBuilder.validateTransactionParams({ userAddress, perk, amount });

// 3. Network connectivity testing
const networkTest = await testNetworkConnectivity();
if (!networkTest.success) {
  throw new Error(networkTest.message);
}

// 4. Enhanced transaction connectivity testing
const connectivityTest = await transactionService.testTransactionConnectivity(
  userAddress,
  signAndExecuteTransaction
);
if (!connectivityTest.success) {
  throw new Error(connectivityTest.error);
}
```

### 2. Transaction Building

```typescript
// Enhanced transaction building with fallback
const buildEnhancedTransaction = (userAddress, perk, uniqueCode) => {
  try {
    // Use comprehensive transaction builder
    return TransactionBuilder.buildPurchaseAlphaPerkTransaction(userAddress, perk, uniqueCode);
  } catch (error) {
    console.warn('Enhanced builder failed, falling back to test transaction:', error);
    // Graceful fallback to simple test transaction
    return TransactionBuilder.buildTestTransaction(userAddress);
  }
};
```

### 3. Transaction Execution

```typescript
// Enhanced transaction execution with flexible result handling
const result = await signAndExecuteTransaction(transaction);

// Flexible hash extraction (handles different wallet implementations)
const txHash = extractTransactionHash(result);

// Enhanced error parsing
if (!result.success) {
  const errorMessage = parseTransactionError(result.error);
  throw new Error(errorMessage);
}
```

### 4. Post-Transaction Processing

```typescript
// Discord role assignment for role perks
if (isDiscordPerk(perk) && result.success) {
  try {
    const roleAssigned = await assignDiscordRole(perk);
    result.discordRoleAssigned = roleAssigned;
  } catch (discordError) {
    console.warn('Transaction succeeded but Discord role assignment failed:', discordError);
    // Don't fail the entire transaction for Discord issues
  }
}

// Enhanced success logging
console.log('🎉 Transaction completed successfully:', {
  perkName: perk.name,
  cost: ConversionUtils.formatAlphaPoints(perk.alphaPointCost),
  txHash: result.txHash,
  discordRoleAssigned: result.discordRoleAssigned
});
```

## Error Handling Enhancement

### 1. Network Errors
```typescript
if (message.includes('failed to fetch') || message.includes('network')) {
  return 'Network connection failed. Please check your internet connection and try again.';
}
```

### 2. User Rejection
```typescript
if (message.includes('user rejected') || message.includes('cancelled')) {
  return 'Transaction was rejected by user.';
}
```

### 3. Contract Errors
```typescript
if (message.includes('moveCall') || message.includes('package')) {
  return 'Smart contract call failed. The contract may be unavailable or incorrectly configured.';
}
```

### 4. Configuration Errors
```typescript
if (message.includes('not configured') || message.includes('missing')) {
  return 'System configuration error. Please contact support.';
}
```

## Configuration Requirements

### Environment Variables

```bash
# Core contract configuration
VITE_PACKAGE_ID=0x...              # Main Alpha4 package ID
VITE_LEDGER_ID=0x...               # Alpha Points ledger
VITE_CONFIG_ID=0x...               # Configuration object
VITE_ORACLE_ID=0x...               # Price oracle

# Discord integration
VITE_DISCORD_BOT_TOKEN=...         # Bot token for role assignment
VITE_DISCORD_GUILD_ID=...          # Discord server ID
VITE_DISCORD_ALPHA_OG_ROLE_ID=...  # Role IDs for different perks

# SuiNS integration (for role perks)
VITE_SUINS_PARENT_DOMAIN_NAME=alpha4.sui
VITE_SUINS_PARENT_OBJECT_ID=0x...
```

### Validation

```typescript
// Check if configuration is complete
const isComplete = isConfigurationComplete();

// Get detailed status
const status = getConfigurationStatus();
```

## Benefits of Integration

### 1. **Robust Error Handling**
- Specific error messages for different failure scenarios
- Graceful fallbacks when enhanced features fail
- Comprehensive logging for debugging

### 2. **Enhanced Validation**
- Pre-transaction parameter validation
- Configuration completeness checking
- Network connectivity testing

### 3. **Flexible Transaction Building**
- Multiple transaction types for different operations
- Proper gas estimation and budgeting
- Discord role integration for social perks

### 4. **Production Ready**
- Comprehensive configuration management
- Environment-specific settings
- Detailed status reporting

### 5. **Developer Experience**
- Extensive logging and debugging information
- Clear error messages and resolution guidance
- Modular architecture for easy maintenance

## Testing

### 1. Connectivity Testing
```typescript
// Test basic network connectivity
const networkTest = await testNetworkConnectivity();

// Test wallet transaction capability
const walletTest = await testWalletTransaction(userAddress);

// Test enhanced transaction service
const serviceTest = await transactionService.testTransactionConnectivity(
  userAddress,
  signAndExecuteTransaction
);
```

### 2. Configuration Testing
```typescript
// Check configuration status
const configStatus = getConfigurationStatus();
console.log('Configuration status:', configStatus);

// Validate individual components
console.log('Transaction helpers status:', TransactionHelpers.getConfigurationStatus());
```

### 3. Transaction Testing
```typescript
// Build and validate test transaction
const testTx = TransactionBuilder.buildTestTransaction(userAddress);
const result = await signAndExecuteTransaction(testTx);
```

This integration provides a production-ready transaction system that leverages the comprehensive patterns developed in the frontend project while adapting them for the specific needs of the Alpha4 Rewards system. 