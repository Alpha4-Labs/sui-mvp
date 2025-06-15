# Discord Bot Setup for Alpha4 Rewards

This guide explains how to set up a Discord bot for automatically assigning roles when users claim perks.

## Prerequisites

1. Discord account with server administrator permissions
2. Discord Developer Portal access
3. Basic understanding of Discord permissions

## Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your application (e.g., "Alpha4 Rewards Bot")
4. Navigate to the "Bot" section in the left sidebar
5. Click "Add Bot"
6. Save the **Bot Token** - you'll need this for `VITE_DISCORD_BOT_TOKEN`

## Step 2: Configure Bot Permissions

### Required Bot Permissions:
- `Manage Roles` - To assign/remove roles
- `View Channels` - To access server information
- `Read Message History` - For basic functionality

### Permission Integer: `268435456`

## Step 3: Invite Bot to Your Server

1. In the Discord Developer Portal, go to "OAuth2 > URL Generator"
2. Select scopes: `bot`
3. Select permissions: `Manage Roles`
4. Copy the generated URL and open it
5. Select your Discord server and authorize the bot

## Step 4: Configure Roles in Discord

1. In your Discord server, go to Server Settings > Roles
2. Create the roles you want to assign:
   - `Alpha OG` (for the 2,000,000 AP perk)
   - `Premium Member` (for the 10,000 AP perk)
3. **Important**: Make sure the bot's role is positioned ABOVE the roles it needs to assign
4. Note the Role IDs (right-click role → Copy ID with Developer Mode enabled)

## Step 5: Get Discord IDs

### Enable Developer Mode:
1. Discord Settings > Advanced > Developer Mode (ON)

### Get Required IDs:
- **Guild ID**: Right-click your server name → Copy ID
- **Role IDs**: Right-click each role → Copy ID

## Step 6: Environment Variables

Add these to your `.env` file in the rewards directory:

```env
# Discord Bot Configuration
VITE_DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
VITE_DISCORD_GUILD_ID=YOUR_GUILD_ID_HERE
VITE_DISCORD_ALPHA_OG_ROLE_ID=YOUR_ALPHA_OG_ROLE_ID_HERE
VITE_DISCORD_PREMIUM_ROLE_ID=YOUR_PREMIUM_ROLE_ID_HERE

# Existing Discord OAuth (for user authentication)
VITE_DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE
VITE_DISCORD_REDIRECT_URI=http://localhost:5173/
```

## Step 7: Security Considerations

### Bot Token Security:
- Never commit bot tokens to version control
- Use environment variables for all sensitive data
- Regenerate tokens if compromised

### Permission Principle:
- Give the bot only the minimum required permissions
- Regularly audit bot permissions
- Consider using role hierarchies for additional security

## Step 8: Testing

1. Ensure the bot is online in your Discord server
2. Test role assignment by claiming a Discord perk
3. Verify roles are assigned correctly
4. Check console for any error messages

## Discord API Endpoints Used

The transaction service uses these Discord API endpoints:

### Add Role to Member:
```
PUT /guilds/{guild.id}/members/{user.id}/roles/{role.id}
```

### Required Headers:
```
Authorization: Bot YOUR_BOT_TOKEN
Content-Type: application/json
X-Audit-Log-Reason: Alpha4 Rewards - Perk claimed
```

## Error Handling

Common Discord API errors and solutions:

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 403 | Missing permissions | Check bot role hierarchy and permissions |
| 404 | User not in server | User must join Discord server first |
| 429 | Rate limited | Implement proper rate limiting |
| 401 | Invalid token | Check bot token configuration |

## Troubleshooting

### Bot Not Assigning Roles:
1. Check bot is online in Discord server
2. Verify bot role is above target roles
3. Confirm `Manage Roles` permission is enabled
4. Check console for Discord API errors

### User Not Found Errors:
1. Ensure user has joined the Discord server
2. Verify user has completed Discord OAuth flow
3. Check if user has left and rejoined the server

### Permission Denied:
1. Check bot role hierarchy (bot role must be above assigned roles)
2. Verify `Manage Roles` permission
3. Ensure roles aren't "managed" (bot-created) roles

## Rate Limiting

Discord API has rate limits:
- 5 requests per second per bot
- Burst limit of 10 requests

The transaction service implements basic rate limiting to avoid hitting these limits.

## Monitoring

Monitor bot activity through:
1. Discord Audit Logs (Server Settings > Audit Log)
2. Console logs in your application
3. Discord Developer Portal > Bot > Token (shows bot status)

## Production Considerations

For production deployment:
1. Use secure environment variable management
2. Implement proper logging and monitoring
3. Consider using Discord webhook for notifications
4. Set up error alerting for failed role assignments
5. Regular security audits of bot permissions 