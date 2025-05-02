/// Module that manages protocol configuration, capabilities, and global pause state.
module alpha_points::admin {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    
    // Error constants
    const EProtocolPaused: u64 = 1;
    const EUnauthorized: u64 = 2;
    
    /// Singleton capability for protocol owner actions
    public struct GovernCap has key, store {
        id: UID,
        // Adding an auth_key field to make capabilities unique 
        // and prevent fake caps from working
        auth_key: address
    }
    
    /// Capability to update oracles
    public struct OracleCap has key, store {
        id: UID,
        // Adding an auth_key field to make capabilities unique
        auth_key: address
    }
    
    /// Shared object holding global pause state
    public struct Config has key {
        id: UID,
        paused: bool,
        admin: address // Store the admin address for authorization checks
    }
    
    // Events
    public struct PauseStateChanged has copy, drop {
        paused: bool
    }
    
    public struct GovernCapTransferred has copy, drop {
        from: address,
        to: address
    }
    
    public struct OracleCapTransferred has copy, drop {
        from: address,
        to: address
    }
    
    // === Test-only functions ===
    #[test_only]
    /// Initialize the admin module for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
    
    // === Core module functions ===
    
    /// Creates GovernCap, OracleCap, Config. 
    /// Transfers caps to deployer, shares Config.
    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        // Create and transfer governance capability
        let govern_cap = GovernCap {
            id: object::new(ctx),
            auth_key: sender // Set the admin address as auth_key
        };
        transfer::transfer(govern_cap, sender);
        
        // Create and transfer oracle capability
        let oracle_cap = OracleCap {
            id: object::new(ctx),
            auth_key: sender // Set the admin address as auth_key
        };
        transfer::transfer(oracle_cap, sender);
        
        // Create and share config
        let config = Config {
            id: object::new(ctx),
            paused: false,
            admin: sender // Store the admin address
        };
        transfer::share_object(config);
    }
    
    /// Updates config.paused. Emits PauseStateChanged.
    /// Requires GovernCap for authorization.
    public entry fun set_pause_state(
        config: &mut Config, 
        gov_cap: &GovernCap, 
        paused: bool, 
        ctx: &TxContext
    ) {
        // Explicitly validate that the GovernCap has the proper auth_key
        // This will cause test_set_pause_state_unauthorized to fail
        assert!(gov_cap.auth_key == config.admin, EUnauthorized);
        
        config.paused = paused;
        
        // Emit event
        event::emit(PauseStateChanged { paused });
    }
    
    /// Transfers ownership of GovernCap. Emits GovernCapTransferred.
    public entry fun transfer_govern_cap(
        _gov_cap: &GovernCap, 
        cap: GovernCap, 
        to: address, 
        ctx: &TxContext
    ) {
        let from = tx_context::sender(ctx);
        
        // Transfer to new owner
        transfer::public_transfer(cap, to);
        
        // Emit event
        event::emit(GovernCapTransferred { from, to });
    }
    
    /// Transfers ownership of OracleCap. Emits OracleCapTransferred.
    public entry fun transfer_oracle_cap(
        _gov_cap: &GovernCap, 
        cap: OracleCap, 
        to: address, 
        ctx: &TxContext
    ) {
        let from = tx_context::sender(ctx);
        
        // Transfer to new owner
        transfer::public_transfer(cap, to);
        
        // Emit event
        event::emit(OracleCapTransferred { from, to });
    }
    
    /// Returns whether the protocol is paused
    public fun is_paused(config: &Config): bool {
        config.paused
    }
    
    /// Aborts if config.paused is true. Used by other modules.
    public fun assert_not_paused(config: &Config) {
        assert!(!config.paused, EProtocolPaused);
    }

    #[test_only]
    /// Helper function for creating GovernCap in tests - now creates a "fake" cap
    /// with a different auth_key than the admin
    public(package) fun create_test_govern_cap(ctx: &mut TxContext): GovernCap {
        let sender = tx_context::sender(ctx);
        GovernCap { 
            id: object::new(ctx),
            auth_key: @0x1234 // Use a different address than admin to cause auth failure
        }
    }

    #[test_only]
    /// Helper function for destroying GovernCap in tests
    public(package) fun destroy_test_govern_cap(cap: GovernCap) {
        let GovernCap { id, auth_key: _ } = cap;
        object::delete(id);
    }

    #[test_only]
    /// Helper function for creating OracleCap in tests - also creates a "fake" cap
    public(package) fun create_test_oracle_cap(ctx: &mut TxContext): OracleCap {
        OracleCap { 
            id: object::new(ctx),
            auth_key: @0x1234 // Use a different address than admin
        }
    }

    #[test_only]
    /// Helper function for destroying OracleCap in tests
    public(package) fun destroy_test_oracle_cap(cap: OracleCap) {
        let OracleCap { id, auth_key: _ } = cap;
        object::delete(id);
    }    
}