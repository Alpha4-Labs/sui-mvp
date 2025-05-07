/// Module that manages protocol configuration, capabilities, and global pause state.
module alpha_points::admin {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    // use sui::clock::{Self, Clock}; // Clock might become unused
    
    // Removed unused internal module imports
    // use alpha_points::ledger;
    // use alpha_points::escrow;
    // use alpha_points::oracle;
    // use alpha_points::loan;
    // use alpha_points::staking_manager;
    
    // Error constants
    // const EProtocolPaused: u64 = 1; // May become unused
    // const EUnauthorized: u64 = 2; // May become unused
    const EInvalidCaller: u64 = 1; // Used
    const EPaused: u64 = 2; // Used
    // Removed: const ENotPaused: u64 = 3;
    const EZeroPointsRate: u64 = 4; // Used
    
    /// Singleton capability for protocol owner actions
    public struct GovernCap has key, store {
        id: UID,
        auth_key: address
    }
    
    /// Capability to update oracles
    public struct OracleCap has key, store {
        id: UID,
        auth_key: address
    }
    
    /// Capability that grants administrative rights.
    /// Held by the deployer.
    public struct AdminCap has key, store {
        id: UID
    }
    
    /// Configuration object holding protocol parameters.
    public struct Config has key {
        id: UID,
        admin_cap_id: ID,
        is_paused: bool,
        points_rate_per_sui_per_epoch: u64,
        deployer_address: address,
        forfeiture_grace_period_ms: u64,
        target_validator_address: address
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
    
    public struct PointsRateChanged has copy, drop {
        new_rate: u64 // Points per SUI per epoch
    }
    
    public struct ProtocolPaused has copy, drop {}
    public struct ProtocolUnpaused has copy, drop {}
    public struct PointsRateUpdated has copy, drop {
        new_rate: u64
    }
    
    public struct ForfeitureGracePeriodUpdated has copy, drop {
        new_period_ms: u64
    }

    public struct TargetValidatorChanged has copy, drop {
        old_validator: address,
        new_validator: address
    }
    
    // === Test-only functions ===
    #[test_only]
    /// Initialize the admin module for testing
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
    
    // === Core module functions ===
    
    /// Creates GovernCap, OracleCap, Config, and initializes other modules.
    /// Transfers caps to deployer, shares Config and other shared objects.
    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        // Create and transfer governance capability
        let govern_cap = GovernCap {
            id: object::new(ctx),
            auth_key: sender 
        };
        transfer::transfer(govern_cap, sender);
        
        let oracle_cap = OracleCap {
            id: object::new(ctx),
            auth_key: sender 
        };
        transfer::transfer(oracle_cap, sender);
        
        let admin_cap = AdminCap { id: object::new(ctx) };
        let admin_cap_id = object::id(&admin_cap); // Renamed from admin_cap_actual_id for clarity
        transfer::public_transfer(admin_cap, sender); 
        
        let config = Config {
            id: object::new(ctx),
            admin_cap_id, // Use the renamed variable
            is_paused: false,
            points_rate_per_sui_per_epoch: 100, 
            deployer_address: sender,
            forfeiture_grace_period_ms: 14 * 24 * 60 * 60 * 1000,
            target_validator_address: @0x0 
        }; // Removed invalid characters and corrected structure
        
        transfer::share_object(config); // Ensure config is shared
    }
    
    /// Updates config.paused. Emits PauseStateChanged.
    /// Requires GovernCap for authorization.
    public entry fun set_pause_state(
        config: &mut Config, 
        admin_cap: &AdminCap, 
        new_pause_state: bool, 
        _ctx: &TxContext
    ) {
        assert!(object::id(admin_cap) == config.admin_cap_id, EInvalidCaller);
        config.is_paused = new_pause_state;
        
        // Emit event
        if (config.is_paused) {
            event::emit(ProtocolPaused {});
        } else {
            event::emit(ProtocolUnpaused {});
        }
    }
    
    /// Updates the points earning rate. Emits PointsRateChanged.
    /// Requires GovernCap for authorization.
    public entry fun set_points_rate(
        config: &mut Config,
        admin_cap: &AdminCap,
        new_rate: u64, // New points per SUI per epoch
        _ctx: &TxContext // Context might be needed later
    ) {
        assert!(object::id(admin_cap) == config.admin_cap_id, EInvalidCaller);
        assert!(new_rate > 0, EZeroPointsRate);
        config.points_rate_per_sui_per_epoch = new_rate;
        event::emit(PointsRateUpdated { new_rate });
    }
    
    /// Updates the forfeiture grace period. Emits ForfeitureGracePeriodUpdated.
    /// Requires AdminCap for authorization.
    public entry fun update_forfeiture_grace_period(
        config: &mut Config,
        admin_cap: &AdminCap,
        new_period_ms: u64,
        _ctx: &TxContext
    ) {
        assert!(object::id(admin_cap) == config.admin_cap_id, EInvalidCaller);
        config.forfeiture_grace_period_ms = new_period_ms;
        event::emit(ForfeitureGracePeriodUpdated { new_period_ms });
    }
    
    /// Updates the target validator address for native staking.
    /// Requires AdminCap for authorization.
    public entry fun set_target_validator(
        config: &mut Config,
        admin_cap: &AdminCap,
        new_validator: address,
        _ctx: &TxContext
    ) {
        assert!(object::id(admin_cap) == config.admin_cap_id, EInvalidCaller);
        let old_validator = config.target_validator_address;
        config.target_validator_address = new_validator;
        event::emit(TargetValidatorChanged { old_validator, new_validator });
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
        config.is_paused
    }
    
    /// Aborts if config.paused is true. Used by other modules.
    public fun assert_not_paused(config: &Config) {
        assert!(!config.is_paused, EPaused);
    }

    /// Returns the configured points earning rate per SUI per epoch.
    public fun get_points_rate(config: &Config): u64 {
        config.points_rate_per_sui_per_epoch
    }

    /// Get the deployer address stored in the config.
    public fun deployer_address(config: &Config): address {
        config.deployer_address
    }

    /// Get the forfeiture grace period stored in the config.
    public fun forfeiture_grace_period(config: &Config): u64 {
        config.forfeiture_grace_period_ms
    }

    /// Returns true if the provided AdminCap matches the one in the Config.
    public fun is_admin(admin_cap: &AdminCap, config: &Config): bool {
        object::id(admin_cap) == config.admin_cap_id
    }

    /// Returns the ID of the AdminCap associated with this config.
    public fun admin_cap_id(config: &Config): ID {
        config.admin_cap_id
    }

    /// Returns the configured target validator address for native staking.
    public fun get_target_validator(config: &Config): address {
        config.target_validator_address
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

    #[test_only]
    /// Helper function for creating AdminCap in tests
    public(package) fun create_test_admin_cap(ctx: &mut TxContext): AdminCap {
        AdminCap { id: object::new(ctx) }
    }

    #[test_only]
    /// Helper function for destroying AdminCap in tests
    public(package) fun destroy_test_admin_cap(cap: AdminCap) {
        let AdminCap { id } = cap;
        object::delete(id);
    }
}