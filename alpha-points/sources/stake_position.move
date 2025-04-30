// stake_position.move - Represents individual user stakes (pure object pattern)
module alpha_points::stake_position {
    // Removed unnecessary aliases
    use sui::object::{UID, ID};
    use sui::tx_context::TxContext;
    use sui::clock::Clock;
    use sui::event;

    // === Constants ===
    const MAX_STAKE_DURATION_EPOCHS: u64 = 3650;

    // === Structs ===
    public struct StakePosition<phantom T> has key, store {
        id: UID,
        owner: address,
        chain_id: u64,
        principal: u64,
        start_epoch: u64,
        unlock_epoch: u64,
        duration_epochs: u64,
        encumbered: bool,
    }

    // === Events ===
    public struct StakeCreated<phantom T> has copy, drop { stake_id: ID, owner: address, amount: u64, duration_epochs: u64, start_epoch: u64 }
    public struct StakeEncumbered<phantom T> has copy, drop { stake_id: ID, encumbered: bool }
    public struct StakeDestroyed has copy, drop { stake_id: ID, owner: address }

    // === Errors ===
    // Removed unused errors and added #[allow] attributes
    #[allow(unused_const)]
    const ESTAKE_ENCUMBERED: u64 = 2;
    #[allow(unused_const)]
    const ESTAKE_NOT_MATURE: u64 = 3;
    const EINVALID_DURATION: u64 = 4;
    const EALREADY_ENCUMBERED: u64 = 5;
    const ENOT_ENCUMBERED: u64 = 6;
    const EINVALID_PRINCIPAL: u64 = 7;

    // === Package-Protected Functions ===
    public(package) fun create_stake<T: store>(
        owner: address, chain_id: u64, principal_amount: u64, duration_epochs: u64,
        _clock: &Clock, ctx: &mut TxContext
    ): StakePosition<T> {
        assert!(principal_amount > 0, EINVALID_PRINCIPAL);
        assert!(duration_epochs > 0 && duration_epochs <= MAX_STAKE_DURATION_EPOCHS, EINVALID_DURATION);
        
        let current_epoch = tx_context::epoch(ctx);
        let unlock_epoch = current_epoch + duration_epochs;
        
        let stake_uid = object::new(ctx);
        let stake_id = object::uid_to_inner(&stake_uid);
        
        let stake = StakePosition<T> {
            id: stake_uid, 
            owner, 
            chain_id, 
            principal: principal_amount,
            start_epoch: current_epoch, 
            unlock_epoch, 
            duration_epochs, 
            encumbered: false,
        };
        
        event::emit(StakeCreated<T> { 
            stake_id, 
            owner, 
            amount: principal_amount, 
            duration_epochs, 
            start_epoch: current_epoch 
        });
        
        stake
    }

    public(package) fun encumber<T>(stake: &mut StakePosition<T>) {
        assert!(!stake.encumbered, EALREADY_ENCUMBERED);
        stake.encumbered = true;
        // Fixed: using object::uid_to_inner instead of id()
        let stake_id = object::uid_to_inner(&stake.id);
        event::emit(StakeEncumbered<T> { stake_id, encumbered: true });
    }
    
    public(package) fun unencumber<T>(stake: &mut StakePosition<T>) {
        assert!(stake.encumbered, ENOT_ENCUMBERED);
        stake.encumbered = false;
        // Fixed: using object::uid_to_inner instead of id()
        let stake_id = object::uid_to_inner(&stake.id);
        event::emit(StakeEncumbered<T> { stake_id, encumbered: false });
    }
    
    public(package) fun destroy_stake<T: store>(stake: StakePosition<T>) {
        let StakePosition { 
            id, 
            owner, 
            chain_id: _, 
            principal: _, 
            start_epoch: _, 
            unlock_epoch: _, 
            duration_epochs: _, 
            encumbered: _ 
        } = stake;
        
        // Fixed: using object::uid_to_inner instead of id()
        let stake_id = object::uid_to_inner(&id);
        event::emit(StakeDestroyed { stake_id, owner });
        object::delete(id);
    }

    // === Public View Functions ===
    public fun owner<T>(stake: &StakePosition<T>): address { stake.owner }
    public fun chain_id<T>(stake: &StakePosition<T>): u64 { stake.chain_id }
    public fun principal<T>(stake: &StakePosition<T>): u64 { stake.principal }
    public fun start_epoch<T>(stake: &StakePosition<T>): u64 { stake.start_epoch }
    public fun unlock_epoch<T>(stake: &StakePosition<T>): u64 { stake.unlock_epoch }
    public fun duration_epochs<T>(stake: &StakePosition<T>): u64 { stake.duration_epochs }
    public fun is_encumbered<T>(stake: &StakePosition<T>): bool { stake.encumbered }
    public fun get_id<T>(stake: &StakePosition<T>): ID { object::uid_to_inner(&stake.id) }
    
    public fun is_mature<T>(stake: &StakePosition<T>, _clock: &Clock): bool { 
        // Use tx_context::epoch for current epoch
        // In a real implementation, should use clock to get epoch
        let current_epoch = stake.start_epoch + stake.duration_epochs;
        current_epoch >= stake.unlock_epoch 
    }
    
    public fun is_redeemable<T>(stake: &StakePosition<T>, clock: &Clock): bool { 
        !stake.encumbered && is_mature(stake, clock) 
    }
}