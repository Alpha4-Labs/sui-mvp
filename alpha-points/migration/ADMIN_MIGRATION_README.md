# 🔧 Admin Migration Process

This guide walks you through the two-step migration process to help users migrate their stakes from the old package to the new one.

## 📋 Overview

**Step 1:** Query old package for all stakes and batch unencumber them (Admin)  
**Step 2:** Users can then self-service migrate their unencumbered stakes (User)

---

## 🔍 Step 1: Query Old Package Stakes

### 1.1 Install Dependencies
```bash
npm install
```

### 1.2 Configure Query Script
Edit `query_old_stakes.js`:
```javascript
const OLD_PACKAGE_ID = "0xYOUR_OLD_PACKAGE_ID"; // Replace with actual old package ID
const NETWORK = 'testnet'; // or 'mainnet'
```

### 1.3 Run Query Script
```bash
npm run query-stakes
# OR
node query_old_stakes.js
```

This will:
- ✅ Find all stake objects in the old package
- ✅ Identify which stakes are locked/encumbered
- ✅ Output stake IDs for the admin function
- ✅ Show summary of stakes and total SUI locked

**📝 Copy the stake IDs from the output - you'll need them for Step 2!**

---

## 🔐 Step 2: Admin Batch Unencumber

### 2.1 Configure Admin Script
Edit `admin_unencumber_stakes.js` with your values:

```javascript
const CONFIG = {
    OLD_PACKAGE_ID: "0xYOUR_OLD_PACKAGE_ID",
    OLD_ADMIN_CAP_ID: "0xYOUR_OLD_ADMIN_CAP_OBJECT_ID", 
    NEW_PACKAGE_ID: "0xYOUR_NEW_PACKAGE_ID",
    NETWORK: "testnet", // or "mainnet"
    ADMIN_ADDRESS: "0xYOUR_ADMIN_WALLET_ADDRESS",
    STAKE_IDS: [
        // Paste the stake IDs from Step 1 here:
        "0xstake1...",
        "0xstake2...",
        // ... more stake IDs
    ]
};
```

### 2.2 Generate Admin Command
```bash
npm run admin-unencumber
# OR 
node admin_unencumber_stakes.js
```

This will show you the exact command to run. You have two options:

#### Option A: Via Sui CLI
Copy and run the generated CLI command:
```bash
sui client call --package 0x... --module integration --function admin_batch_unencumber_old_stakes ...
```

#### Option B: Via Sui Console/UI
Use the generated Move call in your Sui wallet or console interface.

### 2.3 Execute the Admin Function
**⚠️ WARNING:** This will unencumber ALL stakes in the old package!

To actually execute (uncomment this line in the script):
```javascript
executeAdminUnencumber(); // Uncomment this line
```

---

## 👥 Step 3: User Self-Service Migration

After you've unencumbered the stakes, users can now migrate using the frontend migration button, which will call:

- `self_service_migrate_stake()` - For single stake migration
- `self_service_batch_migrate_stakes()` - For multiple stakes

**Key Benefits:**
- ✅ No admin permissions required for users
- ✅ Users own their stake objects
- ✅ 1:1000 SUI to Alpha Points conversion
- ✅ Secure ownership validation

---

## 🔧 Troubleshooting

### Common Issues:

1. **"Object not found" errors**
   - Verify OLD_PACKAGE_ID is correct
   - Check that stakes actually exist in the old package
   - Ensure you're on the right network (testnet vs mainnet)

2. **"Insufficient permissions" errors**
   - Verify OLD_ADMIN_CAP_ID is correct and you own it
   - Check that the admin cap is for the old package
   - Ensure your wallet is connected and has SUI for gas

3. **"Type mismatch" errors**
   - The old package structure might be different than expected
   - You may need to customize the helper functions in `integration.move`

### Verification Steps:

1. **Check old package exists:**
   ```bash
   sui client object --id YOUR_OLD_PACKAGE_ID
   ```

2. **Check admin cap ownership:**
   ```bash
   sui client object --id YOUR_OLD_ADMIN_CAP_ID
   ```

3. **Verify stake objects:**
   ```bash
   sui client object --id STAKE_ID_FROM_QUERY
   ```

---

## 🎯 Expected Results

### After Query Script:
```
📊 Found 50 stake objects
🔒 Found 30 locked/encumbered stakes  
📋 Total stakes found: 50
✅ Total unique stakes to unencumber: 50
```

### After Admin Unencumber:
```
✅ Command executed successfully!
🔗 Transaction: https://suiscan.xyz/testnet/tx/ABC123...
```

### After User Migration:
- Users see "Migrate X stakes from old package" button
- Clicking migrates their stakes and awards Alpha Points
- Old stakes are consumed/destroyed in the process

---

## 📚 Additional Resources

- [Sui Move Documentation](https://docs.sui.io/concepts/sui-move-concepts)
- [Sui CLI Reference](https://docs.sui.io/references/cli)
- [Package Upgrade Guide](https://docs.sui.io/concepts/sui-move-concepts/packages/upgrade)

---

## 🆘 Need Help?

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all configuration values are correct
3. Test with a small subset of stakes first
4. Review the transaction details on Suiscan for error messages

The migration process is designed to be safe and recoverable, but always test thoroughly before running on all stakes! 