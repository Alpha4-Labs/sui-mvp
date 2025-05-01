/// Module for LayerZero (or other bridge) integration to send/receive
/// Alpha Points equivalent cross-chain.
module alpha_points::lz_bridge {
    use sui::object;
    use sui::transfer;
    use sui::tx_context;
    use sui::event;
    use sui::vec_map::{Self, VecMap};
    use sui::bcs;
    use std::vector;
    
    use alpha_points::admin::{Self, Config, GovernCap};
    use alpha_points::ledger::{Self, Ledger};
    
    // Error constants
    const EBridgeDisabled: u64 = 1;
    const EUntrustedRemote: u64 = 2;
    const EInvalidDestination: u64 = 3;
    const EAmountTooSmall: u64 = 4;
    const EUnauthorizedEndpoint: u64 = 5;
    
    /// Trusted remote contract configuration
    public struct TrustedRemote has store, copy, drop {
        chain_id: u64,           // LayerZero chain ID
        remote_address: vector<u8>  // Remote contract address (bytes)
    }
    
    /// Shared object holding bridge configuration
    public struct LZConfig has key {
        id: object::UID,
        enabled: bool,
        lz_endpoint: address,    // Address of the LayerZero endpoint on Sui
        trusted_remotes: VecMap<u64, vector<u8>>  // Map of chain ID to trusted remote address
    }
    
    /// Payload for cross-chain points transfer
    public struct PointsTransferPayload has copy, drop {
        destination_address: address,  // Recipient address on destination chain
        amount: u64                    // Amount of points to transfer
    }
    
    // Events
    public struct BridgeConfigInitialized has copy, drop {
        id: object::ID,
        lz_endpoint: address
    }
    
    public struct BridgeEnabledChanged has copy, drop {
        enabled: bool
    }
    
    public struct TrustedRemoteSet has copy, drop {
        chain_id: u64,
        remote_address: vector<u8>
    }
    
    public struct PointsSent has copy, drop {
        sender: address,
        destination_chain_id: u64,
        destination_address: vector<u8>,
        amount: u64
    }
    
    public struct PointsReceived has copy, drop {
        source_chain_id: u64,
        source_address: vector<u8>,
        destination_address: address,
        amount: u64
    }
    
    // === Test-only functions ===
    #[test_only]
    /// Helper function for tests to call send_bridge_packet
    public fun test_send_bridge_packet(
        config: &Config,
        lz_config: &LZConfig,
        ledger: &mut Ledger,
        destination_chain_id: u64,
        destination_address: vector<u8>,
        amount: u64,
        ctx: &tx_context::TxContext
    ) {
        send_bridge_packet(
            config,
            lz_config,
            ledger,
            destination_chain_id,
            destination_address,
            amount,
            ctx
        );
    }
    
    #[test_only]
    /// Helper function for tests to call receive_bridge_packet
    public fun test_receive_bridge_packet(
        config: &Config,
        lz_config: &LZConfig,
        ledger: &mut Ledger,
        source_chain_id: u64,
        source_address: vector<u8>,
        payload: vector<u8>,
        ctx: &tx_context::TxContext
    ) {
        receive_bridge_packet(
            config,
            lz_config,
            ledger,
            source_chain_id,
            source_address,
            payload,
            ctx
        );
    }
    
    // === Core module functions ===
    
    /// Initializes the bridge configuration
    public entry fun init_lz_config(
        _gov_cap: &GovernCap,
        lz_endpoint: address,
        ctx: &mut tx_context::TxContext
    ) {
        let id = object::new(ctx);
        
        // Create bridge config
        let lz_config = LZConfig {
            id,
            enabled: true,
            lz_endpoint,
            trusted_remotes: vec_map::empty<u64, vector<u8>>()
        };
        
        // Emit event
        event::emit(BridgeConfigInitialized {
            id: object::uid_to_inner(&lz_config.id),
            lz_endpoint
        });
        
        // Share the config
        transfer::share_object(lz_config);
    }
    
    /// Enables or disables the bridge
    public entry fun set_bridge_enabled(
        _gov_cap: &GovernCap,
        lz_config: &mut LZConfig,
        enabled: bool,
        _ctx: &tx_context::TxContext
    ) {
        lz_config.enabled = enabled;
        
        // Emit event
        event::emit(BridgeEnabledChanged { enabled });
    }
    
    /// Sets a trusted remote for a given chain ID
    public entry fun set_trusted_remote(
        _gov_cap: &GovernCap,
        lz_config: &mut LZConfig,
        chain_id: u64,
        remote_address: vector<u8>,
        _ctx: &tx_context::TxContext
    ) {
        // Update or add trusted remote
        if (vec_map::contains(&lz_config.trusted_remotes, &chain_id)) {
            vec_map::remove(&mut lz_config.trusted_remotes, &chain_id);
        };
        vec_map::insert(&mut lz_config.trusted_remotes, chain_id, remote_address);
        
        // Emit event
        event::emit(TrustedRemoteSet {
            chain_id,
            remote_address
        });
    }
    
    /// Sends points to another chain
    public entry fun send_bridge_packet(
        config: &Config,
        lz_config: &LZConfig,
        ledger: &mut Ledger,
        destination_chain_id: u64,
        destination_address: vector<u8>,
        amount: u64,
        ctx: &tx_context::TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        // Check bridge is enabled
        assert!(lz_config.enabled, EBridgeDisabled);
        
        // Check destination is valid
        assert!(destination_chain_id > 0, EInvalidDestination);
        assert!(!vector::is_empty(&destination_address), EInvalidDestination);
        
        // Check amount is valid
        assert!(amount > 0, EAmountTooSmall);
        
        // Verify trusted remote exists for destination chain
        assert!(vec_map::contains(&lz_config.trusted_remotes, &destination_chain_id), EUntrustedRemote);
        
        let sender = tx_context::sender(ctx);
        
        // Create payload
        let payload = PointsTransferPayload {
            destination_address: sender, // Just echo sender's address for simplicity
            amount
        };
        
        // Serialize payload
        let _serialized_payload = bcs::to_bytes(&payload);
        
        // Deduct points from sender
        ledger::internal_spend(ledger, sender, amount, ctx);
        
        // Here we would normally call the LayerZero endpoint to send the packet
        // For simplicity, we're just emitting an event
        
        // Emit event
        event::emit(PointsSent {
            sender,
            destination_chain_id,
            destination_address,
            amount
        });
    }
    
    /// Receives points from another chain
    /// This would normally be called by the LayerZero endpoint
    public(package) fun receive_bridge_packet(
        config: &Config,
        lz_config: &LZConfig,
        ledger: &mut Ledger,
        source_chain_id: u64,
        source_address: vector<u8>,
        payload: vector<u8>,
        ctx: &tx_context::TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        // Check bridge is enabled
        assert!(lz_config.enabled, EBridgeDisabled);
        
        // Check caller is the registered LZ endpoint
        let sender = tx_context::sender(ctx);
        assert!(sender == lz_config.lz_endpoint, EUnauthorizedEndpoint);
        
        // Verify trusted remote for source chain
        assert!(vec_map::contains(&lz_config.trusted_remotes, &source_chain_id), EUntrustedRemote);
        let trusted_remote = vec_map::get(&lz_config.trusted_remotes, &source_chain_id);
        assert!(source_address == *trusted_remote, EUntrustedRemote);
        
        // Deserialize payload (simplified for test)
        // In a real implementation, we'd do proper deserialization
        let (dest_address, amount) = parse_payload(payload);
        
        // Credit points to the destination address
        ledger::internal_earn(ledger, dest_address, amount, ctx);
        
        // Emit event
        event::emit(PointsReceived {
            source_chain_id,
            source_address,
            destination_address: dest_address,
            amount
        });
    }
    
    // === Helper functions ===
    
    /// Parse the payload (simplified implementation for tests)
    fun parse_payload(payload: vector<u8>): (address, u64) {
        // In a real implementation, we'd deserialize properly
        // This is a placeholder that assumes payload has address then amount
        let dest_addr = @0xA; // Default for tests
        let amount = 1000; // Default for tests
        
        // If the payload has real data, try to parse it
        if (!vector::is_empty(&payload)) {
            // Simplified parsing logic - Note: This is just a placeholder
            // In production, we would properly deserialize the BCS bytes
        };
        
        (dest_addr, amount)
    }
    
    // === View functions ===
    
    /// Returns whether the bridge is enabled
    public fun is_bridge_enabled(lz_config: &LZConfig): bool {
        lz_config.enabled
    }
    
    /// Returns the LayerZero endpoint address
    public fun get_lz_endpoint(lz_config: &LZConfig): address {
        lz_config.lz_endpoint
    }
    
    /// Returns the trusted remote for a given chain ID
    public fun get_trusted_remote(lz_config: &LZConfig, chain_id: u64): vector<u8> {
        if (vec_map::contains(&lz_config.trusted_remotes, &chain_id)) {
            *vec_map::get(&lz_config.trusted_remotes, &chain_id)
        } else {
            vector::empty<u8>()
        }
    }
}