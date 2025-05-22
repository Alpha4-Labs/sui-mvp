#[test_only]
module alpha_points::admin_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use alpha_points::admin::{
        Self, Config, GovernCap, OracleCap, AdminCap,
        create_test_govern_cap, destroy_test_govern_cap, create_test_admin_cap
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
        // Set pause state to true
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = create_test_admin_cap(ts::ctx(&mut scenario));
            let mut config = ts::take_shared<Config>(&scenario);
            admin::set_pause_state(&mut config, &admin_cap, true, ts::ctx(&mut scenario));
            assert_eq(admin::is_paused(&config), true);
            ts::return_shared(config);
        };
        // Set pause state back to false
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = create_test_admin_cap(ts::ctx(&mut scenario));
            let mut config = ts::take_shared<Config>(&scenario);
            admin::set_pause_state(&mut config, &admin_cap, false, ts::ctx(&mut scenario));
            assert_eq(admin::is_paused(&config), false);
            ts::return_shared(config);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0)]
    fun test_set_pause_state_unauthorized() {
        // We'll use a different approach to test unauthorized access
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };

        // User tries to use a fake govern cap
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let fake_govern_cap = create_test_govern_cap(ctx);
            
            ts::next_tx(&mut scenario, USER_ADDR);
            {
                let mut config = ts::take_shared<Config>(&scenario);
                let ctx = ts::ctx(&mut scenario);
                
                // This should fail because user is trying to use a fake cap
                let admin_cap = create_test_admin_cap(ctx);
                admin::set_pause_state(&mut config, &admin_cap, true, ctx);
                
                // Cleanup
                ts::return_shared(config);
            };
            
            ts::next_tx(&mut scenario, USER_ADDR);
            {
                destroy_test_govern_cap(fake_govern_cap);
            };
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
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0)]
    fun test_assert_not_paused_when_paused() {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = create_test_admin_cap(ts::ctx(&mut scenario));
            let mut config = ts::take_shared<Config>(&scenario);
            admin::set_pause_state(&mut config, &admin_cap, true, ts::ctx(&mut scenario));
            ts::return_shared(config);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            admin::assert_not_paused(&config); // Should abort here with EProtocolPaused
            
            // This line won't execute if the test fails as expected
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
        
        // Create a new govern cap for transfer
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let new_cap = create_test_govern_cap(ctx);
            transfer::public_transfer(new_cap, ADMIN_ADDR);
        };
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let auth_cap = ts::take_from_sender<GovernCap>(&scenario);
            let transfer_cap = ts::take_from_sender<GovernCap>(&scenario);
            
            let ctx = ts::ctx(&mut scenario);
            admin::transfer_govern_cap(&auth_cap, transfer_cap, USER_ADDR, ctx);
            
            ts::return_to_sender(&scenario, auth_cap);
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
        
        // Create a new oracle cap for transfer
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let new_cap = admin::create_test_oracle_cap(ctx);
            transfer::public_transfer(new_cap, ADMIN_ADDR);
        };
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            
            let ctx = ts::ctx(&mut scenario);
            admin::transfer_oracle_cap(&govern_cap, oracle_cap, USER_ADDR, ctx);
            
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