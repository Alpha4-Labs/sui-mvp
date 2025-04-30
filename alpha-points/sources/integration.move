// integration.move - Public entry points for the Alpha Points protocol
module alpha_points::integration {
    use sui::object::ID;
    use sui::tx_context::TxContext;
    use sui::coin::Coin;
    use sui::clock::Clock;
    use sui::event;
    use std::type_name::{get, TypeName}; // Correct import for TypeName

    // Import sibling modules and specific functions/structs
    use alpha_points::admin::{Config, assert_not_paused};
    use alpha_points::partner::PartnerCap;
    use alpha_points::ledger::{Ledger, internal_earn, internal_spend, internal_lock, internal_unlock};
    use alpha_points::escrow::{EscrowVault, deposit as escrow_deposit, withdraw as escrow_withdraw};
    use alpha_points::stake_position::{
        StakePosition, create_stake, destroy_stake, get_id as stake_get_id,
        is_redeemable as stake_is_redeemable, owner as stake_owner
    };
    use alpha_points::oracle::{
        RateOracle, is_stale as oracle_is_stale, 
        get_rate as oracle_get_rate, convert_points_to_asset
    };

    // === Events ===
    public struct StakeRouted<phantom T> has copy, drop { user: address, amount: u64, duration_epochs: u64, stake_id: ID }
    public struct StakeRedeemed<phantom T> has copy, drop { user: address, amount: u64, stake_id: ID }
    public struct PointsRedeemed<phantom T> has copy, drop { user: address, points_amount: u64, asset_amount: u64, asset_type: TypeName }

    // === Errors ===
    const EINVALID_AMOUNT: u64 = 101;
    const ESTAKE_NOT_OWNED: u64 = 102;
    const ESTAKE_NOT_REDEEMABLE: u64 = 103;
    const EORACLE_STALE: u64 = 104;
    
    // === Entry Functions ===
    public entry fun route_stake<T: store>(
        config: &Config, 
        ledger: &mut Ledger, 
        escrow_vault: &mut EscrowVault<T>, 
        asset_coin: Coin<T>, 
        duration_epochs: u64, 
        clock: &Clock, 
        ctx: &mut TxContext
    ) {
        // Fixed: use ledger parameter since it's required
        // This prevents "unused parameter" warning
        let _ = ledger;
        
        // Check protocol not paused
        assert_not_paused(config);
        
        // Validate inputs
        let stake_amount = sui::coin::value(&asset_coin);
        assert!(stake_amount > 0, EINVALID_AMOUNT);
        assert!(duration_epochs > 0, EINVALID_AMOUNT);
        
        // Deposit asset to escrow
        escrow_deposit(escrow_vault, asset_coin, ctx);
        
        // Create stake position
        let user = tx_context::sender(ctx);
        let stake = create_stake<T>(
            user, 
            0, // Chain ID 0 for local chain
            stake_amount,
            duration_epochs,
            clock, 
            ctx
        );
        
        // Fixed: using stake_get_id accessor function
        let stake_id = stake_get_id(&stake);
        
        // Emit event
        event::emit(StakeRouted<T> {
            user,
            amount: stake_amount,
            duration_epochs,
            stake_id
        });
        
        // Transfer stake to user
        sui::transfer::public_transfer(stake, user);
    }
    
    public entry fun redeem_stake<T: store>(
        config: &Config, 
        escrow_vault: &mut EscrowVault<T>, 
        stake: StakePosition<T>, 
        clock: &Clock, 
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(config);
        
        // Validate ownership
        let user = tx_context::sender(ctx);
        assert!(stake_owner(&stake) == user, ESTAKE_NOT_OWNED);
        
        // Check if stake is redeemable (mature and not encumbered)
        assert!(stake_is_redeemable(&stake, clock), ESTAKE_NOT_REDEEMABLE);
        
        // Get amount to redeem
        let amount = alpha_points::stake_position::principal(&stake);
        // Fixed: using stake_get_id instead of direct access
        let stake_id = stake_get_id(&stake);
        
        // Withdraw from escrow
        escrow_withdraw(escrow_vault, amount, user, ctx);
        
        // Emit event
        event::emit(StakeRedeemed<T> {
            user,
            amount,
            stake_id
        });
        
        // Destroy the stake
        destroy_stake(stake);
    }
    
    public entry fun earn_points(
        config: &Config, 
        ledger: &mut Ledger, 
        _auth_cap: &PartnerCap, 
        user: address, 
        points_to_earn: u64, 
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(config);
        
        // Validate inputs
        assert!(points_to_earn > 0, EINVALID_AMOUNT);
        
        // The PartnerCap is required to call this function
        // Framework automatically checks that _auth_cap is owned by caller
        
        // Award points to the user
        internal_earn(ledger, user, points_to_earn, ctx);
    }
    
    public entry fun spend_points(
        config: &Config, 
        ledger: &mut Ledger, 
        points_to_spend: u64, 
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(config);
        
        // Validate inputs
        assert!(points_to_spend > 0, EINVALID_AMOUNT);
        
        // Spend points from the caller
        let user = tx_context::sender(ctx);
        internal_spend(ledger, user, points_to_spend, ctx);
    }
    
    public entry fun redeem_points<T: store + drop>(
        config: &Config,
        ledger: &mut Ledger,
        escrow_vault: &mut EscrowVault<T>,
        oracle: &RateOracle,
        points_to_redeem: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert_not_paused(config);
        assert!(points_to_redeem > 0, EINVALID_AMOUNT);
        
        let user = tx_context::sender(ctx);
        assert!(!oracle_is_stale(oracle, clock), EORACLE_STALE);
        
        let (rate, decimals) = oracle_get_rate(oracle);
        let asset_amount = convert_points_to_asset(points_to_redeem, rate, decimals);
        assert!(asset_amount > 0, EINVALID_AMOUNT);
        
        internal_spend(ledger, user, points_to_redeem, ctx);
        escrow_withdraw<T>(escrow_vault, asset_amount, user, ctx);
        
        event::emit(PointsRedeemed<T> { 
            user, 
            points_amount: points_to_redeem, 
            asset_amount, 
            asset_type: get<T>() 
        });
    }
    
    public entry fun lock_points(
        config: &Config,
        ledger: &mut Ledger,
        points_to_lock: u64,
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(config);
        
        // Validate inputs
        assert!(points_to_lock > 0, EINVALID_AMOUNT);
        
        // Lock points for the caller
        let user = tx_context::sender(ctx);
        internal_lock(ledger, user, points_to_lock, ctx);
    }
    
    public entry fun unlock_points(
        config: &Config,
        ledger: &mut Ledger,
        points_to_unlock: u64,
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(config);
        
        // Validate inputs
        assert!(points_to_unlock > 0, EINVALID_AMOUNT);
        
        // Unlock points for the caller
        let user = tx_context::sender(ctx);
        internal_unlock(ledger, user, points_to_unlock, ctx);
    }

    // === Feature Flagged Function Stub ===
    // Correct cfg syntax - commented out until feature defined
    // #[cfg(feature = lz_bridge)]
    // public entry fun send_bridge_message( ... ) { ... }
}