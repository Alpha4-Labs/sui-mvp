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
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
           { let ctx = ts::ctx(&mut scenario);
               oracle::create_oracle(&oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx); };
           ts::return_to_sender(&scenario, oracle_cap);
       };
       let temp_oracle_cap;
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           { let ctx = ts::ctx(&mut scenario);
               temp_oracle_cap = admin::create_test_oracle_cap(ctx); };
       };
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           let mut oracle = ts::take_shared<RateOracle>(&scenario);
           let ctx = ts::ctx(&mut scenario);
           let new_rate = INITIAL_RATE + (INITIAL_RATE / 5);
           oracle::update_rate(&mut oracle, &temp_oracle_cap, new_rate, ctx); // Should abort here
           ts::return_shared(oracle);
       };
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
        let (mut scenario, mut clock) = setup_test(); // Both need mutability
        // Transfer the real OracleCap to ORACLE_ADDR
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            transfer::public_transfer(oracle_cap, ORACLE_ADDR);
        };

        // Create the oracle (needs ctx)
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            { // Scope ctx borrow for create
                let ctx = ts::ctx(&mut scenario);
                oracle::create_oracle(
                    &oracle_cap, INITIAL_RATE, DECIMALS, STALENESS_THRESHOLD, ctx
                );
            }; // ctx borrow ends
            ts::return_to_sender(&scenario, oracle_cap);
        };

        // Update the rate once to set last_update_epoch (needs ctx)
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
             let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
             // E07001 Fix: take_shared happens *before* ctx borrow in this block
             let mut oracle = ts::take_shared<RateOracle>(&scenario);
             { // Scope ctx borrow for update
                 let ctx = ts::ctx(&mut scenario);
                 oracle::update_rate(&mut oracle, &oracle_cap, INITIAL_RATE, ctx);
             }; // ctx borrow ends
             ts::return_shared(oracle); // Return modified shared obj
             ts::return_to_sender(&scenario, oracle_cap);
        };

        // Check freshness right after update (no ctx needed)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario); // Immutable borrow ok
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            ts::return_shared(oracle);
        };

        // Advance clock less than threshold (ms)
        clock::increment_for_testing(&mut clock, (STALENESS_THRESHOLD / 2) * 86400000);

        // Check freshness again (no ctx needed)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            ts::return_shared(oracle);
        };

        // Advance clock beyond threshold (ms)
        clock::increment_for_testing(&mut clock, STALENESS_THRESHOLD * 86400000);

        // Check staleness (no ctx needed)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let oracle = ts::take_shared<RateOracle>(&scenario);
            assert_eq(oracle::is_stale(&oracle, &clock), true);
            ts::return_shared(oracle);
        };

        // Update rate to reset staleness (needs ctx)
        ts::next_tx(&mut scenario, ORACLE_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let mut oracle = ts::take_shared<RateOracle>(&scenario); // take shared before ctx
            { // scope ctx borrow
                let ctx = ts::ctx(&mut scenario);
                oracle::update_rate(&mut oracle, &oracle_cap, INITIAL_RATE, ctx);
            }; // ctx borrow ends
            assert_eq(oracle::is_stale(&oracle, &clock), false);
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(oracle);
        };

        clock::destroy_for_testing(clock); // Destroy clock
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