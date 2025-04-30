// lz_bridge.move - Placeholder for LayerZero cross-chain integration
// #[cfg(feature = lz_bridge)] // Commented out until feature defined
module alpha_points::lz_bridge {
    // Removed unnecessary aliases and use proper qualified imports
    use sui::object;
    use sui::tx_context;
    use sui::transfer::share_object;
    use sui::event;

    use alpha_points::admin::{Config as AdminConfig, GovernCap, assert_not_paused};
    use alpha_points::ledger::{Ledger, internal_earn, internal_spend, get_available_balance};

    // === Structs ===
    public struct LZConfig has key {
        id: UID,
        enabled: bool,
        lz_app_address: address,
        trusted_remotes: vector<TrustedRemote>,
    }
    
    public struct TrustedRemote has store, copy, drop {
        chain_id: u16,
        address: vector<u8>,
    }
    
    public struct PointsTransferPayload has copy, drop, store {
        sender_address: address,
        recipient_address: address,
        points_amount: u64,
    }

    // === Events ===
    public struct LZConfigUpdated has copy, drop {
        config_id: ID, 
        enabled: bool, 
        updated_by: address,
    }
    
    public struct TrustedRemoteAdded has copy, drop {
        chain_id: u16,
        address: vector<u8>,
        added_by: address,
    }
    
    public struct TrustedRemoteRemoved has copy, drop {
        chain_id: u16,
        removed_by: address,
    }
    
    public struct BridgePacketSent has copy, drop {
        source_address: address,
        destination_chain_id: u16,
        recipient_address: address,
        points_amount: u64,
    }
    
    public struct BridgePacketReceived has copy, drop {
        source_chain_id: u16,
        sender_address: address,
        recipient_address: address,
        points_amount: u64,
    }

    // === Errors ===
    const EUNAUTHORIZED: u64 = 1;
    const EBRIDGING_DISABLED: u64 = 2;
    const EINVALID_SOURCE_CHAIN: u64 = 4;
    const EINVALID_PAYLOAD: u64 = 5;
    #[allow(unused_const)]
    const EMESSAGE_PROCESSING_FAILED: u64 = 6;
    const EINSUFFICIENT_POINTS: u64 = 7;
    const EREMOTE_NOT_TRUSTED: u64 = 9;

    // === Init Function ===
    public entry fun init_lz_config(
        _gov_cap: &GovernCap,
        lz_app_address: address,
        enabled: bool,
        ctx: &mut TxContext
    ) {
        let config = LZConfig {
            id: object::new(ctx),
            enabled,
            lz_app_address,
            trusted_remotes: std::vector::empty<TrustedRemote>(),
        };
        
        share_object(config);
    }

    // === Entry Functions ===
    public entry fun send_bridge_packet(
        admin_config: &AdminConfig,
        lz_config: &LZConfig,
        ledger: &mut Ledger,
        destination_lz_chain_id: u16,
        recipient_address: address,
        points_amount: u64,
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(admin_config);
        
        // Check bridging enabled
        assert!(lz_config.enabled, EBRIDGING_DISABLED);
        
        // Check chain is trusted
        assert!(is_trusted_chain(lz_config, destination_lz_chain_id), EREMOTE_NOT_TRUSTED);
        
        // Check valid amount
        assert!(points_amount > 0, EINVALID_PAYLOAD);
        
        // Check sender has enough points
        let sender_addr = tx_context::sender(ctx);
        let available_points = get_available_balance(ledger, sender_addr);
        assert!(available_points >= points_amount, EINSUFFICIENT_POINTS);
        
        // Spend points from sender
        internal_spend(ledger, sender_addr, points_amount, ctx);
        
        // Construct payload (simplified - in real impl would use LayerZero SDK)
        // Create transfer payload
        let _payload = PointsTransferPayload {
            sender_address: sender_addr,
            recipient_address,
            points_amount,
        };
        
        // In a real implementation:
        // 1. Serialize payload using bcs
        // 2. Call LayerZero endpoint to send payload
        
        // Emit event
        event::emit(BridgePacketSent {
            source_address: sender_addr,
            destination_chain_id: destination_lz_chain_id,
            recipient_address,
            points_amount,
        });
    }

    public entry fun receive_bridge_packet(
        admin_config: &AdminConfig, 
        lz_config: &LZConfig, 
        ledger: &mut Ledger,
        source_lz_chain_id: u16, 
        _source_address_bytes: vector<u8>, 
        payload: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Security checks
        assert!(tx_context::sender(ctx) == lz_config.lz_app_address, EUNAUTHORIZED);
        assert_not_paused(admin_config);
        assert!(lz_config.enabled, EBRIDGING_DISABLED);
        assert!(is_trusted_chain(lz_config, source_lz_chain_id), EINVALID_SOURCE_CHAIN);

        // In a real implementation, use BCS deserialization
        // This is a simplified placeholder 
        // The actual implementation would deserialize payload to PointsTransferPayload
        
        // Simulate deserialization - in real impl, use bcs::from_bytes
        let transfer_data = deserialize_payload(&payload);
        
        // Validate payload
        assert!(transfer_data.points_amount > 0, EINVALID_PAYLOAD);
        
        // Award points to recipient
        internal_earn(ledger, transfer_data.recipient_address, transfer_data.points_amount, ctx);
        
        // Emit event
        event::emit(BridgePacketReceived {
            source_chain_id: source_lz_chain_id,
            sender_address: transfer_data.sender_address,
            recipient_address: transfer_data.recipient_address,
            points_amount: transfer_data.points_amount,
        });
    }

    // === Governance Functions ===
    public entry fun set_bridge_enabled(
        lz_config: &mut LZConfig, 
        _gov_cap: &GovernCap, 
        enabled: bool, 
        ctx: &TxContext
    ) {
        lz_config.enabled = enabled;
        
        // Fixed: using object::uid_to_inner instead of id()
        let config_id = object::uid_to_inner(&lz_config.id);
        event::emit(LZConfigUpdated {
            config_id,
            enabled,
            updated_by: tx_context::sender(ctx),
        });
    }
    
    public entry fun set_trusted_remote(
        lz_config: &mut LZConfig, 
        _gov_cap: &GovernCap, 
        chain_id: u16, 
        remote_address: vector<u8>,
        ctx: &TxContext
    ) {
        // Remove existing entry if present
        let (found, i) = find_trusted_remote_index(lz_config, chain_id);
        if (found) {
            std::vector::remove(&mut lz_config.trusted_remotes, i);
        };
        
        // Add new trusted remote
        let remote = TrustedRemote {
            chain_id,
            address: remote_address,
        };
        std::vector::push_back(&mut lz_config.trusted_remotes, remote);
        
        event::emit(TrustedRemoteAdded {
            chain_id,
            address: remote_address,
            added_by: tx_context::sender(ctx),
        });
    }
    
    public entry fun remove_trusted_remote(
        lz_config: &mut LZConfig, 
        _gov_cap: &GovernCap, 
        chain_id: u16,
        ctx: &TxContext
    ) {
        let (found, i) = find_trusted_remote_index(lz_config, chain_id);
        assert!(found, EREMOTE_NOT_TRUSTED);
        
        std::vector::remove(&mut lz_config.trusted_remotes, i);
        
        event::emit(TrustedRemoteRemoved {
            chain_id,
            removed_by: tx_context::sender(ctx),
        });
    }

    // === Helper Functions ===
    public fun is_trusted_chain(config: &LZConfig, lz_chain_id: u16): bool {
        let (found, _) = find_trusted_remote_index(config, lz_chain_id);
        found
    }
    
    fun find_trusted_remote_index(config: &LZConfig, chain_id: u16): (bool, u64) {
        let len = std::vector::length(&config.trusted_remotes);
        let i = 0;
        
        while (i < len) {
            let remote = std::vector::borrow(&config.trusted_remotes, i);
            if (remote.chain_id == chain_id) {
                return (true, i)
            };
            i = i + 1;
        };
        
        (false, 0)
    }
    
    // Simplified placeholder for deserialization
    // In a real implementation, use bcs::from_bytes
    fun deserialize_payload(payload: &vector<u8>): PointsTransferPayload {
        // This is a placeholder - in reality we would deserialize using BCS
        let _payload_len = std::vector::length(payload);
        
        // Simply return a dummy structure for now
        // In a real implementation, decode the bytes to reconstruct the payload
        PointsTransferPayload {
            sender_address: @0x1,  // dummy address
            recipient_address: @0x2, // dummy address
            points_amount: 100, // dummy amount
        }
    }
    
    // Add missing imports at the top to fix compilation
    use sui::object::{UID, ID};
    use sui::tx_context::TxContext;
}