# Alpha Points Protocol on Sui

This repository contains the Alpha Points Protocol implementation for the Sui blockchain. The protocol enables the minting, management, and redemption of Alpha Points - account-bound units of cross-chain liquidity and loyalty - secured by object-isolated stakes on Sui.

## Module Structure

The protocol is split into several modules with specific responsibilities:

### Core Modules

1. **admin.move**
   - Manages configuration, capabilities, and protocol pause state
   - Contains governance (GovernCap) and oracle (OracleCap) capabilities
   - Controls emergency pause flag functionality

2. **ledger.move**
   - Manages global Alpha Point balances and supply
   - Tracks user account-bound point balances (available and locked)
   - Implements point minting, burning, locking, and unlocking

3. **escrow.move**
   - Holds underlying assets backing points/stakes
   - Manages vaults for different asset types
   - Handles deposits and withdrawals of underlying assets

4. **stake_position.move**
   - Represents individual user stakes as objects
   - Tracks stake parameters (principal, duration, maturity)
   - Handles encumbrance status for loans

5. **oracle.move**
   - Manages conversion rates or other external data
   - Updates and maintains rate information with staleness checks
   - Calculates asset-to-point and point-to-asset conversions

6. **integration.move**
   - Provides public entry points for the protocol
   - Implements stake creation, redemption, and point operations
   - Acts as the main interface for users and external contracts

### Extended Functionality

7. **loan.move** (Phase 2)
   - Enables loans against staked positions
   - Calculates interest based on loan duration
   - Manages loan creation, repayment, and liquidation

8. **lz_bridge.move** (Optional, Feature-Flagged)
   - LayerZero integration for cross-chain functionality
   - Manages message passing between different chains
   - Handles cross-chain point transfers

9. **package.move**
   - Entry point for the Move package
   - Manages upgrade capabilities
   - Controls versioning

## Key Components

- **Account-bound Points**: Points are non-transferable by design, tied to user addresses.
- **Object-centric Security**: Each stake is its own `StakePosition` object with the `key` ability – compromise blast-radius is limited to one object.
- **Upgradability**: The package uses an upgrade capability, allowing for compatible upgrades without forced migration.
- **Extensible Redemption**: Partner modules can call a stable integration API without needing ledger modifications.
- **Cross-chain Optionality**: Feature-flagged LayerZero integration allows for cross-chain functionality if desired.

## Points Generation Formula

```
points = principal × participation × time_weight × (1 / liquidity_dom)
```

Implemented as pure Move math inside the `ledger` module for deterministic results.

## Security Features

- Emergency pause functionality
- Explicit authorization checks via capability objects
- Comprehensive event emission for all state changes
- Full test coverage to ensure correct behavior
- Proper error handling with descriptive error codes

## Deployment Phases

1. **α-0 Core Ledger**: Basic points accounting
2. **α-1 Stake + Escrow**: Full staking and redemption flows
3. **α-2 Loan Module**: Early-exit capability via loans
4. **α-3 LZ Bridge**: Cross-chain functionality (optional)
5. **α-4 Partner Extensions**: SDK integrations using the stable API

## Development and Testing

See the `tests` directory for unit tests covering all module functionalities.

## License

[Add license information here]