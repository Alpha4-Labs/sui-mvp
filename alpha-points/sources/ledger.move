/// Module that manages the internal accounting of Alpha Points.
/// Tracks user balances and total supply using a shared Ledger object.
module alpha_points::ledger {
    use sui::object;
    use sui::balance::{Self, Supply};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context;
    use sui::event;
    
    // Error constants
    const EInsufficientBalance: u64 = 1;
    const EInsufficientLockedBalance: u64 = 2;
    const EOverflow: u64 = 3;
    
    // Marker type for the Alpha Points Supply
    public struct AlphaPointTag has drop {}
    
    /// User's point balance details with available and locked amounts
    public struct PointBalance has store, copy, drop {
        available: u64,
        locked: u64
    }
    
    /// Shared object holding the global ledger with point supply and user balances
    public struct Ledger has key {
        id: object::UID,
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
    
    // === Test-only functions ===
    #[test_only]
    /// Initialize the Ledger for testing
    public fun init_for_testing(ctx: &mut tx_context::TxContext) {
        init(ctx);
    }
    
    #[test_only]
    /// Helper function for tests to call internal_earn
    public fun test_earn(
        ledger: &mut Ledger, 
        _gov_cap: &alpha_points::admin::GovernCap, 
        user: address, 
        amount: u64, 
        ctx: &tx_context::TxContext
    ) {
        internal_earn(ledger, user, amount, ctx);
    }
    
    #[test_only]
    /// Helper function for tests to call internal_spend
    public fun test_spend(
        ledger: &mut Ledger, 
        _gov_cap: &alpha_points::admin::GovernCap, 
        user: address, 
        amount: u64, 
        ctx: &tx_context::TxContext
    ) {
        internal_spend(ledger, user, amount, ctx);
    }
    
    #[test_only]
    /// Helper function for tests to call internal_lock
    public fun test_lock(
        ledger: &mut Ledger, 
        _gov_cap: &alpha_points::admin::GovernCap, 
        user: address, 
        amount: u64, 
        ctx: &tx_context::TxContext
    ) {
        internal_lock(ledger, user, amount, ctx);
    }
    
    #[test_only]
    /// Helper function for tests to call internal_unlock
    public fun test_unlock(
        ledger: &mut Ledger, 
        _gov_cap: &alpha_points::admin::GovernCap, 
        user: address, 
        amount: u64, 
        ctx: &tx_context::TxContext
    ) {
        internal_unlock(ledger, user, amount, ctx);
    }
    
    // === Core module functions ===
    
    /// Creates and shares the Ledger object
    fun init(ctx: &mut tx_context::TxContext) {
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
        _ctx: &tx_context::TxContext
    ) {
        if (amount == 0) return;
        
        // Mint new points to the supply
        let minted_points = balance::increase_supply(&mut ledger.point_supply, amount);
        
        // Update or create user's balance
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
        
        // Drop the minted points as they're now accounted for in the ledger
        balance::destroy_zero(minted_points);
        
        // Emit event
        event::emit(Earned { user, amount });
    }
    
    /// Decreases user's available balance and the point_supply
    public(package) fun internal_spend(
        ledger: &mut Ledger, 
        user: address, 
        amount: u64, 
        _ctx: &tx_context::TxContext
    ) {
        if (amount == 0) return;
        
        // Check if user exists and has sufficient balance
        assert!(table::contains(&ledger.entries, user), EInsufficientBalance);
        
        let user_balance = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance.available >= amount, EInsufficientBalance);
        
        // Update user's available balance
        user_balance.available = user_balance.available - amount;
        
        // Since we can't directly decrease supply by a u64 amount in non-test code,
        // we first create a temporary Balance object with the exact amount by
        // increasing supply, then use it to decrease supply, resulting in net-zero effect
        // on the supply plus the amount we want to burn
        let temp_balance = balance::increase_supply(&mut ledger.point_supply, amount);
        let burn_amount = balance::decrease_supply(&mut ledger.point_supply, temp_balance);
        // Verify that we burned exactly what we expected
        assert!(burn_amount == amount, EInsufficientBalance);
        
        // Emit event
        event::emit(Spent { user, amount });
    }
    
    /// Moves amount from user's available to locked balance
    public(package) fun internal_lock(
        ledger: &mut Ledger, 
        user: address, 
        amount: u64, 
        _ctx: &tx_context::TxContext
    ) {
        if (amount == 0) return;
        
        // Check if user exists and has sufficient available balance
        assert!(table::contains(&ledger.entries, user), EInsufficientBalance);
        
        let user_balance = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance.available >= amount, EInsufficientBalance);
        
        // Update balances
        user_balance.available = user_balance.available - amount;
        
        let new_locked = user_balance.locked + amount;
        assert!(new_locked >= user_balance.locked, EOverflow);
        user_balance.locked = new_locked;
        
        // Emit event
        event::emit(Locked { user, amount });
    }
    
    /// Moves amount from user's locked to available balance
    public(package) fun internal_unlock(
        ledger: &mut Ledger, 
        user: address, 
        amount: u64, 
        _ctx: &tx_context::TxContext
    ) {
        if (amount == 0) return;
        
        // Check if user exists and has sufficient locked balance
        assert!(table::contains(&ledger.entries, user), EInsufficientLockedBalance);
        
        let user_balance = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance.locked >= amount, EInsufficientLockedBalance);
        
        // Update balances
        user_balance.locked = user_balance.locked - amount;
        
        let new_available = user_balance.available + amount;
        assert!(new_available >= user_balance.available, EOverflow);
        user_balance.available = new_available;
        
        // Emit event
        event::emit(Unlocked { user, amount });
    }
    
    /// Implements the points generation formula from the whitepaper
    /// Formula: amount * (1 + (duration_days / 365)) * participation_level
    /// This is a simplified version - can be updated based on exact requirements
    public fun calculate_points_to_earn(
        amount: u64, 
        duration_days: u64, 
        participation_level: u64
    ): u64 {
        if (amount == 0 || duration_days == 0) {
            return 0
        };
        
        // Calculate time-weighted factor
        // We multiply by 100 to handle decimals more precisely, then divide at the end
        let time_factor = 100 + ((duration_days * 100) / 365);
        
        // Calculate base points (amount * time_factor / 100)
        let base_points = (amount * time_factor) / 100;
        
        // Adjust by participation level
        let total_points = base_points * participation_level;
        
        total_points
    }
    
    // === View functions ===
    
    /// Get user's available balance
    public fun get_available_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.entries, user)) {
            return 0
        };
        
        let balance = table::borrow(&ledger.entries, user);
        balance.available
    }
    
    /// Get user's locked balance
    public fun get_locked_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.entries, user)) {
            return 0
        };
        
        let balance = table::borrow(&ledger.entries, user);
        balance.locked
    }
    
    /// Get user's total balance (available + locked)
    public fun get_total_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.entries, user)) {
            return 0
        };
        
        let balance = table::borrow(&ledger.entries, user);
        balance.available + balance.locked
    }
    
    /// Get total supply of Alpha Points
    public fun get_total_supply(ledger: &Ledger): u64 {
        balance::supply_value(&ledger.point_supply)
    }
    
    #[test_only]
    /// For testing only: create a Balance of AlphaPointTag
    public fun create_test_balance(amount: u64, ctx: &mut tx_context::TxContext): balance::Balance<AlphaPointTag> {
        balance::create_for_testing<AlphaPointTag>(amount, ctx)
    }
}