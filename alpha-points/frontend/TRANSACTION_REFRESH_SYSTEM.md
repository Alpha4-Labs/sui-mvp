# Transaction Success Hook System

## Overview

The `useTransactionSuccess` hook provides automatic component refresh functionality when transactions succeed. This eliminates the need for manual `refreshData()` calls scattered throughout components and provides a clean, consistent way to update UI state after blockchain operations.

## Key Benefits

- **Automatic Refresh**: Components automatically refresh when transactions succeed
- **No Manual Calls**: Eliminates scattered `refreshData()` and `setTimeout()` calls
- **Granular Control**: Each component can specify exactly what data to refresh
- **Error Safety**: Refresh only happens on successful transactions
- **Clean Architecture**: Separates transaction logic from refresh logic

## How It Works

1. Components register refresh callbacks using `registerRefreshCallback()`
2. Components use `signAndExecute()` from the hook instead of the raw dApp Kit hook
3. When transactions succeed (have a digest), all registered callbacks are automatically called
4. If transactions fail, no refresh callbacks are executed

## Usage Examples

### Basic Usage

```tsx
import { useTransactionSuccess } from '../hooks/useTransactionSuccess';
import { useAlphaContext } from '../context/AlphaContext';

const MyComponent = () => {
  const { refreshData, refreshStakePositions } = useAlphaContext();
  const { registerRefreshCallback, signAndExecute } = useTransactionSuccess();

  // Register what should refresh when transactions succeed
  useEffect(() => {
    const cleanup = registerRefreshCallback(async () => {
      await refreshStakePositions(); // Refresh specific data
      await refreshData(); // Or refresh all data
    });
    return cleanup; // Important: cleanup on unmount
  }, [registerRefreshCallback, refreshStakePositions, refreshData]);

  const handleTransaction = async () => {
    try {
      // Use signAndExecute instead of the raw hook
      // This will automatically call your refresh callbacks on success
      await signAndExecute(transaction);
      // No need for manual refresh calls!
    } catch (error) {
      // Handle errors - refresh won't happen on failure
    }
  };
};
```

### Points Display Example

```tsx
// PointsDisplay component automatically refreshes points and accrued data
useEffect(() => {
  const cleanup = registerRefreshCallback(async () => {
    await refreshData(); // Refresh context data
    // Re-fetch accrued points after context refresh
    if (currentEpoch && stakePositions && currentAccount) {
      fetchAccruedPoints();
    }
  });
  return cleanup;
}, [registerRefreshCallback, refreshData, currentEpoch, stakePositions, currentAccount]);
```

### Stake Positions Example

```tsx
// StakedPositionsList refreshes positions and loans after transactions
useEffect(() => {
  const cleanup = registerRefreshCallback(async () => {
    await refreshStakePositions(); // Refresh stake positions
    await refreshLoansData(); // Refresh loans data
    await refreshData(); // Update points balance
  });
  return cleanup;
}, [registerRefreshCallback, refreshStakePositions, refreshLoansData, refreshData]);
```

## Migration Guide

### Before (Manual Refresh)

```tsx
const handleClaim = async () => {
  try {
    const result = await signAndExecute({ transaction });
    
    // Manual refresh calls scattered everywhere
    setTimeout(() => {
      refreshData();
    }, 2000);
    
  } catch (error) {
    // Error handling
  }
};
```

### After (Automatic Refresh)

```tsx
// Register refresh callback once
useEffect(() => {
  const cleanup = registerRefreshCallback(async () => {
    await refreshData();
  });
  return cleanup;
}, [registerRefreshCallback, refreshData]);

const handleClaim = async () => {
  try {
    // Automatic refresh on success - no manual calls needed!
    const result = await signAndExecute(transaction);
  } catch (error) {
    // Error handling - no refresh on failure
  }
};
```

## Components Updated

The following components have been updated to use the transaction success system:

- **PointsDisplay**: Automatically refreshes points and accrued data after claiming
- **StakedPositionsList**: Refreshes positions and loans after unstaking/registration
- **StakeCard**: Refreshes all data after staking transactions

## Best Practices

1. **Always return cleanup function**: Use the cleanup function returned by `registerRefreshCallback()` in your `useEffect` cleanup
2. **Be specific with refreshes**: Only refresh the data that actually needs updating
3. **Handle async callbacks**: Refresh callbacks can be async - the hook handles this properly
4. **Error handling**: The hook only refreshes on successful transactions (those with a digest)
5. **Avoid duplicate registrations**: Register callbacks in `useEffect` with proper dependencies

## Technical Details

- The hook uses `useRef` to maintain a set of refresh callbacks
- Callbacks are executed in parallel using `Promise.allSettled()`
- Failed refresh callbacks are logged but don't break other callbacks
- The hook wraps the standard `useSignAndExecuteTransaction` from dApp Kit
- Only transactions with a `digest` property trigger refresh callbacks 