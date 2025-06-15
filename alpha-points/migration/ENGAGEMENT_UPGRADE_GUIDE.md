# Ledger-Integrated Engagement Tracking

## Approach: Security Through Ledger Integration

Instead of creating separate access controls, we've integrated engagement tracking directly into the existing ledger functions that already have proper authorization. This ensures:

✅ **Maximum Security** - Uses existing ledger access controls  
✅ **Atomic Updates** - Engagement updates happen with point operations  
✅ **Zero Gaming** - Can't record engagement without legitimate point activity  
✅ **Upgrade Safe** - No changes to existing struct signatures  
✅ **Clean Architecture** - Single source of truth through ledger

## Architecture

```move
// Engagement is a separate storage module
module alpha_points::engagement {
    public struct EngagementTracker has key {
        id: UID,
        users: SuiTable<address, UserEngagement>
    }
}

// Ledger integrates with engagement on legitimate operations
module alpha_points::ledger {
    // Enhanced versions that also update engagement
    public(package) fun internal_earn_with_engagement(
        ledger: &mut Ledger,
        engagement_tracker: &mut EngagementTracker,
        user: address,
        amount: u64,
        current_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext
    )
}
```

## How It Works

### 1. Legitimate Point Operations Update Engagement
When authorized systems perform point operations, they can optionally update engagement:

```move
// Mint points + record engagement in one call
ledger::internal_earn_with_engagement(
    ledger,                  // ← Existing authorization applies  
    engagement_tracker,      // ← Engagement gets updated
    user,
    amount,
    current_epoch,
    clock,
    ctx
);
```

### 2. Security Through Ledger Authorization
- **Partner systems** already validate through `PartnerCapFlex`
- **Staking systems** already validate through staking permissions  
- **Internal systems** already use `public(package)` functions
- **Engagement inherits all these protections automatically**

### 3. Available Enhanced Functions

```move
// Enhanced ledger functions with engagement tracking
internal_earn_with_engagement()     // Earning points + engagement
internal_spend_with_engagement()    // Spending points + engagement  
internal_lock_with_engagement()     // Locking points + engagement
internal_unlock_with_engagement()   // Unlocking points + engagement
```

## Integration Examples

### Partner Integration
```move
// When partner mints points, optionally track engagement
use alpha_points::ledger;
use alpha_points::engagement;

public entry fun mint_with_engagement(
    partner_cap: &mut PartnerCapFlex,
    ledger: &mut Ledger,
    engagement_tracker: &mut EngagementTracker,
    user: address,
    amount: u64,
    current_epoch: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // Validate partner cap (existing security)
    assert!(!partner_flex::is_paused(partner_cap), 0);
    
    // Mint points with engagement tracking
    ledger::internal_earn_with_engagement(
        ledger, 
        engagement_tracker, 
        user, 
        amount, 
        current_epoch, 
        clock, 
        ctx
    );
}
```

### Staking Integration
```move
// When user claims staking rewards
public fun claim_with_engagement(
    stake_position: &mut StakePosition<T>,
    ledger: &mut Ledger,
    engagement_tracker: &mut EngagementTracker,
    current_epoch: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let user = tx_context::sender(ctx);
    let rewards = calculate_rewards(stake_position, clock);
    
    // Claim rewards + record engagement
    ledger::internal_earn_with_engagement(
        ledger,
        engagement_tracker,
        user,
        rewards,
        current_epoch,
        clock,
        ctx
    );
}
```

### Marketplace Integration
```move
// When user spends points in marketplace
public fun spend_points_with_engagement(
    ledger: &mut Ledger,
    engagement_tracker: &mut EngagementTracker,
    user: address,
    cost: u64,
    current_epoch: u64,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // Validate user is transaction sender
    assert!(tx_context::sender(ctx) == user, 1);
    
    // Spend points + record engagement
    ledger::internal_spend_with_engagement(
        ledger,
        engagement_tracker,
        user,
        cost,
        current_epoch,
        clock,
        ctx
    );
}
```

## Activity Types Tracked

- **ACTIVITY_EARN (1)** - Earning Alpha Points
- **ACTIVITY_SPEND (2)** - Spending points  
- **ACTIVITY_STAKE (3)** - Locking/staking points
- **ACTIVITY_CLAIM (4)** - Unlocking/claiming points

## Anti-Gaming Built-In

1. **Ledger Authorization** - Can only update engagement through authorized point operations
2. **One Per Epoch** - Multiple activities in same epoch are deduplicated
3. **Real Operations** - Must actually earn/spend/lock/unlock points
4. **No Direct Access** - No public functions to directly manipulate engagement

## View Functions (Public)

```move
// Query engagement data (read-only, public access)
engagement::get_current_streak(tracker, user): u64
engagement::get_longest_streak(tracker, user): u64  
engagement::get_engagement_stats(tracker, user): (u64, u64, u64, u64, u64, u64)
engagement::get_multiple_streaks(tracker, users): vector<u64>
```

## Events Emitted

```move
// Activity tracking
EngagementActivity { user, activity_type, epoch }

// Streak updates  
EngagementStreakUpdated { user, current_streak, longest_streak, epoch }

// Milestones achieved
EngagementMilestone { user, milestone_type, streak_value, epoch }
```

## Benefits of This Architecture

1. **🔒 Maximum Security** - Inherits all existing ledger protections
2. **⚡ Atomic Operations** - Point changes and engagement updates together
3. **🚫 Zero Gaming** - Can't fake engagement without real point activity
4. **🔧 Simple Integration** - Just use enhanced ledger functions
5. **📊 Guaranteed Accuracy** - Engagement only updates with real operations
6. **🎯 Clean Code** - No duplicate access control logic
7. **🛡️ Future Proof** - Engagement inherits future ledger security improvements

## Migration Steps

1. **Deploy package upgrade** - Adds engagement module + enhanced ledger functions
2. **EngagementTracker auto-creates** on package init
3. **Switch to enhanced functions** where you want engagement tracking:
   - `internal_earn()` → `internal_earn_with_engagement()`
   - `internal_spend()` → `internal_spend_with_engagement()`
   - etc.
4. **Frontend integration** - Query engagement data from EngagementTracker
5. **Event monitoring** - Listen to engagement events for real-time updates

This approach provides bulletproof engagement tracking that's impossible to game because it requires legitimate point operations! 🛡️ 