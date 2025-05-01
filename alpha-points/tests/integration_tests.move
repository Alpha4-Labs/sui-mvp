#[test_only]
module alpha_points::integration_tests {
    use sui::test_scenario::{Self as ts};
    use sui::test_utils::assert_eq;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    
    use alpha_points::integration;
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
    
    // Helper function to set up a test scenario with initialized modules
    fun setup_test(): (ts::Scenario, Clock) {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Initialize ledger module
        {
            let ctx = ts::ctx(&mut scenario);
            ledger::init_for_testing(ctx);
        };
        
        // Create a test clock
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        
        // Create escrow vault for SUI
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let oracle_cap = ts::take_from_sender<OracleCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            
            // Create oracle for SUI/AlphaPoints rate
            oracle::create_oracle(
                &oracle_cap,
                1000000000, // 1.0 with 9 decimals
                9,
                10, // 10 epochs staleness threshold
                ctx
            );
            
            // Grant partner capability
            let partner_name = string::utf8(b"Test Partner");
            partner::grant_partner_cap(&govern_cap, PARTNER_ADDR, partner_name, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Mint some SUI to USER_ADDR
        {
            let ctx = ts::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(STAKE_AMOUNT * 2, ctx);
            transfer::public_transfer(coin, USER_ADDR);
        };
        
        (scenario, clock)
    }
    
    #[test]
    fun test_route_stake() {
        let (scenario, clock) = setup_test();
        
        // Route a stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Split the coin
            let stake_coin = coin::split(&mut coin, STAKE_AMOUNT, ctx);
            
            // Route stake
            integration::route_stake<SUI>(
                &config,
                &mut escrow_vault,
                &clock,
                stake_coin,
                DURATION_EPOCHS,
                ctx
            );
            
            // Return remaining coin
            ts::return_to_sender(&scenario, coin);
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        // Verify stake was created and escrow has the funds
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // Check escrow vault balance
            assert_eq(escrow::total_value(&escrow_vault), STAKE_AMOUNT);
            
            // Check stake details
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
        let (scenario, clock) = setup_test();
        
        // First route a stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Split the coin
            let stake_coin = coin::split(&mut coin, STAKE_AMOUNT, ctx);
            
            // Route stake
            integration::route_stake<SUI>(
                &config,
                &mut escrow_vault,
                &clock,
                stake_coin,
                DURATION_EPOCHS,
                ctx
            );
            
            // Return remaining coin
            ts::return_to_sender(&scenario, coin);
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        // Advance clock past unlock epoch
        clock::increment_for_testing(&mut clock, DURATION_EPOCHS + 1);
        
        // Redeem the stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::redeem_stake<SUI>(
                &config,
                &ledger,
                &mut escrow_vault,
                stake,
                &clock,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
        };
        
        // Verify user received their coins back and escrow is empty
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            
            // Escrow should be empty
            assert_eq(escrow::total_value(&escrow_vault), 0);
            
            // User should have their stake amount back
            assert_eq(coin::value(&coin), STAKE_AMOUNT * 2);
            
            ts::return_shared(escrow_vault);
            ts::return_to_sender(&scenario, coin);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure]
    fun test_redeem_stake_immature() {
        let (scenario, clock) = setup_test();
        
        // First route a stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let stake_coin = coin::split(&mut coin, STAKE_AMOUNT, ctx);
            
            integration::route_stake<SUI>(
                &config,
                &mut escrow_vault,
                &clock,
                stake_coin,
                DURATION_EPOCHS,
                ctx
            );
            
            ts::return_to_sender(&scenario, coin);
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        // Try to redeem before maturity - should fail
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::redeem_stake<SUI>(
                &config,
                &ledger,
                &mut escrow_vault,
                stake,
                &clock,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_earn_points() {
        let (scenario, clock) = setup_test();
        
        // Partner earns points for USER_ADDR
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::earn_points(
                &config,
                &mut ledger,
                &partner_cap,
                USER_ADDR,
                POINTS_AMOUNT,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // Verify user's points balance
        ts::next_tx(&mut scenario, USER_ADDR);
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
        let (scenario, clock) = setup_test();
        
        // First give user some points
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::earn_points(
                &config,
                &mut ledger,
                &partner_cap,
                USER_ADDR,
                POINTS_AMOUNT,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // User spends some points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let spend_amount = POINTS_AMOUNT / 2;
            integration::spend_points(
                &config,
                &mut ledger,
                spend_amount,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Verify balance changed
        ts::next_tx(&mut scenario, USER_ADDR);
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
        let (scenario, clock) = setup_test();
        
        // First give user some points
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::earn_points(
                &config,
                &mut ledger,
                &partner_cap,
                USER_ADDR,
                POINTS_AMOUNT,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // User locks some points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let lock_amount = POINTS_AMOUNT / 2;
            integration::lock_points(
                &config,
                &mut ledger,
                lock_amount,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Verify points are locked
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
        };
        
        // User unlocks some points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let unlock_amount = POINTS_AMOUNT / 4;
            integration::unlock_points(
                &config,
                &mut ledger,
                unlock_amount,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Verify points are unlocked
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT * 3 / 4);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 4);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_redeem_points() {
        let (scenario, clock) = setup_test();
        
        // First give user some points
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::earn_points(
                &config,
                &mut ledger,
                &partner_cap,
                USER_ADDR,
                POINTS_AMOUNT,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        // Put some coins in escrow
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let coin = coin::mint_for_testing<SUI>(STAKE_AMOUNT * 2, ctx);
            escrow::test_deposit(&mut escrow_vault, &govern_cap, coin, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(escrow_vault);
        };
        
        // User redeems points for SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let redeem_amount = POINTS_AMOUNT / 2;
            integration::redeem_points<SUI>(
                &config,
                &mut ledger,
                &mut escrow_vault,
                &oracle,
                redeem_amount,
                &clock,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_shared(escrow_vault);
            ts::return_shared(oracle);
        };
        
        // Verify points were spent and user received SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            
            // Points balance reduced
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            
            // User received SUI (exact amount depends on oracle rate)
            assert!(coin::value(&coin) > 0, 0);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, coin);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}