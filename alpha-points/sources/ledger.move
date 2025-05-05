/// Module that manages the internal accounting of Alpha Points.
/// Tracks user balances and total supply using a shared Ledger object.
module alpha_points::ledger {
    use sui::object::{Self, UID};
    use sui::balance::{Self, Supply, Balance};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    // Import for GovernCap
    use alpha_points::admin::GovernCap;

    // Error constants
    const EInsufficientBalance: u64 = 1;
    const EInsufficientLockedBalance: u64 = 2;
    const EOverflow: u64 = 3;

    // Scaling divisor to adjust point calculation based on MIST input
    const POINTS_SCALING_DIVISOR: u64 = 50_000_000; // Adjust as needed for desired APY

    // Marker type for the Alpha Points Supply
    public struct AlphaPointTag has drop {}

    /// User's point balance details with available and locked amounts
    public struct PointBalance has store, copy, drop {
        available: u64,
        locked: u64
    }

    /// Shared object holding the global ledger with point supply and user balances
    public struct Ledger has key {
        id: UID,
        point_supply: Supply<AlphaPointTag>,
        entries: Table<address, PointBalance>
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
            point_supply: balance::create_supply(AlphaPointTag {}),
            entries: table::new(ctx)
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

    /// Implements the points generation formula
    public fun calculate_points_to_earn(
        amount: u64,
        duration_days: u64,
        participation_level: u64
    ): u64 {
        if (amount == 0 || duration_days == 0) { return 0 };
        let time_factor = 100 + ((duration_days * 100) / 365);
        let base_points = (amount * time_factor) / 100;
        let total_points = base_points * participation_level;
        // Apply scaling divisor
        total_points / POINTS_SCALING_DIVISOR
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