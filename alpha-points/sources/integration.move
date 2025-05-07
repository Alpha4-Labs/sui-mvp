/// Module that provides the main public entry points for user interactions.
/// Orchestrates calls to other modules.
module alpha_points::integration {
    use sui::tx_context::TxContext;
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use sui::event;
    use sui::object::ID;
    use sui::transfer;
    use sui::sui::SUI;
    use std::type_name;
    use std::ascii;
    
    // Corrected Sui System State and Staking Pool imports
    use sui_system::sui_system::SuiSystemState;
    use sui_system::staking_pool::{Self, StakedSui, staked_sui_amount};

    use std::string::{Self, String};
    use std::u64;
    use std::option::{Self, Option};
    
    use alpha_points::admin::{Self, Config, AdminCap, is_admin, get_target_validator};
    use alpha_points::ledger::{Self, Ledger, mint_points, PointType};
    use alpha_points::escrow::{Self, EscrowVault};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::staking_manager::{Self, StakingManager};
    use alpha_points::loan::{Self, Loan};
    
    // Error constants
    const EStakeNotMature: u64 = 103;
    const EAlreadyClaimedOrTooSoon: u64 = 102;
    const EFeeCalculationError: u64 = 109;
    const EAdminOnly: u64 = 107;
    const ERepaymentAmountError: u64 = 108;
    
    // Constants
    const STAKE_EXPIRY_DAYS: u64 = 14;

    // APY Calculation Constants
    const EPOCHS_PER_YEAR: u64 = 365; // Assuming daily epochs for simplicity
    const SUI_TO_MIST_CONVERSION: u64 = 1_000_000_000;
    const APY_POINT_SCALING_FACTOR: u64 = 25; // Scales APY_bps * 25 for points calculation
    const EInvalidStakeDurationForApy: u64 = 110; // Error for APY lookup
    
    // Constants for Event Structs
    const POINTS_ACCRUED_EVENT_TYPE: vector<u8> = b"PointsAccrued";
    const POINTS_CLAIMED_EVENT_TYPE: vector<u8> = b"PointsClaimed";
    
    // Events
    public struct StakeRouted<phantom T: store> has copy, drop {
        staker: address,
        stake_id: ID,
        asset_type: String, 
        amount_staked_asset: u64,
        duration_days: u64,
        unlock_time_ms: u64,
        native_stake_id: ID 
    }
    
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
    public struct StakeForfeited has store, copy, drop {
        admin_cap_id: ID,
        staker_address: address,
        stake_id: ID,
        forfeited_amount: u64,
        asset_type: String,
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
    public struct StakeRedeemed<phantom T: store> has copy, drop {
        redeemer: address,
        principal_redeemed: u64,
        points_used: u64,
        fee_paid: u64,
        epoch: u64
    }
    
    /// Event emitted when points are redeemed for the fee asset
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
        let total_asset_amount = oracle::convert_points_to_asset(points_amount, rate, decimals);

        let fee_asset_amount = total_asset_amount / 1000;
        let user_asset_amount = total_asset_amount - fee_asset_amount;
        if (fee_asset_amount > total_asset_amount) { abort EFeeCalculationError };

        ledger::internal_spend(ledger, user, points_amount, ctx);
        
        if (user_asset_amount > 0) {
            escrow::withdraw(escrow, user_asset_amount, user, ctx);
        };
        if (fee_asset_amount > 0) {
            escrow::withdraw(escrow, fee_asset_amount, deployer, ctx);
        };
        
        event::emit(PointsRedeemedEvent<T> {
            user,
            points_amount,
            asset_amount: total_asset_amount
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
        _config: &Config, // config might be needed if APY lookup moves to admin module later
        stake_position_obj: &mut StakePosition<T>,
        ledger: &mut Ledger,
        _clock: &Clock, // Not directly used if current_epoch from ctx is sufficient
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(_config); 
        let claimer = tx_context::sender(ctx);

        let current_epoch = ctx.epoch();
        let last_claim_epoch = stake_position::last_claim_epoch_view(stake_position_obj);
        assert!(current_epoch > last_claim_epoch, EAlreadyClaimedOrTooSoon);

        let stake_id = stake_position::get_id_view(stake_position_obj);
        let principal_mist = stake_position::principal_view(stake_position_obj);
        
        let duration_days = stake_position::duration_days_view(stake_position_obj);
        let stake_apy_bps = get_apy_bps_for_duration_days(duration_days);

        let numerator_part1 = (principal_mist as u128) * (stake_apy_bps as u128);
        let numerator = numerator_part1 * (APY_POINT_SCALING_FACTOR as u128);
        let denominator = (SUI_TO_MIST_CONVERSION as u128) * (EPOCHS_PER_YEAR as u128);
        
        let points_per_epoch = if (denominator > 0) { (numerator / denominator) as u64 } else { 0 };

        let epochs_passed = current_epoch - last_claim_epoch;
        let points_to_claim = points_per_epoch * epochs_passed;

        if (points_to_claim > 0) {
            ledger::mint_points(ledger, claimer, points_to_claim, ledger::new_point_type_staking(), ctx);
            stake_position::set_last_claim_epoch_mut(stake_position_obj, current_epoch);
            stake_position::add_claimed_rewards_mut(stake_position_obj, points_to_claim); 

            let temp_ascii_string = std::type_name::into_string(std::type_name::get<T>());
            let asset_type_string = string::utf8(ascii::into_bytes(temp_ascii_string));

            event::emit(PointsClaimed {
                user: claimer,
                stake_id: stake_id,
                points_claimed: points_to_claim,
                asset_type: asset_type_string,
                claim_epoch: current_epoch,
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
        manager: &mut StakingManager,
        _escrow_vault: &mut EscrowVault<T>,
        sui_system_state_obj: &mut SuiSystemState,
        stake_id_to_forfeit: ID,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(admin::is_admin(admin_cap, config), EAdminOnly);

        let staker_address: address = tx_context::sender(ctx);
        let mut forfeited_amount: u64 = 0;
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
            forfeited_amount = 1;
        } else {
            forfeited_amount = 1;
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
        oracle: &RateOracle,
        mut payment: Coin<SUI>,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        let user = tx_context::sender(ctx);
        let deployer = admin::deployer_address(config);
        let paid_sui_amount = coin::value(&payment);

        let current_debt_points = ledger::get_bad_debt(ledger, user);
        assert!(current_debt_points > 0, ERepaymentAmountError);

        let (rate, decimals) = oracle::get_rate(oracle);
        let payment_value_points = oracle::convert_asset_to_points(
            paid_sui_amount,
            rate,
            decimals
        );

        let debt_to_repay_points = u64::min(payment_value_points, current_debt_points);

        if (debt_to_repay_points == 0) {
            transfer::public_transfer(payment, deployer);
            return;
        };

        ledger::internal_remove_bad_debt(ledger, user, debt_to_repay_points);
        transfer::public_transfer(payment, deployer);
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
        _ctx: &TxContext
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
        config: &Config, // Assuming Config is needed for some validation, or can be removed if not
        sui_system_state_obj: &mut SuiSystemState,
        stake_id: ID,
        ctx: &mut TxContext
    ) {
        // TODO: Add any necessary pre-checks using config or manager state if needed
        // For example, check if the stake_id is valid or belongs to the caller if that logic exists

        // Call the function without assigning its result
        staking_manager::request_native_stake_withdrawal(
            manager,
            sui_system_state_obj, 
            stake_id, 
            ctx
        );

        // let event_data = unstake_event_data(stake_id, puntos_constants::NATIVE_SUI_TYPE_NAME_ASCII());
        // puntos_event_bus::emit_puntos_event(config.event_bus_id(), event_data, ctx);
    }

    // TODO: The logic for completing unstake needs to be revised based on how 
    // the StakedSui object (that is ready for withdrawal) is obtained after request_native_stake_withdrawal.
    // Commenting out for now to resolve the immediate build error.
    /*
    public entry fun complete_unstake_native_sui(
        manager: &mut StakingManager,
        config: &Config, // Assuming Config is needed
        sui_system_state_obj: &mut SuiSystemState,
        withdrawal_ticket: ???, // This needs to be the StakedSui object ready for withdrawal
        original_stake_id: ID,
        ctx: &mut TxContext
    ): Coin<SUI> {
        let withdrawn_coin = staking_manager::complete_native_stake_withdrawal(
            manager,
            sui_system_state_obj,
            withdrawal_ticket, // This needs to be the StakedSui object
            original_stake_id,
            ctx
        );

        // let event_data = complete_unstake_event_data(original_stake_id, coin::value(&withdrawn_coin), puntos_constants::NATIVE_SUI_TYPE_NAME_ASCII());
        // puntos_event_bus::emit_puntos_event(config.event_bus_id(), event_data, ctx);
        withdrawn_coin
    }
    */

    public fun view_accrued_points_for_stake<T: key + store>(
        stake_position_obj: &StakePosition<T>,
        // _config: &Config, // Pass if APY logic moves to config
        current_epoch: u64
    ): u64 {
        let last_claim_epoch = stake_position::last_claim_epoch_view(stake_position_obj);
        if (current_epoch <= last_claim_epoch) {
            return 0;
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
}