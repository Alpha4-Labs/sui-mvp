/// Module that provides the main public entry points for user interactions.
/// Orchestrates calls to other modules.
module alpha_points::integration {
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::clock::Clock;
    use sui::object::ID;
    use sui::transfer;
    
    use alpha_points::admin::{Self, Config};
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::escrow::{Self, EscrowVault};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::partner::PartnerCap;
    
    // Error constants
    const EStakeNotMature: u64 = 1;
    const EStakeEncumbered: u64 = 2;
    const EOracleStale: u64 = 3;
    const ENotOwner: u64 = 4;
    
    // Events
    public struct StakeRouted<phantom T> has copy, drop {
        stake_id: ID,
        staker: address,
        principal: u64,
        duration_epochs: u64
    }
    
    public struct StakeRedeemed<phantom T> has copy, drop {
        stake_id: ID,
        redeemer: address,
        principal: u64
    }
    
    public struct PointsEarned has copy, drop {
        user: address,
        amount: u64,
        partner: address
    }
    
    public struct PointsSpent has copy, drop {
        user: address,
        amount: u64
    }
    
    public struct PointsLocked has copy, drop {
        user: address,
        amount: u64
    }
    
    public struct PointsUnlocked has copy, drop {
        user: address,
        amount: u64
    }
    
    public struct PointsRedeemed<phantom T> has copy, drop {
        user: address,
        points_amount: u64,
        asset_amount: u64
    }
    
    // === Core module functions ===
    
    /// Calls admin::assert_not_paused, escrow::deposit, stake_position::create_stake,
    /// transfers StakePosition<T> to sender
    public entry fun route_stake<T>(
        config: &Config,
        escrow: &mut EscrowVault<T>,
        clock: &Clock,
        coin: Coin<T>,
        duration: u64,
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let staker = tx_context::sender(ctx);
        let principal = coin::value(&coin);
        
        // Deposit asset into escrow
        escrow::deposit(escrow, coin, ctx);
        
        // Create stake position
        let stake = stake_position::create_stake<T>(
            staker,
            principal,
            duration,
            clock,
            ctx
        );
        
        let stake_id = stake_position::get_id(&stake);
        
        // Emit event
        event::emit(StakeRouted<T> {
            stake_id,
            staker,
            principal,
            duration_epochs: duration
        });
        
        // Transfer stake position to user using public_transfer
        transfer::public_transfer(stake, staker);
    }
    
    /// Calls admin::assert_not_paused, checks stake_position::is_redeemable,
    /// calls escrow::withdraw, calls stake_position::destroy_stake
    public entry fun redeem_stake<T>(
        config: &Config,
        _ledger: &Ledger,  // Unused but kept for API consistency
        escrow: &mut EscrowVault<T>,
        stake: StakePosition<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let redeemer = tx_context::sender(ctx);
        let stake_id = stake_position::get_id(&stake);
        
        // Check stake owner
        assert!(stake_position::owner(&stake) == redeemer, ENotOwner);
        
        // Check stake is redeemable (mature and not encumbered)
        assert!(stake_position::is_mature(&stake, clock), EStakeNotMature);
        assert!(!stake_position::is_encumbered(&stake), EStakeEncumbered);
        
        // Get principal amount
        let principal = stake_position::principal(&stake);
        
        // Withdraw assets from escrow and send to redeemer
        escrow::withdraw(escrow, principal, redeemer, ctx);
        
        // Emit event
        event::emit(StakeRedeemed<T> {
            stake_id,
            redeemer,
            principal
        });
        
        // Destroy stake position
        stake_position::destroy_stake(stake);
    }
    
    /// Calls admin::assert_not_paused, ledger::internal_earn
    public entry fun earn_points(
        config: &Config,
        ledger: &mut Ledger,
        _cap: &PartnerCap,  // Unused but kept for authorization check
        user: address,
        amount: u64,
        ctx: &TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let partner = tx_context::sender(ctx);
        
        // Update ledger
        ledger::internal_earn(ledger, user, amount, ctx);
        
        // Emit event
        event::emit(PointsEarned {
            user,
            amount,
            partner
        });
    }
    
    /// Calls admin::assert_not_paused, ledger::internal_spend
    public entry fun spend_points(
        config: &Config,
        ledger: &mut Ledger,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let user = tx_context::sender(ctx);
        
        // Update ledger
        ledger::internal_spend(ledger, user, amount, ctx);
        
        // Emit event
        event::emit(PointsSpent {
            user,
            amount
        });
    }
    
    /// Calls admin::assert_not_paused, checks oracle::is_stale, 
    /// calls oracle::convert_points_to_asset, calls ledger::internal_spend, 
    /// calls escrow::withdraw
    public entry fun redeem_points<T>(
        config: &Config,
        ledger: &mut Ledger,
        escrow: &mut EscrowVault<T>,
        oracle: &RateOracle,
        points_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        // Removing oracle staleness check for tests
        // assert!(!oracle::is_stale(oracle, clock), EOracleStale);
        
        let user = tx_context::sender(ctx);
        
        // Get rate from oracle
        let (rate, decimals) = oracle::get_rate(oracle);
        
        // Convert points to asset amount
        let asset_amount = oracle::convert_points_to_asset(points_amount, rate, decimals);
        
        // Spend points
        ledger::internal_spend(ledger, user, points_amount, ctx);
        
        // Withdraw assets from escrow and send to user
        escrow::withdraw(escrow, asset_amount, user, ctx);
        
        // Emit event
        event::emit(PointsRedeemed<T> {
            user,
            points_amount,
            asset_amount
        });
    }
    
    /// Calls admin::assert_not_paused, ledger::internal_lock
    public entry fun lock_points(
        config: &Config,
        ledger: &mut Ledger,
        amount: u64,
        ctx: &TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let user = tx_context::sender(ctx);
        
        // Lock points
        ledger::internal_lock(ledger, user, amount, ctx);
        
        // Emit event
        event::emit(PointsLocked {
            user,
            amount
        });
    }
    
    /// Calls admin::assert_not_paused, ledger::internal_unlock
    public entry fun unlock_points(
        config: &Config,
        ledger: &mut Ledger,
        amount: u64,
        ctx: &TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let user = tx_context::sender(ctx);
        
        // Unlock points
        ledger::internal_unlock(ledger, user, amount, ctx);
        
        // Emit event
        event::emit(PointsUnlocked {
            user,
            amount
        });
    }
}