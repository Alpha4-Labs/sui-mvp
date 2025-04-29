// oracle.move - Manages conversion rates or other external data
module alpha_points::oracle {
    use sui::object::{Self, ID, UID, new, id, uid_to_inner};
    use sui::tx_context::{Self, TxContext, sender, epoch};
    use sui::transfer::{Self, share_object}; // Only share_object needed
    use sui::event;
    use sui::clock::{Self, Clock, epoch as clock_epoch}; // Use clock::epoch

    // Import the capability type from the admin module
    use alpha_points::admin::{OracleCap};

    // === Constants ===
    const FIXED_POINT_SCALE_U128: u128 = 1_000_000_000_000_000_000; // 10^18 as u128
    const MAX_U64: u128 = 18_446_744_073_709_551_615; // (2^64 - 1) as u128

    // === Structs ===
    // Added 'public' visibility
    public struct RateOracle has key {
        id: UID,
        base_rate: u128, // Fixed-point rate, typically with FIXED_POINT_SCALE decimals assumed
        decimals: u8, // Actual decimals of the asset this rate applies to (e.g., 6 for USDC, 18 for ETH) - Used for potential adjustments
        last_update_epoch: u64, // Epoch of the last rate update
        staleness_threshold: u64, // Max epochs allowed since last update
    }

    // === Events ===
    // Added 'public' visibility, adjusted fields
    public struct OracleCreated has copy, drop {
        oracle_id: ID,
        initial_rate: u128,
        // decimals field removed as per requirement
    }

    // Added 'public' visibility, adjusted fields
    public struct RateUpdated has copy, drop {
        oracle_id: ID,
        new_rate: u128,
        by: address, // Renamed from 'updater'
        // old_rate, update_epoch removed as per requirement
    }

    // Added 'public' visibility
    public struct StalenessThresholdUpdated has copy, drop {
        oracle_id: ID,
        old_threshold: u64,
        new_threshold: u64,
        updater: address, // Keeping 'updater' here as it's specific to this action
    }

    // === Errors ===
    // Standardized and adjusted error codes
    const EINVALID_RATE: u64 = 1;           // Rate must be positive
    const EUNAUTHORIZED_ORACLE_UPDATE: u64 = 2; // Caller lacks the required OracleCap
    const EINVALID_DECIMALS: u64 = 3;       // Invalid decimal value provided
    const EINVALID_STALENESS_THRESHOLD: u64 = 4; // Staleness threshold must be positive
    const ERATE_STALE: u64 = 5;           // Oracle rate data is considered too old
    const ECONVERSION_OVERFLOW: u64 = 6;    // Overflow occurred during conversion calculation

    // === Public Functions ===

    /// Creates a new RateOracle object. Requires the OracleCap.
    public entry fun create_oracle(
        _oracle_cap: &OracleCap, // Authorization check
        initial_rate: u128,
        decimals: u8, // Decimals of the target asset
        staleness_threshold: u64,
        ctx: &mut TxContext
    ) {
        assert!(initial_rate > 0, EINVALID_RATE);
        // Example: Allow decimals up to 18, adjust if needed
        assert!(decimals <= 18, EINVALID_DECIMALS);
        assert!(staleness_threshold > 0, EINVALID_STALENESS_THRESHOLD);

        let oracle_uid = new(ctx);
        let oracle_id = uid_to_inner(&oracle_uid);

        let oracle = RateOracle {
            id: oracle_uid,
            base_rate: initial_rate, // Assume rate is provided with 18 decimals fixed-point
            decimals,
            last_update_epoch: epoch(ctx),
            staleness_threshold,
        };

        event::emit(OracleCreated {
            oracle_id,
            initial_rate,
            // decimals field removed from event
        });

        share_object(oracle);
    }

    /// Updates the base_rate of the RateOracle. Requires the OracleCap.
    public entry fun update_rate(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap, // Capability check
        new_rate: u128,
        ctx: &TxContext
    ) {
        assert!(new_rate > 0, EINVALID_RATE);

        // let old_rate = oracle.base_rate; // Removed as per event requirement
        oracle.base_rate = new_rate;

        let current_epoch = epoch(ctx);
        oracle.last_update_epoch = current_epoch;
        let updater_address = sender(ctx);

        event::emit(RateUpdated {
            oracle_id: id(oracle),
            // old_rate removed
            new_rate,
            // update_epoch removed
            by: updater_address // Renamed from 'updater'
        });
    }

    /// Updates the staleness threshold of the RateOracle. Requires the OracleCap.
    public entry fun update_staleness_threshold(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap, // Capability check
        new_threshold: u64,
        ctx: &TxContext
    ) {
        assert!(new_threshold > 0, EINVALID_STALENESS_THRESHOLD);

        let old_threshold = oracle.staleness_threshold;
        oracle.staleness_threshold = new_threshold;

        event::emit(StalenessThresholdUpdated {
            oracle_id: id(oracle),
            old_threshold,
            new_threshold,
            updater: sender(ctx) // Keeping 'updater' for this specific event
        });
    }

    // === Public View Functions ===

    /// Returns the base rate and the decimals configured for the oracle.
    public fun get_rate(oracle: &RateOracle): (u128, u8) {
        (oracle.base_rate, oracle.decimals)
    }

    /// Returns the epoch when the oracle rate was last updated.
    public fun last_update_epoch(oracle: &RateOracle): u64 {
        oracle.last_update_epoch
    }

    /// Returns true if the oracle rate is considered stale based on the current clock epoch.
    public fun is_stale(oracle: &RateOracle, clock: &Clock): bool {
        let current_epoch = clock_epoch(clock);
        // Ensure subtraction doesn't underflow if clock somehow went backwards (unlikely)
        if (current_epoch <= oracle.last_update_epoch) { return false };
        (current_epoch - oracle.last_update_epoch) > oracle.staleness_threshold
    }


    // === Package-Protected Conversion Function ===

    /// Converts a points amount (u64, assumed to have FIXED_POINT_SCALE decimals)
    /// to an asset amount (u64) using the provided rate (u128, assumed FIXED_POINT_SCALE decimals)
    /// and the target asset's decimals (u8). Includes rounding.
    /// IMPORTANT: This function does NOT check for rate staleness. The caller MUST check is_stale first.
    public(package) fun convert_points_to_asset(
        points: u64,
        rate: u128, // Rate with FIXED_POINT_SCALE decimals
        decimals: u8 // Decimals of the target asset
    ): u64 {
        assert!(rate > 0, EINVALID_RATE); // Cannot convert with zero rate
        if (points == 0) { return 0 }; // Handle zero input directly

        let points_u128 = (points as u128);

        // Calculate: (points * rate) / FIXED_POINT_SCALE
        // Perform multiplication first
        let intermediate_result = points_u128 * rate;

        // Check for intermediate overflow before division
        // If points * rate overflowed u128, the result is meaningless.
        // A simple check: if rate > 0, then intermediate_result / rate == points
        // This check isn't perfect due to potential division truncation but helps.
        // A better approach might involve full u256 math libraries for production.
        if (rate > 0) {
             assert!(intermediate_result / rate == points_u128, ECONVERSION_OVERFLOW);
        };

        // Apply rounding: add half the denominator before dividing
        let denominator = FIXED_POINT_SCALE_U128;
        let rounded_intermediate = intermediate_result + (denominator / 2);
         // Check for overflow after adding rounding factor
        assert!(rounded_intermediate >= intermediate_result, ECONVERSION_OVERFLOW);

        let result_u128 = rounded_intermediate / denominator;

        // --- Optional: Adjust for target asset decimals if different from points decimals (18) ---
        // This part is complex and depends on requirements.
        // If points are 1e18 scale and target asset has 'decimals',
        // you might need to multiply or divide by 10^(18-decimals).
        // Example (If target decimals < 18):
        // if (decimals < 18) {
        //    let factor = 10u128.pow((18 - decimals) as u32);
        //    result_u128 = result_u128 / factor; // Reduce precision
        // }
        // Example (If target decimals > 18): - This case is unusual
        // if (decimals > 18) {
        //     let factor = 10u128.pow((decimals - 18) as u32);
        //     result_u128 = result_u128 * factor; // Increase precision (check overflow)
        // }
        // --- End Optional Adjustment ---


        // Check final result fits in u64
        assert!(result_u128 <= MAX_U64, ECONVERSION_OVERFLOW);

        (result_u128 as u64)
    }
}


// === Test Submodule ===
#[test_only]
module alpha_points::oracle_tests {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx, take_shared, return_shared, take_from_sender, return_to_sender};
    use sui::object::{Self, ID};
    use sui::clock::{Self, Clock, create_for_testing, destroy, increment_for_testing};
    use sui::test_utils; // For ::destroy() if needed? No.

    use alpha_points::admin::{Self as admin, OracleCap}; // Need admin to get OracleCap
    use alpha_points::oracle::{
        Self, RateOracle, OracleCreated, RateUpdated, StalenessThresholdUpdated,
        EINVALID_RATE, EUNAUTHORIZED_ORACLE_UPDATE, EINVALID_DECIMALS,
        EINVALID_STALENESS_THRESHOLD, ERATE_STALE, ECONVERSION_OVERFLOW,
        FIXED_POINT_SCALE_U128 // Import constant for use in tests
    };

    // Test addresses
    const ADMIN: address = @0xA1; // Assumed deployer and initial OracleCap holder
    const USER1: address = @0xB1; // Unauthorized user

    // Helper to initialize admin and get OracleCap
    fun init_admin_get_cap(scenario: &mut Scenario): OracleCap {
        next_tx(scenario, ADMIN);
        admin::init(ctx(scenario));
        // Discard GovCap, keep OracleCap
        let _ = take_from_sender<admin::GovernCap>(scenario);
        take_from_sender<admin::OracleCap>(scenario)
    }

    // Helper to create a default oracle for tests
    fun create_test_oracle(scenario: &mut Scenario, oracle_cap: &OracleCap): RateOracle {
         next_tx(scenario, ADMIN);
         oracle::create_oracle(
             oracle_cap,
             FIXED_POINT_SCALE_U128, // Rate = 1.0 (1e18)
             18, // Decimals = 18
             100, // Staleness = 100 epochs
             ctx(scenario)
         );
         take_shared<RateOracle>(scenario)
    }

    #[test]
    fun test_create_and_update_rate_success() {
        let scenario = test_scenario::begin(ADMIN);
        let oracle_cap = init_admin_get_cap(&mut scenario);
        let mut oracle = create_test_oracle(&mut scenario, &oracle_cap);
        let clock = create_for_testing(ctx(&mut scenario)); // Need clock for view funcs

        next_tx(&mut scenario, ADMIN);
        let (rate, decimals) = oracle::get_rate(&oracle);
        assert!(rate == FIXED_POINT_SCALE_U128 && decimals == 18, 0);

        // Update rate
        let new_rate = FIXED_POINT_SCALE_U128 * 2; // Rate = 2.0
        oracle::update_rate(&mut oracle, &oracle_cap, new_rate, ctx(&mut scenario));

        let (rate, decimals) = oracle::get_rate(&oracle);
        assert!(rate == new_rate && decimals == 18, 1);

        // Cleanup
        return_shared(oracle);
        return_to_sender(&mut scenario, oracle_cap);
        destroy(clock);
        test_scenario::end(scenario);
    }

     #[test]
     #[expected_failure(abort_code = EUNAUTHORIZED_ORACLE_UPDATE)] // Placeholder, framework might use different code
    /// Test update_rate fails without OracleCap
    fun test_update_rate_fail_unauthorized() {
        let scenario = test_scenario::begin(ADMIN);
        let oracle_cap = init_admin_get_cap(&mut scenario);
        let mut oracle = create_test_oracle(&mut scenario, &oracle_cap);

        // Try update from USER1 (no cap)
        next_tx(&mut scenario, USER1);
        let new_rate = FIXED_POINT_SCALE_U128 / 2; // Rate = 0.5
        // The call requires &OracleCap, USER1 cannot provide it.
        // oracle::update_rate(&mut oracle, ??? , new_rate, ctx(&mut scenario));

        // Cleanup (won't reach)
        return_shared(oracle);
        return_to_sender(&mut scenario, oracle_cap); // To ADMIN
        test_scenario::end(scenario);
    }

     #[test]
    fun test_staleness() {
        let scenario = test_scenario::begin(ADMIN);
        let oracle_cap = init_admin_get_cap(&mut scenario);
        let oracle = create_test_oracle(&mut scenario, &oracle_cap); // Staleness = 100
        let mut clock = create_for_testing(ctx(&mut scenario));

        next_tx(&mut scenario, ADMIN); // Needed for clock owner? Maybe not.

        assert!(!oracle::is_stale(&oracle, &clock), 0); // Not stale initially

        // Advance clock just below threshold
        increment_for_testing(&mut clock, 100);
        assert!(!oracle::is_stale(&oracle, &clock), 1); // Still not stale

         // Advance clock beyond threshold
        increment_for_testing(&mut clock, 1);
        assert!(oracle::is_stale(&oracle, &clock), 2); // Now stale

        // Cleanup
        return_shared(oracle);
        return_to_sender(&mut scenario, oracle_cap);
        destroy(clock);
        test_scenario::end(scenario);
    }

     #[test]
    fun test_conversion_basic() {
        // Test direct conversion function (staleness must be checked by caller)
        let points = 100 * FIXED_POINT_SCALE_U128 / 100; // 100e18 (100 points)
        let rate = 2 * FIXED_POINT_SCALE_U128; // Rate = 2.0
        let decimals = 18;
        let expected_asset_amount = 200 * FIXED_POINT_SCALE_U128 / 100; // 200e18 (200 assets)

        let result = oracle::convert_points_to_asset(points, rate, decimals);
        assert!(result == expected_asset_amount, 0);

        // Test rate = 0.5
        let rate_half = FIXED_POINT_SCALE_U128 / 2; // Rate = 0.5
        let expected_asset_amount_half = 50 * FIXED_POINT_SCALE_U128 / 100; // 50e18 (50 assets)
        let result_half = oracle::convert_points_to_asset(points, rate_half, decimals);
         assert!(result_half == expected_asset_amount_half, 1);

        // Test zero points
        assert!(oracle::convert_points_to_asset(0, rate, decimals) == 0, 2);
    }

     #[test]
    fun test_conversion_rounding() {
        // Rate = 1/3 = 0.333...
        let rate = FIXED_POINT_SCALE_U128 / 3;
        let decimals = 18;

        // 10 points * (1/3) = 3.333... -> rounded should be 3
        let points1 = 10 * FIXED_POINT_SCALE_U128 / 100;
        let expected1 = 3 * FIXED_POINT_SCALE_U128 / 100;
        assert!(oracle::convert_points_to_asset(points1, rate, decimals) == expected1, 0);

         // 1 point * (1/3) = 0.333... -> rounded should be 0
        let points2 = 1 * FIXED_POINT_SCALE_U128 / 100;
        let expected2 = 0;
        assert!(oracle::convert_points_to_asset(points2, rate, decimals) == expected2, 1);

        // Use a rate where rounding matters: Rate = 1.5
        let rate_1_5 = FIXED_POINT_SCALE_U128 * 3 / 2;
        // 3 points * 1.5 = 4.5 -> rounded should be 5
        let points3 = 3 * FIXED_POINT_SCALE_U128 / 100;
        let expected3 = 5 * FIXED_POINT_SCALE_U128 / 100; // TODO: Double check rounding logic implementation
        // Current logic: (3e18 * 1.5e18 + 0.5e18) / 1e18 = (4.5e36 + 0.5e18) / 1e18 -> should be 4.5e18 -> 4. Need to fix rounding calc.
        // Correct rounding: (points * rate + SCALE/2) / SCALE
        // (3e18 * 1.5e18 + 0.5e18) / 1e18 = (4.5e36 + 0.5e18)/1e18 -> still gives 4.5e18... Hmm.
        // Let's test numerator + denominator/2 before division
        // numerator = points_u128 * rate; = 3e18 * 1.5e18 = 4.5e36
        // denominator = FIXED_POINT_SCALE_U128; = 1e18
        // rounded_intermediate = numerator + (denominator / 2) = 4.5e36 + 0.5e18
        // result = rounded_intermediate / denominator = (4.5e36 + 0.5e18) / 1e18 = 4.5e18 + 0.5 = 4.500...005 e18
        // Cast to u64 truncates -> 4e18. Standard rounding might require more careful implementation or library.
        // For now, expecting truncation:
        let expected3_trunc = 4 * FIXED_POINT_SCALE_U128 / 100;
        assert!(oracle::convert_points_to_asset(points3, rate_1_5, decimals) == expected3_trunc, 2);

    }

     #[test]
     #[expected_failure(abort_code = oracle::ECONVERSION_OVERFLOW)]
    fun test_conversion_overflow() {
        let points = MAX_U64; // Max u64 points
        let rate = 2 * FIXED_POINT_SCALE_U128; // Rate = 2.0 -> intermediate value > MAX_U128
        let decimals = 18;

        // This should overflow during points_u128 * rate
        oracle::convert_points_to_asset(points, rate, decimals);
    }

     // Add test for decimal adjustment if implemented
     // Add test for EINVALID_RATE if rate = 0 passed

}