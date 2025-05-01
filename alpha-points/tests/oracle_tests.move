#[test_only]
module alpha_points::oracle_tests {
    use sui::test_scenario as ts;
    use sui::test_utils::assert_eq;
    use sui::transfer;
    use sui::clock::{Self, Clock};
    
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::admin::{Self, GovernCap, OracleCap};
    
    const ADMIN_ADDR: address = @0xAD;
    const ORACLE_ADDR: address = @0xB;
    
    const INITIAL_RATE: u128 = 1000000000; // 1.0 with 9 decimals
    const DECIMALS: u8 = 9;
    const STALENESS_THRESHOLD: u64 = 10; // 10 epochs
    
    // Helper function to set up a test scenario with initialized modules
    fun setup_test(): (ts::Scenario, Clock) {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module first to get caps
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Create a test clock
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        
        (scenario, clock)
    }
    
    #[test]
    fun test_create_oracle() {
        let (scenario, clock) = setup_test();
        
        // Transfer oracle cap to dedicated oracle address
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Create an oracle
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, 
                INITIAL_RATE, 
                DECIMALS, 
                STALENESS_THRESHOLD, 
                ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Verify oracle was created properly
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Check initial values
            let (rate, dec) = oracle::get_rate(&oracle);
            assert_eq(rate, INITIAL_RATE);
            assert_eq(dec, DECIMALS);
            
            // Should not be stale initially
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_update_rate() {
        let (scenario, clock) = setup_test();
        
        // Transfer oracle cap to dedicated oracle address
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Create an oracle
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, 
                INITIAL_RATE, 
                DECIMALS, 
                STALENESS_THRESHOLD, 
                ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Update the rate
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // New rate is 20% higher
            let new_rate = INITIAL_RATE + (INITIAL_RATE / 5);
            oracle::update_rate(&mut oracle, &oracle_cap, new_rate, ctx);
            
            // Verify rate was updated
            let (rate, _) = oracle::get_rate(&oracle);
            assert_eq(rate, new_rate);
            
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure]
    fun test_update_rate_unauthorized() {
        let (scenario, clock) = setup_test();
        
        // Create an oracle with admin's oracle cap
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, 
                INITIAL_RATE, 
                DECIMALS, 
                STALENESS_THRESHOLD, 
                ctx
            );
            
            // Transfer oracle cap to dedicated oracle address
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Try to update rate with govern cap instead of oracle cap - should fail
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // This will fail - we're incorrectly using govern_cap as oracle_cap
            let new_rate = INITIAL_RATE + (INITIAL_RATE / 5);
            oracle::update_rate(&mut oracle, &govern_cap, new_rate, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_update_staleness_threshold() {
        let (scenario, clock) = setup_test();
        
        // Transfer oracle cap to dedicated oracle address
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Create an oracle
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, 
                INITIAL_RATE, 
                DECIMALS, 
                STALENESS_THRESHOLD, 
                ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Update the staleness threshold
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Double the threshold
            let new_threshold = STALENESS_THRESHOLD * 2;
            oracle::update_staleness_threshold(&mut oracle, &oracle_cap, new_threshold, ctx);
            
            // Verify threshold was updated
            assert_eq(oracle::get_staleness_threshold(&oracle), new_threshold);
            
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_is_stale() {
        let (scenario, clock) = setup_test();
        
        // Transfer oracle cap to dedicated oracle address
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Create an oracle
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, 
                INITIAL_RATE, 
                DECIMALS, 
                STALENESS_THRESHOLD, 
                ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Check freshness initially
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Should not be stale initially
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            
            ts::return_shared(oracle);
        };
        
        // Advance clock by less than threshold
        clock::increment_for_testing(&mut clock, STALENESS_THRESHOLD / 2);
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Should still not be stale
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            
            ts::return_shared(oracle);
        };
        
        // Advance clock beyond threshold
        clock::increment_for_testing(&mut clock, STALENESS_THRESHOLD);
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Should now be stale
            assert_eq(oracle::is_stale(&oracle, &clock), true);
            
            ts::return_shared(oracle);
        };
        
        // Update the rate to reset the staleness
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::update_rate(&mut oracle, &oracle_cap, INITIAL_RATE, ctx);
            
            // Should no longer be stale
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_conversion_functions() {
        let (scenario, clock) = setup_test();
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            // Test converting points to asset
            let points = 1000;
            let rate = 500000000; // 0.5 with 9 decimals
            let decimals = 9;
            
            // 1000 points * 0.5 = 500 asset units
            let asset_amount = oracle::convert_points_to_asset(points, rate, decimals);
            assert_eq(asset_amount, 500);
            
            // Test converting asset to points
            let asset = 500;
            let rate = 2000000000; // 2.0 with 9 decimals
            
            // 500 asset * 2.0 = 1000 points
            let points_amount = oracle::convert_asset_to_points(asset, rate, decimals);
            assert_eq(points_amount, 1000);
            
            // Test with zero values
            assert_eq(oracle::convert_points_to_asset(0, rate, decimals), 0);
            assert_eq(oracle::convert_asset_to_points(0, rate, decimals), 0);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}