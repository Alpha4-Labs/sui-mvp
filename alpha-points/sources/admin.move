/// Module that manages protocol configuration, capabilities, and global pause state.
module alpha_points::admin {
    use sui::object;
    use sui::transfer;
    use sui::tx_context;
    use sui::event;
    
    // Error constants
    const EProtocolPaused: u64 = 1;
    
    /// Singleton capability for protocol owner actions
    public struct GovernCap has key, store {
        id: object::UID
    }
    
    /// Capability to update oracles
    public struct OracleCap has key, store {
        id: object::UID
    }
    
    /// Shared object holding global pause state
    public struct Config has key {
        id: object::UID,
        paused: bool
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
    public fun init_for_testing(ctx: &mut tx_context::TxContext) {
        init(ctx);
    }
    
    // === Core module functions ===
    
    /// Creates GovernCap, OracleCap, Config. 
    /// Transfers caps to deployer, shares Config.
    fun init(ctx: &mut tx_context::TxContext) {
        let sender = tx_context::sender(ctx);
        
        // Create and transfer governance capability
        let govern_cap = GovernCap {
            id: object::new(ctx)
        };
        transfer::transfer(govern_cap, sender);
        
        // Create and transfer oracle capability
        let oracle_cap = OracleCap {
            id: object::new(ctx)
        };
        transfer::transfer(oracle_cap, sender);
        
        // Create and share config
        let config = Config {
            id: object::new(ctx),
            paused: false
        };
        transfer::share_object(config);
    }
    
    /// Updates config.paused. Emits PauseStateChanged.
    public entry fun set_pause_state(
        config: &mut Config, 
        _gov_cap: &GovernCap, 
        paused: bool, 
        _ctx: &tx_context::TxContext
    ) {
        // Only the holder of GovernCap can change pause state
        config.paused = paused;
        
        // Emit event
        event::emit(PauseStateChanged { paused });
    }
    
    /// Transfers ownership of GovernCap. Emits GovernCapTransferred.
    public entry fun transfer_govern_cap(
        _gov_cap: &GovernCap, 
        cap: GovernCap, 
        to: address, 
        ctx: &tx_context::TxContext
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
        ctx: &tx_context::TxContext
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
    /// Helper function for creating GovernCap in tests
    public(package) fun create_test_govern_cap(ctx: &mut TxContext): GovernCap {
        GovernCap { id: object::new(ctx) }
    }

    #[test_only]
    /// Helper function for destroying GovernCap in tests
    public(package) fun destroy_test_govern_cap(cap: GovernCap) {
        let GovernCap { id } = cap;
        object::delete(id);
    }

    #[test_only]
    /// Helper function for creating OracleCap in tests
    public(package) fun create_test_oracle_cap(ctx: &mut TxContext): OracleCap {
        OracleCap { id: object::new(ctx) }
    }

    #[test_only]
    /// Helper function for destroying OracleCap in tests
    public(package) fun destroy_test_oracle_cap(cap: OracleCap) {
        let OracleCap { id } = cap;
        object::delete(id);
    }    
}