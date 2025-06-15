# Testing the Alpha Points Transaction System

## 🧪 Testing Checklist

### 1. Environment Setup
- [ ] `.env` file created with Discord configuration
- [ ] Wallet extension installed (Sui Wallet, Ethos, or Martian)
- [ ] Discord bot configured (if testing role assignment)
- [ ] Development server running (`npm run dev`)

### 2. Basic Functionality Tests

#### Wallet Connection
- [ ] Click "Connect Wallet" button
- [ ] Select wallet from popup
- [ ] Verify wallet address appears in header
- [ ] Check that perks load from blockchain

#### Discord Connection  
- [ ] Click "Connect Discord" button
- [ ] Complete OAuth flow
- [ ] Verify "Connected" status in header
- [ ] Check console for successful authentication

#### Perk Validation
- [ ] Verify Discord perks show "Discord connection required" when not connected
- [ ] Verify Discord perks show "Ready to claim" when connected
- [ ] Check that wallet connection is required for all perks

### 3. Transaction Testing

#### For Regular Perks (Merchandise Bundle)
1. Connect wallet
2. Click "Claim Reward" on merchandise bundle
3. Expected flow:
   - Loading toast appears: "Preparing transaction..."
   - Wallet popup for transaction signing
   - Success toast: "Successfully claimed [perk name]!"
   - Button shows "Processing..." during transaction

#### For Discord Perks (Discord Alpha OG)
1. Connect both wallet AND Discord
2. Click "Claim Reward" on Discord Alpha OG (2,000,000 AP)
3. Expected flow:
   - Loading toast: "Preparing transaction..."
   - Wallet popup for transaction signing
   - Success toast: "Successfully claimed Discord Alpha OG! Discord role has been assigned."
   - Role assigned in Discord server (if bot configured)

### 4. Error Scenarios

#### Insufficient Balance
- Expected behavior: "Insufficient Alpha Points. Required: X AP"

#### Missing Discord Connection
- Click Discord perk without Discord connected
- Expected: "Discord connection required"

#### Transaction Rejection
- Reject wallet transaction popup
- Expected: Error toast with rejection message

#### Network Issues
- Disconnect internet during transaction
- Expected: Error toast with network error

### 5. Console Monitoring

Watch browser console for:

#### Successful Transaction:
```
🔧 Building transaction for perk: Discord Alpha OG Cost: 2000000 AP
🔄 Executing Alpha Points spend transaction...
✅ Transaction executed: {digest: "0x..."}
🔄 Assigning Discord role for perk: Discord Alpha OG
✅ Discord role assigned via API
✅ Transaction hash: 0x...
```

#### Discord Role Assignment:
```
🔄 Assigning Discord role for perk: Discord Alpha OG
✅ Discord role assigned successfully
✅ Discord role assigned via API
```

#### Expected Errors (for testing):
```
❌ Discord connection required for this perk
❌ Insufficient Alpha Points balance
❌ Transaction failed: User rejected
```

### 6. Discord Bot Testing (if configured)

#### Prerequisites:
- Discord bot token set in environment
- Bot invited to server with "Manage Roles" permission
- Roles created and IDs configured
- User is member of Discord server

#### Test Steps:
1. Complete Discord perk transaction
2. Check Discord server - user should have new role
3. Verify in Discord audit log (Server Settings > Audit Log)
4. Look for "Role update" by your bot

### 7. Performance Testing

#### Load Testing:
- Try multiple perk claims in succession
- Verify loading states work correctly
- Check that buttons are disabled during processing

#### Network Testing:
- Test on slow network connection
- Verify timeouts are handled gracefully
- Check transaction status updates

### 8. UI/UX Testing

#### Visual Feedback:
- [ ] Loading states show correctly
- [ ] Success/error messages are clear
- [ ] Button states update appropriately
- [ ] Connection indicators work

#### Responsive Design:
- [ ] Test on mobile device
- [ ] Verify modals/popups work on small screens
- [ ] Check touch interactions

## 🐛 Common Issues & Solutions

### "toast.info is not a function"
- ✅ Fixed: Using `toast.loading()` instead

### "MetaMask extension not found"
- Try installing Sui Wallet instead of using MetaMask
- Check that wallet extension is enabled
- Refresh page after installing wallet

### "Transaction failed"
- Check network connection
- Verify wallet has sufficient SUI for gas
- Try with different wallet

### "Discord role not assigned"
- Verify bot token in environment
- Check bot permissions in Discord server
- Ensure bot role is above assigned roles
- Confirm user is member of Discord server

### "Requirements Not Met"
- Check if Discord connection is required
- Verify user has required perks
- Ensure wallet is connected

## 📊 Success Metrics

A successful test should show:
- ✅ Smooth wallet connection
- ✅ Working Discord OAuth
- ✅ Valid transaction creation
- ✅ Proper error handling
- ✅ Clear user feedback
- ✅ Discord role assignment (if configured)
- ✅ UI updates correctly

## 🚀 Next Steps

After successful testing:
1. Deploy to testnet/mainnet
2. Configure production Discord bot
3. Set up monitoring and analytics
4. Add more perk types
5. Implement batch operations 