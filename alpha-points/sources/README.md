# Alpha Points Move Modules

This directory contains the Move smart contracts for the Alpha Points protocol on Sui.

## Overview
Alpha Points is a protocol for minting, distributing, and managing non-transferable points (Alpha Points) for ecosystem partners. Partners can lock SUI as collateral to receive a PartnerCapFlex NFT, which grants them quota-based minting capabilities backed by Total Value Locked (TVL).

## Key Features
- **TVL-Backed Quotas**: Partners can mint up to 1,000 Alpha Points per USDC of locked collateral (lifetime)
- **Daily Throttling**: Maximum 3% of TVL value can be minted per day to prevent dilution
- **Revenue Recycling**: 20% of perk revenue is automatically reinvested to grow partner TVL
- **Sustainable Tokenomics**: 70/20/10 revenue split (Producer/TVL Growth/Platform)
- **Upgrade-Safe Architecture**: New TVL system maintains backward compatibility with legacy partner system

## Package Upgrade Strategy

This package follows Sui Move upgrade best practices:

### Compatible Changes (✅ Safe)
- **New Functions**: All PartnerCapFlex functions are additions to existing modules
- **Deprecation Markers**: Legacy functions marked with `@deprecated` but remain functional
- **Enhanced Revenue Splits**: New 70/20/10 model adds functionality without breaking changes
- **TVL-Backed Quotas**: Additional validation layer that doesn't affect existing struct layouts

### Backward Compatibility
- **Legacy PartnerCap**: Fully functional, no breaking changes to struct or function signatures
- **Old Integration Points**: `earn_points_by_partner()` continues to work unchanged
- **Existing Perks**: Previous perk system remains operational during transition
- **Migration Path**: Clear upgrade path from old to new system without forced migration

## Key Modules

### Core Infrastructure
- `partner_flex.move`: **NEW** - Flexible partner system with TVL-backed quotas and collateral management
- `perk_manager.move`: **ENHANCED** - Now supports both legacy and TVL-backed revenue splits (70/20/10)
- `oracle.move`: **ENHANCED** - SUI/USD price feeds and Alpha Points conversion (1 USDC = 10,000 Alpha Points)
- `integration.move`: **ENHANCED** - New entry points for TVL-backed system alongside legacy functions
- `loan.move`: **ENHANCED** - New PartnerCapFlex loan functions with quota validation

### Legacy Modules (Deprecated but Functional)
- `partner.move`: **DEPRECATED** - Legacy partner system maintained for backward compatibility

### Supporting Infrastructure
- `stake_position.move`, `staking_manager.move`: Staking and rewards logic
- `escrow.move`, `ledger.move`: Lending, escrow, and accounting modules  
- `admin.move`: Admin controls and configuration

## Migration Guide

### For New Integrations (Recommended)
1. Use `create_partner_cap_flex_with_collateral()` in `partner_flex.move`
2. Call `earn_points_by_partner_flex()` for minting with quota validation
3. Create perks via enhanced `perk_manager.move` with automatic 70/20/10 split
4. Benefit from TVL growth loop and sustainable tokenomics

### For Existing Integrations (Gradual Migration)
1. **No Immediate Action Required** - All existing functions continue working
2. **Optional Migration** - Upgrade to PartnerCapFlex at your own pace
3. **Enhanced Features** - Migrate to access TVL backing and revenue recycling
4. **Support Period** - Legacy system will be supported indefinitely for existing partners

## Partner Onboarding Flow (New TVL-Backed System)

### Initial Setup
1. **Collateral Deposit**: Call `create_partner_cap_flex_with_collateral()` locking SUI as collateral
2. **Oracle Valuation**: Protocol determines USDC value via oracle pricing
3. **Quota Calculation**: System calculates:
   - Lifetime quota: TVL × 1,000 Alpha Points
   - Daily quota: 3% of TVL value per day
4. **NFT Issuance**: PartnerCapFlex NFT minted with quota tracking capabilities

### Operational Flow
1. **Point Minting**: Use `earn_points_by_partner_flex()` with automatic quota validation
2. **Perk Creation**: Enhanced perk system validates against partner quotas
3. **Revenue Distribution**: Automatic 70/20/10 split on perk sales:
   - 70% to perk producer (immediate)
   - 20% reinvested as USDC value to grow producer's TVL
   - 10% to platform deployer
4. **TVL Growth**: Successful partners see TVL growth → higher quotas → more earning potential

## Revenue Split & TVL Growth Mechanics

### Enhanced Revenue Model (70/20/10)
- **Perk Sales**: 100% of user payment is burned from circulation, then redistributed:
  - **70% Producer Share**: Direct payment to perk creator
  - **20% TVL Reinvestment**: Converted to USDC value and added to producer's effective TVL
  - **10% Platform Fee**: Payment to protocol deployer

### TVL Growth Loop
- **Automatic Reinvestment**: 20% of all perk revenue grows partner's effective TVL
- **Quota Expansion**: Higher TVL enables larger daily and lifetime quotas
- **Sustainable Growth**: Partners who create valuable perks naturally gain more minting capacity
- **Protection Mechanism**: Daily limits prevent rapid TVL dilution while allowing sustained growth

### Quota Protection
- **Daily Throttling**: Maximum 3% of TVL can be minted per day
- **Lifetime Limits**: Total quota based on 1,000 points per USDC of TVL
- **Validation Layer**: Every mint operation validates against current quotas
- **Growth Accommodation**: TVL increases automatically expand available quotas

## Function Reference

### New TVL-Backed Functions (Recommended)
```move
// Partner onboarding with collateral
partner_flex::create_partner_cap_flex_with_collateral()

// Enhanced point minting with quota validation  
integration::earn_points_by_partner_flex()

// TVL-backed loan opening
loan::open_loan_with_partner_flex()

// Enhanced perk creation with quota validation
perk_manager::create_perk_with_quota_validation()
```

### Legacy Functions (Deprecated but Functional)
```move
// @deprecated - Use partner_flex system
integration::earn_points_by_partner()

// @deprecated - Use open_loan_with_partner_flex  
loan::open_loan_with_partner()

// Legacy perk system - still functional
perk_manager::create_perk() // (original signature)
```

## Building & Testing

### Build
```bash
sui move build
```

### Test
```bash
sui move test
```

### Lint
```bash
sui move lint
```

## Integration Notes

### For New Integrations
- **Use TVL System**: Integrate with `earn_points_by_partner_flex()` for quota validation
- **Enhanced Revenue**: Benefit from 70/20/10 split and automatic TVL growth
- **Future-Proof**: Built on sustainable tokenomics with protection mechanisms

### For Existing Integrations  
- **No Breaking Changes**: All existing functions maintain exact signatures
- **Gradual Migration**: Upgrade at your own pace without forced changes
- **Dual Support**: Both systems operational during transition period
- **Clear Migration Path**: Documentation and tooling for smooth transition

### Technical Requirements
- Frontend must pass correct object IDs from deployment as function arguments
- BCS serialization handled via Mysten Sui SDK
- See `/frontend/README.md` for environment variable setup and integration details

## Upgrade Safety

This package follows Sui Move upgrade compatibility requirements:

### ✅ Compliant Changes
- **Additions Only**: All new functions and structs are additions
- **Struct Compatibility**: No changes to existing struct layouts or abilities
- **Function Signatures**: All public function signatures remain unchanged
- **Deprecation Strategy**: Old functions marked deprecated but remain functional

### 🔒 Protection Mechanisms
- **Backward Compatibility**: Existing integrations continue working without changes
- **Migration Support**: Clear path from legacy to new system
- **Documentation**: Comprehensive upgrade guide and deprecation notices
- **Testing**: Full test suite ensures both legacy and new systems work correctly

---

For frontend usage and onboarding UI, see `/frontend/README.md`. 
For package upgrade procedures, see Sui Move upgrade documentation. 

## Core Modules

### `admin.move`
Handles protocol administration, configuration, and governance.

### `ledger.move` 
Manages Alpha Points balances and calculations.

### `integration.move`
Main integration layer for staking operations.

## ⚠️ KNOWN CRITICAL ISSUES

### Staking Rewards Math Error (URGENT)

**Status**: DOCUMENTED - Cannot fix due to Sui Move upgrade constraints

**Problem**: Staking rewards are giving **223x more points than intended**

**Expected vs Actual**:
- **Expected**: 1 SUI at 5% APY for 7 epochs = ~3.14 Alpha Points
- **Actual**: 1 SUI gives 700 Alpha Points (223x multiplier error!)

**Root Cause Analysis**:
1. `Config.points_rate = 100` interpreted as "100 points per SUI per epoch"
2. Should be APY basis points where `500 = 5% APY`
3. Two inconsistent calculation methods:
   - `ledger.move`: Flat rate multiplication per epoch
   - `integration.move`: Uses arbitrary scaling factor (25)

**Math Breakdown**:
```
Current Wrong Formula (ledger.move):
points = (principal_mist * points_rate * epochs) / 1e9
For 1 SUI, 7 epochs: (1e9 * 100 * 7) / 1e9 = 700 points ❌

Correct Formula Should Be:
principal_in_AP = (principal_mist * 3280) / 1e9  // Convert to Alpha Points value  
points = (principal_in_AP * apy_bps * epochs) / (10000 * 365)  // APY-based
For 1 SUI, 7 epochs: (3280 * 500 * 7) / (10000 * 365) = ~3.14 points ✅
```

**Impact**:
- Users receiving massive over-rewards
- Economics completely broken
- Inconsistent calculation results between functions

**Why Can't Fix Immediately**:
- Sui Move upgrade rules prevent changing public function logic
- Cannot change struct field interpretations  
- Would break existing contract compatibility

**Immediate Options**:
1. **Quick Fix**: Reduce `points_rate` from 100 to ~0.45 via admin function
2. **Frontend Fix**: Apply correction factor in UI display
3. **New Functions**: Add v2 functions with correct math (safe upgrade)
4. **Major Upgrade**: Plan new economics module

**Files Affected**:
- `sources/admin.move` - Config struct and points_rate interpretation
- `sources/ledger.move` - calculate_accrued_points function  
- `sources/integration.move` - view_accrued_points_for_stake function

**Next Steps**:
1. ✅ Documented in code comments
2. ⚠️ Needs immediate decision on mitigation strategy
3. 📋 Plan proper architectural fix for next major upgrade

---

## Module Documentation 