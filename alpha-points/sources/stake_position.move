/// Module that defines and manages the user's stake representation as a Move object.
module alpha_points::stake_position {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::event;
    use sui::clock::Clock;

    // Error constants - Commented out since unused, but kept for future reference
    // const ENotMature: u64 = 1;
    // const EEncumbered: u64 = 2;
    // const ENotOwner: u64 = 3;

    /// Owned object representing a user's stake of asset T.
    /// T is phantom as the actual asset is in escrow.
    public struct StakePosition<phantom T> has key, store {
        id: UID,
        owner: address,
        principal: u64,
        start_epoch: u64,
        unlock_epoch: u64,
        duration_epochs: u64,
        encumbered: bool
    }

    // Events
    public struct StakeCreated<phantom T> has copy, drop {
        id: ID,
        owner: address,
        principal: u64,
        duration_epochs: u64,
        unlock_epoch: u64
    }

    public struct StakeDestroyed<phantom T> has copy, drop {
        id: ID,
        owner: address,
        principal: u64
    }

    public struct StakeEncumbered<phantom T> has copy, drop {
        id: ID,
        encumbered: bool
    }

    // === Test-only functions ===
    #[test_only]
    /// Helper function for tests to set encumbered flag
    public fun test_set_encumbered<T>(
        stake: &mut StakePosition<T>, 
        value: bool
    ) {
        set_encumbered(stake, value);
    }

    // === Core module functions ===

    /// Creates a new StakePosition object
    public(package) fun create_stake<T>(
        owner: address,
        principal: u64,
        duration_epochs: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): StakePosition<T> {
        // Get current time as starting point
        let start_time_ms = sui::clock::timestamp_ms(clock);
        
        // Convert to epochs based on your epoch definition
        // Simple example: 1 epoch = 1 day = 86400000 ms
        let start_epoch = start_time_ms / 86400000;
        
        // Calculate unlock epoch
        let unlock_epoch = start_epoch + duration_epochs;
        
        // Create stake object
        let id = object::new(ctx);
        
        // Event emission
        event::emit(StakeCreated<T> {
            id: object::uid_to_inner(&id),
            owner,
            principal,
            duration_epochs,
            unlock_epoch
        });
        
        StakePosition<T> {
            id,
            owner,
            principal,
            start_epoch,
            unlock_epoch,
            duration_epochs,
            encumbered: false
        }
    }

    /// Consumes and destroys the stake object
    public(package) fun destroy_stake<T>(
        stake: StakePosition<T>
    ) {
        let StakePosition {
            id,
            owner,
            principal,
            start_epoch: _,
            unlock_epoch: _,
            duration_epochs: _,
            encumbered: _
        } = stake;
        
        // Event emission
        event::emit(StakeDestroyed<T> {
            id: object::uid_to_inner(&id),
            owner,
            principal
        });
        
        // Delete object
        object::delete(id);
    }

    /// Sets the encumbered flag
    public(package) fun set_encumbered<T>(
        stake: &mut StakePosition<T>,
        value: bool
    ) {
        stake.encumbered = value;
        
        // Event emission
        event::emit(StakeEncumbered<T> {
            id: object::uid_to_inner(&stake.id),
            encumbered: value
        });
    }

    // === View functions ===

    /// Returns the owner of the stake
    public fun owner<T>(stake: &StakePosition<T>): address {
        stake.owner
    }

    /// Returns the principal amount of the stake
    public fun principal<T>(stake: &StakePosition<T>): u64 {
        stake.principal
    }

    /// Returns the duration in epochs
    public fun duration_epochs<T>(stake: &StakePosition<T>): u64 {
        stake.duration_epochs
    }

    /// Returns the unlock epoch
    public fun unlock_epoch<T>(stake: &StakePosition<T>): u64 {
        stake.unlock_epoch
    }

    /// Returns whether the stake is encumbered
    public fun is_encumbered<T>(stake: &StakePosition<T>): bool {
        stake.encumbered
    }

    /// Returns whether the stake is mature
    public fun is_mature<T>(stake: &StakePosition<T>, clock: &Clock): bool {
        // Get current time
        let current_time_ms = sui::clock::timestamp_ms(clock);
        
        // Convert to epochs based on your epoch definition
        // Simple example: 1 epoch = 1 day = 86400000 ms
        let current_epoch = current_time_ms / 86400000;
        
        // Stake is mature if current epoch >= unlock epoch
        current_epoch >= stake.unlock_epoch
    }

    /// Returns whether the stake is redeemable (mature and not encumbered)
    public fun is_redeemable<T>(stake: &StakePosition<T>, clock: &Clock): bool {
        is_mature(stake, clock) && !is_encumbered(stake)
    }

    /// Returns the object ID
    public fun get_id<T>(stake: &StakePosition<T>): ID {
        object::uid_to_inner(&stake.id)
    }
}