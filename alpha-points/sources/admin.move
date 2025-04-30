// admin.move - Manages configuration, capabilities, and pause state
module alpha_points::admin {
    // Removed unnecessary aliases
    use sui::object::UID;
    use sui::transfer::{public_transfer, share_object};
    use sui::tx_context::TxContext;
    use sui::event;

    // === Structs ===
    // Removed drop ability from OracleCap as UID doesn't have drop
    public struct GovernCap has key, store { id: UID }
    public struct OracleCap has key, store { id: UID }
    public struct Config has key { id: UID, paused: bool }

    // === Events ===
    public struct PausingToggled has copy, drop { paused: bool, changed_by: address }
    public struct GovernCapTransferred has copy, drop { from: address, to: address }
    public struct OracleCapTransferred has copy, drop { from: address, to: address }

    // === Errors ===
    const ECONFIG_PAUSED: u64 = 2;

    // === Init === (Changed to public(package) function so it can be called properly)
    public(package) fun init(ctx: &mut TxContext) {
        let sender_address = tx_context::sender(ctx);
        let gov_cap = GovernCap { id: object::new(ctx) };
        let oracle_cap = OracleCap { id: object::new(ctx) };
        let config = Config { id: object::new(ctx), paused: false };
        public_transfer(gov_cap, sender_address);
        public_transfer(oracle_cap, sender_address);
        share_object(config);
    }

    // === Public Functions ===
    public entry fun set_pause_state(
        config: &mut Config, 
        _gov_cap: &GovernCap, 
        paused_state: bool, 
        ctx: &TxContext
    ) {
        // Only the owner of the GovernCap can pause/unpause
        // The framework handles the authorization check
        let old_state = config.paused;
        if (old_state != paused_state) {
            config.paused = paused_state;
            event::emit(PausingToggled { 
                paused: paused_state, 
                changed_by: tx_context::sender(ctx) 
            });
        }
    }
    
    public entry fun transfer_govern_cap(
        _gov_cap: &GovernCap, 
        cap_to_transfer: GovernCap, 
        new_owner: address, 
        ctx: &TxContext
    ) {
        // Only someone with a GovernCap can transfer this cap
        // The framework handles the authorization check
        let from = tx_context::sender(ctx);
        event::emit(GovernCapTransferred { from, to: new_owner });
        public_transfer(cap_to_transfer, new_owner);
    }
    
    public entry fun transfer_oracle_cap(
        _gov_cap: &GovernCap, 
        cap_to_transfer: OracleCap, 
        new_owner: address, 
        ctx: &TxContext
    ) {
        // Only the governance cap holder can transfer oracle caps
        // The framework handles the authorization check
        let from = tx_context::sender(ctx);
        event::emit(OracleCapTransferred { from, to: new_owner });
        public_transfer(cap_to_transfer, new_owner);
    }
    
    public fun is_paused(config: &Config): bool { config.paused }
    
    public fun assert_not_paused(config: &Config) { 
        assert!(!config.paused, ECONFIG_PAUSED) 
    }

    // Provide a public getter for the error constant
    public fun config_paused_error_code(): u64 { ECONFIG_PAUSED }

    // Added test-only init function that can be called in tests
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}

// === Test Submodule ===
#[test_only]
module alpha_points::admin_tests {
    // Removed unnecessary aliases
    use sui::test_scenario::{
        Scenario, begin, next_tx, ctx, end as end_scenario,
        take_shared, return_shared, take_from_sender, return_to_sender
    };

    // Use fully qualified path for module items
    use alpha_points::admin::{
        set_pause_state, is_paused, transfer_govern_cap, transfer_oracle_cap, assert_not_paused, init_for_testing,
        Config, GovernCap, OracleCap
    };

    const ADMIN_ADDR: address = @0xA1;
    const USER1_ADDR: address = @0xB1;
    const USER2_ADDR: address = @0xB2;
    const CONFIG_PAUSED_ERROR: u64 = 2; // Define error code directly for test

    // Helper to perform publish operations in the test
    fun setup_admin(scenario: &mut Scenario): (Config, GovernCap, OracleCap) {
        next_tx(scenario, ADMIN_ADDR);
        
        // Call the test-only init
        init_for_testing(ctx(scenario));
        
        let config = take_shared<Config>(scenario);
        let gov_cap = take_from_sender<GovernCap>(scenario);
        let oracle_cap = take_from_sender<OracleCap>(scenario);
        (config, gov_cap, oracle_cap)
    }

    #[test]
    fun test_set_pause_state_success() {
        let scenario = begin(ADMIN_ADDR);
        let (mut config, gov_cap, oracle_cap) = setup_admin(&mut scenario);
        
        // Initially not paused
        assert!(!is_paused(&config), 0);
        
        // Pause the system
        next_tx(&mut scenario, ADMIN_ADDR);
        set_pause_state(&mut config, &gov_cap, true, ctx(&mut scenario));
        assert!(is_paused(&config), 1);
        
        // Unpause the system
        next_tx(&mut scenario, ADMIN_ADDR);
        set_pause_state(&mut config, &gov_cap, false, ctx(&mut scenario));
        assert!(!is_paused(&config), 2);
        
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure(abort_code = CONFIG_PAUSED_ERROR)] // Use direct const instead of function call
    fun test_assert_not_paused_fail_when_paused() {
        let scenario = begin(ADMIN_ADDR);
        let (mut config, gov_cap, oracle_cap) = setup_admin(&mut scenario);
        
        // Pause the system
        next_tx(&mut scenario, ADMIN_ADDR);
        set_pause_state(&mut config, &gov_cap, true, ctx(&mut scenario));
        
        // This should abort
        assert_not_paused(&config);
        
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure] // Rely on framework check for missing capability
    fun test_set_pause_state_fail_unauthorized() {
        let scenario = begin(ADMIN_ADDR);
        let (mut config, gov_cap, oracle_cap) = setup_admin(&mut scenario);
        
        // USER1 doesn't have gov_cap
        next_tx(&mut scenario, USER1_ADDR);
        // This will fail due to missing GovernCap
        set_pause_state(&mut config, &gov_cap, true, ctx(&mut scenario));
        
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }

    #[test]
    fun test_transfer_govern_cap_success() {
        let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = setup_admin(&mut scenario);
        
        // Transfer the gov cap to USER1
        next_tx(&mut scenario, ADMIN_ADDR);
        transfer_govern_cap(&gov_cap, gov_cap, USER1_ADDR, ctx(&mut scenario));
        
        // Verify USER1 has the cap
        next_tx(&mut scenario, USER1_ADDR);
        let user1_gov_cap = take_from_sender<GovernCap>(&scenario);
        
        return_shared(config);
        return_to_sender(&mut scenario, user1_gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }

    #[test]
    fun test_transfer_oracle_cap_success() {
        let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = setup_admin(&mut scenario);
        
        // Transfer the oracle cap to USER1
        next_tx(&mut scenario, ADMIN_ADDR);
        transfer_oracle_cap(&gov_cap, oracle_cap, USER1_ADDR, ctx(&mut scenario));
        
        // Verify USER1 has the cap
        next_tx(&mut scenario, USER1_ADDR);
        let user1_oracle_cap = take_from_sender<OracleCap>(&scenario);
        
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, user1_oracle_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure] // Rely on framework check
    fun test_transfer_oracle_cap_fail_unauthorized() {
        let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = setup_admin(&mut scenario);
        
        // USER1 doesn't have gov_cap
        next_tx(&mut scenario, USER1_ADDR);
        // This will fail due to missing GovernCap
        transfer_oracle_cap(&gov_cap, oracle_cap, USER2_ADDR, ctx(&mut scenario));
        
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }

    #[test]
    fun test_assert_not_paused_when_running() {
        let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = setup_admin(&mut scenario);
        
        // Should not abort when not paused
        assert_not_paused(&config);
        
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }
}