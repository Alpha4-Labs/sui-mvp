/// Module that provides the main public entry points for user interactions.
/// Orchestrates calls to other modules.
module alpha_points::integration {
    use sui::clock::Clock;
    use sui::event;
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use std::string::{Self, String};
    use std::ascii::{Self as ascii};
    
    // Corrected Sui System State and Staking Pool imports
    use sui_system::sui_system::SuiSystemState;
    use sui_system::staking_pool::{StakedSui, staked_sui_amount};
    
    use alpha_points::admin::{Self, Config, AdminCap};
    use alpha_points::ledger::{Self, Ledger, MintStats, SupplyOracle};
    use alpha_points::escrow::{Self, EscrowVault};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::staking_manager::{Self, StakingManager};
    use alpha_points::partner::{Self, PartnerCap};
    use alpha_points::loan;
    use sui::object::id_from_address;
    // use alpha_points::types::{Self, CollateralType, PointTypeConstants, ErrorCodeConstants}; // FIXME: Temporarily commented out due to unresolved types
    // use sui::table; // Removed table alias
    // use alpha_points::ledger::get_daily_wallet_cap; // Removed as unused alias
    
    // Error constants - using placeholders for now
    const EAdminOnly: u64 = 0; // FIXME: ErrorCodeConstants undefined
    const EAlreadyClaimedOrTooSoon: u64 = 0; // FIXME: ErrorCodeConstants undefined
    const ERepaymentAmountError: u64 = 0; // FIXME: ErrorCodeConstants undefined
    const EFeeCalculationError: u64 = 0; // FIXME: ErrorCodeConstants undefined
    const ENotOwner: u64 = 1; // Example, ensure this is defined or use an existing one
    const ENotRedeemable: u64 = 2; // Example, ensure this is defined or use an existing one
    const EInvalidStakeIdType: u64 = 3; // Example for type mismatch
    const EStakeEncumbered: u64 = 4; // New error: Stake is encumbered by a loan
    #[allow(unused_const)]
    const ELoanProcessingError: u64 = 5; // Error during loan object creation/processing for liquid unstake
    const EStakeNotMatureForLoan: u64 = 6; // Stake is not mature enough for this type of loan/unstake
    
    // Constants
    // const STAKE_EXPIRY_DAYS: u64 = 14; // Removed as unused

    // APY Calculation Constants
    const EPOCHS_PER_YEAR: u64 = 365; // Assuming daily epochs for simplicity
    const SUI_TO_MIST_CONVERSION: u64 = 1_000_000_000;
    const APY_POINT_SCALING_FACTOR: u64 = 25; // Scales APY_bps * 25 for points calculation
    const EInvalidStakeDurationForApy: u64 = 110; // Error for APY lookup
    
    // Constants for Event Structs
    // const POINTS_ACCRUED_EVENT_TYPE: vector<u8> = b"PointsAccrued"; // Removed as unused
    // const POINTS_CLAIMED_EVENT_TYPE: vector<u8> = b"PointsClaimed"; // Removed as unused
    
    // New Event for Supply Rate Retention
    public struct SupplyRateRetention<phantom T: store> has copy, drop {
        vault_id: ID,
        asset_type: String,
        retained_amount: u64
    }
    
    // Events
    #[allow(unused_field)]
    public struct StakeRouted<phantom T: store> has copy, drop {
        staker: address,
        stake_id: ID,
        asset_type: String, 
        amount_staked_asset: u64,
        duration_days: u64,
        unlock_time_ms: u64,
        native_stake_id: ID 
    }
    
    #[allow(unused_field)]
    public struct StakeRedeemedEvent<phantom T: store> has copy, drop {
        redeemer: address,
        stake_id: ID,
        asset_type: String,
        amount_returned_asset: u64,
        points_forfeited: u64
    }
    
    public struct PointsEarned has copy, drop {
        user: address,
        amount: u64,
        partner: address
    }
    
    #[allow(unused_field)]
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
    
    public struct PointsRedeemedEvent<phantom T: store> has copy, drop {
        user: address,
        points_amount: u64,
        asset_amount: u64
    }
    
    /// Event emitted when user claims accrued points from a stake
    public struct PointsClaimed has store, copy, drop {
        user: address,
        stake_id: ID,
        points_claimed: u64,
        asset_type: String,
        claim_epoch: u64,
    }
    
    /// Event emitted when an admin claims a forfeited (expired) stake
    #[allow(unused_field)]
    public struct StakeForfeited has store, copy, drop {
        admin_cap_id: ID,
        staker_address: address,
        stake_id: ID,
        forfeited_amount: u64,
        asset_type: String,
    }
    
    /// Event emitted when a user repays bad debt
    #[allow(unused_field)]
    public struct BadDebtRepaid has copy, drop {
        user: address,
        paid_sui_amount: u64,
        repaid_debt_points: u64,
        remaining_debt_points: u64
    }
    
    /// Event emitted when a user initiates native withdrawal and receives the ticket
    #[allow(unused_field)]
    public struct WithdrawalTicketIssued has copy, drop {
        user: address,
        native_stake_id: ID
    }
    
    /// Event emitted when a user's native SUI stake is converted to Alpha Points
    /// and the SUI withdrawal ticket is stored by the protocol.
    public struct StakeConvertedToPoints has store, copy, drop {
        user: address,
        original_staked_sui_id: ID, // ID of the StakedSui object that was unstaked
        sui_amount_unstaked: u64,   // The principal amount of SUI that was unstaked
        points_minted: u64,         // The amount of Alpha Points minted to the user
        stake_position_id: ID,      // ID of the destroyed StakePosition NFT
    }
    
    /// Event emitted when staked assets are deposited into the protocol
    public struct StakeDeposited<phantom T> has copy, drop {
        staker: address,
        stake_id: ID,
        asset_type: string::String, 
        amount_staked: u64,
        duration_days: u64,
        unlock_time_ms: u64,
        native_stake_id: ID 
    }
    
    /// Event emitted when staked assets are redeemed back to the native asset
    #[allow(unused_field)]
    public struct StakeRedeemed<phantom T: store> has copy, drop {
        redeemer: address,
        principal_redeemed: u64,
        points_used: u64,
        fee_paid: u64,
        epoch: u64
    }
    
    /// Event emitted when points are redeemed for the fee asset
    public struct PartnerAttribution has copy, drop {
        partner_address: address,
        user: address,
        action: vector<u8>,
        amount: u64,
        fee_share: u64
    }
    
    /// Event emitted when a user initiates a liquid unstake, receiving points as a loan against their stake.
    public struct LiquidUnstakeAsLoanInitiated has store, copy, drop {
        user: address,
        stake_position_id: ID,      // ID of the StakePosition NFT being used as collateral
        native_sui_stake_id: ID,    // ID of the underlying StakedSui object
        sui_value_for_loan: u64,    // The SUI principal value backing the loan
        points_loaned: u64,         // The amount of Alpha Points loaned to the user
        loan_fee_points: u64,       // Fee taken for opening this loan (if any)
        loan_object_id: ID,         // ID of the Loan object created (held by protocol admin)
        opened_time_ms: u64,
    }

    /// Event emitted when user claims accrued points from a stake
    public entry fun redeem_points<T: store>(
        config: &Config,
        ledger: &mut Ledger,
        escrow: &mut EscrowVault<T>,
        supply_oracle: &mut SupplyOracle,
        oracle: &RateOracle,
        points_amount: u64,
        clock: &Clock,
        mint_stats: &mut MintStats,
        epoch: u64,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        let deployer = admin::deployer_address(config);
        let (rate, decimals) = oracle::get_rate(oracle);
        
        // Initial conversion from points to asset
        let total_asset_amount_initial = oracle::convert_points_to_asset(points_amount, rate, decimals);
        
        // Apply SupplyOracle.redeem_rate
        let supply_redeem_rate_bps = ledger::get_redeem_rate(supply_oracle);
        
        let reduction_due_to_supply_rate = if (total_asset_amount_initial > 0 && supply_redeem_rate_bps > 0) {
            (total_asset_amount_initial * supply_redeem_rate_bps) / 10000
        } else {
            0
        };
        let total_asset_amount_after_supply_rate = total_asset_amount_initial - reduction_due_to_supply_rate;

        // Standard fee calculation on the adjusted total
        let fee_asset_amount = total_asset_amount_after_supply_rate / 1000; // 0.1% fee
        let user_asset_amount = total_asset_amount_after_supply_rate - fee_asset_amount;
        
        assert!(fee_asset_amount <= total_asset_amount_after_supply_rate, EFeeCalculationError);

        // Mint points logic (remains the same)
        let stake_opt_none = option::none<StakePosition<T>>();
        ledger::mint_points<T>(ledger, user, points_amount, ledger::new_point_type_staking(), ctx, mint_stats, epoch, &stake_opt_none, 0, clock, supply_oracle);
        option::destroy_none(stake_opt_none);
        
        // Withdrawals
        if (user_asset_amount > 0) {
            escrow::withdraw(escrow, user_asset_amount, user, ctx);
        };
        if (fee_asset_amount > 0) {
            escrow::withdraw(escrow, fee_asset_amount, deployer, ctx);
        };

        // Emit retention event if any amount was retained due to supply rate
        if (reduction_due_to_supply_rate > 0) {
            let asset_name_ascii = std::type_name::into_string(std::type_name::get<T>());
            let asset_name_string = string::utf8(ascii::into_bytes(asset_name_ascii));
            event::emit(SupplyRateRetention<T> {
                vault_id: object::id_from_address(object::uid_to_address(escrow::vault_uid(escrow))),
                asset_type: asset_name_string,
                retained_amount: reduction_due_to_supply_rate
            });
        };
        
        event::emit(PointsRedeemedEvent<T> {
            user,
            points_amount,
            asset_amount: total_asset_amount_after_supply_rate
        });
    }
    
    /// Redeems points for the underlying asset WITH partner attribution
    public entry fun redeem_points_with_partner<T: store>(
        config: &Config,
        ledger: &mut Ledger,
        escrow: &mut EscrowVault<T>,
        supply_oracle: &mut SupplyOracle,
        oracle: &RateOracle,
        points_amount: u64,
        partner_cap: &PartnerCap,
        clock: &Clock,
        mint_stats: &mut MintStats,
        epoch: u64,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        let deployer = admin::deployer_address(config);
        let (rate, decimals) = oracle::get_rate(oracle);

        // Initial conversion from points to asset
        let total_asset_amount_initial = oracle::convert_points_to_asset(points_amount, rate, decimals);

        // Apply SupplyOracle.redeem_rate
        let supply_redeem_rate_bps = ledger::get_redeem_rate(supply_oracle);
        
        let reduction_due_to_supply_rate = if (total_asset_amount_initial > 0 && supply_redeem_rate_bps > 0) {
            (total_asset_amount_initial * supply_redeem_rate_bps) / 10000
        } else {
            0
        };
        let total_asset_amount_after_supply_rate = total_asset_amount_initial - reduction_due_to_supply_rate;

        // Standard fee calculation on the adjusted total
        let fee_asset_amount = total_asset_amount_after_supply_rate / 1000; // 0.1% fee
        let user_asset_amount_after_std_fee = total_asset_amount_after_supply_rate - fee_asset_amount;

        // Partner fee calculation (e.g., 20% of the standard fee)
        let partner_fee_share = fee_asset_amount / 5; // 20% of 0.1% = 0.02%
        let deployer_fee_share = fee_asset_amount - partner_fee_share;
        let user_final_asset_amount = user_asset_amount_after_std_fee; // User amount isn't reduced further by partner fee

        assert!(fee_asset_amount <= total_asset_amount_after_supply_rate, EFeeCalculationError);
        assert!(partner_fee_share <= fee_asset_amount, EFeeCalculationError); // Ensure partner share isn't > total fee

        // Mint points logic
        let stake_opt_none = option::none<StakePosition<T>>();
        ledger::mint_points<T>(ledger, user, points_amount, ledger::new_point_type_staking(), ctx, mint_stats, epoch, &stake_opt_none, 0, clock, supply_oracle);
        option::destroy_none(stake_opt_none);
        
        // Withdrawals
        if (user_final_asset_amount > 0) {
            escrow::withdraw(escrow, user_final_asset_amount, user, ctx);
        };
        
        let partner_addr = object::uid_to_address(partner::get_id(partner_cap));
        if (partner_fee_share > 0) {
            escrow::withdraw(escrow, partner_fee_share, partner_addr, ctx);
            event::emit(PartnerAttribution {
                partner_address: partner_addr,
                user,
                action: b"redeem_points_with_partner",
                amount: points_amount,
                fee_share: partner_fee_share
            });
        };
        if (deployer_fee_share > 0) {
            escrow::withdraw(escrow, deployer_fee_share, deployer, ctx);
        };

        // Emit retention event if any amount was retained due to supply rate
        if (reduction_due_to_supply_rate > 0) {
            let asset_name_ascii = std::type_name::into_string(std::type_name::get<T>());
            let asset_name_string = string::utf8(ascii::into_bytes(asset_name_ascii));
            event::emit(SupplyRateRetention<T> {
                vault_id: object::id_from_address(object::uid_to_address(escrow::vault_uid(escrow))),
                asset_type: asset_name_string,
                retained_amount: reduction_due_to_supply_rate
            });
        };
        
        event::emit(PointsRedeemedEvent<T> {
            user,
            points_amount,
            asset_amount: total_asset_amount_after_supply_rate
        });
    }
    
    /// Calls admin::assert_not_paused, ledger::internal_lock
    public entry fun lock_points(
        config: &Config,
        ledger: &mut Ledger,
        amount: u64,
        ctx: &mut TxContext
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
        ctx: &mut TxContext
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
    
    // Helper to get APY in Basis Points (bps) based on duration_days
    // Matches frontend DEFAULT_DURATIONS APY values
    // For MVP, this is a hardcoded lookup. Could be driven by Config later.
    fun get_apy_bps_for_duration_days(duration_days: u64): u64 {
        if (duration_days == 7) { 500 } // 5.0%
        else if (duration_days == 14) { 750 } // 7.5%
        else if (duration_days == 30) { 1000 } // 10.0%
        else if (duration_days == 90) { 1500 } // 15.0%
        else if (duration_days == 180) { 2000 } // 20.0%
        else if (duration_days == 365) { 2500 } // 25.0%
        else {
            abort EInvalidStakeDurationForApy
        }
    }

    /// Allows a user to claim accrued Alpha Points for their stake position.
    public entry fun claim_accrued_points<T: key + store>(
        config: &Config,
        ledger: &mut Ledger,
        stake_position: &mut StakePosition<T>,
        supply_oracle: &mut SupplyOracle,
        clock: &Clock,
        mint_stats: &mut MintStats,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let claimer = tx_context::sender(ctx);
        assert!(stake_position::owner_view(stake_position) == claimer, EAdminOnly);
        let current_epoch = tx_context::epoch(ctx);
        let last_claim_epoch = stake_position::last_claim_epoch_view(stake_position);
        assert!(current_epoch > last_claim_epoch, EAlreadyClaimedOrTooSoon);
        
        // Fetch points_rate and liq_share from config
        let points_rate = admin::get_points_rate(config);
        let liq_share_value = admin::get_default_liq_share(config);

        let principal_sui = stake_position::principal_view(stake_position);
        let points_to_claim = ledger::calculate_accrued_points(
            principal_sui,
            points_rate,
            last_claim_epoch,
            current_epoch
        );

        if (points_to_claim > 0) {
            // Update the stake position's last claim epoch *before* minting to prevent re-entrancy/double-claim issues.
            stake_position::set_last_claim_epoch_mut(stake_position, current_epoch);
            stake_position::add_claimed_rewards_mut(stake_position, points_to_claim);

            // FIXME: Temporarily passing none for stake_opt due to type incompatibility.
            // The `ledger::mint_points` function expects `&Option<StakePosition<T>>` (an owned Option),
            // but we only have `&mut StakePosition<T>`. This will prevent weight curve calculations
            // based on this specific stake_position from working correctly.
            // This requires a change in `ledger::mint_points` or a different approach.
            let stake_opt_temp_none = option::none<StakePosition<T>>();
            ledger::mint_points<T>(
                ledger, 
                claimer, 
                points_to_claim, 
                ledger::new_point_type_staking(), 
                ctx, 
                mint_stats, 
                current_epoch, 
                &stake_opt_temp_none, // Passing None temporarily
                liq_share_value, 
                clock, 
                supply_oracle
            );
            option::destroy_none(stake_opt_temp_none); // Clean up the temporary None option

            let asset_name_ascii = std::type_name::into_string(std::type_name::get<T>());
            let asset_name_string = string::utf8(ascii::into_bytes(asset_name_ascii));
            event::emit(PointsClaimed {
                user: claimer,
                stake_id: stake_position::get_id_view(stake_position),
                points_claimed: points_to_claim,
                asset_type: asset_name_string,
                claim_epoch: current_epoch,
            });
        }
        // If points_to_claim is 0, no state change to stake_position's last_claim_epoch or claimed_rewards,
        // and no minting or event emission occurs.
    }
    
    /// Allows an admin to claim a forfeited stake that has passed its expiry window.
    /// Initiates unstaking but currently discards the withdrawal ticket.
    /// NOTE: Phase 5 Change - This function NO LONGER initiates native unstake.
    /// Admin must call `admin_withdraw_forfeited_stake` separately after this.
    public entry fun admin_claim_forfeited_stake<T: store>(
        admin_cap: &AdminCap,
        config: &Config,
        manager: &mut StakingManager,
        _escrow_vault: &mut EscrowVault<T>,
        sui_system_state_obj: &mut SuiSystemState,
        stake_id_to_forfeit: ID,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(admin::is_admin(admin_cap, config), EAdminOnly);

        let staker_address: address = tx_context::sender(ctx);
        let forfeited_amount: u64 = 1;
        let asset_name_ascii = std::type_name::into_string(std::type_name::get<T>());
        let asset_name_string = string::utf8(ascii::into_bytes(asset_name_ascii));
        
        let type_t_name_ascii = std::type_name::into_string(std::type_name::get<T>());
        let sui_type_name_ascii = std::type_name::into_string(std::type_name::get<sui::sui::SUI>());

        if (type_t_name_ascii == sui_type_name_ascii) {
            // Call the function without assigning its result
            staking_manager::request_native_stake_withdrawal(
                manager, 
                sui_system_state_obj, 
                stake_id_to_forfeit, 
                ctx
            );
        } else {
            // forfeited_amount is already 1
        };

        event::emit(StakeForfeited {
            admin_cap_id: admin::admin_cap_id(config),
            staker_address: staker_address,
            stake_id: stake_id_to_forfeit,
            forfeited_amount: forfeited_amount,
            asset_type: asset_name_string,
        });
    }

    /// Allows a user to repay their outstanding bad debt using SUI.
    public entry fun repay_bad_debt(
        config: &Config,
        ledger: &mut Ledger,
        payment: Coin<SUI>,
        oracle: &RateOracle,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        let payment_value_sui = coin::value(&payment);
        let (rate, decimals) = oracle::get_rate(oracle);
        let payment_value_points = oracle::convert_asset_to_points(payment_value_sui, rate, decimals);
        let current_debt_points = ledger::get_bad_debt(ledger, user);
        
        assert!(payment_value_points > 0, ERepaymentAmountError); // Ensure some points value from payment
        
        let debt_to_repay_points = std::u64::min(payment_value_points, current_debt_points); // Changed from sui::math::min
        
        ledger::internal_remove_bad_debt(ledger, user, debt_to_repay_points);
        
        // Consume the payment coin by transferring it to the deployer
        transfer::public_transfer(payment, admin::deployer_address(config));
    }

    // --- View Functions ---

    /// Get the current points balance for a user
    public fun get_points(ledger: &Ledger, user: address): u64 {
        ledger::get_total_balance(ledger, user)
    }

    /// Get the available points balance for a user
    public fun get_available_points(ledger: &Ledger, user: address): u64 {
        ledger::get_available_balance(ledger, user)
    }

    /// Get the locked points balance for a user
    public fun get_locked_points(ledger: &Ledger, user: address): u64 {
        ledger::get_locked_balance(ledger, user)
    }

    /// Get the current bad debt points for a user
    public fun get_bad_debt_points(ledger: &Ledger, user: address): u64 {
        ledger::get_bad_debt(ledger, user)
    }

    /// Get the current conversion rate from asset to points
    public fun get_asset_to_points_rate(
        oracle: &RateOracle, 
        _clock: &Clock
    ): (u64, u8) {
        let (rate128, dec) = oracle::get_rate(oracle);
        ((rate128 as u64), dec)
    }

    public fun get_user_bad_debt(ledger: &Ledger, user: address): u64 {
        ledger::get_bad_debt(ledger, user)
    }

    public fun get_user_staked_balance<T: store>(
        _escrow_vault: &EscrowVault<T>,
        _user: address,
        _ctx: &mut TxContext
    ): u64 {
        0
    }

    public fun get_user_points_balance(
        ledger: &Ledger,
        user: address
    ): u64 {
        ledger::get_total_balance(ledger, user)
    }

    // test init function
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        admin::init_for_testing(ctx);
    }

    public fun get_escrow_stake_details<T: store>(
        _escrow_vault: &EscrowVault<T>,
        _owner: address,
        _stake_id: ID,
        _ctx: &mut TxContext
    ): (u64, u64, u64, bool, ID) {
        (0,0,0,false, object::id_from_bytes(vector[]))
    }

    public fun get_stake_details<T: store>(
        _escrow_vault: &EscrowVault<T>,
        _owner: address,
        _stake_id: ID,
        _ctx: &mut TxContext
    ): (u64, u64, u64, bool, ID) {
        (0,0,0,false, object::id_from_bytes(vector[]))
    }

    public fun total_staked_value_in_escrow<T: key + store>(
        _escrow: &EscrowVault<T>
    ): u64 {
        0
    }

    public entry fun request_unstake_native_sui(
        manager: &mut StakingManager,
        config: &Config,
        sui_system_state_obj: &mut SuiSystemState,
        stake_position_to_unstake: StakePosition<StakedSui>,
        clock: &Clock,
        ledger: &mut Ledger,
        mint_stats: &mut MintStats,
        supply_oracle: &mut SupplyOracle,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);

        // 1. Verify ownership
        assert!(stake_position::owner_view(&stake_position_to_unstake) == user, ENotOwner);

        // 1.b. Verify not encumbered by an existing loan
        assert!(!stake_position::is_encumbered_view(&stake_position_to_unstake), EStakeEncumbered);

        // 2. Verify redeemability (mature and not encumbered by its own terms for redemption)
        assert!(stake_position::is_redeemable(&stake_position_to_unstake, clock), ENotRedeemable);

        // 3. Get native StakedSui ID and principal amount
        let native_staked_sui_address = stake_position::native_stake_id_view(&stake_position_to_unstake);
        let native_staked_sui_id = id_from_address(native_staked_sui_address);
        assert!(native_staked_sui_address != @0x0, EInvalidStakeIdType);
        let principal_sui_unstaked = stake_position::principal_view(&stake_position_to_unstake);

        // 4. Call staking_manager to initiate withdrawal, capture the returned Balance<SUI>
        staking_manager::request_native_stake_withdrawal(
            manager,
            sui_system_state_obj,
            native_staked_sui_id,
            ctx
        );

        // 6. Mint Alpha Points to the user, equivalent to the principal SUI unstaked.
        // We use the principal_sui_unstaked as the amount of points to mint.
        // This assumes 1 SUI unstaked = 1 Alpha Point for this specific action.
        // We'll use a generic stake_opt_none as this minting is not tied to an active stake position's APY.
        let points_to_mint = principal_sui_unstaked; // Or a scaled value if desired
        let current_epoch = tx_context::epoch(ctx);
        let liq_share_value = admin::get_default_liq_share(config); // Or 0 if these points don't contribute to liq share
        let stake_opt_none = option::none<StakePosition<StakedSui>>(); // Generic, as we are destroying the position

        if (points_to_mint > 0) { // Only mint if there's an amount
            ledger::mint_points<StakedSui>( // Using StakedSui as T, can be generic if point_type dictates behavior
                ledger,
                user,
                points_to_mint,
                ledger::new_point_type_generic_reward(), // Using a generic reward type, or create a new one
                ctx,
                mint_stats,
                current_epoch,
                &stake_opt_none, // Not tied to a specific ongoing stake's APY curve
                liq_share_value,
                clock,
                supply_oracle
            );
        };
        option::destroy_none(stake_opt_none);

        // 7. Get StakePosition ID before destroying for event
        let stake_position_object_id = stake_position::get_id_view(&stake_position_to_unstake);

        // 8. Destroy the StakePosition NFT
        stake_position::destroy_stake(stake_position_to_unstake);

        // 9. Emit an event indicating the conversion
        event::emit(StakeConvertedToPoints {
            user: user,
            original_staked_sui_id: native_staked_sui_id,
            sui_amount_unstaked: principal_sui_unstaked,
            points_minted: points_to_mint,
            stake_position_id: stake_position_object_id,
        });

        // Note: The old WithdrawalTicketIssued event is no longer relevant here as the user
        // does not receive the ticket directly.
    }

    public fun view_accrued_points_for_stake<T: key + store>(
        stake_position_obj: &StakePosition<T>,
        // _config: &Config, // Pass if APY logic moves to config
        current_epoch: u64
    ): u64 {
        let last_claim_epoch = stake_position::last_claim_epoch_view(stake_position_obj);
        if (current_epoch <= last_claim_epoch) {
            return 0
        };

        let principal_mist = stake_position::principal_view(stake_position_obj);
        let duration_days = stake_position::duration_days_view(stake_position_obj);
        let stake_apy_bps = get_apy_bps_for_duration_days(duration_days);

        let numerator_part1 = (principal_mist as u128) * (stake_apy_bps as u128);
        let numerator = numerator_part1 * (APY_POINT_SCALING_FACTOR as u128);
        let denominator = (SUI_TO_MIST_CONVERSION as u128) * (EPOCHS_PER_YEAR as u128);
        
        let points_per_epoch = if (denominator > 0) { (numerator / denominator) as u64 } else { 0 };

        let epochs_passed = current_epoch - last_claim_epoch;
        points_per_epoch * epochs_passed
    }

    /// Public entry function to stake SUI into the protocol.
    /// Stakes the provided Coin<SUI> natively using the Sui system, creates a StakePosition<SUI> NFT,
    /// stores the underlying StakedSui object in the StakingManager, and transfers the
    /// StakePosition<SUI> NFT to the staker.
    public entry fun route_stake_sui(
        config: &Config,
        _ledger: &mut Ledger, // Unused parameter prefixed
        manager: &mut StakingManager,
        clock: &Clock,
        staked_sui: StakedSui, // Added StakedSui parameter, removed Coin<SUI>
        duration_days: u64,
        _referrer: Option<address>, // Referrer address (currently unused)
        ctx: &mut TxContext
    ) {
        // 1. Pre-checks
        admin::assert_not_paused(config);
        let staker = tx_context::sender(ctx);

        let stake_amount_mist = staked_sui_amount(&staked_sui); 
        let native_stake_id = object::id(&staked_sui);

        // 2. Store Native Stake in Manager (was step 3)
        // The StakedSui object is now passed directly
        staking_manager::store_native_stake(manager, staked_sui, ctx);

        // 3. Calculate Unlock Time (was step 4)
        let current_time_ms = sui::clock::timestamp_ms(clock);
        let duration_ms = duration_days * stake_position::get_ms_per_day(); // Use getter
        let unlock_time_ms_for_event = current_time_ms + duration_ms;

        // 4. Create StakePosition NFT (was step 5)
        // Use StakedSui as the type parameter
        let mut stake_position_obj = stake_position::create_stake<StakedSui>( 
            stake_amount_mist, 
            duration_days,
            clock, 
            ctx
        );
        stake_position::set_native_stake_id_mut(&mut stake_position_obj, native_stake_id);
        
        let stake_position_id = object::id(&stake_position_obj);

        // 5. Transfer StakePosition NFT to user (was step 6)
        transfer::public_transfer(stake_position_obj, staker);

        // 6. Emit Event (was step 7)
        // Use StakedSui for the type parameter, and get asset_name_string accordingly
        let staked_sui_type_name_ascii = std::type_name::into_string(std::type_name::get<StakedSui>());
        let asset_name_string = string::utf8(ascii::into_bytes(staked_sui_type_name_ascii));
        event::emit(StakeDeposited<StakedSui> { 
            staker,
            stake_id: stake_position_id,
            asset_type: asset_name_string,
            amount_staked: stake_amount_mist,
            duration_days,
            unlock_time_ms: unlock_time_ms_for_event,
            native_stake_id
        });
    }

    // Removed internal_earn_points_by_partner_logic, its logic is now inlined below

    public entry fun earn_points_by_partner(
        user: address,
        pts: u64,
        partner: &mut PartnerCap,
        ledger: &mut Ledger,
        mint_stats: &mut MintStats,
        current_epoch: u64,
        supply_oracle: &mut SupplyOracle,
        _clock: &Clock,
        config: &Config,
        ctx: &mut TxContext
    ) {
        // Inlined logic from internal_earn_points_by_partner_logic starts here
        // Partner pause check
        assert!(!partner::get_paused(partner), EAdminOnly);

        // Epoch rollover for partner stats
        {
            if (current_epoch > partner::get_last_epoch(partner)) {
                partner::reset_mint_today_mut(partner, current_epoch);
            }
        };

        // Partner daily quota check
        { 
            let _ = 0; // Parser workaround
            if (!(partner::get_mint_remaining_today(partner) >= pts)) {
                abort EAdminOnly
            }
        };

        // User daily cap check (from ledger)
        { 
            let _ = 0; // Parser workaround
            if (!(ledger::can_mint_points(mint_stats, user, pts))) {
                abort EAdminOnly
            }
        };

        // Fetch liq_share from config
        let liq_share_value = admin::get_default_liq_share(config);

        // Mint points via ledger
        { 
            let _ = 0; // Parser workaround
            let stake_opt = option::none<StakePosition<u8>>();
            ledger::mint_points<u8>(ledger, user, pts, ledger::new_point_type_staking(), ctx, mint_stats, current_epoch, &stake_opt, liq_share_value, _clock, supply_oracle);
            option::destroy_none(stake_opt);
        };

        // Update partner stats
        partner::decrease_mint_remaining_today_mut(partner, pts);

        // Update user's minted today in ledger MintStats
        ledger::update_minted_today(mint_stats, user, pts);
        
        event::emit(PointsEarned { user, amount: pts, partner: object::uid_to_address(partner::get_id(partner)) });
        // Inlined logic ends here
    }

    // --- Helper / View functions ---
    public fun get_stake_unlock_time_ms(start_time_ms: u64, duration_days: u64): u64 {
        if (duration_days == 0) { return 0 };
        let duration_ms = duration_days * 24 * 60 * 60 * 1000;
        start_time_ms + duration_ms
    }

    // === Test-only functions ===

    /// Allows a user to get an instant Alpha Points loan against their maturing/matured native SUI stake.
    /// The SUI stake is then unstaked by the protocol, and the Loan object is held by the protocol admin.
    /// The user's StakePosition NFT is encumbered and later destroyed by an admin action
    /// once the SUI is claimed by the protocol.
    #[allow(unused_const)]
    public entry fun liquid_unstake_as_loan_native_sui(
        config: &Config,
        _loan_config: &loan::LoanConfig, // Changed to _loan_config, LTV/fees TBD
        ledger: &mut Ledger,
        stake_position: &mut StakePosition<StakedSui>,
        // oracle: &RateOracle, // Not strictly needed if points loaned = SUI principal directly
        clock: &Clock,
        mint_stats: &mut MintStats,
        supply_oracle: &mut SupplyOracle,
        staking_manager_obj: &mut StakingManager, // Renamed from manager to avoid conflict
        sui_system_state_obj: &mut SuiSystemState,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);

        // 1. Verify ownership of the StakePosition
        assert!(stake_position::owner_view(stake_position) == user, ENotOwner);

        // 2. Verify StakePosition is not already encumbered by another loan
        assert!(!stake_position::is_encumbered_view(stake_position), EStakeEncumbered);

        // 3. Verify StakePosition is redeemable (mature for unstaking)
        // This is crucial as the protocol will immediately start the unstaking process.
        assert!(stake_position::is_redeemable(stake_position, clock), EStakeNotMatureForLoan);

        // 4. Determine Loan Amount (Points)
        // For this flow, loan points = SUI principal of the stake (100% LTV)
        let sui_principal_for_loan = stake_position::principal_view(stake_position);
        let points_to_loan_gross = sui_principal_for_loan; // Assuming 1 SUI = 1 Point for this loan principal

        // 5. Apply Loan Origination Fee (e.g., from loan.move logic: 0.1%)
        // This logic mirrors the fee structure in loan::open_loan.
        // If LoanConfig has specific fees for this type of loan, that could be used.
        // For now, let's assume a similar fee structure to regular loans if loan_config.interest_rate_bps or a similar field implies it.
        // However, loan_config.interest_rate_bps is for interest, not origination.
        // Let's use a hardcoded/configurable origination fee specific to this action or assume 0.1% like loan.move.
        // For simplicity, taking 0.1% of the points_to_loan_gross as fee.
        let loan_origination_fee_points = points_to_loan_gross / 1000; // 0.1% fee
        let points_to_user_net = points_to_loan_gross - loan_origination_fee_points;

        assert!(loan_origination_fee_points <= points_to_loan_gross, EFeeCalculationError); // Ensure fee isn't > gross

        // 6. Mint net points to user & fee to deployer
        let current_epoch = tx_context::epoch(ctx);
        let deployer_address = admin::deployer_address(config);
        let liq_share_for_loan_points = admin::get_default_liq_share(config); // Or a specific one for loan points

        if (points_to_user_net > 0) {
            let stake_opt_none = option::none<StakePosition<StakedSui>>();
            ledger::mint_points<StakedSui>(
                ledger,
                user,
                points_to_user_net,
                ledger::new_point_type_loan_proceeds(), // New point type for clarity
                ctx,
                mint_stats,
                current_epoch,
                &stake_opt_none,
                liq_share_for_loan_points, // Or 0 if loan points don't contribute to weight
                clock,
                supply_oracle
            );
            option::destroy_none(stake_opt_none);
        };
        if (loan_origination_fee_points > 0) {
            // ledger::internal_earn or a similar mechanism to credit fees
            // For now, assuming fees are also minted to deployer or a fee collector address
            let stake_opt_none_fee = option::none<StakePosition<StakedSui>>();
             ledger::mint_points<StakedSui>( // Or a dedicated fee collection point type/mechanism
                ledger,
                deployer_address, // Fee goes to deployer
                loan_origination_fee_points,
                ledger::new_point_type_fee_revenue(), // New point type for fee revenue
                ctx,
                mint_stats, // MintStats might need adjustment for admin/deployer
                current_epoch,
                &stake_opt_none_fee,
                0, // No weight for fee points
                clock,
                supply_oracle
            );
            option::destroy_none(stake_opt_none_fee);
        };

        // 7. Create Loan Object (from loan.move struct)
        let stake_pos_id = stake_position::get_id_view(stake_position);
        let loan_opened_time_ms = sui::clock::timestamp_ms(clock);
        let loan_object = loan::create_loan(
            user, 
            stake_pos_id, 
            points_to_loan_gross, 
            loan_opened_time_ms, 
            ctx
        );
        let loan_uid = loan::get_loan_uid(&loan_object);
        let loan_object_id_for_event = object::uid_to_inner(loan_uid);

        // Transfer Loan object to THE USER
        transfer::public_transfer(loan_object, user);

        // 8. Encumber the StakePosition NFT
        stake_position::set_encumbered(stake_position, true);

        // 9. Initiate SUI Unstaking (Protocol side)
        let native_staked_sui_address = stake_position::native_stake_id_view(stake_position);
        let native_staked_sui_id = id_from_address(native_staked_sui_address);
        assert!(native_staked_sui_address != @0x0, EInvalidStakeIdType);

        // Call staking_manager to initiate withdrawal from the system.
        // This consumes the StakedSui from StakingManager and the user receives
        // the modified StakedSui (cooldown) object from the Sui system.
        staking_manager::request_native_stake_withdrawal(
            staking_manager_obj,
            sui_system_state_obj,
            native_staked_sui_id,
            ctx
        );

        // NOTE: pending_withdrawals_manager is NOT used here. The user receives the StakedSui (cooldown) object.

        // 10. Emit Event
        event::emit(LiquidUnstakeAsLoanInitiated {
            user: user,
            stake_position_id: stake_pos_id,
            native_sui_stake_id: native_staked_sui_id,
            sui_value_for_loan: sui_principal_for_loan,
            points_loaned: points_to_user_net, // Net points given to user
            loan_fee_points: loan_origination_fee_points,
            loan_object_id: loan_object_id_for_event, // Use the fetched ID
            opened_time_ms: loan_opened_time_ms,
        });

        // StakePosition NFT is NOT destroyed here. It's held by user but encumbered.
    }

    // Removed admin_claim_sui_and_settle_loan function as it's not viable
    // if the user receives the StakedSui (cooldown) object.
}