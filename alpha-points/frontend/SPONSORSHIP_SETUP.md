# Sponsored Transactions Setup

## Overview

The Alpha Points platform now supports **sponsored transactions** for **ALL partner operations**. The deployer/admin wallet sponsors gas fees for partners, making it completely free for partners to create capabilities, build perks, and manage their operations.

## Environment Variables

Add these variables to your `.env` file:

```env
# === Sponsorship Configuration ===

# Platform sponsor address for general operations
VITE_PLATFORM_SPONSOR_ADDRESS=0x1234567890abcdef1234567890abcdef12345678

# Deployer/Admin wallet address for partner operations (takes priority)
VITE_DEPLOYER_SPONSOR_ADDRESS=0xabcdef1234567890abcdef1234567890abcdef12

# Enable all partner transaction sponsorship (RECOMMENDED)
VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=true

# Enable specific sponsorship features (overridden by ALL_PARTNER_SPONSORSHIP)
VITE_ENABLE_PERK_SPONSORSHIP=true
VITE_ENABLE_PARTNER_CAP_SPONSORSHIP=true

# Default gas budget for sponsored transactions in MIST (0.01 SUI = 10000000)
VITE_DEFAULT_SPONSORED_GAS_BUDGET=10000000
```

## What Gets Sponsored

### ✅ **ALL Partner Operations (Fully Sponsored by Deployer/Admin)**
- 🏢 **Partner Creation** - Creating new PartnerCapFlex (completely free!)
- 🔗 **ProxyCap Creation** - Creating proxy capabilities for SuiNS integration
- ✨ **Perk Creation** - Creating new perk definitions
- 🔄 **Perk Management** - Updating perk status (activate/pause)
- ⚙️ **Perk Settings** - Updating expiration, usage limits, tags
- 💰 **Price Updates** - Updating perk pricing
- 🎯 **Points Minting** - Minting Alpha Points for users
- 💳 **Loan Facilitation** - Creating loans through partner system

### ❌ **User Operations (Users Pay Their Own Gas)**
- 🛒 Purchasing/claiming perks from marketplace
- 💰 Redeeming Alpha Points for SUI
- 🔄 Staking operations
- 📊 Personal transactions

## Implementation Details

### Sponsor Priority System
1. **DEPLOYER_SPONSOR_ADDRESS** (highest priority for partner operations)
2. **PLATFORM_SPONSOR_ADDRESS** (fallback)
3. **No sponsorship** (user pays gas)

### Transaction Building Example
```typescript
// Partner operations automatically use deployer sponsorship
const sponsorAddress = (SPONSOR_CONFIG.ENABLE_ALL_PARTNER_SPONSORSHIP || SPONSOR_CONFIG.ENABLE_PERK_SPONSORSHIP) 
  ? (SPONSOR_CONFIG.DEPLOYER_SPONSOR_ADDRESS || SPONSOR_CONFIG.PLATFORM_SPONSOR_ADDRESS)
  : undefined;

const transaction = buildCreatePartnerCapFlexTransaction(
  partnerName,
  suiAmount,
  sponsorAddress // 🎁 Deployer/admin pays gas!
);
```

### Sponsor Signature Flow
1. **User Initiates**: Partner initiates operation (create perk, etc.)
2. **Transaction Built**: System builds transaction with deployer sponsor
3. **User Signs**: User signs transaction intent (no gas required)
4. **Deployer Signs**: Deployer/admin wallet signs to authorize gas payment
5. **Execution**: Transaction executes with deployer paying all gas fees

## User Experience

### Partner Operations (Sponsored)
- 🎁 "This transaction will be sponsored by the deployer/admin - no gas fees for you!"
- ✅ "PartnerCapFlex created successfully! (Gas fees sponsored by deployer/admin 🎁)"
- ✅ "Perk created successfully! (Gas fees sponsored by deployer/admin 🎁)"

### User Operations (Not Sponsored)
- ⛽ Standard gas fee charged to user
- ✅ "Perk claimed successfully!"

## Configuration Examples

### Full Partner Sponsorship (Recommended)
```env
VITE_DEPLOYER_SPONSOR_ADDRESS=0xdeployer_wallet_address
VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=true
```

### Selective Sponsorship
```env
VITE_DEPLOYER_SPONSOR_ADDRESS=0xdeployer_wallet_address
VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=false
VITE_ENABLE_PERK_SPONSORSHIP=true
VITE_ENABLE_PARTNER_CAP_SPONSORSHIP=true
```

### Disable Sponsorship
```env
VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=false
VITE_ENABLE_PERK_SPONSORSHIP=false
VITE_ENABLE_PARTNER_CAP_SPONSORSHIP=false
```

## Benefits for Partners

### 🆓 **Zero Gas Costs**
- Partners never pay gas for platform operations
- Lower barrier to entry for new partners
- More predictable operational costs

### 🚀 **Improved UX**
- Seamless partner onboarding
- No need to maintain SUI balance for operations
- Focus on business logic, not gas management

### 💡 **Enhanced Adoption**
- Reduces friction for partner acquisition
- Encourages experimentation with perks
- Supports ecosystem growth

## Security & Monitoring

### Deployer Wallet Security
- **High Security**: Use hardware wallet or multi-sig for deployer
- **Sufficient Balance**: Monitor SUI balance for gas payments
- **Rate Limiting**: Consider implementing rate limits per partner
- **Budget Controls**: Set maximum daily/monthly sponsorship limits

### Monitoring Metrics
- **Total Gas Spent**: Track daily/monthly sponsorship costs
- **Per-Partner Usage**: Monitor gas usage by partner
- **Transaction Success Rate**: Track sponsored transaction success
- **Balance Alerts**: Alert when deployer balance is low

## Cost Management

### Expected Costs
- **Partner Creation**: ~0.01 SUI per new partner
- **Perk Creation**: ~0.005 SUI per perk
- **Perk Management**: ~0.003 SUI per update
- **Points Minting**: ~0.004 SUI per mint operation

### Budget Planning
```
Monthly Estimates:
- 100 new partners: ~1 SUI
- 1000 new perks: ~5 SUI  
- 5000 perk updates: ~15 SUI
- 10000 point mints: ~40 SUI
Total: ~61 SUI/month for high activity
```

## Troubleshooting

### Common Issues

**Deployer Balance Too Low**
- Error: "Insufficient gas budget"
- Solution: Add more SUI to deployer wallet
- Prevention: Set up balance monitoring alerts

**Sponsorship Not Working**
- Check: `VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=true`
- Check: `VITE_DEPLOYER_SPONSOR_ADDRESS` is valid
- Verify: Deployer wallet has sufficient SUI

**Transaction Still Requires Gas**
- Cause: Sponsorship may be disabled for that operation type
- Solution: Enable `VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=true`
- Check: Configuration variables are properly set

**Partner Can't Create Operations**
- Error: Various execution errors
- Check: Partner has valid PartnerCapFlex
- Verify: Contract state and permissions
- Confirm: Deployer sponsorship is active

## Testing

To test sponsored transactions:

1. Set up deployer wallet with SUI balance
2. Enable sponsorship in environment variables
3. Create a perk - should show sponsorship notifications
4. Check transaction on explorer - should show deployer paid gas

## Monitoring

Monitor these metrics:
- **Deployer Balance**: Ensure sufficient SUI for gas payments
- **Transaction Success Rate**: Track sponsored transaction success
- **Gas Usage**: Monitor gas consumption patterns
- **Cost**: Track total sponsorship costs

## Configuration Management

### Development Environment
```env
VITE_ENABLE_PERK_SPONSORSHIP=true
VITE_PLATFORM_SPONSOR_ADDRESS=0xdev_sponsor_address
```

### Production Environment
```env
VITE_ENABLE_PERK_SPONSORSHIP=true
VITE_PLATFORM_SPONSOR_ADDRESS=0xprod_sponsor_address
VITE_DEFAULT_SPONSORED_GAS_BUDGET=10000000
```

### Disable Sponsorship
```env
VITE_ENABLE_PERK_SPONSORSHIP=false
VITE_ENABLE_PARTNER_CAP_SPONSORSHIP=false
```

## Monitoring

Monitor these metrics:
- **Deployer Balance**: Ensure sufficient SUI for gas payments
- **Transaction Success Rate**: Track sponsored transaction success
- **Gas Usage**: Monitor gas consumption patterns
- **Cost**: Track total sponsorship costs

## Troubleshooting

### Common Issues

**Deployer Balance Too Low**
- Error: "Insufficient gas budget"
- Solution: Add more SUI to deployer wallet
- Prevention: Set up balance monitoring alerts

**Sponsorship Not Working**
- Check: `VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=true`
- Check: `VITE_DEPLOYER_SPONSOR_ADDRESS` is valid
- Verify: Deployer wallet has sufficient SUI

**Transaction Still Requires Gas**
- Cause: Sponsorship may be disabled for that operation type
- Solution: Enable `VITE_ENABLE_ALL_PARTNER_SPONSORSHIP=true`
- Check: Configuration variables are properly set

**Partner Can't Create Operations**
- Error: Various execution errors
- Check: Partner has valid PartnerCapFlex
- Verify: Contract state and permissions
- Confirm: Deployer sponsorship is active 