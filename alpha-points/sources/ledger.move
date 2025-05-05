/// Module that manages the internal accounting of Alpha Points.
/// Tracks user balances and total supply using a shared Ledger object.
module alpha_points::ledger {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{TxContext, sender};
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::transfer;
    use std::option::Option;
    use sui::event;

    // Import for GovernCap
    use alpha_points::admin::GovernCap;
    use alpha_points::admin::{Self, Config};
    use sui::clock::{Self, Clock};

    // Error constants
    const EInsufficientBalance: u64 = 1;
    const EInsufficientAvailableBalance: u64 = 2;
    const ELockExceedsBalance: u64 = 3;
    const EUnlockExceedsLocked: u64 = 4;
    const EHasBadDebt: u64 = 5; // Added for bad debt check
    const ERepaymentExceedsDebt: u64 = 6; // Cannot repay more than owed

    // Scaling divisor to adjust point calculation based on MIST input
    const POINTS_SCALING_DIVISOR: u64 = 50_000_000; // Adjust as needed for desired APY

    // Marker type for the Alpha Points Supply
    public struct AlphaPointTag has drop {}

    /// User's point balance details with available and locked amounts
    public struct PointBalance has store {
        available: u64,
        locked: u64
    }

    /// Shared object holding the global ledger with point supply and user balances
    public struct Ledger has key {
        id: UID,
        balances: Table<address, PointBalance>,
        bad_debt: Table<address, u64> // Stores outstanding bad debt per user
    }

    // Events
    public struct Earned has copy, drop {
        user: address,
        amount: u64
    }

    public struct Spent has copy, drop {
        user: address,
        amount: u64
    }

    public struct Locked has copy, drop {
        user: address,
        amount: u64
    }

    public struct Unlocked has copy, drop {
        user: address,
        amount: u64
    }

    // === Core module functions ===

    /// Creates and shares the Ledger object
    fun init(ctx: &mut TxContext) {
        let ledger = Ledger {
            id: object::new(ctx),
            balances: table::new(ctx),
            bad_debt: table::new(ctx) // Initialize bad debt table
        };
        transfer::share_object(ledger);
    }

    /// Increases point_supply and updates user's available balance
    /// Creates entry if not exists
    public(package) fun internal_earn(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        _ctx: &TxContext
    ) {
        if (amount == 0) return;
        
        // Increase supply for tracking, then immediately decrease it by destroying the balance.
        // This keeps the supply count accurate without needing the Balance object itself.
        let b = balance::increase_supply(&mut ledger.point_supply, amount);
        balance::decrease_supply(&mut ledger.point_supply, b); // Use decrease_supply to destroy b
                
        // Update user's entry in the Table
        if (!table::contains(&ledger.entries, user)) {
            table::add(
                &mut ledger.entries,
                user,
                PointBalance { available: amount, locked: 0 }
            );
        } else {
            let user_balance = table::borrow_mut(&mut ledger.entries, user);
            let new_available = user_balance.available + amount;
            assert!(new_available >= user_balance.available, EOverflow);
            user_balance.available = new_available;
        };
        
        event::emit(Earned { user, amount });
    }

    /// Decreases user's available balance and the point_supply
    public(package) fun internal_spend(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        _ctx: &TxContext
    ) {
        if (amount == 0) return;
        assert!(table::contains(&ledger.entries, user), EInsufficientBalance);
        let user_balance = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance.available >= amount, EInsufficientBalance);
        user_balance.available = user_balance.available - amount;

        // === Revised Approach ===
        // Assuming the actual Coin burn happens elsewhere and calls balance::decrease_supply there,
        // this function *only* needs to update the internal table.
        // We remove the supply adjustment entirely from internal_spend.

        event::emit(Spent { user, amount });
    }

    /// Moves amount from user's available to locked balance
    public(package) fun internal_lock(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        _ctx: &TxContext
    ) {
        if (amount == 0) return;
        assert!(table::contains(&ledger.entries, user), EInsufficientBalance);
        let user_balance = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance.available >= amount, EInsufficientBalance);
        user_balance.available = user_balance.available - amount;
        let new_locked = user_balance.locked + amount;
        assert!(new_locked >= user_balance.locked, EOverflow);
        user_balance.locked = new_locked;
        event::emit(Locked { user, amount });
    }

    /// Moves amount from user's locked to available balance
    public(package) fun internal_unlock(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        _ctx: &TxContext
    ) {
        if (amount == 0) return;
        assert!(table::contains(&ledger.entries, user), EInsufficientLockedBalance);
        let user_balance = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance.locked >= amount, EInsufficientLockedBalance);
        user_balance.locked = user_balance.locked - amount;
        let new_available = user_balance.available + amount;
        assert!(new_available >= user_balance.available, EOverflow);
        user_balance.available = new_available;
        event::emit(Unlocked { user, amount });
    }

    /// Calculates points accrued since the last claim epoch.
    public fun calculate_accrued_points(
        principal: u64, // Principal in MIST
        points_rate_per_sui_per_epoch: u64, // Rate from Config
        last_claim_epoch: u64,
        current_epoch: u64
    ): u64 {
        if (current_epoch <= last_claim_epoch) {
            return 0 // No full epochs passed or invalid state
        };

        let elapsed_epochs = current_epoch - last_claim_epoch;

        // Calculation: (principal_sui * points_rate) * elapsed_epochs
        // principal is in MIST, rate is per SUI (10^9 MIST)
        // points = (principal / 10^9) * points_rate * elapsed_epochs
        // To avoid floating point, use: (principal * points_rate * elapsed_epochs) / 10^9

        // Using u128 for intermediate multiplication to prevent overflow
        let principal_u128 = (principal as u128);
        let rate_u128 = (points_rate_per_sui_per_epoch as u128);
        let elapsed_u128 = (elapsed_epochs as u128);

        let numerator = principal_u128 * rate_u128 * elapsed_u128;
        let denominator = 1_000_000_000u128; // 1 SUI in MIST

        let accrued_points = (numerator / denominator) as u64; // Integer division

        accrued_points
    }

    // === View functions ===

    public fun get_available_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.entries, user)) { return 0 };
        table::borrow(&ledger.entries, user).available
    }

    public fun get_locked_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.entries, user)) { return 0 };
        table::borrow(&ledger.entries, user).locked
    }

    public fun get_total_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.entries, user)) { return 0 };
        let balance = table::borrow(&ledger.entries, user);
        balance.available + balance.locked
    }

    public fun get_total_supply(ledger: &Ledger): u64 {
        balance::supply_value(&ledger.point_supply)
    }

    /// Internal function to add to a user's bad debt amount
    /// This would be called during liquidation/forfeiture if recovered value is insufficient.
    public(package) fun internal_add_bad_debt(ledger: &mut Ledger, user: address, amount: u64) {
        if (amount == 0) { return }; // No-op
        let current_debt = table::borrow_mut_with_default(&mut ledger.bad_debt, user, 0);
        *current_debt = *current_debt + amount;
        // Note: No specific event for bad debt added yet.
    }

    /// Get the current bad debt amount for a user
    public fun get_bad_debt(ledger: &Ledger, user: address): u64 {
        *table::borrow_with_default(&ledger.bad_debt, user, 0)
    }

    /// Check if a user has any outstanding bad debt
    public fun has_bad_debt(ledger: &Ledger, user: address): bool {
        get_bad_debt(ledger, user) > 0
    }

    /// Internal function to subtract from a user's bad debt amount.
    /// Removes the user entry if debt becomes 0.
    public(package) fun internal_remove_bad_debt(ledger: &mut Ledger, user: address, amount: u64) {
        if (amount == 0) { return }; // No-op

        // Check if user actually has any debt entry
        assert!(table::contains(&ledger.bad_debt, user), EInsufficientBalance); // Re-use error or use ERepaymentExceedsDebt? Using ERepaymentExceedsDebt seems better.
        // assert!(table::contains(&ledger.bad_debt, user), ERepaymentExceedsDebt);

        let current_debt_ref = table::borrow_mut(&mut ledger.bad_debt, user);
        let current_debt = *current_debt_ref;

        // Ensure repayment doesn't exceed the actual debt
        assert!(amount <= current_debt, ERepaymentExceedsDebt);

        let new_debt = current_debt - amount;

        if (new_debt == 0) {
            // Remove the entry from the table if debt is fully cleared
            table::remove(&mut ledger.bad_debt, user);
        } else {
            // Otherwise, update the debt amount
            *current_debt_ref = new_debt;
        }
        // Note: Add BadDebtRepaid event emission if needed internally, 
        // or rely on the entry function in integration.move to emit it.
    }

    // === Test-only functions ===

    #[test_only]
    /// Initialize the Ledger for testing. Calls the internal init function.
    public(package) fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    /// Helper function for tests to call internal_earn.
    public(package) fun test_earn(
        ledger: &mut Ledger,
        _gov_cap: &GovernCap, // Requires GovernCap import
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        internal_earn(ledger, user, amount, ctx);
    }

    #[test_only]
    /// Helper function for tests to call internal_spend.
    public(package) fun test_spend(
        ledger: &mut Ledger,
        _gov_cap: &GovernCap, // Requires GovernCap import
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        internal_spend(ledger, user, amount, ctx);
    }

    #[test_only]
    /// Helper function for tests to call internal_lock.
    public(package) fun test_lock(
        ledger: &mut Ledger,
        _gov_cap: &GovernCap, // Requires GovernCap import
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        internal_lock(ledger, user, amount, ctx);
    }

    #[test_only]
    /// Helper function for tests to call internal_unlock.
    public(package) fun test_unlock(
        ledger: &mut Ledger,
        _gov_cap: &GovernCap, // Requires GovernCap import
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        internal_unlock(ledger, user, amount, ctx);
    }
} // End of module alpha_points::ledger