#[test_only]
module alpha_points::admin_tests {
    use sui::test_scenario as ts;
    use sui::test_utils::assert_eq;
    use sui::transfer;
    
    use alpha_points::admin::{Self, Config, GovernCap, OracleCap};
    
    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    
    #[test]
    fun test_admin_init() {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Verify that caps were sent to admin and config was created with expected state
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            // Admin should have both caps
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            
            // Config should exist as shared object
            let config = ts::take_shared<Config>(&scenario);
            
            // Verify config is not paused initially
            assert_eq(admin::is_paused(&config), false);
            
            // Return objects to scenario
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_to_sender(&scenario, oracle_cap);
            ts::return_shared(config);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_set_pause_state() {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Set pause state to true
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            admin::set_pause_state(&mut config, &govern_cap, true, ctx);
            
            // Verify config is now paused
            assert_eq(admin::is_paused(&config), true);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        
        // Set pause state back to false
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            admin::set_pause_state(&mut config, &govern_cap, false, ctx);
            
            // Verify config is not paused
            assert_eq(admin::is_paused(&config), false);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure]
    fun test_set_pause_state_unauthorized() {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Transfer govern cap to USER_ADDR
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(govern_cap, USER_ADDR);
        };
        
        // Admin tries to set pause state without govern cap - should fail
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let fake_govern_cap = ts::take_from_address<GovernCap>(&scenario, USER_ADDR);
            let ctx = ts::ctx(&mut scenario);
            
            // This should fail since we're trying to use someone else's govern cap
            admin::set_pause_state(&mut config, &fake_govern_cap, true, ctx);
            
            ts::return_shared(config);
            ts::return_to_address(USER_ADDR, fake_govern_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_assert_not_paused() {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Test assert_not_paused when not paused - should pass
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            
            // Should not abort
            admin::assert_not_paused(&config);
            
            ts::return_shared(config);
        };
        
        // Set pause state to true
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            admin::set_pause_state(&mut config, &govern_cap, true, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure(abort_code = admin::EProtocolPaused)]
    fun test_assert_not_paused_when_paused() {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Set pause state to true
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            admin::set_pause_state(&mut config, &govern_cap, true, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(config);
        };
        
        // Test assert_not_paused when paused - should abort
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            
            // Should abort with EProtocolPaused
            admin::assert_not_paused(&config);
            
            ts::return_shared(config);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_transfer_govern_cap() {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Transfer govern cap using the proper function
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            admin::transfer_govern_cap(&govern_cap, govern_cap, USER_ADDR, ctx);
        };
        
        // Verify USER_ADDR now has the govern cap
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_transfer_oracle_cap() {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Transfer oracle cap using the proper function
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            admin::transfer_oracle_cap(&govern_cap, oracle_cap, USER_ADDR, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Verify USER_ADDR now has the oracle cap
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        ts::end(scenario);
    }
}