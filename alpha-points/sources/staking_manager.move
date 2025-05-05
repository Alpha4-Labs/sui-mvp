/// Module responsible for managing the protocol's collection of native StakedSui objects.
module alpha_points::staking_manager {
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::staked_sui::StakedSui; // Import the StakedSui type
    use sui::event;
    use sui::staking_pool::{Self, WithdrawalTicket}; // Import WithdrawalTicket
    use sui::types::authenticator_state::sui_system_state_summary; // Import system state summary

    // Error Constants
    const EStakeNotFound: u64 = 1;
    const EStakeAlreadyExists: u64 = 2;

    /// Shared object holding the table of native stakes managed by the protocol.
    public struct StakingManager has key {
        id: UID,
        /// Table mapping the StakedSui object ID to the StakedSui object itself.
        native_stakes: Table<ID, StakedSui>
    }

    // Events
    public struct NativeStakeAdded has copy, drop {
        stake_id: ID
    }

    public struct NativeStakeRemoved has copy, drop {
        stake_id: ID
    }

    /// Creates and shares the StakingManager object during protocol initialization.
    /// Only called once from admin::init.
    public(package) fun init(ctx: &mut TxContext) {
        let manager = StakingManager {
            id: object::new(ctx),
            native_stakes: table::new(ctx)
        };
        transfer::share_object(manager);
    }

    /// Adds a StakedSui object to the manager's table.
    /// Called internally from integration::route_stake.
    public(package) fun add_native_stake(
        manager: &mut StakingManager,
        stake_id: ID, // The ID of the staked_sui object itself
        staked_sui: StakedSui,
        _ctx: &TxContext // Context might be needed for future events/logic
    ) {
        assert!(!table::contains(&manager.native_stakes, stake_id), EStakeAlreadyExists);
        table::add(&mut manager.native_stakes, stake_id, staked_sui);
        event::emit(NativeStakeAdded { stake_id });
    }

    /// Removes and returns a StakedSui object from the manager's table using its ID.
    /// Called internally from integration::redeem_stake.
    public(package) fun remove_native_stake(
        manager: &mut StakingManager,
        stake_id: ID, // The ID of the StakedSui object to remove
        _ctx: &TxContext // Context might be needed for future events/logic
    ): StakedSui {
        assert!(table::contains(&manager.native_stakes, stake_id), EStakeNotFound);
        let staked_sui = table::remove(&mut manager.native_stakes, stake_id);
        event::emit(NativeStakeRemoved { stake_id });
        staked_sui
    }

    /// Retrieves a StakedSui object, initiates unstaking via staking_pool::request_remove_stake,
    /// and returns the WithdrawalTicket.
    /// This consumes the StakedSui object from the manager.
    /// Called internally from integration::withdraw_native_stake and integration::admin_withdraw_forfeited_stake.
    public(package) fun retrieve_and_request_unstake(
        manager: &mut StakingManager,
        stake_id: ID, // The ID of the StakedSui object to retrieve and unstake
        ctx: &mut TxContext
    ): WithdrawalTicket {
        // Use existing remove function to get the object and remove from table
        let staked_sui_object = remove_native_stake(manager, stake_id, ctx);

        // Load the system state summary
        let system_state_summary = sui_system_state_summary::load();

        // Call request_remove_stake using the retrieved object
        let withdrawal_ticket = staking_pool::request_remove_stake(
            &mut system_state_summary.sui_system_state,
            staked_sui_object,
            ctx
        );

        withdrawal_ticket
    }

    // === Test-only functions ===

    #[test_only]
    /// Initialize for testing.
    public(package) fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
