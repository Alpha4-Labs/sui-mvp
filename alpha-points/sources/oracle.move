/// Module that provides asset price/rate information for Alpha Points against
/// other assets or a base currency like USDC.
module alpha_points::oracle {
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};

    use alpha_points::admin::OracleCap;

    // Error constants
    const EInvalidRate: u64 = 1;
    const EInvalidDecimals: u64 = 2;
    const EOracleStale: u64 = 3;

    /// Shared object holding rate information
    public struct RateOracle has key {
        id: UID,
        base_rate: u128,          // Fixed-point representation
        decimals: u8,             // Number of decimal places in base_rate
        last_update_epoch: u64,   // When rate was last updated (Consider using Sui Epoch or Timestamp)
        staleness_threshold: u64  // Max duration (in units matching last_update_epoch) before oracle is considered stale
    }

    // Events
    public struct OracleCreated has copy, drop {
        id: ID,
        initial_rate: u128,
        decimals: u8,
        threshold: u64
    }

    public struct RateUpdated has copy, drop {
        id: ID,
        old_rate: u128,
        new_rate: u128,
        update_epoch: u64 // Or timestamp if using clock time
    }

    public struct StalenessThresholdUpdated has copy, drop {
        id: ID,
        old_threshold: u64,
        new_threshold: u64
    }

    // === Test-only functions ===
    #[test_only]
    /// Initialize oracle with a GovernCap for testing purposes
    public fun create_oracle_for_testing(
        _gov_cap: &OracleCap, // Using OracleCap type for testing
        initial_rate: u128,
        decimals: u8,
        threshold: u64,
        ctx: &mut TxContext
    ) {
        create_oracle(_gov_cap, initial_rate, decimals, threshold, ctx)
    }

    // === Core module functions ===

    /// Creates and shares RateOracle
    public entry fun create_oracle(
        _oracle_cap: &OracleCap,
        initial_rate: u128,
        decimals: u8,
        threshold: u64,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(initial_rate > 0, EInvalidRate);
        assert!(decimals <= 18, EInvalidDecimals); // Limit max decimals

        let id = object::new(ctx);
        let oracle_id = object::uid_to_inner(&id); // Get ID for event before potential move

        // Create oracle with initial values
        // Consider setting last_update_epoch to the current epoch/time during creation
        let oracle = RateOracle {
            id,
            base_rate: initial_rate,
            decimals,
            last_update_epoch: 0, // Or tx_context::epoch(ctx) or clock::timestamp_ms(...)
            staleness_threshold: threshold
        };

        // Emit event
        event::emit(OracleCreated {
            id: oracle_id,
            initial_rate,
            decimals,
            threshold
        });

        // Share the oracle
        transfer::share_object(oracle);
    }

    /// Updates oracle.base_rate and last_update_epoch
    public entry fun update_rate(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap,
        new_rate: u128,
        ctx: &TxContext // Using TxContext to get current Sui epoch
        // clock: &Clock // Or pass Clock if using timestamp_ms
    ) {
        // Validate inputs
        assert!(new_rate > 0, EInvalidRate);

        let old_rate = oracle.base_rate;

        // Using tx_context's epoch. Change if using clock timestamp.
        let current_epoch_or_time = tx_context::epoch(ctx);
        // let current_epoch_or_time = clock::timestamp_ms(clock);

        // Update rate and timestamp/epoch
        oracle.base_rate = new_rate;
        oracle.last_update_epoch = current_epoch_or_time;

        // Emit event
        event::emit(RateUpdated {
            id: object::uid_to_inner(&oracle.id),
            old_rate,
            new_rate,
            update_epoch: current_epoch_or_time
        });
    }

    /// Updates oracle.staleness_threshold
    public entry fun update_staleness_threshold(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap,
        new_threshold: u64,
        _ctx: &TxContext
    ) {
        let old_threshold = oracle.staleness_threshold;

        // Update threshold
        oracle.staleness_threshold = new_threshold;

        // Emit event
        event::emit(StalenessThresholdUpdated {
            id: object::uid_to_inner(&oracle.id),
            old_threshold,
            new_threshold
        });
    }

    /// Converts Alpha Points to asset amount using the oracle rate
    public fun convert_points_to_asset(
        points: u64,
        rate: u128,
        decimals: u8
    ): u64 {
        if (points == 0 || rate == 0) {
            return 0
        };

        // Apply rate to points with fixed-point math
        let scaled_points = (points as u128);
        let pow_decimals = pow10(decimals); // Calculate 10^decimals
        // Ensure pow_decimals is not zero to avoid division by zero if decimals is large enough
        // Although u8 limits decimals, making pow10(decimals) unlikely to be zero within u128 range.
        assert!(pow_decimals > 0, EInvalidDecimals); // Or a different error code

        let result = (scaled_points * rate) / pow_decimals;

        // Convert back to u64, capping at u64::MAX if necessary
        let max_u64 = 18446744073709551615u128; // Use constant notation
        if (result > max_u64) {
            (max_u64 as u64) // Return u64::MAX
        } else {
            (result as u64)
        }
    }

    /// Converts asset amount to Alpha Points using the oracle rate
    public fun convert_asset_to_points(
        asset: u64,
        rate: u128,
        decimals: u8
    ): u64 {
        if (asset == 0) { // No need to check rate here, handled below
            return 0
        };
        // Rate must be non-zero for inverse calculation
        assert!(rate > 0, EInvalidRate);

        // Calculate inverse rate and apply to asset with fixed-point math
        let scaled_asset = (asset as u128);
        let pow_decimals = pow10(decimals);
        assert!(pow_decimals > 0, EInvalidDecimals);

        // points = asset * (10^decimals / rate)
        // To prevent potential overflow from scaled_asset * pow_decimals, check intermediate result if needed
        // Or rearrange calculation if possible, but division first might lose precision.
        let result = (scaled_asset * pow_decimals) / rate;

        // Convert back to u64, capping at u64::MAX if necessary
        let max_u64 = 18446744073709551615u128;
        if (result > max_u64) {
            (max_u64 as u64)
        } else {
            (result as u64)
        }
    }

    // === View functions ===

    /// Returns the oracle rate and decimals
    public fun get_rate(oracle: &RateOracle): (u128, u8) {
        (oracle.base_rate, oracle.decimals)
    }

    /// Checks if the oracle data is stale based on the clock time.
    /// NOTE: This uses Clock time (milliseconds) and converts it to days for comparison.
    /// Ensure this matches how last_update_epoch and staleness_threshold are defined.
    /// If using Sui epochs, you should pass TxContext and compare epochs directly.
    /// Checks if the oracle data is stale based on the clock time.
    /// NOTE: Ensure time unit conversions match your definitions for last_update_epoch and staleness_threshold.
    public fun is_stale(oracle: &RateOracle, clock: &Clock): bool {
        // Use an if-else expression for the entire function body to avoid problematic parsing sequences.
        if (oracle.last_update_epoch == 0) {
            // If epoch is 0 (uninitialized/test case), it's considered fresh. Return false.
            false
        } else {
            // If epoch is non-zero, proceed with the staleness calculation.
            // Use the fully qualified function name:
            let current_time_ms = sui::clock::timestamp_ms(clock);

            // Convert timestamp to the same unit as last_update_epoch and staleness_threshold.
            // !! Adjust this calculation based on your actual epoch/time unit definition !!
            let current_epoch_or_time = current_time_ms / 86400000; // Simple ms to days example

            // Implicitly return the boolean result of the staleness check.
            // The '&&' operator short-circuits: the subtraction only happens if
            // current_epoch_or_time is strictly greater than last_update_epoch,
            // preventing potential underflow if time hasn't advanced.
            current_epoch_or_time > oracle.last_update_epoch &&
            (current_epoch_or_time - oracle.last_update_epoch > oracle.staleness_threshold)
        }
        // No semicolon needed here as the value of the if-else expression is implicitly returned.
    }

    /// Returns the staleness threshold
    public fun get_staleness_threshold(oracle: &RateOracle): u64 {
        oracle.staleness_threshold
    }

    /// Asserts that the oracle is not stale using the provided Clock.
    public fun assert_not_stale(oracle: &RateOracle, clock: &Clock) {
        assert!(!is_stale(oracle, clock), EOracleStale);
    }

    /*
    /// Asserts that the oracle is not stale using the transaction context epoch.
    public fun assert_not_stale_epoch(oracle: &RateOracle, ctx: &TxContext) {
        assert!(!is_stale_epoch(oracle, ctx), EOracleStale);
    }
    */

    // === Helper functions ===

    /// Calculate 10^n
    fun pow10(n: u8): u128 {
        let mut i = 0;
        let mut result = 1u128;

        while (i < n) {
            // Check for potential overflow before multiplication
            // 10 * result > u128::MAX  <=> result > u128::MAX / 10
            let max_div_10 = 34028236692093846346337460743176821145u128; // u128::MAX / 10
            assert!(result <= max_div_10, EInvalidDecimals); // Prevent overflow

            result = result * 10;
            i = i + 1;
        };

        result
    }
}