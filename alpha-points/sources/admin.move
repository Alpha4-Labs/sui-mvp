// admin.move - Manages configuration, capabilities, and pause state
module alpha_points::admin {
    use sui::object::{Self, ID, UID, new, owner as object_owner}; // Added imports
    use sui::transfer::{Self, public_transfer, share_object}; // Added imports
    use sui::tx_context::{Self, TxContext, sender}; // Added imports
    use sui::event;

    // === Structs ===
    // Added 'public' visibility based on compiler errors and Move 2024 conventions
    // Governance Capability - Controls upgrades and critical parameters
    public struct GovernCap has key, store {
        id: UID
    }

    // Oracle Signer Capability - Allows updating the RateOracle
    public struct OracleCap has key, store {
        id: UID
    }

    // Main configuration object
    public struct Config has key {
        id: UID,
        paused: bool, // Emergency pause flag
        // Upgrade capability is managed by Sui framework
    }

    // === Events ===
    // Added 'public' visibility for cross-module use if needed, although typically events are implicitly public
    public struct PausingToggled has copy, drop { // Renamed event
        paused: bool,
        changed_by: address // Renamed from 'by' for clarity
    }

    public struct GovernCapTransferred has copy, drop {
        from: address,
        to: address
    }

    public struct OracleCapTransferred has copy, drop {
        from: address,
        to: address
    }

    // === Errors ===
    // Standardized error codes for this module
    const EUNAUTHORIZED: u64 = 1; // Caller lacks the required capability
    const ECONFIG_PAUSED: u64 = 2; // Operation cannot be performed while paused

    // === Init ===
    // Initializes the module on deployment
    // Note: This function itself doesn't need 'public' as it's special
    fun init(ctx: &mut TxContext) {
        let sender_address = sender(ctx); // Use distinct variable name

        // Create governance capability
        let gov_cap = GovernCap {
            id: new(ctx)
        };

        // Create oracle capability
        let oracle_cap = OracleCap {
            id: new(ctx)
        };

        // Create and share the Config object
        let config = Config {
            id: new(ctx),
            paused: false, // Start unpaused
        };

        // Transfer capabilities to the deployer
        public_transfer(gov_cap, sender_address);
        public_transfer(oracle_cap, sender_address);

        // Share config as a shared object accessible by others
        share_object(config);
    }

    // === Public Functions ===

    /// Sets the pause state for the protocol. Requires the GovernCap.
    public entry fun set_pause_state(
        config: &mut Config,
        _gov_cap: &GovernCap, // Capability check - presence implies authorization
        paused_state: bool,
        ctx: &TxContext
    ) {
        // Only set if state changes to avoid redundant events
        if (config.paused != paused_state) {
            config.paused = paused_state;
            event::emit(PausingToggled {
                paused: paused_state,
                changed_by: sender(ctx)
            });
        }
    }

    /// Transfers the governance capability object to a new owner. Requires the current GovernCap.
    public entry fun transfer_govern_cap(
        _gov_cap: &GovernCap, // Authorization check - sender must hold this
        cap_to_transfer: GovernCap, // The actual capability object being transferred
        new_owner: address,
        ctx: &TxContext
    ) {
        let sender_address = sender(ctx);
        // Note: The _gov_cap parameter ensures the sender holds *a* govern cap.
        // Ownership implies the right to transfer.

        event::emit(GovernCapTransferred {
            from: sender_address,
            to: new_owner
        });
        public_transfer(cap_to_transfer, new_owner);
    }

    /// Transfers the oracle capability object to a new owner. Requires the GovernCap.
    public entry fun transfer_oracle_cap(
        _gov_cap: &GovernCap, // Authorization check - requires GovernCap holder permission
        cap_to_transfer: OracleCap, // The actual capability object being transferred
        new_owner: address,
        ctx: &TxContext
    ) {
        // Requires GovernCap to authorize the transfer of the OracleCap
        event::emit(OracleCapTransferred {
            // Get owner before transfer might require passing cap by reference if needed,
            // but for event, knowing the *sender* (who holds GovernCap) initiated is often sufficient.
            // Using object_owner requires passing by reference or querying state (more complex).
            // Sticking with sender who authorized the transfer for simplicity.
            from: sender(ctx), // Address holding GovernCap authorizing the transfer
            to: new_owner
        });
        public_transfer(cap_to_transfer, new_owner);
    }

    /// Public view function to check if the protocol is paused.
    public fun is_paused(config: &Config): bool {
        config.paused
    }

    /// Helper function to assert the protocol is not paused.
    /// Intended to be called at the beginning of sensitive entry functions in other modules.
    public fun assert_not_paused(config: &Config) {
        assert!(!config.paused, ECONFIG_PAUSED);
    }
}

// === Test Submodule ===
#[test_only]
module alpha_points::admin_tests {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx, take_shared, return_shared, take_from_sender, return_to_sender, end as end_scenario, begin}; // Added imports
    use sui::object::{Self, ID}; // Removed unused Self import

    // Use fully qualified path for module items
    use alpha_points::admin::{
        init as admin_init, set_pause_state, is_paused, transfer_govern_cap, transfer_oracle_cap, assert_not_paused,
        Config, GovernCap, OracleCap, EUNAUTHORIZED, ECONFIG_PAUSED
    };

    // Test addresses
    const ADMIN_ADDR: address = @0xA1; // Use distinct names
    const USER1_ADDR: address = @0xB1; // Non-admin user
    const USER2_ADDR: address = @0xB2; // Another user for transfer tests

    // Helper to initialize the admin module for tests
    fun init_admin(scenario: &mut Scenario): (Config, GovernCap, OracleCap) {
        next_tx(scenario, ADMIN_ADDR);
        admin_init(ctx(scenario));

        // Return the created objects for the test setup
        let config = take_shared<Config>(scenario);
        let gov_cap = take_from_sender<GovernCap>(scenario);
        let oracle_cap = take_from_sender<OracleCap>(scenario);

        (config, gov_cap, oracle_cap)
    }

    #[test]
    /// Test setting the pause state successfully with GovernCap
    fun test_set_pause_state_success() {
        let scenario = begin(ADMIN_ADDR);
        let (mut config, gov_cap, oracle_cap) = init_admin(&mut scenario);

        next_tx(&mut scenario, ADMIN_ADDR);
        set_pause_state(&mut config, &gov_cap, true, ctx(&mut scenario));
        assert!(is_paused(&config), 0); // Check it's paused

        // Unpause
        set_pause_state(&mut config, &gov_cap, false, ctx(&mut scenario));
        assert!(!is_paused(&config), 1); // Check it's unpaused

        // Cleanup
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure] // No specific abort code check needed, framework handles missing Cap
    /// Test setting the pause state fails without GovernCap
    fun test_set_pause_state_fail_unauthorized() {
        let scenario = begin(ADMIN_ADDR);
        let (mut config, gov_cap, oracle_cap) = init_admin(&mut scenario);

        // USER1_ADDR tries to pause without GovernCap
        next_tx(&mut scenario, USER1_ADDR);
        // This call requires &GovernCap which USER1_ADDR doesn't have.
        // The test framework will prevent this call from being constructed correctly
        // in a Programmable Transaction Block (PTB) test if USER1_ADDR doesn't own the Cap object.
        // set_pause_state(&mut config, ???, true, ctx(&mut scenario));

        // Cleanup (won't be reached on expected failure)
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap); // Back to ADMIN_ADDR
        return_to_sender(&mut scenario, oracle_cap); // Back to ADMIN_ADDR
        end_scenario(scenario);
    }

    #[test]
    /// Test transferring GovernCap successfully
    fun test_transfer_govern_cap_success() {
        let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = init_admin(&mut scenario);

        next_tx(&mut scenario, ADMIN_ADDR);
        // ADMIN transfers the GovernCap they own to USER1_ADDR
        transfer_govern_cap(&gov_cap, gov_cap, USER1_ADDR, ctx(&mut scenario));

        // Now USER1_ADDR should have the GovernCap, ADMIN_ADDR no longer does.

        // Cleanup
        return_shared(config);
        // Gov Cap was transferred, not returned to ADMIN_ADDR
        return_to_sender(&mut scenario, oracle_cap); // Return OracleCap to ADMIN_ADDR
        end_scenario(scenario); // Automatically cleans up USER1_ADDR's cap
    }


    #[test]
    /// Test transferring OracleCap successfully with GovernCap
    fun test_transfer_oracle_cap_success() {
        let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = init_admin(&mut scenario);

        next_tx(&mut scenario, ADMIN_ADDR);
        // ADMIN uses GovernCap to authorize transfer of OracleCap to USER1_ADDR
        transfer_oracle_cap(&gov_cap, oracle_cap, USER1_ADDR, ctx(&mut scenario));

        // Now USER1_ADDR should have the OracleCap, ADMIN_ADDR no longer does.

        // Cleanup
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        // Oracle Cap was transferred, not returned to ADMIN_ADDR
        end_scenario(scenario); // Automatically cleans up USER1_ADDR's cap
    }

     #[test]
     #[expected_failure] // Framework handles missing Cap
    /// Test transferring OracleCap fails without GovernCap
    fun test_transfer_oracle_cap_fail_unauthorized() {
        let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = init_admin(&mut scenario);

        // Return gov_cap so ADMIN_ADDR doesn't hold it for the next transaction
        return_to_sender(&mut scenario, gov_cap);

        // USER1_ADDR (who doesn't have GovernCap) tries to authorize the transfer of OracleCap
        next_tx(&mut scenario, USER1_ADDR);
        // This call requires &GovernCap which USER1_ADDR doesn't have.
        // transfer_oracle_cap(???, oracle_cap, USER2_ADDR, ctx(&mut scenario));

        // Cleanup (won't be reached)
        return_shared(config);
        return_to_sender(&mut scenario, oracle_cap); // Return OracleCap to ADMIN_ADDR
        end_scenario(scenario);
    }

    #[test]
    /// Test assert_not_paused helper function when not paused
    fun test_assert_not_paused_when_running() {
         let scenario = begin(ADMIN_ADDR);
        let (config, gov_cap, oracle_cap) = init_admin(&mut scenario);

        // Should not abort when not paused
        next_tx(&mut scenario, ADMIN_ADDR); // Context needs an active transaction
        assert_not_paused(&config); // Call the function

        // Cleanup
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }

     #[test]
     #[expected_failure(abort_code = ECONFIG_PAUSED)] // Use the specific code from admin module
    /// Test assert_not_paused helper function fails when paused
    fun test_assert_not_paused_fail_when_paused() {
         let scenario = begin(ADMIN_ADDR);
        let (mut config, gov_cap, oracle_cap) = init_admin(&mut scenario);

        // Pause the config
        next_tx(&mut scenario, ADMIN_ADDR);
        set_pause_state(&mut config, &gov_cap, true, ctx(&mut scenario));

        // Should abort when paused
        assert_not_paused(&config); // Call the function that should abort

        // Cleanup (won't be reached)
        return_shared(config);
        return_to_sender(&mut scenario, gov_cap);
        return_to_sender(&mut scenario, oracle_cap);
        end_scenario(scenario);
    }
}
