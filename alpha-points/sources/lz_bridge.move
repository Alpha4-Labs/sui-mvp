// lz_bridge.move - Placeholder for LayerZero cross-chain integration
// This module will only be compiled if the 'lz_bridge' feature is enabled.
#[cfg(feature = "lz_bridge")]
module alpha_points::lz_bridge {
    use sui::object::{Self, ID, UID, new, id, uid_to_inner, delete};
    use sui::tx_context::{Self, TxContext, sender};
    use sui::transfer::{Self, share_object, public_transfer};
    use sui::event;
    use sui::bcs; // For potential message serialization/hashing
    use std::vector;

    // Import necessary components from other modules
    use alpha_points::admin::{Config as AdminConfig, GovernCap, assert_not_paused};
    use alpha_points::ledger::{Ledger, internal_earn, internal_spend, get_available_balance}; // For potential point mint/burn on receive/send

    // === Constants ===
    // Example: Sui's chain ID representation in LayerZero (adjust as needed)
    const SUI_LZ_CHAIN_ID: u16 = 101; // Placeholder LayerZero chain ID for Sui

    // === Structs ===

    /// Configuration for the LayerZero bridge endpoint.
    /// Controls trusted remotes and potentially fees or other parameters.
    public struct LZConfig has key {
        id: UID,
        lz_app_address: address, // Address of the LayerZero endpoint contract on Sui
        enabled: bool, // Flag to enable/disable bridging
        // Map or vector storing trusted remote chain IDs and their corresponding endpoint addresses (as bytes)
        trusted_remotes: vector<TrustedRemote>, // Example structure
    }

    /// Represents a trusted remote chain configuration.
    public struct TrustedRemote has store, copy, drop {
        lz_chain_id: u16, // LayerZero's ID for the remote chain
        remote_address: vector<u8>, // Address of the corresponding contract on the remote chain
    }

    /// Example message structure for sending points cross-chain.
    /// This would be defined based on the agreed-upon cross-chain message format.
    public struct PointsTransferPayload has copy, drop, store {
        sender_address: address, // Original sender on the source chain
        recipient_address: address, // Target recipient on the destination chain
        points_amount: u64,
        // Add other fields as needed (e.g., nonce, extra data)
    }

    // === Events ===

    public struct LZConfigUpdated has copy, drop {
        config_id: ID,
        enabled: bool,
        updated_by: address
    }

    public struct TrustedRemoteAdded has copy, drop {
        config_id: ID,
        lz_chain_id: u16,
        remote_address: vector<u8>,
        added_by: address
    }

     public struct TrustedRemoteRemoved has copy, drop {
        config_id: ID,
        lz_chain_id: u16,
        removed_by: address
    }

    public struct BridgePacketSent has copy, drop {
        destination_chain_id: u16, // LayerZero chain ID
        recipient_address: address, // Target recipient
        points_amount: u64,
        sent_by: address // Sui address initiating the send
        // Add nonce or message ID if available from LZ endpoint interaction
    }

    public struct BridgePacketReceived has copy, drop {
        source_chain_id: u16, // LayerZero chain ID
        sender_address: address, // Original sender from source chain
        recipient_address: address, // Sui recipient address
        points_amount: u64,
        // Add nonce or message ID if available
    }

    // === Errors ===
    const EUNAUTHORIZED: u64 = 1;           // Caller lacks GovernCap
    const EBRIDGING_DISABLED: u64 = 2;      // Bridging is currently disabled in LZConfig
    const EINVALID_DESTINATION_CHAIN: u64 = 3;// Target LayerZero chain ID is not trusted or invalid
    const EINVALID_SOURCE_CHAIN: u64 = 4;   // Source LayerZero chain ID is not trusted or invalid
    const EINVALID_PAYLOAD: u64 = 5;        // Received message payload is invalid or cannot be deserialized
    const EMESSAGE_PROCESSING_FAILED: u64 = 6;// Generic error during message processing
    const EINSUFFICIENT_POINTS: u64 = 7;    // User lacks sufficient points to bridge out
    const EREMOTE_ALREADY_TRUSTED: u64 = 8; // Attempted to add an already trusted remote
    const EREMOTE_NOT_TRUSTED: u64 = 9;     // Attempted to remove or interact with an untrusted remote

    // === Init Function ===

    /// Initializes the shared LZConfig object. Requires GovernCap.
    public entry fun init_lz_config(
        _gov_cap: &GovernCap, // Authorization
        lz_app_address: address, // Address of the deployed LayerZero endpoint contract
        ctx: &mut TxContext
    ) {
        let config_uid = new(ctx);

        let config = LZConfig {
            id: config_uid,
            lz_app_address,
            enabled: false, // Start disabled by default for safety
            trusted_remotes: vector::empty<TrustedRemote>(),
        };

        // Share the config object
        share_object(config);
    }

    // === Entry Functions ===

    /// Sends points cross-chain via LayerZero.
    /// Burns points locally and submits a message to the LayerZero endpoint.
    public entry fun send_bridge_packet(
        admin_config: &AdminConfig, // To check pause state
        lz_config: &LZConfig, // To check enabled state and get LZ app address
        ledger: &mut Ledger, // To burn points
        destination_lz_chain_id: u16, // Target LayerZero chain ID
        recipient_address_bytes: vector<u8>, // Target recipient address on destination chain (as bytes)
        points_amount: u64,
        // Additional parameters for LayerZero fees (e.g., native gas token) would be needed here
        // lz_fee_coin: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert_not_paused(admin_config);
        assert!(lz_config.enabled, EBRIDGING_DISABLED);
        assert!(points_amount > 0, EINVALID_PAYLOAD); // Or use ledger::EZERO_AMOUNT

        let sender_address = sender(ctx);

        // Verify destination chain is trusted (implement find_trusted_remote helper)
        // let _remote_config = find_trusted_remote(lz_config, destination_lz_chain_id); // Aborts if not found

        // Verify sender has enough points
        assert!(get_available_balance(ledger, sender_address) >= points_amount, EINSUFFICIENT_POINTS);

        // 1. Burn points locally
        internal_spend(ledger, sender_address, points_amount, ctx); // Emits ledger::Spent event

        // 2. Prepare LayerZero payload (adapt based on actual requirements)
        // let payload = bcs::to_bytes(&PointsTransferPayload { ... });

        // 3. Call the actual LayerZero endpoint contract function
        // Example placeholder call:
        // layerzero_endpoint::send(
        //      lz_config.lz_app_address,
        //      destination_lz_chain_id,
        //      recipient_address_bytes, // Path for the remote address
        //      payload,
        //      lz_fee_coin, // Pass fee payment
        //      ctx
        // );

        // --- Placeholder Logic ---
        // Abort until actual LZ integration is added
        abort(EMESSAGE_PROCESSING_FAILED);

        // --- Event Emission (after successful LZ send call) ---
        // event::emit(BridgePacketSent {
        //     destination_chain_id: destination_lz_chain_id,
        //     recipient_address: ???, // Need to derive address from bytes if possible for event
        //     points_amount,
        //     sent_by: sender_address
        // });
    }

    /// Receives a message from the LayerZero endpoint.
    /// Verifies the source and processes the message (e.g., mints points).
    /// This function MUST be callable *only* by the registered LayerZero endpoint contract.
    public entry fun receive_bridge_packet(
        admin_config: &AdminConfig, // To check pause state
        lz_config: &LZConfig, // To check enabled state and trusted remotes
        ledger: &mut Ledger, // To mint points
        source_lz_chain_id: u16, // Source LayerZero chain ID provided by LZ endpoint
        _source_address_bytes: vector<u8>, // Source contract address provided by LZ endpoint
        payload: vector<u8>, // The message payload
        ctx: &mut TxContext
    ) {
        // 1. Authorization: Verify sender is the registered LayerZero endpoint
        assert!(sender(ctx) == lz_config.lz_app_address, EUNAUTHORIZED);

        // 2. Check pause/enabled states
        assert_not_paused(admin_config);
        assert!(lz_config.enabled, EBRIDGING_DISABLED);

        // 3. Verify source chain is trusted
        // let _remote_config = find_trusted_remote(lz_config, source_lz_chain_id); // Aborts if not found

        // 4. Deserialize payload (handle potential errors)
        let transfer_data: PointsTransferPayload = match (bcs::from_bytes<PointsTransferPayload>(&payload)) {
             option::Some(data) => data,
             option::None => abort(EINVALID_PAYLOAD),
        };

        // 5. Process message (e.g., mint points)
        assert!(transfer_data.points_amount > 0, EINVALID_PAYLOAD);
        internal_earn(ledger, transfer_data.recipient_address, transfer_data.points_amount, ctx); // Emits ledger::Earned event

        // --- Event Emission ---
        event::emit(BridgePacketReceived {
            source_chain_id: source_lz_chain_id,
            sender_address: transfer_data.sender_address, // Sender from the payload
            recipient_address: transfer_data.recipient_address, // Recipient from the payload
            points_amount: transfer_data.points_amount,
        });

        // Note: Deduplication logic (checking nonces/message IDs) would be crucial here
        // and likely handled in coordination with the LZ endpoint contract.
    }

    // === Governance Functions ===

    /// Enables or disables the bridge functionality. Requires GovernCap.
    public entry fun set_bridge_enabled(
        lz_config: &mut LZConfig,
        _gov_cap: &GovernCap, // Authorization
        enabled: bool,
        ctx: &mut TxContext
    ) {
        if (lz_config.enabled != enabled) {
            lz_config.enabled = enabled;
            event::emit(LZConfigUpdated {
                config_id: id(lz_config),
                enabled,
                updated_by: sender(ctx)
            });
        }
    }

    /// Adds or updates a trusted remote chain configuration. Requires GovernCap.
    public entry fun set_trusted_remote(
        lz_config: &mut LZConfig,
        _gov_cap: &GovernCap, // Authorization
        lz_chain_id: u16,
        remote_address: vector<u8>, // Address on the remote chain
        ctx: &mut TxContext
    ) {
        let i = 0;
        let len = vector::length(&lz_config.trusted_remotes);
        let found = false;
        while (i < len) {
            let remote = vector::borrow_mut(&mut lz_config.trusted_remotes, i);
            if (remote.lz_chain_id == lz_chain_id) {
                // Update existing entry
                remote.remote_address = remote_address;
                found = true;
                break
            };
            i = i + 1;
        };

        if (!found) {
            // Add new entry
            let new_remote = TrustedRemote { lz_chain_id, remote_address };
            vector::push_back(&mut lz_config.trusted_remotes, new_remote);
        };

         event::emit(TrustedRemoteAdded { // Emit Added event for both add and update
            config_id: id(lz_config),
            lz_chain_id,
            remote_address, // Emitting copy
            added_by: sender(ctx)
        });
    }

     /// Removes a trusted remote chain configuration. Requires GovernCap.
    public entry fun remove_trusted_remote(
        lz_config: &mut LZConfig,
        _gov_cap: &GovernCap, // Authorization
        lz_chain_id_to_remove: u16,
        ctx: &mut TxContext
    ) {
        let i = 0;
        let len = vector::length(&lz_config.trusted_remotes);
        let found_index = option::none<u64>();

        while (i < len) {
            let remote = vector::borrow(&lz_config.trusted_remotes, i);
            if (remote.lz_chain_id == lz_chain_id_to_remove) {
                found_index = option::some(i);
                break
            };
            i = i + 1;
        };

        assert!(option::is_some(&found_index), EREMOTE_NOT_TRUSTED);

        let index_to_remove = option::destroy_some(found_index);
        let _removed_remote = vector::swap_remove(&mut lz_config.trusted_remotes, index_to_remove);
        // _removed_remote is dropped

         event::emit(TrustedRemoteRemoved {
            config_id: id(lz_config),
            lz_chain_id: lz_chain_id_to_remove,
            removed_by: sender(ctx)
        });
    }

    // === Helper Functions ===

    // Placeholder - Implement logic to find a trusted remote config by chain ID
    // fun find_trusted_remote(config: &LZConfig, lz_chain_id: u16): &TrustedRemote { ... aborts if not found ... }

}
