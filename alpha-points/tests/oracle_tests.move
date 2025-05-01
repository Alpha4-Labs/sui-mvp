#[test_only]
module alpha_points::oracle_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::tx_context::{Self, TxContext};

    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::admin::{Self, GovernCap, OracleCap, create_test_oracle_cap, destroy_test_oracle_cap};

    const ADMIN_ADDR: address = @0xAD;
    const ORACLE_ADDR: address = @0xB;
    const USER_ADDR: address = @0xC;

    const INITIAL_RATE: u128 = 1000000000;
    const DECIMALS: u8 = 9;
    const STALENESS_THRESHOLD: u64 = 10;

    fun setup_test(): (Scenario, Clock) {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        (scenario, clock)
    }

    #[test]
    fun test_create_oracle() {
        let (mut scenario, clock) = setup_test();
        
        // First transfer the oracle cap to the oracle address
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Create the oracle
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Verify the oracle
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            
            let (rate, dec) = oracle::get_rate(&oracle);
            assert_eq(rate, INITIAL_RATE);
            assert_eq(dec, DECIMALS);
            
            // The oracle is fresh at creation, but hasn't been updated yet
            // Since we set last_update_epoch to 0 initially, it should be stale
            let is_stale = oracle::is_stale(&oracle, &clock);
            assert_eq(is_stale, true);
            
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_update_rate() {
        let (mut scenario, clock) = setup_test();
        
        // First transfer the oracle cap to the oracle address
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Create the oracle
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Update the rate - use separate transactions to avoid borrow conflicts
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            // First take the oracle cap
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            // Then take the shared oracle
            let mut oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Calculate new rate
            let new_rate = INITIAL_RATE + (INITIAL_RATE / 5); // 20% increase
            
            // Now get the context
            let ctx = ts::ctx(&mut scenario);
            
            // Update the rate
            oracle::update_rate(&mut oracle, &oracle_cap, new_rate, ctx);
            
            // Verify the rate was updated
            let (rate, _) = oracle::get_rate(&oracle);
            assert_eq(rate, new_rate);
            
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0)]
    fun test_update_rate_unauthorized() {
        let (mut scenario, clock) = setup_test();
        
        // First create the oracle with a regular OracleCap
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Then attempt to update with a fake cap
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            // Create a fake cap first
            let ctx = ts::ctx(&mut scenario);
            let fake_oracle_cap = create_test_oracle_cap(ctx);
            
            // Start a new transaction to avoid borrow conflicts
            ts::next_tx(&mut scenario, USER_ADDR);
            {
                // Take the shared oracle
                let mut oracle = ts::take_shared<RateOracle>(&scenario);
                // Get the context
                let ctx = ts::ctx(&mut scenario);
                
                // Try to update the oracle with the fake cap (should fail)
                oracle::update_rate(&mut oracle, &fake_oracle_cap, INITIAL_RATE * 2, ctx);
                
                // These won't execute if the test fails as expected
                ts::return_shared(oracle);
            };
            
            // Cleanup in a separate transaction
            ts::next_tx(&mut scenario, USER_ADDR);
            {
                destroy_test_oracle_cap(fake_oracle_cap);
            };
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_update_staleness_threshold() {
        let (mut scenario, clock) = setup_test();
        
        // First transfer the oracle cap to the oracle address
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        
        // Create the oracle
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Update the staleness threshold - use separate transactions
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            // First take the oracle cap
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            // Then take the shared oracle
            let mut oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Prepare the new threshold
            let new_threshold = STALENESS_THRESHOLD * 2;
            
            // Get context
            let ctx = ts::ctx(&mut scenario);
            
            // Update the threshold
            oracle::update_staleness_threshold(&mut oracle, &oracle_cap, new_threshold, ctx);
            
            // Verify the threshold was updated
            assert_eq(oracle::get_staleness_threshold(&oracle), new_threshold);
            
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_is_stale() {
        let (mut scenario, mut clock) = setup_test();
        
        // Create the oracle
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Initialize clock to a known value
        clock::set_for_testing(&mut clock, 86400000); // 1 day in milliseconds
        
        // Update the rate to establish a last_update_epoch
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            // Take objects in order: oracle_cap, oracle, get ctx
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let mut oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Get context in a separate step
            let ctx = ts::ctx(&mut scenario);
            
            // Update the rate
            oracle::update_rate(&mut oracle, &oracle_cap, INITIAL_RATE, ctx);
            
            // Check if stale
            let is_stale = oracle::is_stale(&oracle, &clock);
            assert_eq(is_stale, false);
            
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        
        // Advance time within the staleness threshold
        clock::increment_for_testing(&mut clock, (STALENESS_THRESHOLD / 2) * 86400000);
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Should still be fresh since we're within the threshold
            let is_stale = oracle::is_stale(&oracle, &clock);
            assert_eq(is_stale, false);
            
            ts::return_shared(oracle);
        };
        
        // Advance time beyond the threshold (should be stale)
        clock::increment_for_testing(&mut clock, (STALENESS_THRESHOLD + 1) * 86400000);
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Should now be stale
            let is_stale = oracle::is_stale(&oracle, &clock);
            assert_eq(is_stale, true);
            
            ts::return_shared(oracle);
        };
        
        // Update again to reset staleness
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            // Take objects in order: oracle_cap, oracle, get ctx
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let mut oracle = ts::take_shared<RateOracle>(&scenario);
            
            // Get context
            let ctx = ts::ctx(&mut scenario);
            
            // Update the rate
            oracle::update_rate(&mut oracle, &oracle_cap, INITIAL_RATE, ctx);
            
            // Check staleness - should be fresh again
            let is_stale = oracle::is_stale(&oracle, &clock);
            assert_eq(is_stale, false);
            
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_conversion_functions() {
        let (mut scenario, clock) = setup_test();
        
        // Test points to asset conversion
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let points = 1000;
            let rate_p2a = 500000000; // 0.5 with 9 decimals
            let decimals = 9;
            
            let asset_amount = oracle::convert_points_to_asset(points, rate_p2a, decimals);
            assert_eq(asset_amount, 500); // 1000 points * 0.5 = 500 assets
            
            // Test asset to points conversion
            let asset = 500;
            let rate_a2p = 2000000000; // 2.0 with 9 decimals
            
            let points_amount = oracle::convert_asset_to_points(asset, rate_a2p, decimals);
            assert_eq(points_amount, 250); // 500 assets * (1/2.0) = 250 points
            
            // Test with zero inputs
            assert_eq(oracle::convert_points_to_asset(0, rate_p2a, decimals), 0);
            assert_eq(oracle::convert_asset_to_points(0, rate_a2p, decimals), 0);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}