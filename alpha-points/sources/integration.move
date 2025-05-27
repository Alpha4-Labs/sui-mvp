/// Module that provides the main public entry points for user interactions.
/// Orchestrates calls to other modules.
module alpha_points::integration {
    use sui::clock::Clock;
    use sui::event;
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use std::string::{Self, String};
    use std::ascii::{Self as ascii};
    use std::option::{Self as std_option};
    // use sui::table::{Self, Table}; // Removed unused aliases
    
    // Corrected Sui System State and Staking Pool imports
    use sui_system::sui_system::SuiSystemState;
    use sui_system::staking_pool::{StakedSui, staked_sui_amount};
    
    use alpha_points::admin::{Self, Config, AdminCap, TestnetBypassCap};
    use alpha_points::ledger::{Self, Ledger}; // Removed MintStats, SupplyOracle
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
    const EInvalidStakeDurationForApy: u64 = 110;
    // New Errors for earn_points functions
    const EPartnerPaused: u64 = 7;
    const EPartnerExceedsQuota: u64 = 8;
    // EUserExceedsDailyCap is no longer needed as MintStats is removed
    // const EUserExceedsDailyCap: u64 = 9; 
    
    // Constants
    // const STAKE_EXPIRY_DAYS: u64 = 14; // Removed as unused

    // APY Calculation Constants
    const EPOCHS_PER_YEAR: u64 = 365; // Assuming daily epochs for simplicity
    const SUI_TO_MIST_CONVERSION: u64 = 1_000_000_000;
    const APY_POINT_SCALING_FACTOR: u64 = 25; // Scales APY_bps * 25 for points calculation
    
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
        oracle: &RateOracle,
        points_amount: u64,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        let deployer = admin::deployer_address(config);
        let (rate, decimals) = oracle::get_rate(oracle);
        
        let total_asset_amount_initial = oracle::convert_points_to_asset(points_amount, rate, decimals);
        
        let supply_redeem_rate_bps: u64 = 0; // Assuming 0 as SupplyOracle is removed
        
        let reduction_due_to_supply_rate = if (total_asset_amount_initial > 0 && supply_redeem_rate_bps > 0) {
            (total_asset_amount_initial * supply_redeem_rate_bps) / 10000
        } else {
            0
        };
        let total_asset_amount_after_supply_rate = total_asset_amount_initial - reduction_due_to_supply_rate;

        let fee_asset_amount = total_asset_amount_after_supply_rate / 1000; 
        let user_asset_amount = total_asset_amount_after_supply_rate - fee_asset_amount;
        
        assert!(fee_asset_amount <= total_asset_amount_after_supply_rate, EFeeCalculationError);

        ledger::internal_spend(ledger, user, points_amount, ctx);
        
        if (user_asset_amount > 0) {
            escrow::withdraw(escrow, user_asset_amount, user, ctx);
        };
        if (fee_asset_amount > 0) {
            escrow::withdraw(escrow, fee_asset_amount, deployer, ctx);
        };

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
        oracle: &RateOracle,
        points_amount: u64,
        partner_cap: &PartnerCap,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        let deployer = admin::deployer_address(config);
        let (rate, decimals) = oracle::get_rate(oracle);

        let total_asset_amount_initial = oracle::convert_points_to_asset(points_amount, rate, decimals);

        let supply_redeem_rate_bps: u64 = 0; // Assuming 0 as SupplyOracle is removed
        
        let reduction_due_to_supply_rate = if (total_asset_amount_initial > 0 && supply_redeem_rate_bps > 0) {
            (total_asset_amount_initial * supply_redeem_rate_bps) / 10000
        } else {
            0
        };
        let total_asset_amount_after_supply_rate = total_asset_amount_initial - reduction_due_to_supply_rate;

        let fee_asset_amount = total_asset_amount_after_supply_rate / 1000;
        let user_asset_amount_after_std_fee = total_asset_amount_after_supply_rate - fee_asset_amount;

        let partner_fee_share = fee_asset_amount / 5; 
        let deployer_fee_share = fee_asset_amount - partner_fee_share;
        let user_final_asset_amount = user_asset_amount_after_std_fee;

        assert!(fee_asset_amount <= total_asset_amount_after_supply_rate, EFeeCalculationError);
        assert!(partner_fee_share <= fee_asset_amount, EFeeCalculationError); 

        ledger::internal_spend(ledger, user, points_amount, ctx);
        
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
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let claimer = tx_context::sender(ctx);
        assert!(stake_position::owner_view(stake_position) == claimer, EAdminOnly);
        let _current_epoch = tx_context::epoch(ctx);
        let last_claim_epoch = stake_position::last_claim_epoch_view(stake_position);
        assert!(_current_epoch > last_claim_epoch, EAlreadyClaimedOrTooSoon);
        
        let points_rate = admin::get_points_rate(config);
        let points_to_claim = ledger::calculate_accrued_points(
            stake_position::principal_view(stake_position),
            points_rate,
            last_claim_epoch,
            _current_epoch
        );

        if (points_to_claim > 0) {
            stake_position::set_last_claim_epoch_mut(stake_position, _current_epoch);
            stake_position::add_claimed_rewards_mut(stake_position, points_to_claim);

            let stake_opt_none = std::option::none<StakePosition<T>>();
            ledger::mint_points<T>(
                ledger,
                claimer,
                points_to_claim,
                ledger::new_point_type_staking(),
                ctx,
                &stake_opt_none,
                admin::get_default_liq_share(config),
                clock
            );
            std::option::destroy_none(stake_opt_none);

            let asset_name_ascii = std::type_name::into_string(std::type_name::get<T>());
            let asset_name_string = string::utf8(ascii::into_bytes(asset_name_ascii));
            event::emit(PointsClaimed {
                user: claimer,
                stake_id: stake_position::get_id_view(stake_position),
                points_claimed: points_to_claim,
                asset_type: asset_name_string,
                claim_epoch: _current_epoch,
            });
        }
    }
    
    /// Allows an admin to claim a forfeited stake that has passed its expiry window.
    /// Initiates unstaking but currently discards the withdrawal ticket.
    /// NOTE: Phase 5 Change - This function NO LONGER initiates native unstake.
    /// Admin must call `admin_withdraw_forfeited_stake` separately after this.
    public entry fun admin_claim_forfeited_stake<T: store>(
        admin_cap: &AdminCap,
        config: &Config,
        _manager: &mut StakingManager,
        _escrow_vault: &mut EscrowVault<T>,
        _sui_system_state_obj: &mut SuiSystemState,
        stake_id_to_forfeit: ID,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(admin::is_admin(admin_cap, config), EAdminOnly);

        let staker_address: address = tx_context::sender(ctx);
        let forfeited_amount: u64 = 1;
        let asset_name_ascii = std::type_name::into_string(std::type_name::get<T>());
        let asset_name_string = string::utf8(ascii::into_bytes(asset_name_ascii));
        
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
        let initial_debt_points = ledger::get_bad_debt(ledger, user);
        
        assert!(payment_value_points > 0, ERepaymentAmountError);
        
        let debt_to_repay_points = std::u64::min(payment_value_points, initial_debt_points);
        
        ledger::internal_remove_bad_debt(ledger, user, debt_to_repay_points);
        
        let remaining_debt_points = initial_debt_points - debt_to_repay_points;

        transfer::public_transfer(payment, admin::deployer_address(config));

        event::emit(BadDebtRepaid {
            user,
            paid_sui_amount: payment_value_sui,
            repaid_debt_points: debt_to_repay_points,
            remaining_debt_points
        });
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
        sui_system_state: &mut SuiSystemState,
        stake_position: StakePosition<StakedSui>,
        clock: &Clock,
        ledger: &mut Ledger,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        assert!(stake_position::owner_view(&stake_position) == user, ENotOwner);
        assert!(!stake_position::is_encumbered_view(&stake_position), EStakeEncumbered);
        assert!(stake_position::is_redeemable(&stake_position, clock), ENotRedeemable);
        
        let native_staked_sui_address = stake_position::native_stake_id_view(&stake_position);
        let native_staked_sui_id = id_from_address(native_staked_sui_address);
        assert!(native_staked_sui_address != @0x0, EInvalidStakeIdType);
        
        let principal_sui = stake_position::principal_view(&stake_position);
        let stake_position_id = stake_position::get_id_view(&stake_position);
        
        staking_manager::request_native_stake_withdrawal(
            manager,
            sui_system_state,
            native_staked_sui_id,
            ctx
        );

        let stake_opt_none = std::option::none<StakePosition<StakedSui>>();
        if (principal_sui > 0) {
            ledger::mint_points<StakedSui>(
                ledger,
                user,
                principal_sui,
                ledger::new_point_type_staking(),
                ctx,
                &stake_opt_none,
                admin::get_default_liq_share(config),
                clock
            );
        };
        std::option::destroy_none(stake_opt_none);
        
        stake_position::destroy_stake(stake_position);
        
        event::emit(StakeConvertedToPoints {
            user,
            original_staked_sui_id: native_staked_sui_id,
            sui_amount_unstaked: principal_sui,
            points_minted: principal_sui,
            stake_position_id,
        });
    }

    public fun view_accrued_points_for_stake<T: key + store>(
        stake_position: &StakePosition<T>,
        current_epoch: u64
    ): u64 {
        let last_claim_epoch = stake_position::last_claim_epoch_view(stake_position);
        if (current_epoch <= last_claim_epoch) {
            return 0
        };
        
        let denominator = (SUI_TO_MIST_CONVERSION as u128) * (EPOCHS_PER_YEAR as u128);
        let points_per_epoch = if (denominator > 0) {
            ((stake_position::principal_view(stake_position) as u128) * 
            (get_apy_bps_for_duration_days(stake_position::duration_days_view(stake_position)) as u128) * 
            (APY_POINT_SCALING_FACTOR as u128) / denominator) as u64
        } else {
            0
        };
        
        points_per_epoch * (current_epoch - last_claim_epoch)
    }

    /// Public entry function to stake SUI into the protocol.
    /// Stakes the provided Coin<SUI> natively using the Sui system, creates a StakePosition<SUI> NFT,
    /// stores the underlying StakedSui object in the StakingManager, and transfers the
    /// StakePosition<SUI> NFT to the staker.
    public entry fun route_stake_sui(
        config: &Config,
        _ledger: &mut Ledger,
        manager: &mut StakingManager,
        clock: &Clock,
        staked_sui: StakedSui,
        duration_days: u64,
        _referrer: Option<address>,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let staker = tx_context::sender(ctx);
        let stake_amount_mist = staked_sui_amount(&staked_sui);
        let native_stake_id = object::id(&staked_sui);
        
        staking_manager::store_native_stake(manager, staked_sui, ctx);
        
        let mut stake_position_obj = stake_position::create_stake<StakedSui>(
            stake_amount_mist,
            duration_days,
            clock,
            ctx
        );
        stake_position::set_native_stake_id_mut(&mut stake_position_obj, native_stake_id);
        
        let stake_position_id = object::id(&stake_position_obj);
        transfer::public_transfer(stake_position_obj, staker);
        
        event::emit(StakeDeposited<StakedSui> {
            staker,
            stake_id: stake_position_id,
            asset_type: string::utf8(ascii::into_bytes(std::type_name::into_string(std::type_name::get<StakedSui>()))),
            amount_staked: stake_amount_mist,
            duration_days,
            unlock_time_ms: sui::clock::timestamp_ms(clock) + duration_days * stake_position::get_ms_per_day(),
            native_stake_id,
        });
    }

    public entry fun earn_points_by_partner(
        user: address,
        pts: u64,
        partner: &mut PartnerCap,
        ledger: &mut Ledger,
        clock: &Clock,
        config: &Config,
        ctx: &mut TxContext
    ) {
        assert!(!partner::get_paused(partner), EPartnerPaused);
        let _current_epoch = tx_context::epoch(ctx);

        if (_current_epoch > partner::get_last_epoch(partner)) {
            partner::reset_mint_today_mut(partner, _current_epoch);
        };
        assert!(partner::get_mint_remaining_today(partner) >= pts, EPartnerExceedsQuota);
        
        let stake_opt = std_option::none<StakePosition<u8>>();
        ledger::mint_points<u8>(
            ledger,
            user,
            pts,
            ledger::new_point_type_generic_reward(),
            ctx,
            &stake_opt,
            admin::get_default_liq_share(config),
            clock
        );
        std_option::destroy_none(stake_opt);

        partner::decrease_mint_remaining_today_mut(partner, pts);
        
        event::emit(PointsEarned { 
            user, 
            amount: pts, 
            partner: object::uid_to_address(partner::get_id(partner))
        });
    }

    /// Allows a user to get an instant Alpha Points loan against their maturing/matured native SUI stake.
    /// The SUI stake is then unstaked by the protocol, and the Loan object is held by the protocol admin.
    /// The user's StakePosition NFT is encumbered and later destroyed by an admin action
    /// once the SUI is claimed by the protocol.
    #[allow(unused_const)]
    public entry fun liquid_unstake_as_loan_native_sui(
        config: &Config,
        _loan_config: &loan::LoanConfig,
        ledger: &mut Ledger,
        stake_position: &mut StakePosition<StakedSui>,
        clock: &Clock,
        staking_manager: &mut StakingManager,
        sui_system_state: &mut SuiSystemState,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        assert!(stake_position::owner_view(stake_position) == user, ENotOwner);
        assert!(!stake_position::is_encumbered_view(stake_position), EStakeEncumbered);
        assert!(stake_position::is_redeemable(stake_position, clock), EStakeNotMatureForLoan);
        
        let sui_principal_for_loan = stake_position::principal_view(stake_position);
        let loan_fee_points = sui_principal_for_loan / 1000;
        let points_to_user_net = sui_principal_for_loan - loan_fee_points;
        
        assert!(loan_fee_points <= sui_principal_for_loan, EFeeCalculationError);
        
        if (points_to_user_net > 0) {
            let stake_opt_none = std_option::none<StakePosition<StakedSui>>();
            ledger::mint_points<StakedSui>(
                ledger,
                user,
                points_to_user_net,
                ledger::new_point_type_staking(),
                ctx,
                &stake_opt_none,
                admin::get_default_liq_share(config),
                clock
            );
            std_option::destroy_none(stake_opt_none);
        };
        
        if (loan_fee_points > 0) {
            let stake_opt_none_fee = std_option::none<StakePosition<StakedSui>>();
            ledger::mint_points<StakedSui>(
                ledger,
                admin::deployer_address(config),
                loan_fee_points,
                ledger::new_point_type_staking(),
                ctx,
                &stake_opt_none_fee,
                admin::get_default_liq_share(config),
                clock
            );
            std_option::destroy_none(stake_opt_none_fee);
        };

        let stake_pos_id = stake_position::get_id_view(stake_position);
        let loan_opened_time_ms = sui::clock::timestamp_ms(clock);
        let loan_object = loan::create_loan(
            user, 
            stake_pos_id, 
            sui_principal_for_loan, 
            loan_opened_time_ms, 
            ctx
        );
        let loan_object_id = object::uid_to_inner(loan::get_loan_uid(&loan_object));
        transfer::public_transfer(loan_object, user);
        
        stake_position::set_encumbered(stake_position, true);
        
        let native_staked_sui_address = stake_position::native_stake_id_view(stake_position);
        let native_staked_sui_id = id_from_address(native_staked_sui_address);
        assert!(native_staked_sui_address != @0x0, EInvalidStakeIdType);
        
        staking_manager::request_native_stake_withdrawal(
            staking_manager,
            sui_system_state,
            native_staked_sui_id,
            ctx
        );

        event::emit(LiquidUnstakeAsLoanInitiated {
            user,
            stake_position_id: stake_pos_id,
            native_sui_stake_id: native_staked_sui_id,
            sui_value_for_loan: sui_principal_for_loan,
            points_loaned: points_to_user_net,
            loan_fee_points,
            loan_object_id,
            opened_time_ms: loan_opened_time_ms,
        });
    }

    /// Allows minting points without partner cap restrictions for testing
    public entry fun earn_points_testnet(
        config: &Config,
        _bypass_cap: &TestnetBypassCap,
        user: address,
        pts: u64,
        ledger: &mut Ledger,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(admin::is_testnet_bypass_enabled(config), EAdminOnly);
        let _current_epoch = tx_context::epoch(ctx);

        let stake_opt = std_option::none<StakePosition<u8>>();
        ledger::mint_points<u8>(
            ledger,
            user,
            pts,
            ledger::new_point_type_generic_reward(),
            ctx,
            &stake_opt,
            admin::get_default_liq_share(config),
            clock
        );
        std_option::destroy_none(stake_opt);
        
        event::emit(PointsEarned { 
            user, 
            amount: pts, 
            partner: @0x0 
        });
    }

    /// Emergency unstake function that bypasses normal checks to allow users to recover their staked SUI.
    /// This is a one-time function to help users migrate from the old package.
    /// Only callable by the admin.
    public entry fun emergency_unstake_native_sui(
        admin_cap: &AdminCap,
        config: &Config,
        manager: &mut StakingManager,
        sui_system_state: &mut SuiSystemState,
        stake_position: StakePosition<StakedSui>,
        clock: &Clock,
        ledger: &mut Ledger,
        ctx: &mut TxContext
    ) {
        assert!(admin::is_admin(admin_cap, config), EAdminOnly);
        let user = stake_position::owner_view(&stake_position);
        let _current_epoch = tx_context::epoch(ctx);
        
        let native_staked_sui_address = stake_position::native_stake_id_view(&stake_position);
        let native_staked_sui_id = id_from_address(native_staked_sui_address);
        assert!(native_staked_sui_address != @0x0, EInvalidStakeIdType);
        
        let principal_sui = stake_position::principal_view(&stake_position);
        let stake_position_id = stake_position::get_id_view(&stake_position);
        
        staking_manager::request_native_stake_withdrawal(
            manager,
            sui_system_state,
            native_staked_sui_id,
            ctx
        );

        let stake_opt_none = std_option::none<StakePosition<StakedSui>>();
        if (principal_sui > 0) {
            ledger::mint_points<StakedSui>(
                ledger,
                user,
                principal_sui,
                ledger::new_point_type_staking(),
                ctx,
                &stake_opt_none,
                admin::get_default_liq_share(config),
                clock
            );
        };
        std_option::destroy_none(stake_opt_none);
        
        stake_position::destroy_stake(stake_position);
        
        event::emit(StakeConvertedToPoints {
            user,
            original_staked_sui_id: native_staked_sui_id,
            sui_amount_unstaked: principal_sui,
            points_minted: principal_sui,
            stake_position_id,
        });
    }
}