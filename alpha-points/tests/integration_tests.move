#[test_only]
module alpha_points::integration_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use std::vector;
    use sui::tx_context::{TxContext};
    use sui::balance::{Self, Balance};
    use sui::object::{Self, ID};
    use std::option::{Self, Option};

    use alpha_points::integration::{Self, EStakeNotMature, EHasBadDebt, EStakeExpired, EStakeNotExpired};
    use alpha_points::admin::{Self, Config, GovernCap, OracleCap, AdminCap};
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::partner::{Self, PartnerCap};
    use alpha_points::staking_manager::{Self, StakingManager};
    use alpha_points::escrow::{Self, EscrowVault};

    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const PARTNER_ADDR: address = @0xB;
    const STAKE_AMOUNT: u64 = 100_000_000_000; // 100 SUI in MIST
    const ROUTING_FEE_BPS: u64 = 500; // 5%
    const DURATION_DAYS: u64 = 30;
    const VALIDATOR_ADDR: address = @0x1; // Dummy validator address
    const POINTS_AMOUNT: u64 = 2000;

    /// Comprehensive setup function that initializes all required objects for testing
    fun setup_test(): (Scenario, Clock) {
        let mut scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Initialize ledger module
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            ledger::init_for_testing(ctx);
        };
        
        // Initialize StakingManager
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            staking_manager::init_for_testing(ctx);
        };
        
        // Create and initialize clock with a starting time
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        // Start at a reasonable timestamp - 1 day in ms
        clock::set_for_testing(&mut clock, 86400000);
        
        // Setup vault, oracle, partner cap
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            
            // Escrow vault needed for points redemption
            {
                let ctx = ts::ctx(&mut scenario);
                escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            };
            
            // Create oracle - start with fresh oracle
            {
                let ctx = ts::ctx(&mut scenario);
                oracle::create_oracle(&oracle_cap, 1000000000, 9, 10, ctx);
                
                // Update the oracle to make sure it's fresh
                ts::next_tx(&mut scenario, ADMIN_ADDR);
                let mut oracle = ts::take_shared<RateOracle>(&scenario);
                let ctx = ts::ctx(&mut scenario);
                oracle::update_rate(&mut oracle, &oracle_cap, 1000000000, ctx);
                ts::return_shared(oracle);
            };
            
            // Create partner cap
            {
                let ctx = ts::ctx(&mut scenario);
                let partner_name = string::utf8(b"Test Partner");
                partner::grant_partner_cap(&govern_cap, PARTNER_ADDR, partner_name, ctx);
            };
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Give SUI to user for staking
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(STAKE_AMOUNT * 3, ctx);
            transfer::public_transfer(coin, USER_ADDR);
        };
        
        // Deposit some SUI into Escrow for redemption tests
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            // Deposit enough SUI to cover potential redemptions (e.g., 500 SUI)
            let deposit_coin = coin::mint_for_testing<SUI>(500_000_000_000, ctx);
            escrow::test_deposit<SUI>(&mut escrow_vault, &govern_cap, deposit_coin, ctx);
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(escrow_vault);
        };
        
        (scenario, clock)
    }

    #[test]
    fun test_route_stake() {
        let (mut scenario, clock) = setup_test();
        
        let mut native_stake_id_option: Option<ID> = option::none();

        // User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let initial_user_balance = coin::value(&coin);
            integration::route_stake<SUI>(
                &config,
                &mut manager,
                &ledger,
                &clock,
                coin,
                DURATION_DAYS,
                VALIDATOR_ADDR,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };
        
        // Verify stake position and capture native ID
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            assert_eq(stake_position::owner(&stake), USER_ADDR, 1);
            assert_eq(stake_position::principal(&stake), STAKE_AMOUNT, 2);
            assert_eq(stake_position::duration_days(&stake), DURATION_DAYS, 3);
            let native_stake_id = stake_position::get_native_stake_id(&stake);
            assert!(object::id_to_bytes(native_stake_id) != vector::empty<u8>(), 4);
            native_stake_id_option = option::some(native_stake_id);
            
            ts::return_to_sender(&scenario, stake);
        };
        
        // Verify fee was transferred to ADMIN (deployer)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let fee_amount_expected = STAKE_AMOUNT * ROUTING_FEE_BPS / 10000;
            // Take the fee coin transferred to ADMIN
            let fee_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&fee_coin), fee_amount_expected, 5);
            // Burn the fee coin to clean up
            coin::burn_for_testing(fee_coin);
        };

        // Verify StakingManager contains the stake
        ts::next_tx(&mut scenario, ADMIN_ADDR); // Use admin to check manager
        {
            let manager = ts::take_shared<StakingManager>(&scenario);
            let native_stake_id = option::extract(&mut native_stake_id_option);
            assert!(staking_manager::test_contains_stake(&manager, native_stake_id), 6);
            ts::return_shared(manager);
            option::destroy_some(native_stake_id); // Clean up option
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_redeem_stake() {
        let (mut scenario, mut clock) = setup_test();
        let mut native_stake_id_option: Option<ID> = option::none();
        
        // User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::route_stake<SUI>(
                &config,
                &mut manager,
                &ledger,
                &clock,
                coin,
                DURATION_DAYS,
                VALIDATOR_ADDR,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };
        
        // Get the native_stake_id from the created StakePosition
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            native_stake_id_option = option::some(stake_position::get_native_stake_id(&stake));
            ts::return_to_sender(&scenario, stake);
        };

        // Advance time to maturity (but before expiry)
        let duration_ms = DURATION_DAYS * 86400000;
        clock::increment_for_testing(&mut clock, duration_ms + 1000); // Just past maturity
        
        // Check user points before redemption (should be 0 initially)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), 0, 50);
            ts::return_shared(ledger);
        };

        // User redeems stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::redeem_stake<SUI>(
                &config, &ledger, stake, &clock, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Verify points were claimed and StakePosition is destroyed
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let config = ts::take_shared<Config>(&scenario);

            // Calculate expected points
            let points_rate = admin::get_points_rate(&config);
            let native_stake_id = option::extract(&mut native_stake_id_option);
            // Need start epoch - assume it was epoch 0 for simplicity in test setup or get from stake before destroy
            let start_epoch = 0; // Needs verification/refinement based on actual test clock setup
            let current_epoch = clock::epoch(&clock);
            let expected_points = ledger::calculate_accrued_points(
                STAKE_AMOUNT, points_rate, start_epoch, current_epoch
            );

            assert!(expected_points > 0, 51); // Make sure calculation yields something
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), expected_points, 52);
            
            // Verify StakedSui still exists in StakingManager 
            let manager = ts::take_shared<StakingManager>(&scenario);
            assert!(staking_manager::test_contains_stake(&manager, native_stake_id), 53);

            ts::return_shared(ledger);
            ts::return_shared(config);
            ts::return_shared(manager);
            option::destroy_some(native_stake_id);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EStakeNotMature)]
    fun test_redeem_stake_immature() {
        let (mut scenario, clock) = setup_test();
        
        // User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::route_stake<SUI>(
                &config,
                &mut manager,
                &ledger,
                &clock,
                coin,
                DURATION_DAYS,
                VALIDATOR_ADDR,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };
        
        // Try to redeem before maturity (should fail)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // This should fail with EStakeNotMature
            integration::redeem_stake<SUI>(
                &config, &ledger, stake, &clock, ctx
            );
            
            // These won't execute if test properly aborts
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(manager);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_earn_points() {
        let (mut scenario, clock) = setup_test();
        
        // Partner earns points for user
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::earn_points(
                &config, &mut ledger, &partner_cap, USER_ADDR, POINTS_AMOUNT, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // Verify user points
        ts::next_tx(&mut scenario, USER_ADDR); // Switch actor just to read ledger
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT, 1);
            ts::return_shared(ledger);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_spend_points() {
        let (mut scenario, clock) = setup_test();
        let spend_amount = POINTS_AMOUNT / 4;

        // 1. Partner earns points for user
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::earn_points(&config, &mut ledger, &partner_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };

        // 2. User spends some points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            integration::spend_points(&config, &mut ledger, spend_amount, ctx);

            ts::return_shared(config);
            ts::return_shared(ledger);
        };

        // 3. Verify user points decreased
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT - spend_amount, 1);
            ts::return_shared(ledger);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_redeem_points() {
        let (mut scenario, clock) = setup_test();
        let redeem_points_amount = POINTS_AMOUNT / 2;

        // 1. Partner earns points for user
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::earn_points(&config, &mut ledger, &partner_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };

        // 2. User redeems points for SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            integration::redeem_points<SUI>(
                &config, 
                &mut ledger, 
                &mut escrow_vault, 
                &oracle, 
                redeem_points_amount, 
                &clock, 
                ctx
            );

            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
            ts::return_shared(oracle);
            // User should now have received a Coin<SUI>
        };

        // 3. Verify points decreased and SUI received
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT - redeem_points_amount, 1);
            ts::return_shared(ledger);

            // Calculate expected SUI (Rate = 1 SUI per 1 Point, 9 decimals)
            // Points * Rate / 10^Decimals => redeem_points_amount * 10^9 / 10^9 = redeem_points_amount MIST
            let expected_total_sui = redeem_points_amount;
            let fee_sui = expected_total_sui / 1000; // 0.1% fee
            let expected_net_sui = expected_total_sui - fee_sui;

            let user_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&user_coin), expected_net_sui, 2);
            ts::return_to_sender(&scenario, user_coin);

            // Verify deployer (ADMIN_ADDR) received the fee_sui amount.
            // Switch tx context to ADMIN
            ts::next_tx(&mut scenario, ADMIN_ADDR);
            let fee_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&fee_coin), fee_sui, 3);
            coin::burn_for_testing(fee_coin); // Cleanup
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_lock_and_unlock_points() {
        let (mut scenario, clock) = setup_test();
        
        // Partner earns points for user first
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::earn_points(
                &config, &mut ledger, &partner_cap, USER_ADDR, POINTS_AMOUNT, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // Lock points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let lock_amount = POINTS_AMOUNT / 2;
            integration::lock_points(
                &config, &mut ledger, lock_amount, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Verify lock
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            
            ts::return_shared(ledger);
        };
        
        // Unlock points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let unlock_amount = POINTS_AMOUNT / 4;
            integration::unlock_points(
                &config, &mut ledger, unlock_amount, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Verify unlock
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT * 3 / 4);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 4);
            
            ts::return_shared(ledger);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_full_stake_and_redeem_flow() {
        let (mut scenario, mut clock) = setup_test();
        
        // 1. User stakes SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let initial_user_balance = coin::value(&coin);
            integration::route_stake<SUI>(
                &config,
                &mut manager,
                &ledger,
                &clock,
                coin,
                DURATION_DAYS,
                VALIDATOR_ADDR,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };
        
        // 2. User gets points through partner
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::earn_points(
                &config, &mut ledger, &partner_cap, USER_ADDR, POINTS_AMOUNT, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // 3. User locks some points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::lock_points(
                &config, &mut ledger, POINTS_AMOUNT / 4, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // 4. User spends some points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::spend_points(
                &config, &mut ledger, POINTS_AMOUNT / 4, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // 5. Advance time to maturity
        clock::increment_for_testing(&mut clock, DURATION_DAYS * 86400000 * 2);
        
        // 6. User redeems the stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::redeem_stake<SUI>(
                &config, &ledger, &mut manager, stake, &clock, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(manager);
        };
        
        // 7. Verify final state
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            
            // Verify escrow state
            assert_eq(escrow::total_value<SUI>(&escrow_vault), 0);
            
            // Verify ledger state - should have 3/4 of original POINTS_AMOUNT (1/4 locked, 1/4 spent, 2/4 available)
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 4);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), (POINTS_AMOUNT * 3) / 4);
            assert_eq(ledger::get_total_supply(&ledger), (POINTS_AMOUNT * 3) / 4);
            
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EStakeExpired)]
    fun test_redeem_stake_expired() {
        let (mut scenario, mut clock) = setup_test();
        
        // User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::route_stake<SUI>(
                &config, &mut manager, &ledger, &clock, coin, DURATION_DAYS, VALIDATOR_ADDR, ctx
            );
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };
        
        // Advance time past maturity AND expiry (e.g., duration + 15 days)
        let duration_ms = DURATION_DAYS * 86400000;
        let expiry_ms = 15 * 86400000; // 15 days > 14 day expiry
        clock::increment_for_testing(&mut clock, duration_ms + expiry_ms);
        
        // Try to redeem (should fail with EStakeExpired)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::redeem_stake<SUI>(
                &config, &ledger, stake, &clock, ctx
            );
            
            // These won't execute if test properly aborts
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_withdraw_native_stake() {
        let (mut scenario, mut clock) = setup_test();
        let mut native_stake_id_option: Option<ID> = option::none();
        
        // 1. User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::route_stake<SUI>(
                &config, &mut manager, &ledger, &clock, coin, DURATION_DAYS, VALIDATOR_ADDR, ctx
            );
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };
        
        // 2. Get the native_stake_id
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            native_stake_id_option = option::some(stake_position::get_native_stake_id(&stake));
            ts::return_to_sender(&scenario, stake);
        };
        let native_stake_id = option::extract(&mut native_stake_id_option);
        option::destroy_none(native_stake_id_option);

        // 3. Advance time to maturity
        let duration_ms = DURATION_DAYS * 86400000;
        clock::increment_for_testing(&mut clock, duration_ms + 1000); 

        // 4. User redeems stake (claims points, destroys StakePosition)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::redeem_stake<SUI>(&config, &ledger, stake, &clock, ctx);
            ts::return_shared(config);
            ts::return_shared(ledger);
        };

        // 5. User withdraws native stake (gets ticket)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            integration::withdraw_native_stake(
                &config, 
                &mut manager, 
                native_stake_id, 
                ctx
            );

            ts::return_shared(config);
            ts::return_shared(manager);
            // WithdrawalTicket is now owned by USER_ADDR
        };

        // 6. Verify WithdrawalTicket exists for user
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            use sui::staking_pool::WithdrawalTicket;
            let ticket = ts::take_from_sender<WithdrawalTicket>(&scenario);
            // Can add more assertions about the ticket if needed/possible
            assert!(object::id_to_bytes(object::id(&ticket)) != vector::empty<u8>(), 100);
            ts::return_to_sender(&scenario, ticket);

            // TODO: Verify StakedSui is *gone* from StakingManager using native_stake_id 
            // Requires test helper in StakingManager
        }

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // === Forfeiture Tests ===

    #[test]
    fun test_admin_claim_forfeited_stake() {
        let (mut scenario, mut clock) = setup_test();
        let mut native_stake_id_option: Option<ID> = option::none();

        // 1. User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::route_stake<SUI>(
                &config, &mut manager, &ledger, &clock, coin, DURATION_DAYS, VALIDATOR_ADDR, ctx
            );
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };

        // 2. Get native_stake_id (needed for later verification)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            native_stake_id_option = option::some(stake_position::get_native_stake_id(&stake));
            ts::return_to_sender(&scenario, stake);
        };

        // 3. Advance time past expiry
        let duration_ms = DURATION_DAYS * 86400000;
        let expiry_ms = 15 * 86400000; // Past 14 days
        clock::increment_for_testing(&mut clock, duration_ms + expiry_ms);

        // 4. Admin claims the forfeited stake
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            // Manager not needed for claim anymore
            let stake = ts::take_shared<StakePosition<SUI>>(&scenario); // Stake should be findable by ID or type
            let ctx = ts::ctx(&mut scenario);

            integration::admin_claim_forfeited_stake<SUI>(
                &admin_cap, &config, /*&mut manager,*/ stake, &clock, ctx
            );

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(config);
            // ts::return_shared(manager);
            // StakePosition object is destroyed
        };

        // 5. Verification
        // Verify StakePosition is gone (implicit check: trying to take it again would fail)
        // TODO: Verify StakedSui still exists in StakingManager (needs helper)

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EStakeNotExpired)]
    fun test_admin_claim_forfeited_stake_not_expired() {
        let (mut scenario, mut clock) = setup_test();

        // 1. User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::route_stake<SUI>(
                &config, &mut manager, &ledger, &clock, coin, DURATION_DAYS, VALIDATOR_ADDR, ctx
            );
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };

        // 2. Advance time past maturity but *before* expiry
        let duration_ms = DURATION_DAYS * 86400000;
        clock::increment_for_testing(&mut clock, duration_ms + 1000); // Just past maturity

        // 3. Admin tries to claim (should fail)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            let stake = ts::take_shared<StakePosition<SUI>>(&scenario); 
            let ctx = ts::ctx(&mut scenario);

            integration::admin_claim_forfeited_stake<SUI>(
                &admin_cap, &config, stake, &clock, ctx
            );

            // Should not reach here
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(config);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_admin_withdraw_forfeited_stake() {
        let (mut scenario, mut clock) = setup_test();
        let mut native_stake_id_option: Option<ID> = option::none();

        // 1. User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::route_stake<SUI>(
                &config, &mut manager, &ledger, &clock, coin, DURATION_DAYS, VALIDATOR_ADDR, ctx
            );
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };

        // 2. Get native_stake_id 
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            native_stake_id_option = option::some(stake_position::get_native_stake_id(&stake));
            ts::return_to_sender(&scenario, stake);
        };
        let native_stake_id = option::extract(&mut native_stake_id_option);
        option::destroy_none(native_stake_id_option);

        // 3. Advance time past expiry
        let duration_ms = DURATION_DAYS * 86400000;
        let expiry_ms = 15 * 86400000; // Past 14 days
        clock::increment_for_testing(&mut clock, duration_ms + expiry_ms);

        // 4. Admin claims the forfeited stake (destroys StakePosition)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            let stake = ts::take_shared<StakePosition<SUI>>(&scenario); 
            let ctx = ts::ctx(&mut scenario);
            integration::admin_claim_forfeited_stake<SUI>(
                &admin_cap, &config, stake, &clock, ctx
            );
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(config);
        };

        // 5. Admin withdraws the underlying native stake (gets ticket)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            integration::admin_withdraw_forfeited_stake(
                &admin_cap, &config, &mut manager, native_stake_id, ctx
            );

            ts::return_to_sender(&scenario, admin_cap);
            ts::return_shared(config);
            ts::return_shared(manager);
            // WithdrawalTicket should now be owned by ADMIN_ADDR (deployer)
        };

        // 6. Verify WithdrawalTicket exists for ADMIN_ADDR
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            use sui::staking_pool::WithdrawalTicket;
            let ticket = ts::take_from_sender<WithdrawalTicket>(&scenario);
            assert!(object::id_to_bytes(object::id(&ticket)) != vector::empty<u8>(), 101);
            ts::return_to_sender(&scenario, ticket);

            // Verify StakedSui is *gone* from StakingManager
            let manager = ts::take_shared<StakingManager>(&scenario);
            assert!(!staking_manager::test_contains_stake(&manager, native_stake_id), 102);
            ts::return_shared(manager);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // === Bad Debt Tests ===

    // Helper to add bad debt (assumes internal_add_bad_debt is callable or a test helper exists)
    fun add_bad_debt_for_user(scenario: &mut Scenario, user: address, amount: u64) {
        ts::next_tx(scenario, ADMIN_ADDR); // Use admin to modify ledger state
        {
            let mut ledger = ts::take_shared<Ledger>(scenario);
            // Assuming direct call is possible for testing
            ledger::internal_add_bad_debt(&mut ledger, user, amount);
            ts::return_shared(ledger);
        };
    }

    #[test]
    fun test_repay_bad_debt() {
        let (mut scenario, clock) = setup_test();
        let debt_amount = 5000; // Some arbitrary points debt
        let payment_sui = 100_000_000; // 0.1 SUI

        // 1. Add bad debt for the user
        add_bad_debt_for_user(&mut scenario, USER_ADDR, debt_amount);

        // 2. Verify debt exists
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_bad_debt(&ledger, USER_ADDR), debt_amount, 200);
            ts::return_shared(ledger);
        };

        // 3. User repays bad debt with SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let payment_coin = coin::mint_for_testing<SUI>(payment_sui, ts::ctx(&mut scenario));

            integration::repay_bad_debt(
                &config, &mut ledger, &oracle, payment_coin, &clock, ts::ctx(&mut scenario)
            );

            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(oracle);
        };

        // 4. Verify debt decreased/cleared
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            // Oracle rate is 1:1, so 0.1 SUI = 100_000_000 MIST = 100 points repayment value
            // Need actual oracle conversion logic if rate != 1
            let repayment_value_points = 100; // Hardcoded based on 1:1 rate assumption
            let expected_remaining_debt = if (debt_amount > repayment_value_points) {
                debt_amount - repayment_value_points
            } else { 0 };
            assert_eq(ledger::get_bad_debt(&ledger, USER_ADDR), expected_remaining_debt, 201);
            ts::return_shared(ledger);
            
            // Verify ADMIN_ADDR received the payment_sui
            ts::next_tx(&mut scenario, ADMIN_ADDR);
            let received_payment = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&received_payment), payment_sui, 202);
            coin::burn_for_testing(received_payment); // Cleanup
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ledger::ERepaymentExceedsDebt)] // Or ENoDebtToRepay if added
    fun test_repay_bad_debt_no_debt() {
        let (mut scenario, clock) = setup_test();
        let payment_sui = 100_000_000; // 0.1 SUI

        // 1. Verify user has no debt
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_bad_debt(&ledger, USER_ADDR), 0, 300);
            ts::return_shared(ledger);
        };

        // 2. User tries to repay non-existent debt (should fail)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let payment_coin = coin::mint_for_testing<SUI>(payment_sui, ts::ctx(&mut scenario));

            integration::repay_bad_debt(
                &config, &mut ledger, &oracle, payment_coin, &clock, ts::ctx(&mut scenario)
            );

            // Should not reach here
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(oracle);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ledger::EHasBadDebt)]
    fun test_route_stake_fails_with_bad_debt() {
        let (mut scenario, clock) = setup_test();
        let debt_amount = 5000; 

        // 1. Add bad debt for the user
        add_bad_debt_for_user(&mut scenario, USER_ADDR, debt_amount);

        // 2. User tries to stake (should fail)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::route_stake<SUI>(
                &config, &mut manager, &ledger, &clock, coin, DURATION_DAYS, VALIDATOR_ADDR, ctx
            );

            // Should not reach here
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_claim_accrued_points() {
        let (mut scenario, mut clock) = setup_test();
        let mut native_stake_id_option: Option<ID> = option::none();
        let claim_wait_days = 10; // Wait 10 days before claiming

        // 1. User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut manager = ts::take_shared<StakingManager>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            integration::route_stake<SUI>(
                &config, &mut manager, &ledger, &clock, coin, DURATION_DAYS, VALIDATOR_ADDR, ctx
            );
            ts::return_shared(config);
            ts::return_shared(manager);
            ts::return_shared(ledger);
        };

        // 2. Advance time (part way through staking duration)
        let wait_ms = claim_wait_days * 86400000;
        clock::increment_for_testing(&mut clock, wait_ms);

        // 3. User claims accrued points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            // Get current epoch before claim for assertion later
            let epoch_before_claim = stake_position::last_claim_epoch(&stake);

            integration::claim_accrued_points<SUI>(
                &config, &mut ledger, &mut stake, &clock, ctx
            );

            // Verify last_claim_epoch was updated
            let current_epoch = clock::epoch(&clock);
            assert!(stake_position::last_claim_epoch(&stake) == current_epoch, 1);
            assert!(current_epoch > epoch_before_claim, 2);

            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
        };

        // 4. Verify points were claimed
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            // TODO: Calculate expected points based on STAKE_AMOUNT, rate, and elapsed epochs.
            // Requires getting points_rate from Config and calculating epochs from time.
            // For now, just check > 0.
            assert!(ledger::get_available_balance(&ledger, USER_ADDR) > 0, 3);
            ts::return_shared(ledger);
        };

        // 5. Advance time again and claim again (optional check)
        clock::increment_for_testing(&mut clock, wait_ms); // Advance another 10 days
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let initial_points = ledger::get_available_balance(&ledger, USER_ADDR);

            integration::claim_accrued_points<SUI>(
                &config, &mut ledger, &mut stake, &clock, ctx
            );

            let points_after_second_claim = ledger::get_available_balance(&ledger, USER_ADDR);
            assert!(points_after_second_claim > initial_points, 4);

            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ... (keep existing tests like test_claim_accrued_points if present)
 
    // ... other tests ...
}