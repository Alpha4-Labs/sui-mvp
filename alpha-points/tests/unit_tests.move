// unit_tests.move - Unit tests for individual module functions
#[test_only]
module alpha_points::alpha_points_unit_tests { // Renamed module

    // === Imports ===
    use sui::clock::Clock;
    // Removed unnecessary aliases
    
    // Import specific functions via module accessors instead of direct imports
    // Use public getters for constants
    
    // Ledger module
    use alpha_points::ledger;
    
    // Stake position module
    use alpha_points::stake_position;
    
    // Oracle module
    use alpha_points::oracle;
    
    // Loan module
    use alpha_points::loan;

    // === Test Constants ===
    // Only define test addresses
    #[allow(unused_const)]
    const DUMMY_ADDR_1: address = @0xAAA;

    // Define dummy asset type within the test module
    public struct USDC has store, drop {} // Needs public for use in other module struct tests

    // === Ledger Unit Tests ===
    #[test]
    fun test_runner_discovery() { assert!(true, 0); }

    #[test]
    fun test_ledger_calculate_points() {
        let principal = 1000; // u64
        // Not using this variable, but kept for clarity
        let _fixed_point_scale = ledger::fixed_point_scale();
        
        // Use u64 values that don't require explicit conversion from constants
        let participation = 1000000000000000000; // 1 in fixed point
        let time_weight = 1000000000000000000; // 1 in fixed point
        let liquidity_dom = 1000000000000000000; // 1 in fixed point

        // Calculate points
        let points1 = ledger::calculate_points(principal, participation, time_weight, liquidity_dom);
        assert!(points1 == 1000, 0); // principal * 1 * 1 / 1 = principal

        // Test with participation = 2
        let participation2 = participation * 2;
        let points2 = ledger::calculate_points(principal, participation2, time_weight, liquidity_dom);
        assert!(points2 == 2000, 1); // principal * 2 * 1 / 1 = principal * 2

        // Test with time_weight = 5
        let time_weight5 = time_weight * 5;
        let points3 = ledger::calculate_points(principal, participation, time_weight5, liquidity_dom);
        assert!(points3 == 5000, 2); // principal * 1 * 5 / 1 = principal * 5

        // Test with liquidity_dom = 4
        let liquidity_dom4 = liquidity_dom * 4;
        let points4 = ledger::calculate_points(principal, participation, time_weight, liquidity_dom4);
        assert!(points4 == 250, 3); // principal * 1 * 1 / 4 = principal / 4

        // Test with all factors combined
        let points5 = ledger::calculate_points(principal, participation2, time_weight5, liquidity_dom4);
        assert!(points5 == 2500, 4); // principal * 2 * 5 / 4 = principal * 10 / 4
    }

    #[test]
    #[expected_failure(abort_code = 5)] // Use numeric code instead of function call
    fun test_ledger_calculate_points_fail_zero_input() {
        ledger::calculate_points(100, 0, 1, 1);
    }

    #[test]
    #[expected_failure(abort_code = 6)] // Use numeric code instead of function call
    fun test_ledger_calculate_points_fail_overflow() {
        // Create values that would cause overflow
        let principal = 18446744073709551615; // Max u64
        let participation = 1000000000000000000; // 1 in fixed point
        let time_weight = 1000000000000000000 * 10; // 10 in fixed point
        let liquidity_dom = 1000000000000000000 / 10; // 0.1 in fixed point
        
        // This should overflow
        ledger::calculate_points(principal, participation, time_weight, liquidity_dom);
    }

    // === Oracle Unit Tests ===
    #[test]
    fun test_oracle_convert_points_to_asset() {
        // Use values rather than constants for tests
        let rate_1 = 1000000000000000000; // 1.0 in fixed point
        let rate_2 = 2000000000000000000; // 2.0 in fixed point
        let rate_half = 500000000000000000; // 0.5 in fixed point
        let rate_third = 333333333333333333; // ~0.33 in fixed point
        let rate_1_5 = 1500000000000000000; // 1.5 in fixed point
        let decimals = 18;

        assert!(oracle::convert_points_to_asset(100, rate_1, decimals) == 100, 0);
        assert!(oracle::convert_points_to_asset(100, rate_2, decimals) == 200, 1);
        assert!(oracle::convert_points_to_asset(100, rate_half, decimals) == 50, 2);
        assert!(oracle::convert_points_to_asset(10, rate_third, decimals) == 3, 3);
        assert!(oracle::convert_points_to_asset(1, rate_third, decimals) == 0, 4);
        assert!(oracle::convert_points_to_asset(3, rate_1_5, decimals) == 5, 5); // Rounding
        assert!(oracle::convert_points_to_asset(0, rate_1, decimals) == 0, 6);
    }

    #[test]
    #[expected_failure(abort_code = 6)] // Use numeric code instead of function call
    fun test_oracle_convert_points_overflow() {
        let points = 18446744073709551615; // Max u64
        let rate = 2000000000000000000; // 2.0 in fixed point
        oracle::convert_points_to_asset(points, rate, 18);
    }
}