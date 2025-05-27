# Alpha Points Move Modules

This directory contains the Move smart contracts for the Alpha Points protocol on Sui.

## Overview
Alpha Points is a protocol for minting, distributing, and managing non-transferable points (Alpha Points) for ecosystem partners. Partners can lock SUI as collateral to receive a PartnerCap NFT, which grants them a daily minting quota based on the value of their collateral.

## Key Modules
- `partner.move`: Manages partner onboarding, PartnerCap NFT, collateralization, and quota logic.
- `oracle.move`: Provides SUI/USD price feeds for quota calculation.
- `integration.move`: Entry point for protocol integration and routing.
- `stake_position.move`, `staking_manager.move`: Staking and rewards logic.
- `loan.move`, `escrow.move`, `ledger.move`: Lending, escrow, and accounting modules.
- `admin.move`: Admin controls and configuration.

## Partner Onboarding Flow
- Partners call `create_partner_cap_with_collateral` in `partner.move`, locking SUI as collateral.
- The protocol uses the oracle to determine the USDC value and sets the daily minting quota.
- A PartnerCap NFT is minted and transferred to the partner.

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
- The frontend must pass the correct object IDs (from deployment) as arguments to entry functions.
- BCS serialization is handled via the Mysten Sui SDK in the frontend.
- See `/frontend/README.md` for environment variable setup and integration details.

---
For frontend usage and onboarding UI, see `/frontend/README.md`. 