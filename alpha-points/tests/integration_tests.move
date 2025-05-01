#[test_only]
module alpha_points::integration_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use sui::tx_context::{TxContext};

    use alpha_points::integration::{Self, EStakeNotMature};
    use alpha_points::admin::{Self, Config, GovernCap, OracleCap};
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::escrow::{Self, EscrowVault};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::partner::{Self, PartnerCap};

    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const PARTNER_ADDR: address = @0xB;
    const STAKE_AMOUNT: u64 = 1000;
    const DURATION_EPOCHS: u64 = 30;
    const POINTS_AMOUNT: u64 = 2000;

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
        
        // Create clock
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        
        // Setup vault, oracle, partner cap
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            
            // Create escrow vault
            {
                let ctx = ts::ctx(&mut scenario);
                escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            };
            
            // Create oracle
            {
                let ctx = ts::ctx(&mut scenario);
                oracle::create_oracle(&oracle_cap, 1000000000, 9, 10, ctx);
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
            let coin = coin::mint_for_testing<SUI>(STAKE_AMOUNT * 2, ctx);
            transfer::public_transfer(coin, USER_ADDR);
        };
        
        (scenario, clock)
    }

    #[test]
    fun test_route_stake() {
        let (mut scenario, clock) = setup_test();
        
        // User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let mut coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Split for staking
            let stake_coin = coin::split(&mut coin, STAKE_AMOUNT, ctx);
            
            // Route stake
            integration::route_stake<SUI>(
                &config, &mut escrow_vault, &clock, stake_coin, DURATION_EPOCHS, ctx
            );
            
            ts::return_to_sender(&scenario, coin);
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        // Verify stake position and escrow
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // Verify escrow balance
            assert_eq(escrow::total_value<SUI>(&escrow_vault), STAKE_AMOUNT);
            
            // Verify stake details
            assert_eq(stake_position::owner(&stake), USER_ADDR);
            assert_eq(stake_position::principal(&stake), STAKE_AMOUNT);
            assert_eq(stake_position::duration_epochs(&stake), DURATION_EPOCHS);
            
            ts::return_shared(escrow_vault);
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_redeem_stake() {
        let (mut scenario, mut clock) = setup_test();
        
        // User stakes
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let mut coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Split for staking
            let stake_coin = coin::split(&mut coin, STAKE_AMOUNT, ctx);
            
            // Route stake
            integration::route_stake<SUI>(
                &config, &mut escrow_vault, &clock, stake_coin, DURATION_EPOCHS, ctx
            );
            
            ts::return_to_sender(&scenario, coin);
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        // Advance time to maturity
        clock::increment_for_testing(&mut clock, DURATION_EPOCHS * 86400000 * 2);
        
        // User redeems stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Redeem stake
            integration::redeem_stake<SUI>(
                &config, &ledger, &mut escrow_vault, stake, &clock, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
        };
        
        // Verify redemption
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            
            // Escrow should be empty
            assert_eq(escrow::total_value<SUI>(&escrow_vault), 0);
            
            // User should have their coin back
            assert_eq(coin::value(&coin), STAKE_AMOUNT * 2);
            
            ts::return_shared(escrow_vault);
            ts::return_to_sender(&scenario, coin);
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
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let mut coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Split for staking
            let stake_coin = coin::split(&mut coin, STAKE_AMOUNT, ctx);
            
            // Route stake
            integration::route_stake<SUI>(
                &config, &mut escrow_vault, &clock, stake_coin, DURATION_EPOCHS, ctx
            );
            
            ts::return_to_sender(&scenario, coin);
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        // Try to redeem before maturity (should fail)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // This should fail with EStakeNotMature
            integration::redeem_stake<SUI>(
                &config, &ledger, &mut escrow_vault, stake, &clock, ctx
            );
            
            // These won't execute if test properly aborts
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
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
            
            // Earn points
            integration::earn_points(
                &config, &mut ledger, &partner_cap, USER_ADDR, POINTS_AMOUNT, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // Verify points earned
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_spend_points() {
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
        
        // User spends points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let spend_amount = POINTS_AMOUNT / 2;
            integration::spend_points(
                &config, &mut ledger, spend_amount, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Verify points spent
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT / 2);
            
            ts::return_shared(ledger);
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
    fun test_redeem_points() {
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
        
        // Put coins in escrow for redemption
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let coin = coin::mint_for_testing<SUI>(STAKE_AMOUNT * 2, ctx);
            escrow::test_deposit<SUI>(&mut escrow_vault, &govern_cap, coin, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(escrow_vault);
        };
        
        // Redeem points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let redeem_amount = POINTS_AMOUNT / 2;
            integration::redeem_points<SUI>(
                &config, &mut ledger, &mut escrow_vault, &oracle, redeem_amount, &clock, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
            ts::return_shared(oracle);
        };
        
        // Verify redemption
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            
            // Check user has new SUI coin
            let user_coin = ts::take_from_address<Coin<SUI>>(&scenario, USER_ADDR);
            
            // Verify point balance reduced
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            
            // Verify escrow vault balance reduced
            let expected_asset_amount = POINTS_AMOUNT / 2; // Rate is 1.0
            assert_eq(escrow::total_value<SUI>(&escrow_vault), (STAKE_AMOUNT * 2) - expected_asset_amount);
            
            // Verify user received correct amount
            assert_eq(coin::value(&user_coin), expected_asset_amount);
            
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
            ts::return_to_address(USER_ADDR, user_coin);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}