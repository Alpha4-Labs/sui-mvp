# Migration Button Troubleshooting Guide

## Problem: "I have multiple stake positions but can't see the migration button"

The migration button only appears when you have **legacy stakes** from the old package that need to be migrated. If you don't see it, this guide will help you understand why.

## Understanding the Migration System

### When the Migration Button Shows:
✅ You have stake positions from the **old package** (`0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf`)  
✅ These stakes are eligible for migration to the new system  
✅ You'll receive Alpha Points (αP) when migrating  

### When the Migration Button is Hidden:
❌ All your stakes are already in the **new package** (no migration needed)  
❌ You've already migrated all your legacy stakes  
❌ Your stakes are from a different package version  
❌ No legacy stakes found in your wallet  

## Troubleshooting Steps

### Step 1: Check Your Browser Console
1. Open your browser's developer tools (F12)
2. Go to the "Console" tab
3. Look for migration-related logs when the page loads
4. Check for any error messages

### Step 2: Use the Debug Tool
Run our debug script to analyze your wallet:

```bash
cd migration
node debug_migration_button.js YOUR_WALLET_ADDRESS
```

**Example:**
```bash
node debug_migration_button.js 0x1234567890abcdef1234567890abcdef12345678
```

### Step 3: Use the In-App Debug Button
If you don't see the migration button, you should see a "Re-check Migration" button instead:

1. Look for the gray "Re-check Migration" button in the Staked Positions section
2. Click it to force a re-check for legacy stakes
3. Check your browser console for detailed logs

## Common Scenarios

### Scenario 1: "I see current stakes but no migration button"
**Diagnosis:** Your stakes are in the new system  
**Solution:** No action needed - your stakes are already up-to-date!

### Scenario 2: "I had old stakes but migrated them already"
**Diagnosis:** Migration completed successfully  
**Solution:** No action needed - your stakes were already migrated to Alpha Points

### Scenario 3: "I expect to have legacy stakes but see none"
**Possible causes:**
- Wrong wallet address connected
- Stakes were in a different old package version
- Stakes were already unstaked/withdrawn
- Browser cache issues

**Solutions:**
1. Verify correct wallet is connected
2. Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)
3. Clear browser cache for the site
4. Run the debug tool to check your wallet contents

### Scenario 4: "Debug tool shows legacy stakes but UI doesn't"
**Possible causes:**
- JavaScript error in browser
- Network connectivity issues
- RPC endpoint problems

**Solutions:**
1. Check browser console for errors
2. Refresh the page
3. Try a different browser
4. Check your internet connection

## Debug Tool Output Examples

### ✅ Migration Available
```
🎉 MIGRATION BUTTON SHOULD BE VISIBLE!

📋 Old Stakes Details:
   1. Object ID: 0xabc123...
      Type: 0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf::stake_position::StakePosition
      Principal: 1000000000
      Duration: 30 days

✅ DIAGNOSIS: You have legacy stakes that can be migrated!
```

### ❌ No Migration Needed
```
❌ NO OLD PACKAGE STAKES FOUND

📊 Analysis of 25 total objects:
   - Stake-related objects: 3

📋 Stake-related objects found:
   1. 0xdef456...: 0x123456::stake_position::StakePosition
   2. 0xghi789...: 0x123456::stake_position::StakePosition
   3. 0xjkl012...: 0x123456::stake_position::StakePosition

🤔 POSSIBLE ISSUES:
   1. Your stakes might be in the NEW package (not eligible for migration)
```

## Technical Details

### Old Package ID
The migration system looks for stakes in this specific old package:
```
0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf
```

### Query Structure
The system queries for objects with this exact type:
```
{OLD_PACKAGE_ID}::stake_position::StakePosition
```

### Migration Button Conditions
The button appears when:
1. `hasOldPackageStakes === true`
2. `checkingOldPackage === false`
3. User wallet is connected

## Getting Help

If you're still having issues after following this guide:

1. **Gather Information:**
   - Run the debug tool and save the output
   - Take screenshots of your Staked Positions section
   - Note your wallet address and any error messages

2. **Check Our Resources:**
   - Review the browser console logs
   - Check if there are any network connectivity issues
   - Verify you're on the correct network (testnet/mainnet)

3. **Contact Support:**
   - Provide the debug tool output
   - Include screenshots and error messages
   - Mention your wallet address and expected number of legacy stakes

## FAQ

**Q: I see "No legacy stakes found" but I'm sure I had stakes before**  
**A:** Your stakes might have been:
- Already migrated to the new system
- Unstaked and withdrawn
- From a different package version
- In a different wallet address

**Q: The migration button appeared before but is gone now**  
**A:** This usually means:
- You successfully migrated your stakes
- Your browser cached old data (try refreshing)
- There was a temporary network issue

**Q: Can I migrate stakes from multiple wallets?**  
**A:** Each wallet must be migrated separately. Connect each wallet and look for the migration button in each one.

**Q: What happens if I don't migrate my legacy stakes?**  
**A:** Legacy stakes from the old package won't earn Alpha Points until migrated. It's recommended to migrate them to access the full features of the new system. 