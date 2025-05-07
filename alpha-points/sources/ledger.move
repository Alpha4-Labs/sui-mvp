/// Module that manages the internal accounting of Alpha Points.
/// Tracks user balances and total supply using a shared Ledger object.
module alpha_points::ledger {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::event;

    // Error constants
    const EInsufficientBalance: u64 = 1;
    const EInsufficientAvailableBalance: u64 = 2;
    // Internal: const ELockExceedsBalance: u64 = 3; 
    // Internal: const EUnlockExceedsLocked: u64 = 4; 
    const EHasBadDebt: u64 = 5; // For integration.move to check via has_bad_debt()
    const ERepaymentExceedsDebt: u64 = 6; // For integration.move to check via internal_remove_bad_debt()
    const EOverflow: u64 = 7;
    const EInsufficientLockedBalance: u64 = 8;

    // Scaling divisor to adjust point calculation based on MIST input
    // const POINTS_SCALING_DIVISOR: u64 = 50_000_000; // Commented out as unused in this module now

    /// Enum to categorize different types of points being minted or tracked.
    public enum PointType has drop {
        Staking, // Points earned from staking
        // Add other types as needed, e.g., Referral, Bonus
    }

    /// Public constructor for PointType::Staking variant.
    public fun new_point_type_staking(): PointType {
        PointType::Staking
    }

    // Marker type for the Alpha Points Supply
    // public struct AlphaPointTag has drop {}

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
        // Removed: point_supply: Supply<AlphaPointTag>
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
            // Removed: point_supply: balance::create_supply<AlphaPointTag>(AlphaPointTag {}, ctx)
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
        
        // Removed supply logic: total supply is not tracked directly in Ledger anymore
        // let b = balance::increase_supply(&mut ledger.point_supply, amount);
        // balance::decrease_supply(&mut ledger.point_supply, b);
                
        // Update user's entry in the Table (using 'balances' field)
        if (!table::contains(&ledger.balances, user)) {
            table::add(
                &mut ledger.balances,
                user,
                PointBalance { available: amount, locked: 0 }
            );
        } else {
            let user_balance = table::borrow_mut(&mut ledger.balances, user);
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
        assert!(table::contains(&ledger.balances, user), EInsufficientBalance);
        let user_balance = table::borrow_mut(&mut ledger.balances, user);
        assert!(user_balance.available >= amount, EInsufficientAvailableBalance);
        user_balance.available = user_balance.available - amount;

        // Removed supply adjustment

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
        assert!(table::contains(&ledger.balances, user), EInsufficientBalance);
        let user_balance = table::borrow_mut(&mut ledger.balances, user);
        assert!(user_balance.available >= amount, EInsufficientAvailableBalance);
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
        assert!(table::contains(&ledger.balances, user), EInsufficientLockedBalance);
        let user_balance = table::borrow_mut(&mut ledger.balances, user);
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

    /// Public function to mint points for a user.
    /// Currently calls internal_earn and ignores point_type for simplicity.
    public fun mint_points(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        _point_type: PointType, // Parameter is present but not used yet
        ctx: &TxContext
    ) {
        internal_earn(ledger, user, amount, ctx);
    }

    // === View functions ===

    public fun get_available_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.balances, user)) { return 0 };
        table::borrow(&ledger.balances, user).available
    }

    public fun get_locked_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.balances, user)) { return 0 };
        table::borrow(&ledger.balances, user).locked
    }

    public fun get_total_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.balances, user)) { return 0 };
        let balance = table::borrow(&ledger.balances, user);
        balance.available + balance.locked
    }

    public fun get_total_supply(_ledger: &Ledger): u64 {
        // Total supply is not tracked directly in Ledger anymore. 
        // This would need to be calculated by iterating over all balances or managed elsewhere.
        assert!(false, EInsufficientLockedBalance); // Explicitly state not implemented
        0 // Keep compiler happy, assert will prevent execution
    }

    /// Internal function to add to a user's bad debt amount
    /// This would be called during liquidation/forfeiture if recovered value is insufficient.
    public(package) fun internal_add_bad_debt(ledger: &mut Ledger, user: address, amount: u64) {
        if (amount == 0) { return };
        if (!table::contains(&ledger.bad_debt, user)) {
            table::add(&mut ledger.bad_debt, user, amount);
        } else {
            let current_debt_ref = table::borrow_mut(&mut ledger.bad_debt, user);
            *current_debt_ref = *current_debt_ref + amount;
        }
    }

    /// Get the current bad debt amount for a user
    public fun get_bad_debt(ledger: &Ledger, user: address): u64 {
        if (table::contains(&ledger.bad_debt, user)) {
            *table::borrow(&ledger.bad_debt, user)
        } else {
            0
        }
    }

    /// Check if a user has any outstanding bad debt
    public fun has_bad_debt(ledger: &Ledger, user: address): bool {
        get_bad_debt(ledger, user) > 0
    }

    /// Internal function to subtract from a user's bad debt amount.
    /// Removes the user entry if debt becomes 0.
    public(package) fun internal_remove_bad_debt(ledger: &mut Ledger, user: address, amount: u64) {
        if (amount == 0) { return };

        assert!(table::contains(&ledger.bad_debt, user), ERepaymentExceedsDebt); 
        let current_debt_ref = table::borrow_mut(&mut ledger.bad_debt, user);
        let current_debt = *current_debt_ref;

        assert!(current_debt >= amount, ERepaymentExceedsDebt);
        *current_debt_ref = current_debt - amount;

        if (*current_debt_ref == 0) {
            table::remove(&mut ledger.bad_debt, user);
        }
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