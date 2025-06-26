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
5. **α-3 Partner Extensions**: SDK integrations using the stable API

## Development and Testing

See the `tests` directory for unit tests covering all module functionalities.

# Alpha Points ClaimedPerk Query Tool

A Node.js script to query `ClaimedPerk` objects by Discord ID from the Alpha Points blockchain system.

## Overview

This tool helps you find `ClaimedPerk` objects that contain metadata matching a specific Discord ID. It's particularly useful for Discord bots and backend services that need to verify which perks a user has claimed based on their Discord ID.

## How It Works

1. **ClaimedPerk Structure**: Each claimed perk has an optional `claim_specific_metadata_id` field
2. **Metadata Storage**: This ID points to a `ClaimSpecificMetadataStore` object containing dynamic fields
3. **Discord ID Hashing**: Discord IDs are hashed using SHA-256 with a salt for privacy
4. **Query Process**: The script queries all packages, finds ClaimedPerk objects, and checks their metadata for matching Discord IDs

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (create a `.env` file or export):
```bash
export VITE_PACKAGE_ID="0x..."                    # Your main package ID
export VITE_PACKAGE_ID_V22="0x..."               # Additional package IDs
export VITE_DISCORD_SALT="your-discord-salt"     # Salt used for hashing Discord IDs
```

## Usage

### Query by Discord ID

```bash
# Basic usage with default salt
node query-claimed-perks-by-discord.js 123456789012345678

# With custom salt
node query-claimed-perks-by-discord.js 123456789012345678 custom-salt-2024

# Using npm script
npm run query 123456789012345678
```

### Query by Owner Address

```bash
# Find all ClaimedPerk objects owned by a specific address
node query-claimed-perks-by-discord.js --owner 0x1234567890abcdef...
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_PACKAGE_ID` | Main Alpha Points package ID | Yes |
| `VITE_PACKAGE_ID_V22` | Package ID version 22 | No |
| `VITE_PACKAGE_ID_V21` | Package ID version 21 | No |
| `VITE_DISCORD_SALT` | Salt for Discord ID hashing | Recommended |
| `VITE_METADATA_SALT` | Fallback salt for metadata | No |

## Example Output

```json
[
  {
    "id": "0xabc123...",
    "perk_definition_id": "0xdef456...",
    "owner": "0x789xyz...",
    "claim_timestamp_ms": 1700000000000,
    "status": "ACTIVE",
    "claim_specific_metadata_id": "0x111222...",
    "remaining_uses": 5,
    "packageId": "0x333444...",
    "metadata": {
      "discord_id_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  }
]
```

## API Usage

You can also use this as a module in your own Node.js applications:

```javascript
const { 
  findClaimedPerksByDiscordId, 
  findClaimedPerksByOwner,
  hashDiscordId 
} = require('./query-claimed-perks-by-discord');

// Find perks by Discord ID
const perks = await findClaimedPerksByDiscordId('123456789012345678');

// Find perks by owner address
const userPerks = await findClaimedPerksByOwner('0x123...');

// Hash a Discord ID (useful for verification)
const hashedId = hashDiscordId('123456789012345678', 'your-salt');
```

## Query Strategy

The script uses a multi-step approach for efficiency:

1. **Event-Based Discovery**: First tries to find ClaimedPerk objects via `PerkClaimed` events
2. **Direct Object Query**: Fallback to direct object queries for specific owners
3. **Metadata Fetching**: For each ClaimedPerk, fetches associated metadata from dynamic fields
4. **Hash Matching**: Compares both raw and hashed Discord IDs against stored values

## Supported Metadata Keys

The script looks for Discord IDs in these metadata fields:
- `discord_id` (raw Discord ID)
- `discord_id_hash` (hashed Discord ID)
- `discordId` (alternative naming)
- `discord` (short form)

## Error Handling

- Invalid Discord IDs (must be 17-19 digits) are rejected
- Missing package IDs are skipped with warnings
- Individual object query failures don't stop the entire process
- Network timeouts and RPC errors are handled gracefully

## Performance Considerations

- Uses batch queries where possible (`multiGetObjects`)
- Caches package IDs to avoid repeated environment variable lookups
- Provides progress logging for long-running queries
- Limits event queries to prevent overwhelming the RPC

## Debugging

Run with verbose logging:
```bash
DEBUG=* node query-claimed-perks-by-discord.js 123456789012345678
```

## Common Issues

1. **No results found**: Check that package IDs are correct and the Discord ID exists in metadata
2. **RPC timeouts**: Try using a different RPC endpoint or reducing query limits
3. **Hash mismatches**: Ensure you're using the same salt that was used when creating the metadata

## Integration with Discord Bots

Example Discord bot integration:

```javascript
const { findClaimedPerksByDiscordId } = require('./query-claimed-perks-by-discord');

// Discord bot command
bot.on('messageCreate', async (message) => {
  if (message.content === '!myperks') {
    try {
      const perks = await findClaimedPerksByDiscordId(message.author.id);
      const perkCount = perks.length;
      
      await message.reply(`You have claimed ${perkCount} perk(s)!`);
    } catch (error) {
      await message.reply('Error checking your perks. Please try again later.');
    }
  }
});
```

## Contributing

Feel free to submit issues and pull requests to improve this tool.

## License

MIT License - see LICENSE file for details.
