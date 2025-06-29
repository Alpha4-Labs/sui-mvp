# zkLogin Deprecation Notice

⚠️ **DEPRECATED**: The zkLogin authentication system is being deprecated and will be removed in a future version.

## Current Status

The zkLogin system has been partially deprecated to resolve CORS issues and simplify the authentication flow. We are now using only the standard dApp Kit wallet connections.

## Changes Made

### ✅ Completed
- Removed CORS-causing `SuiClient` instantiation from `useZkLogin.ts`
- Updated `AlphaContext` to use only `currentAccount` address (no more zkLogin fallback)
- Removed unused zkLogin calls from `WelcomePage`
- Added deprecation comments throughout the codebase

### ⚠️ Still Using zkLogin (Needs Migration)
The following components still use zkLogin data for transaction signing:

1. **StakeCard.tsx** - Lines 316-377
   - Uses localStorage zkLogin data for transaction signing
   - Should migrate to standard wallet signing

2. **StakedPositionsList.tsx** - Lines 541-579  
   - Uses localStorage zkLogin data for transaction signing
   - Should migrate to standard wallet signing

3. **ZkLoginCallback.tsx** - Complete component
   - Handles zkLogin OAuth callbacks
   - Should be removed once transaction signing is migrated

4. **App.tsx** - Route `/callback`
   - Routes to ZkLoginCallback component
   - Should be removed once callback component is removed

## Migration Plan

### Phase 1: Fix Transaction Signing ⏳
Replace zkLogin transaction signing in StakeCard and StakedPositionsList with standard wallet signing:

```typescript
// Instead of zkLogin signing:
const jwt = localStorage.getItem('zkLogin_jwt');
// ... complex zkLogin signature construction

// Use standard wallet signing:
const { signAndExecute } = useSignAndExecuteTransaction();
await signAndExecute({ transaction: txb });
```

### Phase 2: Remove Components 📋
Once transaction signing is migrated:
1. Remove `ZkLoginCallback.tsx`
2. Remove `/callback` route from `App.tsx`
3. Remove `useZkLogin.ts` entirely
4. Clean up any remaining localStorage zkLogin keys

### Phase 3: Clean Up Dependencies 🧹
1. Remove zkLogin-related imports from `@mysten/sui/zklogin`
2. Remove Google OAuth environment variables
3. Remove Enoki API dependencies
4. Update documentation

## Immediate Impact

The CORS issues on the Analytics page should now be resolved since the problematic `SuiClient` instantiation has been removed from `useZkLogin.ts`.

## Next Steps

1. Test that Analytics page works without CORS errors
2. Migrate transaction signing in StakeCard and StakedPositionsList
3. Remove remaining zkLogin components and routes
4. Update user documentation to remove zkLogin references

## Support

For questions about this migration, please refer to the Sui dApp Kit documentation for standard wallet integration patterns. 