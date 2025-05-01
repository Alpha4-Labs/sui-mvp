#[test_only]
module alpha_points::oracle_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::object;
    use sui::tx_context::{Self, TxContext};

    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::admin::{Self, GovernCap, OracleCap, create_test_oracle_cap, destroy_test_oracle_cap};

    const ADMIN_ADDR: address = @0xAD;
    const ORACLE_ADDR: address = @0xB;

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
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            ts::return_to_sender(&scenario, oracle_cap);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let (rate, dec) = oracle::get_rate(&oracle);
            assert_eq(rate, INITIAL_RATE);
            assert_eq(dec, DECIMALS);
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            ts::return_shared(oracle);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_update_rate() {
        let (mut scenario, clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            ts::return_to_sender(&scenario, oracle_cap);
        };
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let mut oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let new_rate = INITIAL_RATE + (INITIAL_RATE / 5);
            oracle::update_rate(&mut oracle, &oracle_cap, new_rate, ctx);
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
       let (mut scenario, clock) = setup_test();
       // Create oracle with the real cap held by ADMIN
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
           { // Scope ctx borrow
                let ctx = ts::ctx(&mut scenario);
                oracle::create_oracle(&oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx);
           }; // ctx borrow ends
           ts::return_to_sender(&scenario, oracle_cap); // Keep the real cap
       };

       // Create a temporary, distinct OracleCap for ADMIN
       let temp_oracle_cap;
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           { // Scope ctx borrow
                let ctx = ts::ctx(&mut scenario);
                temp_oracle_cap = admin::create_test_oracle_cap(ctx);
           };
       };

       // Try to update rate using the temporary cap
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           let mut oracle = ts::take_shared<RateOracle>(&scenario);
           let ctx = ts::ctx(&mut scenario);
           let new_rate = INITIAL_RATE + (INITIAL_RATE / 5);
           oracle::update_rate(&mut oracle, &temp_oracle_cap, new_rate, ctx); // Should abort here
           // Cleanup (won't execute)
           ts::return_shared(oracle);
       };

       // Cleanup the temporary cap *after* the failing transaction
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           admin::destroy_test_oracle_cap(temp_oracle_cap);
       };

       clock::destroy_for_testing(clock);
       ts::end(scenario);
   }

    #[test]
    fun test_update_staleness_threshold() {
        let (mut scenario, clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            oracle::create_oracle(
                &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
            );
            ts::return_to_sender(&scenario, oracle_cap);
        };
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let mut oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let new_threshold = STALENESS_THRESHOLD * 2;
            oracle::update_staleness_threshold(&mut oracle, &oracle_cap, new_threshold, ctx);
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
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };
        // Create oracle and update rate once
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let mut oracle; // Declare outside block
            { // Scope ctx for create
                let ctx = ts::ctx(&mut scenario);
                oracle::create_oracle(
                    &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
                );
            }; // ctx borrow for create ends

            // E07001 Fix: Separate take_shared and update_rate into block after create ctx ends
            { // Scope ctx for update
                let ctx = ts::ctx(&mut scenario);
                oracle = ts::take_shared<RateOracle>(&scenario); // Take shared object
                oracle::update_rate(&mut oracle, &oracle_cap, INITIAL_RATE, ctx); // Update within new ctx scope
            }; // ctx borrow for update ends

            ts::return_shared(oracle); // Return modified shared obj
            ts::return_to_sender(&scenario, oracle_cap);
        };
        // Check freshness right after update
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            ts::return_shared(oracle);
        };
        // Advance clock less than threshold (ms)
        clock::increment_for_testing(&mut clock, (STALENESS_THRESHOLD / 2) * 86400000);
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            ts::return_shared(oracle);
        };
        // Advance clock beyond threshold (ms)
        clock::increment_for_testing(&mut clock, STALENESS_THRESHOLD * 86400000);
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            assert_eq(oracle::is_stale(&oracle, &clock), true);
            ts::return_shared(oracle);
        };
        // Update rate to reset staleness
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let mut oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            oracle::update_rate(&mut oracle, &oracle_cap, INITIAL_RATE, ctx);
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_conversion_functions() {
        let (mut scenario, clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let points = 1000;
            let rate_p2a = 500000000;
            let decimals = 9;
            let asset_amount = oracle::convert_points_to_asset(points, rate_p2a, decimals);
            assert_eq(asset_amount, 500);

            let asset = 500;
            let rate_a2p = 2000000000;
            let points_amount = oracle::convert_asset_to_points(asset, rate_a2p, decimals);
            assert_eq(points_amount, 250);

            assert_eq(oracle::convert_points_to_asset(0, rate_p2a, decimals), 0);
            assert_eq(oracle::convert_asset_to_points(0, rate_a2p, decimals), 0);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}