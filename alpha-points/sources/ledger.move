// ledger.move - Manages global Alpha Point balances and supply
module alpha_points::ledger {
    use sui::object::UID;
    use sui::table::{Self, Table, borrow, borrow_mut, contains, add};
    use sui::balance::{Self, Supply, destroy_zero};
    use sui::tx_context::TxContext;
    use sui::event;

    // === Tag Types ===
    public struct AlphaPointTag has drop {}

    // === Structs ===
    // Renamed to avoid conflict with sui::balance::Balance
    public struct PointBalance has store, copy, drop { available: u64, locked: u64 }
    public struct Ledger has key {
        id: UID,
        point_supply: Supply<AlphaPointTag>,
        entries: Table<address, PointBalance>,
        // Invariant removed for now
    }

    // === Events ===
    public struct Earned has copy, drop { caller: address, user: address, amount: u64, timestamp_ms: u64 }
    public struct Spent has copy, drop { caller: address, user: address, amount: u64, timestamp_ms: u64 }
    public struct Locked has copy, drop { caller: address, user: address, amount: u64, timestamp_ms: u64 }
    public struct Unlocked has copy, drop { caller: address, user: address, amount: u64, timestamp_ms: u64 }

    // === Errors ===
    const EZERO_AMOUNT: u64 = 1;
    const ENOT_ENOUGH_AVAILABLE: u64 = 2;
    const ENOT_ENOUGH_LOCKED: u64 = 3;
    const EBALANCE_OVERFLOW: u64 = 4;
    const EINVALID_MATH_PARAMS: u64 = 5;
    const EMISSION_OVERFLOW: u64 = 6;

    // === Constants === 
    const FIXED_POINT_SCALE_U128: u128 = 1_000_000_000_000_000_000;
    const MAX_U64: u128 = 18_446_744_073_709_551_615;

    // === Init === (Changed to internal for module init)
    fun init(ctx: &mut TxContext) {
        let ledger = Ledger {
            id: object::new(ctx),
            point_supply: balance::create_supply<AlphaPointTag>(AlphaPointTag {}),
            entries: table::new(ctx),
        };
        
        sui::transfer::share_object(ledger);
    }

    // === Package-Protected Functions ===
    public(package) fun internal_earn(
        ledger: &mut Ledger, 
        user: address, 
        amount: u64, 
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = tx_context::sender(ctx);
        
        // Mint new points into the supply
        let added_sui_balance = balance::increase_supply(&mut ledger.point_supply, amount);
        destroy_zero(added_sui_balance);

        // Use contains/add/borrow_mut pattern instead of borrow_mut_with_default
        if (!contains(&ledger.entries, user)) {
            add(&mut ledger.entries, user, PointBalance { available: 0, locked: 0 });
        };
        let user_balance_ref = borrow_mut(&mut ledger.entries, user);

        let current_available = (user_balance_ref.available as u128);
        let amount_u128 = (amount as u128);
        assert!(current_available + amount_u128 <= MAX_U64, EBALANCE_OVERFLOW);
        user_balance_ref.available = user_balance_ref.available + amount;
        event::emit(Earned { 
            caller: caller_address, 
            user, 
            amount, 
            timestamp_ms: tx_context::epoch_timestamp_ms(ctx) 
        });
    }
    
    public(package) fun internal_spend(
        ledger: &mut Ledger, 
        user: address, 
        amount: u64, 
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = tx_context::sender(ctx);
        
        // Check if user exists in the table and has enough balance
        assert!(contains(&ledger.entries, user), ENOT_ENOUGH_AVAILABLE);
        let user_balance_ref = borrow_mut(&mut ledger.entries, user);
        assert!(user_balance_ref.available >= amount, ENOT_ENOUGH_AVAILABLE);
        
        // Decrease available balance
        user_balance_ref.available = user_balance_ref.available - amount;
        
        // Decrease total supply - Fixed: Create a Balance<T> and pass that
        let points_balance = balance::create_for_testing<AlphaPointTag>(amount);
        let balance_to_burn = balance::decrease_supply(&mut ledger.point_supply, points_balance);
        balance::destroy_for_testing(balance_to_burn);
        
        event::emit(Spent { 
            caller: caller_address, 
            user, 
            amount, 
            timestamp_ms: tx_context::epoch_timestamp_ms(ctx) 
        });
    }
    
    public(package) fun internal_lock(
        ledger: &mut Ledger, 
        user: address, 
        amount: u64, 
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = tx_context::sender(ctx);
        
        // Check if user exists in the table and has enough available balance
        assert!(contains(&ledger.entries, user), ENOT_ENOUGH_AVAILABLE);
        let user_balance_ref = borrow_mut(&mut ledger.entries, user);
        assert!(user_balance_ref.available >= amount, ENOT_ENOUGH_AVAILABLE);
        
        // Move from available to locked
        user_balance_ref.available = user_balance_ref.available - amount;
        user_balance_ref.locked = user_balance_ref.locked + amount;
        
        event::emit(Locked { 
            caller: caller_address, 
            user, 
            amount, 
            timestamp_ms: tx_context::epoch_timestamp_ms(ctx) 
        });
    }
    
    public(package) fun internal_unlock(
        ledger: &mut Ledger, 
        user: address, 
        amount: u64, 
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = tx_context::sender(ctx);
        
        // Check if user exists in the table and has enough locked balance
        assert!(contains(&ledger.entries, user), ENOT_ENOUGH_LOCKED);
        let user_balance_ref = borrow_mut(&mut ledger.entries, user);
        assert!(user_balance_ref.locked >= amount, ENOT_ENOUGH_LOCKED);
        
        // Move from locked to available
        user_balance_ref.locked = user_balance_ref.locked - amount;
        user_balance_ref.available = user_balance_ref.available + amount;
        
        event::emit(Unlocked { 
            caller: caller_address, 
            user, 
            amount, 
            timestamp_ms: tx_context::epoch_timestamp_ms(ctx) 
        });
    }
    
    public(package) fun calculate_points(
        principal: u64,
        participation: u64,
        time_weight: u64,
        liquidity_dom: u64
    ): u64 {
        // Validate inputs
        assert!(
            principal > 0 && participation > 0 && 
            time_weight > 0 && liquidity_dom > 0,
            EINVALID_MATH_PARAMS
        );
        
        // Convert to u128 for safe math
        let principal_u128 = (principal as u128);
        let participation_u128 = (participation as u128);
        let time_weight_u128 = (time_weight as u128);
        let liquidity_dom_u128 = (liquidity_dom as u128);
        
        // Calculate points using the formula:
        // points = principal * (participation / SCALE) * (time_weight / SCALE) / (liquidity_dom / SCALE)
        // Simplified: points = principal * participation * time_weight / (liquidity_dom * SCALE * SCALE)
        
        let intermediate1 = principal_u128 * participation_u128;
        assert!(intermediate1 / principal_u128 == participation_u128, EMISSION_OVERFLOW);
        
        let intermediate2 = intermediate1 * time_weight_u128;
        assert!(intermediate2 / intermediate1 == time_weight_u128, EMISSION_OVERFLOW);
        
        let scale_squared = FIXED_POINT_SCALE_U128 * FIXED_POINT_SCALE_U128;
        let denominator = liquidity_dom_u128 * scale_squared;
        assert!(denominator / liquidity_dom_u128 == scale_squared, EMISSION_OVERFLOW);
        
        let scaled_points = intermediate2 / denominator * FIXED_POINT_SCALE_U128;
        assert!(scaled_points <= MAX_U64, EMISSION_OVERFLOW);
        
        (scaled_points as u64)
    }

    // === Public View Functions ===
    public fun get_total_balance(ledger: &Ledger, user: address): u64 {
        if (contains(&ledger.entries, user)) {
            let balance = borrow(&ledger.entries, user); // Use borrow (immutable)
            // Perform add with u128 to prevent overflow before casting back
            let total = (balance.available as u128) + (balance.locked as u128);
            // We assume total balance fits in u64 for view function
            (total as u64)
        } else { 0 }
    }
    
    public fun get_available_balance(ledger: &Ledger, user: address): u64 { 
        if (contains(&ledger.entries, user)) {
            let balance = borrow(&ledger.entries, user);
            balance.available
        } else { 0 }
    }
    
    public fun get_locked_balance(ledger: &Ledger, user: address): u64 { 
        if (contains(&ledger.entries, user)) {
            let balance = borrow(&ledger.entries, user);
            balance.locked
        } else { 0 }
    }
    
    public fun get_total_supply(ledger: &Ledger): u64 { 
        // Get the supply value and cast to u64
        let supply_u128 = balance::supply_value(&ledger.point_supply);
        (supply_u128 as u64)
    }
    
    // Provide public getters for constants
    public fun fixed_point_scale(): u128 { FIXED_POINT_SCALE_U128 }
    public fun max_u64_value(): u128 { MAX_U64 }
    public fun zero_amount_error(): u64 { EZERO_AMOUNT }
    public fun not_enough_available_error(): u64 { ENOT_ENOUGH_AVAILABLE }
    public fun not_enough_locked_error(): u64 { ENOT_ENOUGH_LOCKED }
    public fun balance_overflow_error(): u64 { EBALANCE_OVERFLOW }
    public fun invalid_math_params_error(): u64 { EINVALID_MATH_PARAMS }
    public fun emission_overflow_error(): u64 { EMISSION_OVERFLOW }
    
    // Added test-only init function that can be called in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}