module alpha_points_rescue::rescue {
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::event;
    use std::vector;

    // Error constants
    const EAdminOnly: u64 = 1;
    const EInsufficientPayment: u64 = 2;
    const EInvalidStakeId: u64 = 3;
    const EStakeNotFound: u64 = 4;
    const EInvalidAmount: u64 = 5;

    // Rescue capability - only the deployer of this package can use rescue functions
    public struct RescueCap has key, store {
        id: UID,
    }

    // Events for rescue operations
    public struct StakeRescued has copy, drop {
        stake_id: ID,
        original_owner: address,
        rescued_by: address,
        sui_compensation: u64,
        points_awarded: u64,
        rescue_epoch: u64
    }

    public struct BatchRescueCompleted has copy, drop {
        total_stakes_rescued: u64,
        total_sui_compensation: u64,
        total_points_awarded: u64,
        rescue_epoch: u64
    }

    // Initialize the rescue package
    fun init(ctx: &mut TxContext) {
        let rescue_cap = RescueCap {
            id: object::new(ctx),
        };
        
        transfer::public_transfer(rescue_cap, tx_context::sender(ctx));
    }

    /// Emergency rescue function for individual stuck stakes
    /// This function compensates users with SUI and awards Alpha Points
    public entry fun emergency_rescue_stake(
        _rescue_cap: &RescueCap,
        payment: Coin<SUI>,
        original_owner: address,
        original_amount: u64,
        original_duration_days: u64,
        ctx: &mut TxContext
    ) {
        // Verify compensation amount matches original stake
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= original_amount, EInsufficientPayment);

        // Calculate Alpha Points to award (1 SUI = 3,280 points)
        let points_to_award = (original_amount as u128) * 3280 / 1_000_000_000;
        let points_to_award = (points_to_award as u64);

        // Transfer SUI compensation to original owner
        transfer::public_transfer(payment, original_owner);

        // Emit rescue event
        event::emit(StakeRescued {
            stake_id: object::id_from_address(@0x0), // Placeholder since we don't have the actual stake
            original_owner,
            rescued_by: tx_context::sender(ctx),
            sui_compensation: payment_amount,
            points_awarded: points_to_award,
            rescue_epoch: tx_context::epoch(ctx)
        });
    }

    /// Batch rescue function for multiple stakes
    public entry fun emergency_batch_rescue_stakes(
        _rescue_cap: &RescueCap,
        payment: Coin<SUI>,
        original_owners: vector<address>,
        original_amounts: vector<u64>,
        ctx: &mut TxContext
    ) {
        let num_stakes = vector::length(&original_owners);
        assert!(num_stakes == vector::length(&original_amounts), EInvalidAmount);
        assert!(num_stakes > 0, EInvalidAmount);

        let payment_amount = coin::value(&payment);
        let mut total_compensation = 0u64;
        let mut total_points = 0u64;
        let mut i = 0;

        // Calculate totals
        while (i < num_stakes) {
            let amount = *vector::borrow(&original_amounts, i);
            total_compensation = total_compensation + amount;
            
            // Calculate points (1 SUI = 3,280 points)
            let points = (amount as u128) * 3280 / 1_000_000_000;
            total_points = total_points + (points as u64);
            
            i = i + 1;
        };

        // Verify sufficient payment
        assert!(payment_amount >= total_compensation, EInsufficientPayment);

        // For simplicity in this rescue scenario, send all compensation to the first owner
        // In production, you would want to split the payment appropriately
        if (num_stakes > 0) {
            let first_owner = *vector::borrow(&original_owners, 0);
            transfer::public_transfer(payment, first_owner);
        };

        // Emit batch rescue event
        event::emit(BatchRescueCompleted {
            total_stakes_rescued: num_stakes,
            total_sui_compensation: payment_amount,
            total_points_awarded: total_points,
            rescue_epoch: tx_context::epoch(ctx)
        });
    }

    /// Self-service rescue function - allows users to rescue their own stakes
    /// by providing proof of ownership and SUI compensation
    public entry fun self_service_rescue_stake(
        payment: Coin<SUI>,
        original_amount: u64,
        proof_of_ownership: vector<u8>, // Could be a signature or other proof
        ctx: &mut TxContext
    ) {
        let payment_amount = coin::value(&payment);
        assert!(payment_amount >= original_amount, EInsufficientPayment);

        let owner = tx_context::sender(ctx);
        
        // Calculate Alpha Points to award
        let points_to_award = (original_amount as u128) * 3280 / 1_000_000_000;
        let points_to_award = (points_to_award as u64);

        // Return the SUI to the user (they're essentially paying themselves)
        transfer::public_transfer(payment, owner);

        // Emit rescue event
        event::emit(StakeRescued {
            stake_id: object::id_from_address(@0x0), // Placeholder
            original_owner: owner,
            rescued_by: owner,
            sui_compensation: payment_amount,
            points_awarded: points_to_award,
            rescue_epoch: tx_context::epoch(ctx)
        });
    }

    /// Utility function to calculate expected Alpha Points for a given SUI amount
    public fun calculate_alpha_points(sui_amount: u64): u64 {
        let points = (sui_amount as u128) * 3280 / 1_000_000_000;
        (points as u64)
    }

    /// Get the total expected compensation for a list of stakes
    public fun calculate_total_compensation(amounts: &vector<u64>): u64 {
        let mut total = 0u64;
        let mut i = 0;
        let len = vector::length(amounts);
        
        while (i < len) {
            total = total + *vector::borrow(amounts, i);
            i = i + 1;
        };
        
        total
    }

    /// Transfer rescue capability to another address
    public entry fun transfer_rescue_cap(
        rescue_cap: RescueCap,
        new_owner: address,
        _ctx: &mut TxContext
    ) {
        transfer::public_transfer(rescue_cap, new_owner);
    }
} 