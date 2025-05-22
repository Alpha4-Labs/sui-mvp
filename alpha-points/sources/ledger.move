/// Module that manages the internal accounting of Alpha Points.
/// Tracks user balances and total supply using a shared Ledger object.
module alpha_points::ledger {
    // use sui::object; // Removed as provided by default
    use sui::tx_context::{epoch as get_epoch};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::table::{Self, Table};
    use alpha_points::stake_position::{Self as stake_position, StakePosition};
    // use sui::transfer; // Removed as provided by default

    // Error constants
    const EInsufficientBalance: u64 = 1;
    const EInsufficientAvailableBalance: u64 = 2;
    const ERepaymentExceedsDebt: u64 = 6; // For integration.move to check via internal_remove_bad_debt()
    const EOverflow: u64 = 7;
    const EInsufficientLockedBalance: u64 = 8;
    const EExceedsWeightCurve: u64 = 200;

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

    /// User's point balance details with available and locked amounts
    public struct PointBalance has key, store {
        id: object::UID,
        available: u64,
        locked: u64
    }

    /// Shared object holding the global ledger with point supply and user balances
    public struct Ledger has key {
        id: object::UID,
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

    // Add MintStats for daily wallet cap
    public struct MintStats has key {
        id: object::UID,
        minted_today: Table<address, u64>,
        last_epoch: u64
    }

    // Add DAILY_WALLET_CAP constant
    const DAILY_WALLET_CAP: u64 = 10_000;

    // --- SupplyOracle struct and logic ---
    public struct SupplyOracle has key {
        id: object::UID,
        total_pts: u128,
        last_total_pts: u128,
        redeem_rate: u64, // in basis points (bps)
        last_recompute_epoch: u64
    }

    // Event emitted when SupplyOracle's redeem_rate is recomputed
    public struct RedeemRateRecomputed has copy, drop {
        old_rate_bps: u64,
        new_rate_bps: u64,
        total_pts_at_recompute: u128,
        recompute_epoch: u64
    }
    
    // Event emitted when SupplyOracle's total_pts is updated
    public struct TotalPointsUpdated has copy, drop {
        old_total_pts: u128,
        new_total_pts: u128,
        change_amount: u128, // Can be positive (mint) or represent a positive change for burn (absolute value of burn)
        is_mint: bool // True if mint, false if burn/reduction
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
        ctx: &mut TxContext
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
                PointBalance { id: object::new(ctx), available: amount, locked: 0 }
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
    public fun can_mint_points(stats: &MintStats, user: address, pts: u64): bool {
        // Returns true if user can mint the given amount without exceeding the daily cap
        let minted = get_user_minted_today(stats, user);
        minted + pts <= DAILY_WALLET_CAP
    }

    // --- Weight curve enforcement ---
    // Enforce amount <= weight(stake_secs, principal, liq_share) if stake is present
    public fun enforce_weight_curve<T: store>(stake_opt: &Option<StakePosition<T>>, amount: u64, liq_share: u64, clock_obj: &Clock) {
        if (option::is_some(stake_opt)) {
            let stake = option::borrow(stake_opt);
            let current_time_ms = clock::timestamp_ms(clock_obj);
            let weight = stake_position::calculate_weight<T>(stake, current_time_ms, liq_share);
            assert!(amount <= weight, EExceedsWeightCurve);
        } // If stake_opt is none, the weight curve assertion is skipped for this call.
    }

    // Update mint_points to accept stake_opt as Option<StakePosition<T>>
    /// Public function to mint points for a user.
    /// Currently calls internal_earn and ignores point_type for simplicity.
    public fun mint_points<T: store>(
        ledger: &mut Ledger,
        user: address,
        amount: u64,
        _point_type: PointType,
        ctx: &mut TxContext,
        stats: &mut MintStats,
        current_epoch_val: u64,
        stake_opt: &Option<StakePosition<T>>,
        liq_share: u64,
        clock_obj: &Clock,
        supply_oracle: &mut SupplyOracle
    ) {
        // Reset stats if new epoch
        if (current_epoch_val > stats.last_epoch) {
            stats.last_epoch = current_epoch_val;
        };
        // Enforce user daily cap
        assert!(can_mint_points(stats, user, amount), 100);
        // Enforce weight curve if stake is present
        enforce_weight_curve(stake_opt, amount, liq_share, clock_obj);
        update_minted_today(stats, user, amount);
        internal_earn(ledger, user, amount, ctx);
        update_supply_oracle_on_mint(supply_oracle, amount);
        // No return
    }

    // === View functions ===

    public fun get_available_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.balances, user)) {
            return 0
        };
        let balance = table::borrow(&ledger.balances, user);
        let available = balance.available;
        available
    }

    public fun get_locked_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.balances, user)) {
            return 0
        };
        let balance = table::borrow(&ledger.balances, user);
        let locked = balance.locked;
        locked
    }

    public fun get_total_balance(ledger: &Ledger, user: address): u64 {
        if (!table::contains(&ledger.balances, user)) {
            return 0
        };
        let balance = table::borrow(&ledger.balances, user);
        let total_balance = balance.available + balance.locked;
        total_balance
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
            let current_debt_ref = table::borrow(&ledger.bad_debt, user);
            let current_debt = *current_debt_ref;
            current_debt
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
        _gov_cap: &GovernCap,
        user: address,
        amount: u64,
        ctx: &mut TxContext,
        stats: &mut MintStats,
        epoch: u64,
        stake_opt: &std::option::Option<StakePosition<u8>>,
        liq_share: u64,
        clock: &Clock,
        supply_oracle: &mut SupplyOracle
    ) {
        mint_points(ledger, user, amount, new_point_type_staking(), ctx, stats, epoch, stake_opt, liq_share, clock, supply_oracle);
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

    // Add earned_today function
    public fun earned_today(stats: &MintStats, user: address): u64 {
        if (!table::contains(&stats.minted_today, user)) {
            return 0
        };
        let value_ref = table::borrow(&stats.minted_today, user);
        let value = *value_ref;
        value
    }

    public fun get_or_create_mint_stats(ctx: &mut TxContext): MintStats {
        MintStats {
            id: object::new(ctx),
            minted_today: table::new(ctx),
            last_epoch: 0
        }
    }

    public fun reset_mint_stats(stats: &mut MintStats, epoch: u64, _ctx: &mut tx_context::TxContext) {
        stats.last_epoch = epoch;
    }

    public fun update_minted_today(stats: &mut MintStats, user: address, pts: u64) {
        if (!table::contains(&stats.minted_today, user)) {
            table::add(&mut stats.minted_today, user, pts);
        } else {
            let user_ref = table::borrow_mut(&mut stats.minted_today, user);
            *user_ref = *user_ref + pts;
        }
    }

    public fun get_user_minted_today(stats: &MintStats, user: address): u64 {
        if (table::contains(&stats.minted_today, user)) {
            let value_ref = table::borrow(&stats.minted_today, user);
            let value = *value_ref;
            value
        } else {
            0
        }
    }

    public fun get_daily_wallet_cap(): u64 {
        DAILY_WALLET_CAP
    }

    // Helper to update SupplyOracle on mint/burn
    public fun update_supply_oracle_on_mint(oracle: &mut SupplyOracle, minted_amount: u64) {
        let old_total = oracle.total_pts;
        let new_total = old_total + (minted_amount as u128);
        oracle.total_pts = new_total;
        event::emit(TotalPointsUpdated {
            old_total_pts: old_total,
            new_total_pts: new_total,
            change_amount: (minted_amount as u128),
            is_mint: true
        });
    }

    public fun update_supply_oracle_on_burn(oracle: &mut SupplyOracle, burned_amount: u64) {
        let old_total = oracle.total_pts;
        let burned_u128 = (burned_amount as u128);
        let new_total = if (old_total >= burned_u128) {
            old_total - burned_u128
        } else {
            0 // Prevent underflow
        };
        oracle.total_pts = new_total;
         event::emit(TotalPointsUpdated {
            old_total_pts: old_total,
            new_total_pts: new_total,
            change_amount: burned_u128,
            is_mint: false
        });
    }

    public fun get_last_epoch(stats: &MintStats): u64 {
        stats.last_epoch
    }
    public fun set_last_epoch(stats: &mut MintStats, epoch: u64) {
        stats.last_epoch = epoch;
    }

    /// Public helper for tests: create a mock SupplyOracle
    public fun mock_supply_oracle(ctx: &mut TxContext): SupplyOracle {
        SupplyOracle { id: object::new(ctx), total_pts: 0, last_total_pts: 0, redeem_rate: 0, last_recompute_epoch: 0 }
    }

    /// Initializes the SupplyOracle.
    /// Should be called once during module initialization.
    public fun create_supply_oracle(initial_total_pts: u128, initial_redeem_rate: u64, _clock: &Clock, ctx: &mut TxContext): SupplyOracle { // _clock is unused now
        let current_epoch = get_epoch(ctx);
        SupplyOracle {
            id: object::new(ctx),
            total_pts: initial_total_pts,
            last_total_pts: initial_total_pts, 
            redeem_rate: initial_redeem_rate,
            last_recompute_epoch: current_epoch
        }
    }

    /// Recomputes redeem_rate if total_pts has increased by at least 5% 
    /// since the last recomputation and current_epoch > last_recompute_epoch.
    public fun recompute_redeem_rate_if_needed(oracle: &mut SupplyOracle, ctx: &TxContext) { // Added ctx
        let current_epoch = get_epoch(ctx); // Use ctx to get epoch
        if (current_epoch <= oracle.last_recompute_epoch) {
            return // Exit if current epoch is not greater than the last recompute epoch
        };

        // Check if total_pts has increased by at least 5% since the last recomputation
        if (oracle.last_total_pts > 0) { // Avoid division by zero if last_total_pts was 0
            // Calculate 5% increase threshold: last_total_pts * 1.05 which is last_total_pts * 105 / 100
            // To avoid floating point, check if current_total_pts * 100 >= last_total_pts * 105
            let threshold_check = oracle.total_pts * 100;
            let last_total_with_increase = oracle.last_total_pts * 105;

            if (threshold_check >= last_total_with_increase) {
                let old_rate = oracle.redeem_rate;
                oracle.redeem_rate = oracle.redeem_rate + 1; // Increase by 1 bps as per spec
                oracle.last_total_pts = oracle.total_pts;    // Update last_total_pts for next comparison
                oracle.last_recompute_epoch = current_epoch; // Update the epoch of this recomputation
                event::emit(RedeemRateRecomputed {
                    old_rate_bps: old_rate,
                    new_rate_bps: oracle.redeem_rate,
                    total_pts_at_recompute: oracle.total_pts,
                    recompute_epoch: current_epoch
                });
            }
        } else if (oracle.total_pts > 0) { 
            // If last_total_pts was 0, and current is > 0, this is the first significant point supply.
            // Consider if an initial recomputation or different logic is needed here.
            // For now, just update last_total_pts and epoch if redeem_rate changes (it won't with +1bps from 0).
            // If redeem_rate is 0, any increase is > 5% of 0.
             let old_rate = oracle.redeem_rate;
             oracle.redeem_rate = oracle.redeem_rate + 1; // Increase by 1 bps
             oracle.last_total_pts = oracle.total_pts;
             oracle.last_recompute_epoch = current_epoch;
             event::emit(RedeemRateRecomputed {
                    old_rate_bps: old_rate,
                    new_rate_bps: oracle.redeem_rate,
                    total_pts_at_recompute: oracle.total_pts,
                    recompute_epoch: current_epoch
                });
        }
        // If oracle.last_total_pts is 0 and oracle.total_pts is also 0, do nothing.
    }

    /// Test-only function to manually trigger recomputation for different scenarios.
    #[test_only]
    public fun mock_recompute_redeem_rate(oracle: &mut SupplyOracle, new_total_pts: u128, new_redeem_rate_bps: u64, recompute_epoch: u64) {
        // ... existing code ...
    }

    // Public getter for redeem_rate
    public fun get_redeem_rate(supply_oracle: &SupplyOracle): u64 { // Ensure public access
        supply_oracle.redeem_rate
    }

    // Public getter for total_pts from SupplyOracle
    // ... existing code ...
} // End of module alpha_points::ledger