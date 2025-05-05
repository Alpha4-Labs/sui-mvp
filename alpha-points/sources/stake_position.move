/// Module that defines and manages the user's stake representation as a Move object.
module alpha_points::stake_position {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::math; // Import for multiplication

    const ENotMature: u64 = 1;
    // const EEncumbered: u64 = 2; // Kept commented as encumbered logic is elsewhere
    // const ENotOwner: u64 = 3; // Kept commented

    const MS_PER_DAY: u64 = 24 * 60 * 60 * 1000;

    /// Owned object representing a user's stake of asset T.
    /// T is phantom as the actual asset is in escrow.
    public struct StakePosition<phantom T> has key, store {
        id: UID,
        owner: address,
        principal: u64,
        start_time_ms: u64,
        unlock_time_ms: u64,
        duration_days: u64, // Store original duration in days for clarity
        encumbered: bool, // True if used as collateral for a loan
        // --- Field for Native Staking ID ---
        native_stake_id: ID, // ID of the associated StakedSui object if natively staked
        // ---------------------------------
        last_claim_epoch: u64 // Epoch when points were last claimed for this stake
    }

    // Events
    public struct StakeCreated<phantom T> has copy, drop {
        id: ID,
        owner: address,
        principal: u64,
        duration_days: u64,
        unlock_time_ms: u64
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

    /// Creates a new StakePosition object using timestamps
    public(package) fun create_stake<T>(
        owner: address,
        principal: u64,
        duration_days: u64, // Accept duration in days
        clock: &Clock,
        native_stake_id: ID, // Changed from Option<ID>
        ctx: &mut TxContext
    ): StakePosition<T> {
        assert!(duration_days > 0, 0); // Basic validation
        
        let start_time_ms = clock::timestamp_ms(clock);
        let current_epoch = clock::epoch(clock); // Get current epoch
        // Use standard multiplication; overflow is highly unlikely for realistic durations
        let duration_ms = duration_days * MS_PER_DAY; 
        let unlock_time_ms = start_time_ms + duration_ms;

        let id = object::new(ctx);

        event::emit(StakeCreated<T> {
            id: object::uid_to_inner(&id),
            owner,
            principal,
            duration_days,
            unlock_time_ms
        });

        StakePosition<T> {
            id,
            owner,
            principal,
            start_time_ms,
            unlock_time_ms,
            duration_days,
            encumbered: false,
            native_stake_id, // Store the native ID
            last_claim_epoch: current_epoch // Initialize last claim to current epoch
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
            start_time_ms: _,
            unlock_time_ms: _,
            duration_days: _,
            encumbered: _,
            native_stake_id: _, // Destructure native ID
            last_claim_epoch: _ // Destructure last claim epoch
        } = stake;

        event::emit(StakeDestroyed<T> {
            id: object::uid_to_inner(&id),
            owner,
            principal
        });

        object::delete(id);
    }

    /// Sets the encumbered flag
    public(package) fun set_encumbered<T>(
        stake: &mut StakePosition<T>,
        value: bool
    ) {
        stake.encumbered = value;

        event::emit(StakeEncumbered<T> {
            id: object::uid_to_inner(&stake.id),
            encumbered: value
        });
    }

    /// Updates the last_claim_epoch field.
    /// Called internally after points are claimed.
    public(package) fun set_last_claim_epoch<T>(
        stake: &mut StakePosition<T>,
        epoch: u64
    ) {
        stake.last_claim_epoch = epoch;
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

    /// Returns the duration in days
    public fun duration_days<T>(stake: &StakePosition<T>): u64 {
        stake.duration_days
    }

    /// Returns the unlock timestamp in milliseconds
    public fun unlock_time_ms<T>(stake: &StakePosition<T>): u64 {
        stake.unlock_time_ms
    }
    
    /// Returns the start timestamp in milliseconds
    public fun start_time_ms<T>(stake: &StakePosition<T>): u64 {
        stake.start_time_ms
    }

    /// Returns whether the stake is encumbered
    public fun is_encumbered<T>(stake: &StakePosition<T>): bool {
        stake.encumbered
    }

    /// Returns the Option<ID> of the associated native stake, if any
    public fun get_native_stake_id<T>(stake: &StakePosition<T>): ID {
        stake.native_stake_id
    }

    /// Returns the epoch when points were last claimed for this stake
    public fun last_claim_epoch<T>(stake: &StakePosition<T>): u64 {
        stake.last_claim_epoch
    }

    /// Returns whether the stake is mature based on timestamp
    public fun is_mature<T>(stake: &StakePosition<T>, clock: &Clock): bool {
        let current_time_ms = clock::timestamp_ms(clock);
        current_time_ms >= stake.unlock_time_ms
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