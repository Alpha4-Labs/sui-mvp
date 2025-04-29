// stake_position.move - Represents individual user stakes (pure object pattern)
module alpha_points::stake_position {
    use sui::object::{Self, ID, UID, delete, id, new, uid_to_inner, owner as object_owner};
    use sui::tx_context::{Self, TxContext}; // Removed unused Self import
    use sui::clock::{Self, Clock, epoch};
    use sui::transfer; // Only needed if transferring stake object directly (usually done by caller)
    use sui::event;

    // Functions marked public(package) are callable from other modules in this package
    // (Replacing deprecated 'friend')

    // === Constants ===
    // Example: Maximum stake duration allowed in epochs (approx 1 year if epoch=1 day)
    const MAX_STAKE_DURATION_EPOCHS: u64 = 3650; // Capped at ~10 years based on 1 day epoch example

    // === Structs ===
    // Added 'public' visibility
    public struct StakePosition<phantom T> has key {
        id: UID,
        owner: address, // Sui address that owns this StakePosition object
        chain_id: u64, // Chain where the stake originated (relevant for potential bridging)
        principal: u64, // Amount staked (in the native units of asset T)
        start_epoch: u64, // Epoch when stake started
        unlock_epoch: u64, // Epoch when principal can be withdrawn
        duration_epochs: u64, // The original duration locked for
        encumbered: bool, // If locked by another process (e.g., loan module)
    }

    // === Events ===
    // Added 'public' visibility, updated fields as requested
    public struct StakeCreated<phantom T> has copy, drop {
        stake_id: ID,
        owner: address,
        amount: u64, // Renamed from principal for event clarity
        duration_epochs: u64,
        start_epoch: u64, // Included for context
        // unlock_epoch can be derived from start_epoch + duration_epochs
    }

    // Added 'public' visibility
    public struct StakeEncumbered<phantom T> has copy, drop {
        stake_id: ID,
        encumbered: bool // The new state (true if encumbered, false if unencumbered)
    }

    // Added 'public' visibility, updated fields as requested
    public struct StakeDestroyed has copy, drop { // Removed phantom T as principal is removed
        stake_id: ID,
        owner: address,
    }

    // === Errors ===
    // Standardized error codes
    const ESTAKE_NOT_OWNER: u64 = 1;    // Caller is not the owner of the stake object
    const ESTAKE_ENCUMBERED: u64 = 2;   // Stake is currently encumbered (e.g., by a loan) and cannot be redeemed/destroyed
    const ESTAKE_NOT_MATURE: u64 = 3;   // Stake lock duration has not yet passed
    const EINVALID_DURATION: u64 = 4;   // Stake duration is zero or exceeds maximum allowed
    const EALREADY_ENCUMBERED: u64 = 5; // Attempted to encumber an already encumbered stake
    const ENOT_ENCUMBERED: u64 = 6;     // Attempted to unencumber a stake that was not encumbered
    const EINVALID_PRINCIPAL: u64 = 7;  // Principal amount must be greater than zero

    // === Package-Protected Functions ===

    /// Creates a new StakePosition object for asset T.
    /// Called by integration::route_stake.
    public(package) fun create_stake<T: store>( // T needs store for StakePosition key ability
        owner: address,
        chain_id: u64, // Consider validation if specific chain IDs are expected
        principal_amount: u64,
        duration_epochs: u64,
        clock: &Clock,
        ctx: &TxContext
    ): StakePosition<T> {
        assert!(principal_amount > 0, EINVALID_PRINCIPAL);
        assert!(duration_epochs > 0 && duration_epochs <= MAX_STAKE_DURATION_EPOCHS, EINVALID_DURATION);

        let current_epoch = epoch(clock);
        let unlock_epoch = current_epoch + duration_epochs;

        let stake_uid = new(ctx); // Get the UID for the new object
        let stake_id = object::uid_to_inner(&stake_uid); // Get the ID from UID for events

        let stake = StakePosition<T> {
            id: stake_uid,
            owner,
            chain_id,
            principal: principal_amount,
            start_epoch: current_epoch,
            unlock_epoch,
            duration_epochs, // Store original duration
            encumbered: false,
        };

        event::emit(StakeCreated<T> {
            stake_id,
            owner,
            amount: principal_amount,
            duration_epochs,
            start_epoch: current_epoch
        });

        // Ownership is typically transferred by the caller (e.g., integration module)
        stake
    }

    /// Marks a stake as encumbered (e.g., for a loan).
    /// Typically called by the loan module.
    /// Note: Does not require a specific LoanCap currently, relies on package visibility.
    public(package) fun encumber<T>(stake: &mut StakePosition<T>) {
        assert!(!stake.encumbered, EALREADY_ENCUMBERED);
        stake.encumbered = true;

        event::emit(StakeEncumbered<T> {
            stake_id: id(stake),
            encumbered: true // New state is encumbered
        });
    }

    /// Marks a stake as unencumbered (e.g., after loan repayment).
    /// Typically called by the loan module.
    public(package) fun unencumber<T>(stake: &mut StakePosition<T>) {
        assert!(stake.encumbered, ENOT_ENCUMBERED);
        stake.encumbered = false;

        event::emit(StakeEncumbered<T> {
            stake_id: id(stake),
            encumbered: false // New state is unencumbered
        });
    }


    /// Destroys a StakePosition object.
    /// Called by integration::redeem_stake after principal has been withdrawn.
    /// Assumes necessary checks (maturity, ownership, not encumbered) are performed by the caller.
    public(package) fun destroy_stake<T: store>(
        stake: StakePosition<T> // Consumes the stake object
    ) {
        // Unpack the object to get required fields for the event and the ID for deletion
        let StakePosition {
            id,
            owner,
            chain_id: _, // Field ignored
            principal: _, // Field ignored for event
            start_epoch: _, // Field ignored
            unlock_epoch: _, // Field ignored
            duration_epochs: _, // Field ignored
            encumbered: _ // Field ignored (caller should assert !encumbered before calling)
        } = stake;

        let stake_id = uid_to_inner(&id);

        event::emit(StakeDestroyed { // Removed phantom T type argument
            stake_id,
            owner
        });

        // Delete the object from storage
        delete(id);
    }

    // === Public View Functions ===

    /// Returns the owner address of the StakePosition.
    public fun owner<T>(stake: &StakePosition<T>): address {
        stake.owner
    }

    /// Returns the chain ID where the stake originated.
    public fun chain_id<T>(stake: &StakePosition<T>): u64 {
        stake.chain_id
    }

    /// Returns the principal amount staked.
    public fun principal<T>(stake: &StakePosition<T>): u64 {
        stake.principal
    }

    /// Returns the epoch when the stake was created.
    public fun start_epoch<T>(stake: &StakePosition<T>): u64 {
        stake.start_epoch
    }

    /// Returns the epoch when the stake becomes unlockable.
    public fun unlock_epoch<T>(stake: &StakePosition<T>): u64 {
        stake.unlock_epoch
    }

    /// Returns the original duration of the stake lock in epochs.
    public fun duration_epochs<T>(stake: &StakePosition<T>): u64 {
        stake.duration_epochs
    }

    /// Returns true if the stake is currently encumbered, false otherwise.
    public fun is_encumbered<T>(stake: &StakePosition<T>): bool {
        stake.encumbered
    }

    /// Returns true if the current epoch is greater than or equal to the unlock epoch.
    public fun is_mature<T>(stake: &StakePosition<T>, clock: &Clock): bool {
        epoch(clock) >= stake.unlock_epoch
    }

    /// Checks if the stake can be redeemed (must be mature and not encumbered).
    public fun is_redeemable<T>(stake: &StakePosition<T>, clock: &Clock): bool {
        !stake.encumbered && is_mature(stake, clock)
    }
}