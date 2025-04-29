// ledger.move - Manages global Alpha Point balances and supply
module alpha_points::ledger {
    use sui::object::{Self, ID, UID};
    use sui::table::{Self, Table, fold};
    // Alias imported Balance to avoid name collision with local struct
    use sui::balance::{Self, Balance as SuiBalance, Supply, supply_value, increase_supply, decrease_supply, create_supply, destroy_zero, create_for_testing};
    use sui::tx_context::{Self, TxContext, sender, epoch_timestamp_ms};
    use sui::transfer::{Self, share_object}; // Removed unused `transfer` import
    use sui::event;
    use sui::prover; // Import for invariants

    // Removed unused imports: sui::math, std::vector, std::option

    // Functions marked public(package) are callable from other modules in this package
    // (Replacing deprecated 'friend')

    // === Tag Types ===
    public struct AlphaPointTag has drop {}

    // === Structs ===
    // Added 'public' visibility
    public struct Balance has store, copy, drop {
        available: u64,
        locked: u64,
    }

    // Added 'public' visibility
    public struct Ledger has key {
        id: UID,
        point_supply: Supply<AlphaPointTag>, // Tracks total supply
        entries: Table<address, Balance>, // Maps user address to balance

        // Move Prover Invariant: Total supply must equal the sum of all balances in the table
        invariant {
            supply_value(&self.point_supply) ==
                fold(&self.entries, 0u128, |acc, _addr, b| { // Use u128 for accumulator to prevent overflow during fold
                    acc + (b.available as u128) + (b.locked as u128)
                })
        }
        // Note: Running the Move Prover is required to check this invariant.
    }

    // === Events ===
    // Added 'public' visibility and 'caller' field
    public struct Earned has copy, drop {
        caller: address, // Address that initiated the action
        user: address,
        amount: u64,
        timestamp_ms: u64
    }

    // Added 'public' visibility and 'caller' field
    public struct Spent has copy, drop {
        caller: address, // Address that initiated the action
        user: address,
        amount: u64,
        timestamp_ms: u64
    }

    // Added 'public' visibility and 'caller' field
    public struct Locked has copy, drop {
        caller: address, // Address that initiated the action
        user: address,
        amount: u64,
        timestamp_ms: u64
    }

    // Added 'public' visibility and 'caller' field
    public struct Unlocked has copy, drop {
        caller: address, // Address that initiated the action
        user: address,
        amount: u64,
        timestamp_ms: u64
    }

    // === Errors ===
    // Standardized error codes
    const EZERO_AMOUNT: u64 = 1;           // Amount must be greater than zero
    const ENOT_ENOUGH_AVAILABLE: u64 = 2;  // Insufficient available balance
    const ENOT_ENOUGH_LOCKED: u64 = 3;     // Insufficient locked balance
    const EBALANCE_OVERFLOW: u64 = 4;      // User balance would exceed max u64
    const EINVALID_MATH_PARAMS: u64 = 5;   // Input parameters for calculation are invalid (e.g., zero)
    const EMISSION_OVERFLOW: u64 = 6;      // Calculated points emission exceeds representable amount


    // Fixed point math constants (using u128 for intermediate calculations)
    const FIXED_POINT_SCALE_U128: u128 = 1_000_000_000_000_000_000; // 10^18 as u128
    const MAX_U64: u128 = 18_446_744_073_709_551_615; // (2^64 - 1) as u128

    // === Init ===
    // Initializes the module on deployment
    fun init(ctx: &mut TxContext) {
        share_object(Ledger {
            id: object::new(ctx),
            point_supply: create_supply<AlphaPointTag>(AlphaPointTag{}),
            entries: table::new<address, Balance>(ctx),
        });
    }

    // === Package-Protected Functions ===
    // (Callable only from within the 'alpha_points' package)

    /// Increases a user's available balance (mints points).
    public(package) fun internal_earn(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = sender(ctx);

        // Increase total supply
        let added_sui_balance = increase_supply(&mut ledger.point_supply, amount);
        // Supply object handles its own overflow checks internally.
        destroy_zero(added_sui_balance); // Destroy the temporary SuiBalance object

        // Update user's balance (or create if non-existent)
        let user_balance_ref = table::borrow_mut_with_default(&mut ledger.entries, user, Balance { available: 0, locked: 0 });

        // Check for overflow before adding
        let current_available = (user_balance_ref.available as u128);
        let amount_u128 = (amount as u128);
        assert!(current_available + amount_u128 <= MAX_U64, EBALANCE_OVERFLOW);

        user_balance_ref.available = user_balance_ref.available + amount;

        // Emit event
        event::emit(Earned {
            caller: caller_address,
            user,
            amount,
            timestamp_ms: epoch_timestamp_ms(ctx)
        });
        prover::assert!(supply_value(&ledger.point_supply) > 0); // Example prover assertion
    }

    /// Decreases a user's available balance (burns points).
    public(package) fun internal_spend(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = sender(ctx);

        // Borrow user's balance mutably (aborts if user doesn't exist)
        let user_balance_ref = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance_ref.available >= amount, ENOT_ENOUGH_AVAILABLE);

        // Decrease user's balance
        user_balance_ref.available = user_balance_ref.available - amount;

        // Decrease total supply
        // Create a temporary SuiBalance to decrease supply; handles underflow check.
        let temp_sui_balance = create_for_testing<AlphaPointTag>(amount);
        decrease_supply(&mut ledger.point_supply, temp_sui_balance);
        // No need to destroy zero here, decrease_supply consumes the balance

        // Emit event
        event::emit(Spent {
            caller: caller_address,
            user,
            amount,
            timestamp_ms: epoch_timestamp_ms(ctx)
        });
    }

    /// Moves points from available to locked for a user.
    public(package) fun internal_lock(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = sender(ctx);

        let user_balance_ref = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance_ref.available >= amount, ENOT_ENOUGH_AVAILABLE);

        // Check for locked balance overflow
        let current_locked = (user_balance_ref.locked as u128);
        let amount_u128 = (amount as u128);
        assert!(current_locked + amount_u128 <= MAX_U64, EBALANCE_OVERFLOW);

        // Move points from available to locked
        user_balance_ref.available = user_balance_ref.available - amount;
        user_balance_ref.locked = user_balance_ref.locked + amount;

        // Emit event
        event::emit(Locked {
            caller: caller_address,
            user,
            amount,
            timestamp_ms: epoch_timestamp_ms(ctx)
        });
    }

    /// Moves points from locked to available for a user.
    public(package) fun internal_unlock(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        assert!(amount > 0, EZERO_AMOUNT);
        let caller_address = sender(ctx);

        let user_balance_ref = table::borrow_mut(&mut ledger.entries, user);
        assert!(user_balance_ref.locked >= amount, ENOT_ENOUGH_LOCKED);

        // Check for available balance overflow
        let current_available = (user_balance_ref.available as u128);
        let amount_u128 = (amount as u128);
        assert!(current_available + amount_u128 <= MAX_U64, EBALANCE_OVERFLOW);

        // Move points from locked to available
        user_balance_ref.locked = user_balance_ref.locked - amount;
        user_balance_ref.available = user_balance_ref.available + amount;

        // Emit event
        event::emit(Unlocked {
            caller: caller_address,
            user,
            amount,
            timestamp_ms: epoch_timestamp_ms(ctx)
        });
    }

    /// Points generation formula implementation
    /// Formula: points = principal * participation * time_weight / liquidity_dom
    /// All inputs are assumed to have the same fixed-point scale (e.g., 10^18) except principal.
    /// Returns the calculated points amount.
    public(package) fun calculate_points(
        principal: u64, // Raw principal amount (not fixed-point)
        participation: u64, // Fixed-point representation (e.g., 10^18 = 1.0)
        time_weight: u64, // Fixed-point representation (e.g., 10^18 = 1.0)
        liquidity_dom: u64 // Fixed-point representation (e.g., 10^18 = 1.0)
    ): u64 {
        // Validate inputs
        // Principal can be anything > 0. Other factors are fixed-point rates/weights.
        assert!(principal > 0, EINVALID_MATH_PARAMS);
        assert!(participation > 0, EINVALID_MATH_PARAMS); // e.g., cannot be 0%
        assert!(time_weight > 0, EINVALID_MATH_PARAMS); // e.g., cannot be 0 duration weight
        assert!(liquidity_dom > 0, EINVALID_MATH_PARAMS); // Cannot divide by zero

        // Fixed-point math implementation using u128
        let principal_u128 = (principal as u128);
        let participation_u128 = (participation as u128);
        let time_weight_u128 = (time_weight as u128);
        let liquidity_dom_u128 = (liquidity_dom as u128);

        // Calculate: (principal * participation * time_weight * SCALE) / (liquidity_dom * SCALE * SCALE)
        // Simplified: principal * participation * time_weight / liquidity_dom / SCALE
        // Multiply numerators first to maintain precision before dividing.
        // Need to be careful about intermediate overflows with u128.

        // Step 1: principal * participation (result has SCALE decimals)
        let step1 = principal_u128 * participation_u128;
        // Check intermediate overflow: Not strictly possible if principal*participation fits u128

        // Step 2: step1 * time_weight (result has 2*SCALE decimals)
        // This is the most likely place for intermediate overflow if factors are large.
        // Consider using a full u256 library if needed, or rearrange terms carefully.
        // Let's assume inputs are constrained such that this fits u128 for now.
        let step2 = step1 * time_weight_u128;

        // Step 3: step2 / liquidity_dom (result still has potentially 2*SCALE decimals)
        let step3 = step2 / liquidity_dom_u128;

        // Step 4: Adjust back to SCALE decimals by dividing by SCALE
        let result_u128 = step3 / FIXED_POINT_SCALE_U128;

        // Check final result fits in u64
        assert!(result_u128 <= MAX_U64, EMISSION_OVERFLOW);

        (result_u128 as u64)
    }

    // === Public View Functions ===

    /// Gets a user's total balance (available + locked)
    public fun get_total_balance(ledger: &Ledger, user: address): u64 {
        if (table::contains(&ledger.entries, user)) {
            let balance = table::borrow(&ledger.entries, user);
            // Add overflow check if necessary, though unlikely for view function
            (balance.available as u128 + balance.locked as u128) as u64
        } else {
            0
        }
    }

    /// Gets a user's available balance
    public fun get_available_balance(ledger: &Ledger, user: address): u64 {
        if (table::contains(&ledger.entries, user)) {
            table::borrow(&ledger.entries, user).available
        } else {
            0
        }
    }

    /// Gets a user's locked balance
    public fun get_locked_balance(ledger: &Ledger, user: address): u64 {
        if (table::contains(&ledger.entries, user)) {
            table::borrow(&ledger.entries, user).locked
        } else {
            0
        }
    }

    /// Gets the total supply of Alpha Points
    public fun get_total_supply(ledger: &Ledger): u64 {
        supply_value(&ledger.point_supply)
    }
}