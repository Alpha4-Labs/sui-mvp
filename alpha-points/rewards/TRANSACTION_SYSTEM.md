# Alpha Points Transaction System & Discord Integration

## Overview

This system implements a complete flow for spending Alpha Points to claim perks with automatic Discord role assignment. It includes blockchain transaction handling, Discord bot integration, and comprehensive validation.

## Architecture

### Core Components

1. **TransactionService** (`src/services/transactions.ts`)
   - Handles Alpha Points spending transactions
   - Manages Discord role assignment via bot API
   - Provides balance verification and transaction status tracking

2. **Discord Integration** (`src/services/discord.ts`)
   - OAuth user authentication
   - Bot API for role management
   - User validation and security

3. **Validation Hooks** (`src/hooks/useDiscordValidation.ts`)
   - Validates Discord requirements for perks
   - Provides requirement checking and user feedback

4. **UI Integration** (`src/components/RewardPlatform.tsx`)
   - Enhanced claim buttons with validation
   - Real-time status updates and error handling
   - Transaction progress indicators

## Transaction Flow

### 1. User Initiates Claim
```typescript
handleClaimPerk(perk: Alpha4Perk)
```

### 2. Pre-Transaction Validation
- Wallet connection check
- Discord connection check (for Discord perks)
- Required perks validation
- Alpha Points balance verification

### 3. Transaction Building
```typescript
buildSpendTransaction(userAddress, perk)
```
- Creates Sui transaction for Alpha Points spending
- Includes perk claiming contract calls
- Handles transaction fee estimation

### 4. Transaction Execution
```typescript
signAndExecuteTransaction(transaction)
```
- User signs transaction via wallet
- Transaction submitted to Sui network
- Real-time status monitoring

### 5. Discord Role Assignment
```typescript
assignDiscordRole(perk)
```
- Validates Discord bot permissions
- Calls Discord REST API to assign role
- Handles API errors gracefully

### 6. Status Updates
- UI updates with transaction status
- Error handling and user feedback
- Refresh user perks on success

## Discord Bot Integration

### Required Setup

1. **Discord Application**
   - Bot token for API access
   - Guild ID for server identification
   - Role IDs for specific roles

2. **Bot Permissions**
   - `Manage Roles` - Essential for role assignment
   - `View Channels` - For server access
   - `Read Message History` - For basic functionality

3. **Environment Variables**
   ```env
   VITE_DISCORD_BOT_TOKEN=your_bot_token
   VITE_DISCORD_GUILD_ID=your_server_id
   VITE_DISCORD_ALPHA_OG_ROLE_ID=role_id
   VITE_DISCORD_PREMIUM_ROLE_ID=role_id
   ```

### Discord API Usage

The system uses Discord REST API v10:

```typescript
PUT /guilds/{guild_id}/members/{user_id}/roles/{role_id}
Headers:
  Authorization: Bot {bot_token}
  Content-Type: application/json
  X-Audit-Log-Reason: Alpha4 Rewards - Perk claimed
```

### Error Handling

| Error Code | Meaning | Handling |
|------------|---------|----------|
| 403 | Insufficient permissions | Bot role hierarchy check |
| 404 | User not in server | User guidance message |
| 429 | Rate limited | Retry with backoff |
| 401 | Invalid token | Configuration validation |

## Security Considerations

### Bot Token Security
- Environment variables only
- No client-side exposure
- Regular token rotation

### Role Assignment Validation
- User must be Discord server member
- Bot role must be above assigned roles
- Audit logging for all assignments

### Transaction Security
- User signs all transactions
- Balance verification before execution
- Transaction status validation

## Configuration

### Environment Setup

1. Copy `env.template` to `.env`
2. Fill in Discord bot configuration
3. Set Sui network parameters
4. Configure package IDs

### Discord Server Setup

1. Create Discord application and bot
2. Invite bot to server with `Manage Roles` permission
3. Position bot role above assigned roles
4. Get role and guild IDs

## Usage Examples

### Basic Perk Claim
```typescript
// For non-Discord perks
const result = await transactionService.spendAlphaPoints({
  userAddress: '0x...',
  perk: merchandisePerk,
  signAndExecuteTransaction: walletSign
});
```

### Discord Perk Claim
```typescript
// For Discord perks - includes role assignment
const result = await transactionService.spendAlphaPoints({
  userAddress: '0x...',
  perk: discordAlphaOGPerk,
  signAndExecuteTransaction: walletSign
});

if (result.discordRoleAssigned) {
  console.log('Discord role assigned successfully');
}
```

### Balance Checking
```typescript
const hasBalance = await transactionService.verifyAlphaPointsBalance(
  userAddress, 
  requiredAmount
);
```

### Transaction Status
```typescript
const status = await transactionService.getTransactionStatus(txHash);
// Returns: 'pending' | 'success' | 'failed'
```

## UI Components

### Enhanced Claim Buttons
- Dynamic eligibility checking
- Discord connection validation
- Clear requirement messaging
- Loading states during transactions

### Status Indicators
- Real-time transaction progress
- Discord role assignment confirmation
- Error message display
- Success notifications

### Connection Management
- Wallet connection status
- Discord connection status
- Easy disconnect/reconnect options

## Testing

### Local Testing
1. Set up Discord bot in test server
2. Configure environment variables
3. Test perk claiming flow
4. Verify role assignment

### Production Checklist
- [ ] Bot permissions configured
- [ ] Role hierarchy correct
- [ ] Environment variables set
- [ ] Error handling tested
- [ ] Rate limiting implemented
- [ ] Audit logging enabled

## Monitoring

### Transaction Monitoring
- Console logging for all transactions
- Error tracking and alerting
- Transaction hash recording

### Discord API Monitoring
- API response logging
- Rate limit tracking
- Role assignment verification

### User Experience Monitoring
- Success/failure rates
- Common error patterns
- Performance metrics

## Future Enhancements

### Planned Features
- Batch role assignments
- Role removal on perk expiry
- Advanced Discord server validation
- Multi-server support

### Potential Integrations
- Discord webhooks for notifications
- Advanced audit logging
- Role analytics and reporting
- Automated Discord server setup

## Troubleshooting

### Common Issues

1. **Discord role not assigned**
   - Check bot permissions
   - Verify role hierarchy
   - Confirm user is in server

2. **Transaction fails**
   - Check Alpha Points balance
   - Verify network connection
   - Validate contract addresses

3. **Discord connection issues**
   - Clear localStorage
   - Re-authenticate Discord
   - Check OAuth configuration

### Debug Steps

1. Check console logs for detailed errors
2. Verify environment configuration
3. Test Discord bot separately
4. Validate Sui network connectivity
5. Check user permissions and balances

## API Reference

See `src/services/transactions.ts` for complete TypeScript interfaces and method documentation.

Key interfaces:
- `TransactionResult`
- `SpendAlphaPointsParams`
- `TransactionStatus`
- `PerkClaimResult` 