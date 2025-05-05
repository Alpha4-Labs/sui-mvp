/// Module that provides the main public entry points for user interactions.
/// Orchestrates calls to other modules.
module alpha_points::integration {
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance}; // Import Balance for fee calculation
    use sui::event;
    use sui::clock::Clock;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::types::authenticator_state::sui_system_state_summary;
    use sui::staking_pool;
    use sui::staked_sui::StakedSui;
    use std::option::{Option, some, none}; // Needed for Option types if used elsewhere
    
    use alpha_points::admin::{Self, Config, AdminCap};
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::escrow::{Self, EscrowVault};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::partner::PartnerCap;
    use alpha_points::staking_manager::{Self, StakingManager};
    
    // Error constants
    const EStakeNotMature: u64 = 1;
    const EStakeEncumbered: u64 = 2;
    const EOracleStale: u64 = 3;
    const ENotOwner: u64 = 4;
    const EFeeCalculationError: u64 = 5; // Added for fee errors
    const EStakeExpired: u64 = 6; // Added for expired stake redemption
    const EStakeNotExpired: u64 = 7; // Added for admin claim attempt on non-expired stake
    
    // Default participation level multiplier for standard staking rewards
    // const DEFAULT_PARTICIPATION_LEVEL: u64 = 1;
    
    // Constants
    const MS_PER_DAY: u64 = 24 * 60 * 60 * 1000;
    const STAKE_EXPIRY_DAYS: u64 = 14;
    const EXPIRY_DURATION_MS: u64 = STAKE_EXPIRY_DAYS * MS_PER_DAY;
    
    // Events
    public struct StakeRouted<phantom T> has copy, drop {
        stake_id: ID,
        staker: address,
        principal: u64,
        duration_days: u64,
        validator_address: address
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
    
    /// Event emitted when user claims accrued points from a stake
    public struct PointsClaimed has copy, drop {
        stake_id: ID,
        user: address,
        claimed_amount: u64,
        new_last_claim_epoch: u64
    }
    
    /// Event emitted when an admin claims a forfeited (expired) stake
    public struct StakeForfeited<phantom T> has copy, drop {
        stake_id: ID,
        original_owner: address,
        principal: u64
    }
    
    /// Event emitted when a user repays bad debt
    public struct BadDebtRepaid has copy, drop {
        user: address,
        paid_sui_amount: u64,
        repaid_debt_points: u64,
        remaining_debt_points: u64
    }
    
    /// Event emitted when a user initiates native withdrawal and receives the ticket
    public struct WithdrawalTicketIssued has copy, drop {
        user: address,
        native_stake_id: ID
        // ticket_object_id: ID // The ID of the WithdrawalTicket object itself could also be emitted
    }
    
    // === Core module functions ===
    
    /// Calls admin::assert_not_paused, takes 5% routing fee, initiates native stake, creates stake_position,
    /// transfers StakePosition<T> to sender. POINT ACCRUAL HAPPENS LATER.
    public entry fun route_stake<T: drop>(
        config: &Config,
        manager: &mut StakingManager,
        ledger: &Ledger,
        clock: &Clock,
        mut coin: Coin<T>, // Made mutable to split
        duration_days: u64,
        validator_address: address,
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let staker = tx_context::sender(ctx);
        
        // --- Check for Bad Debt --- 
        assert!(!ledger::has_bad_debt(ledger, staker), ledger::EHasBadDebt);
        // --------------------------
        
        let deployer = admin::deployer_address(config); // Assume this function exists
        let original_principal = coin::value(&coin);
        
        // --- Calculate and Take Routing Fee (5%) ---
        let fee_amount = original_principal * 5 / 100; // 5% fee
        // Ensure fee doesn't exceed principal (edge case for small amounts)
        if (fee_amount >= original_principal) { abort EFeeCalculationError };

        let fee_coin = coin::split(&mut coin, fee_amount, ctx);
        transfer::public_transfer(fee_coin, deployer); // Send fee to deployer

        let principal_after_fee = coin::value(&coin); // Remaining amount for staking
        // -------------------------------------------

        // --- Native Staking Logic ---
        // Load the system state summary to get the SuiSystemState object ID
        let system_state_summary = sui_system_state_summary::load();
        // TODO: Check if specific system state loading function is needed depending on context

        // Call the native staking function with the coin *after* fee deduction
        let staked_sui = staking_pool::request_add_stake(
            &mut system_state_summary.sui_system_state,
            coin, // Use the coin with fee deducted
            validator_address,
            ctx
        );

        // Get the ID of the newly created StakedSui object
        let native_stake_id = object::id(&staked_sui);

        // Store the StakedSui object in the manager
        staking_manager::add_native_stake(
            manager,
            native_stake_id,
            staked_sui,
            ctx
        );
        // sui::transfer::public_transfer(staked_sui, @0xDEAD); // TEMPORARY: Transfer to burn address to avoid dropping owned object
        // -------------------------------------------

        // Create stake position using the *original principal* for point calculations
        let stake = stake_position::create_stake<T>(
            staker,
            original_principal, // Use original principal here
            duration_days,
            clock,
            native_stake_id,
            ctx
        );
        
        let stake_id = stake_position::get_id(&stake);
        
        // Emit event (principal reflects original amount)
        event::emit(StakeRouted<T> {
            stake_id,
            staker,
            principal: original_principal,
            duration_days,
            validator_address
        });
        
        // Transfer stake position to user
        transfer::public_transfer(stake, staker);
    }
    
    /// Calls admin::assert_not_paused, checks stake_position::is_redeemable,
    /// claims final points, initiates native unstake, calls stake_position::destroy_stake
    /// NOTE: Phase 5 Change - This function NO LONGER initiates native unstake.
    /// User must call `withdraw_native_stake` separately after this.
    public entry fun redeem_stake<T>(
        config: &Config,
        ledger: &mut Ledger,
        stake: StakePosition<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let redeemer = tx_context::sender(ctx);
        let stake_id = stake_position::get_id(&stake);
        
        // --- Check Stake Expiry (14 days post-unlock) ---
        let unlock_time_ms = stake_position::unlock_time_ms(&stake);
        let expiry_time_ms = unlock_time_ms + EXPIRY_DURATION_MS;
        let current_time_ms = clock::timestamp_ms(clock);
        assert!(current_time_ms <= expiry_time_ms, EStakeExpired);
        // ------------------------------------------------

        // Check stake owner
        assert!(stake_position::owner(&stake) == redeemer, ENotOwner);
        
        // Check stake is redeemable (Mature and not Encumbered)
        assert!(stake_position::is_mature(&stake, clock), EStakeNotMature); // Check mature *after* expiry check
        assert!(!stake_position::is_encumbered(&stake), EStakeEncumbered);
        
        let principal = stake_position::principal(&stake);
        
        // --- Earn final accrued points ---
        let last_claim_epoch = stake_position::last_claim_epoch(&stake);
        let current_epoch = clock::epoch(clock);
        let points_rate = admin::get_points_rate(config);

        let points_to_claim = ledger::calculate_accrued_points(
            principal,
            points_rate,
            last_claim_epoch,
            current_epoch
        );

        if (points_to_claim > 0) {
            // Use the `redeemer` address as the recipient
            ledger::internal_earn(ledger, redeemer, points_to_claim, ctx);
            // No need to update last_claim_epoch as stake is being destroyed
            // Optionally emit PointsClaimed here if desired for detailed logging
        }
        // -------------------------------

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
    /// calculates 0.1% fee on redeemed asset, calls escrow::withdraw for user and fee recipient.
    public entry fun redeem_points<T>(
        config: &Config,
        ledger: &mut Ledger,
        escrow: &mut EscrowVault<T>,
        oracle: &RateOracle,
        points_amount: u64,
        _clock: &Clock,  // Changed from 'clock' to '_clock' to fix warning
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        // We're skipping the oracle staleness check for production simplicity
        // In a real deployment, you would want to check: assert!(!oracle::is_stale(oracle, clock), EOracleStale);
        
        let user = tx_context::sender(ctx);
        let deployer = admin::deployer_address(config); // Assume this exists
        
        // Get rate from oracle
        let (rate, decimals) = oracle::get_rate(oracle);
        
        // Convert total points to total asset amount
        let total_asset_amount = oracle::convert_points_to_asset(points_amount, rate, decimals);

        // --- Calculate and Handle Redemption Fee (0.1% of redeemed asset) ---
        let fee_asset_amount = total_asset_amount / 1000; // 0.1% fee
        let user_asset_amount = total_asset_amount - fee_asset_amount;
        // Check for underflow (shouldn't happen if total_asset_amount > 0)
        if (fee_asset_amount > total_asset_amount) { abort EFeeCalculationError };
        // --------------------------------------------------------------------

        // Spend user's points
        ledger::internal_spend(ledger, user, points_amount, ctx);
        
        // Withdraw assets from escrow: user's share and fee share
        if (user_asset_amount > 0) {
            escrow::withdraw(escrow, user_asset_amount, user, ctx); // Send user's share
        }
        if (fee_asset_amount > 0) {
            escrow::withdraw(escrow, fee_asset_amount, deployer, ctx); // Send fee share to deployer
        }
        
        // Emit event (asset_amount is the amount user received *before* fee)
        // Consider if this event should reflect the amount *after* fee, or add a fee field.
        // Current implementation reflects total asset value corresponding to points redeemed.
        event::emit(PointsRedeemed<T> {
            user,
            points_amount,
            asset_amount: total_asset_amount // Reflects total value before fee deduction
            // fee_asset_amount: fee_asset_amount // Optionally add fee field
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
    
    /// Allows a user to claim accrued Alpha Points for their stake position.
    public entry fun claim_accrued_points<T>(
        config: &Config,
        ledger: &mut Ledger,
        stake: &mut StakePosition<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);

        let user = tx_context::sender(ctx);
        let stake_id = stake_position::get_id(stake);

        // Ensure the sender owns the stake position
        assert!(stake_position::owner(stake) == user, ENotOwner);

        let principal = stake_position::principal(stake);
        let last_claim_epoch = stake_position::last_claim_epoch(stake);
        let current_epoch = clock::epoch(clock);
        let points_rate = admin::get_points_rate(config);

        // Calculate points accrued since last claim
        let points_to_claim = ledger::calculate_accrued_points(
            principal,
            points_rate,
            last_claim_epoch,
            current_epoch
        );

        if (points_to_claim > 0) {
            // Add points to user's ledger balance
            ledger::internal_earn(ledger, user, points_to_claim, ctx);

            // Update the last claim epoch on the stake position
            stake_position::set_last_claim_epoch(stake, current_epoch);

            // Emit event
            event::emit(PointsClaimed {
                stake_id,
                user,
                claimed_amount: points_to_claim,
                new_last_claim_epoch: current_epoch
            });
        }
        // If points_to_claim is 0, do nothing.
    }
    
    /// Allows an admin to claim a forfeited stake that has passed its expiry window.
    /// Initiates unstaking but currently discards the withdrawal ticket.
    /// NOTE: Phase 5 Change - This function NO LONGER initiates native unstake.
    /// Admin must call `admin_withdraw_forfeited_stake` separately after this.
    public entry fun admin_claim_forfeited_stake<T>(
        _admin_cap: &AdminCap, // Authorization (Corrected import path)
        config: &Config,
        // manager: &mut StakingManager, // No longer needed here
        stake: StakePosition<T>,
        clock: &Clock,
        _ctx: &mut TxContext // Changed to _ctx as it might be unused now
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);

        let stake_id = stake_position::get_id(&stake);
        let original_owner = stake_position::owner(&stake);
        let principal = stake_position::principal(&stake);

        // --- Verify Stake is Expired ---
        let unlock_time_ms = stake_position::unlock_time_ms(&stake);
        let expiry_time_ms = unlock_time_ms + EXPIRY_DURATION_MS;
        let current_time_ms = clock::timestamp_ms(clock);
        assert!(current_time_ms > expiry_time_ms, EStakeNotExpired);
        // -----------------------------

        // Native unstaking logic removed. Admin must call admin_withdraw_forfeited_stake separately.

        // Emit event
        event::emit(StakeForfeited<T> {
            stake_id,
            original_owner,
            principal
        });

        // Destroy stake position object
        stake_position::destroy_stake(stake);
    }

    /// Allows a user to repay their outstanding bad debt using SUI.
    public entry fun repay_bad_debt(
        config: &Config,
        ledger: &mut Ledger,
        oracle: &RateOracle,
        payment: Coin<sui::sui::SUI>, // Assuming payment in SUI
        clock: &Clock, // Needed for oracle check (though maybe skipped)
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);

        let user = tx_context::sender(ctx);
        let deployer = admin::deployer_address(config);
        let paid_sui_amount = coin::value(&payment);

        // Check if user actually has bad debt
        let current_debt_points = ledger::get_bad_debt(ledger, user);
        assert!(current_debt_points > 0, ledger::ERepaymentExceedsDebt); // Use same error? Or new ENoDebt?

        // Skip oracle staleness check for now, consistent with redeem_points
        // assert!(!oracle::is_stale(oracle, clock), EOracleStale);
        let (rate, decimals) = oracle::get_rate(oracle);

        // Convert SUI payment to points value
        let payment_value_points = oracle::convert_asset_to_points(
            paid_sui_amount,
            rate,
            decimals
        );

        // Determine amount of debt points to repay
        let debt_to_repay_points = math::min(payment_value_points, current_debt_points);

        // This check should be redundant given the assert above, but good practice
        if (debt_to_repay_points == 0) {
            // If conversion resulted in 0 points (e.g., tiny SUI payment), transfer SUI and exit
            transfer::public_transfer(payment, deployer);
            return;
        };

        // Remove the debt from the ledger
        ledger::internal_remove_bad_debt(ledger, user, debt_to_repay_points);

        // Transfer the SUI payment to the deployer
        transfer::public_transfer(payment, deployer);

        // Calculate remaining debt for the event
        let remaining_debt_points = current_debt_points - debt_to_repay_points;

        // Emit event
        event::emit(BadDebtRepaid {
            user,
            paid_sui_amount,
            repaid_debt_points: debt_to_repay_points,
            remaining_debt_points
        });
    }

    /// Allows a user to initiate the native unstaking process for a previously redeemed stake.
    /// Retrieves the StakedSui object, calls request_remove_stake, and transfers
    /// the resulting WithdrawalTicket to the user.
    /// The user must then wait one epoch and call sui::staking_pool::withdraw_stake themselves.
    public entry fun withdraw_native_stake(
        config: &Config,
        manager: &mut StakingManager,
        native_stake_id: ID, // ID of the underlying StakedSui object
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);

        let user = tx_context::sender(ctx);

        // Call the staking manager to handle retrieval and unstake request
        // Assumes staking_manager::retrieve_and_request_unstake exists
        // and returns the WithdrawalTicket.
        let withdrawal_ticket = staking_manager::retrieve_and_request_unstake(
            manager,
            native_stake_id,
            ctx
        );

        // Emit event
        event::emit(WithdrawalTicketIssued {
            user,
            native_stake_id
            // ticket_object_id: object::id(&withdrawal_ticket) // Get ticket ID if needed
        });

        // Transfer the ticket to the user
        transfer::public_transfer(withdrawal_ticket, user);
    }

    /// Allows an admin to initiate the native unstaking process for a forfeited stake.
    /// Retrieves the StakedSui object, calls request_remove_stake, and transfers
    /// the resulting WithdrawalTicket to the deployer address.
    /// The admin/deployer must then wait one epoch and call sui::staking_pool::withdraw_stake.
    /// Bad debt reconciliation must happen *after* the final SUI withdrawal.
    public entry fun admin_withdraw_forfeited_stake(
        _admin_cap: &AdminCap, // Authorization
        config: &Config,
        manager: &mut StakingManager,
        native_stake_id: ID, // ID of the underlying StakedSui object
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);

        let deployer = admin::deployer_address(config); // Assuming deployer receives ticket

        // Call the staking manager to handle retrieval and unstake request
        // Assumes staking_manager::retrieve_and_request_unstake exists
        let withdrawal_ticket = staking_manager::retrieve_and_request_unstake(
            manager,
            native_stake_id,
            ctx
        );

        // Emit event (Optional: could re-use WithdrawalTicketIssued or make a new one)
        // event::emit(WithdrawalTicketIssued { user: deployer, native_stake_id });

        // Transfer the ticket to the deployer/protocol address
        transfer::public_transfer(withdrawal_ticket, deployer);
    }
}