#[test_only]
module alpha_points::admin_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};

    use alpha_points::admin::{
        Self, Config, GovernCap, OracleCap, EProtocolPaused,
        create_test_govern_cap, destroy_test_govern_cap
        // Assume OracleCap helpers are also imported if needed
    };

    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;

    #[test]
    fun test_admin_init() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            assert_eq(admin::is_paused(&config), false);
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(config);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_set_pause_state() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            admin::set_pause_state(&mut config, &govern_cap, true, ctx);
            assert_eq(admin::is_paused(&config), true);
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            admin::set_pause_state(&mut config, &govern_cap, false, ctx);
            assert_eq(admin::is_paused(&config), false);
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure]
    fun test_set_pause_state_unauthorized() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let real_govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(real_govern_cap, USER_ADDR);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let mut config = ts::take_shared<Config>(&scenario);
            let fake_govern_cap;
            {
                let ctx = ts::ctx(&mut scenario);
                fake_govern_cap = admin::create_test_govern_cap(ctx);
            };
            {
                let ctx = ts::ctx(&mut scenario);
                admin::set_pause_state(&mut config, &fake_govern_cap, true, ctx); // Should abort
            };
            // Cleanup (won't execute)
            admin::destroy_test_govern_cap(fake_govern_cap);
            ts::return_shared(config);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_assert_not_paused() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            admin::assert_not_paused(&config);
            ts::return_shared(config);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            admin::set_pause_state(&mut config, &govern_cap, true, ctx);
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EProtocolPaused)]
    fun test_assert_not_paused_when_paused() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            admin::set_pause_state(&mut config, &govern_cap, true, ctx);
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            admin::assert_not_paused(&config); // Should abort here
            // E06001 Fix: No change needed. 'config' is not returned because the
            // function aborts above this line, as expected. The test framework
            // handles cleanup in expected failure cases. If the test *didn't*
            // abort, then ts::end(scenario) would error because 'config' wasn't returned.
            // ts::return_shared(config); // This line is unreachable.
        };
        ts::end(scenario);
    }

    #[test]
    fun test_transfer_govern_cap() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap_auth = ts::take_from_sender<GovernCap>(&scenario);
            let govern_cap_to_transfer = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            admin::transfer_govern_cap(&govern_cap_auth, govern_cap_to_transfer, USER_ADDR, ctx);
            ts::return_to_sender(&scenario, govern_cap_auth);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_transfer_oracle_cap() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap_to_transfer = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            admin::transfer_oracle_cap(&govern_cap, oracle_cap_to_transfer, USER_ADDR, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            ts::return_to_sender(&scenario, oracle_cap);
        };
        ts::end(scenario);
    }
}