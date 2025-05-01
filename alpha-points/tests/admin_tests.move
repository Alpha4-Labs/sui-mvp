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
        // Assuming OracleCap helpers are also imported if needed
    };

    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;

    // Test helpers moved to sources/admin.move

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
        // Set pause state to true
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
        // Set pause state back to false
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

        let fake_govern_cap; // Declare outside tx block
        ts::next_tx(&mut scenario, ADMIN_ADDR); // Create fake cap in separate tx
        {
             let ctx = ts::ctx(&mut scenario);
             fake_govern_cap = admin::create_test_govern_cap(ctx);
             // Don't return, use in next tx
        };

        ts::next_tx(&mut scenario, ADMIN_ADDR); // Attempt the unauthorized call
        {
            let mut config = ts::take_shared<Config>(&scenario);
            { // Scope ctx borrow
                let ctx = ts::ctx(&mut scenario);
                admin::set_pause_state(&mut config, &fake_govern_cap, true, ctx); // Should abort here
            }; // ctx borrow ends
            // Cleanup (won't execute if abort occurs as expected)
            ts::return_shared(config); // Return config if it didn't abort
        };

        // Cleanup the temporary cap *after* the transaction where it was used
       ts::next_tx(&mut scenario, ADMIN_ADDR);
       {
           admin::destroy_test_govern_cap(fake_govern_cap);
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

            // E06001 Fix: Return config *after* the call that should abort.
            // This line satisfies the compiler check for non-aborting paths,
            // even though it's unreachable if the test works correctly.
            ts::return_shared(config);
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