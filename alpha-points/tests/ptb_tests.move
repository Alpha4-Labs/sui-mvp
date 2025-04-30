// ptb_tests.move - Integration tests for the Alpha Points protocol using test_scenario
#[test_only]
module alpha_points::alpha_points_ptb_tests { // Keep unique module name

    // === Imports ===
    use sui::test_scenario::{
        Scenario, begin, next_tx, ctx, end as end_scenario,
        take_shared, return_shared, take_from_sender, return_to_sender
    };
    
    use sui::clock::{Clock, create_for_testing, destroy_for_testing, increment_for_testing};
    use sui::coin::{Coin, mint_for_testing, burn_for_testing, value as coin_value, split as coin_split};
    use sui::transfer::public_transfer;
    
    use std::string::utf8;

    // Import modules directly - avoids many unused alias warnings
    use alpha_points::admin;
    use alpha_points::partner;
    use alpha_points::ledger;
    use alpha_points::escrow;
    use alpha_points::oracle;
    use alpha_points::stake_position as sp; // Keep alias for brevity
    use alpha_points::integration;
    use alpha_points::loan;

    // Import specific types needed
    use alpha_points::admin::{Config, GovernCap, OracleCap};
    use alpha_points::partner::PartnerCap;
    use alpha_points::ledger::Ledger;
    use alpha_points::escrow::EscrowVault;
    use alpha_points::oracle::RateOracle;
    use alpha_points::stake_position::StakePosition;
    use alpha_points::loan::{Loan, LoanConfig};

    // === Test Constants ===
    const ADMIN_ADDR: address = @0xA1;
    const USER1_ADDR: address = @0xB1;
    const PARTNER1_ADDR: address = @0xC1;
    // Added constant for the pause error code
    const CONFIG_PAUSED_ERROR: u64 = 2;

    // Test Asset Type - Needs public for test module scope
    public struct USDC has store, drop {}

    const ONE_COIN: u64 = 1_000_000;
    const DEFAULT_RATE: u128 = 1_000_000_000_000_000_000;
    const DEFAULT_STALENESS: u64 = 100;
    const DEFAULT_MAX_LTV: u64 = 7000;
    const DEFAULT_MIN_RATE: u64 = 500;
    const DEFAULT_MAX_RATE: u64 = 2000;

    // === Helper Functions ===

    /// Initializes all modules via their init functions
    fun initialize_all_modules(scenario: &mut Scenario) {
        // Initialize modules directly by calling their init functions which are now public
        next_tx(scenario, ADMIN_ADDR);
        {
            // Initialize the admin module
            admin::init_for_testing(ctx(scenario));
        };
        
        next_tx(scenario, ADMIN_ADDR);
        {
            // Initialize the ledger module
            ledger::init_for_testing(ctx(scenario));
        };
        
        // Take caps created during init
        let gov_cap = take_from_sender<GovernCap>(scenario);
        let oracle_cap = take_from_sender<OracleCap>(scenario);

        // Call public entry setup functions using the caps
        let partner_name = utf8(b"TestPartner");
        partner::grant_partner_cap(&gov_cap, PARTNER1_ADDR, partner_name, ctx(scenario));
        escrow::create_escrow_vault<USDC>(&gov_cap, ctx(scenario));
        oracle::create_oracle(&oracle_cap, DEFAULT_RATE, 6, DEFAULT_STALENESS, ctx(scenario)); // 6 decimals for USDC
        loan::init_loan_config(&gov_cap, DEFAULT_MAX_LTV, DEFAULT_MIN_RATE, DEFAULT_MAX_RATE, ctx(scenario));

        // Return caps to ADMIN for the setup function to retrieve
        return_to_sender(scenario, gov_cap);
        return_to_sender(scenario, oracle_cap);
    }

    /// Full setup: Begins scenario, initializes modules, takes shared objects/caps.
    fun full_setup(scenario: &mut Scenario): (Config, Ledger, LoanConfig, EscrowVault<USDC>, RateOracle, GovernCap, OracleCap, PartnerCap, Clock) {
        next_tx(scenario, ADMIN_ADDR); // Need a tx to create clock
        let clock = create_for_testing(ctx(scenario));
        initialize_all_modules(scenario);

        // Take all shared objects created during init
        let admin_config = take_shared<Config>(scenario);
        let ledger_obj = take_shared<Ledger>(scenario);
        let loan_config_obj = take_shared<LoanConfig>(scenario);
        let escrow_vault_obj = take_shared<EscrowVault<USDC>>(scenario);
        let rate_oracle_obj = take_shared<RateOracle>(scenario);

        // Take caps back from ADMIN
        let gov_cap = take_from_sender<GovernCap>(scenario);
        let oracle_cap = take_from_sender<OracleCap>(scenario);

        // Get PartnerCap from PARTNER1
        next_tx(scenario, PARTNER1_ADDR);
        let partner_cap = take_from_sender<PartnerCap>(scenario);

        (admin_config, ledger_obj, loan_config_obj, escrow_vault_obj, rate_oracle_obj,
          gov_cap, oracle_cap, partner_cap, clock)
    }

    fun mint_usdc(scenario: &mut Scenario, amount: u64, recipient: address) {
        next_tx(scenario, ADMIN_ADDR);
        let coin = mint_for_testing<USDC>(amount * ONE_COIN, ctx(scenario));
        public_transfer(coin, recipient);
    }

    // === Test Cases ===

    #[test]
    fun test_stake_redeem_flow() {
        let scenario = begin(ADMIN_ADDR);
        let (admin_config, mut ledger_obj, loan_config_obj, mut escrow_vault_obj, rate_oracle_obj,
              gov_cap, oracle_cap, partner_cap, mut clock) = full_setup(&mut scenario);
        mint_usdc(&mut scenario, 1000, USER1_ADDR);

        next_tx(&mut scenario, USER1_ADDR);
        let stake_amount = 500; let stake_duration = 50;
        let mut coin_to_stake = take_from_sender<Coin<USDC>>(&scenario);
        let remaining_coin = coin_split(&mut coin_to_stake, stake_amount * ONE_COIN, ctx(&mut scenario));
        return_to_sender(&mut scenario, remaining_coin);
        integration::route_stake<USDC>(&admin_config, &mut ledger_obj, &mut escrow_vault_obj, coin_to_stake, stake_duration, &clock, ctx(&mut scenario));

        assert!(escrow::total_value(&escrow_vault_obj) == stake_amount * ONE_COIN, 1);
        assert!(ledger::get_total_supply(&ledger_obj) > 0, 2);
        let _stake_check = take_from_sender<StakePosition<USDC>>(&scenario);
        return_to_sender(&mut scenario, _stake_check); // Verify ownership

        increment_for_testing(&mut clock, stake_duration + 1);

        next_tx(&mut scenario, USER1_ADDR);
        let stake_object = take_from_sender<StakePosition<USDC>>(&scenario);
        integration::redeem_stake<USDC>(&admin_config, &mut escrow_vault_obj, stake_object, &clock, ctx(&mut scenario));

        assert!(escrow::total_value(&escrow_vault_obj) == 0, 5);
        let redeemed_coin = take_from_sender<Coin<USDC>>(&scenario);
        assert!(coin_value(&redeemed_coin) == stake_amount * ONE_COIN, 7);
        burn_for_testing(redeemed_coin);

        // Cleanup
        return_shared(admin_config); return_shared(ledger_obj); return_shared(loan_config_obj);
        return_shared(escrow_vault_obj); return_shared(rate_oracle_obj);
        next_tx(&mut scenario, PARTNER1_ADDR); return_to_sender(&mut scenario, partner_cap);
        next_tx(&mut scenario, ADMIN_ADDR); return_to_sender(&mut scenario, gov_cap); return_to_sender(&mut scenario, oracle_cap);
        destroy_for_testing(clock); end_scenario(scenario);
    }

    #[test]
    fun test_points_operations() {
        let scenario = begin(ADMIN_ADDR);
        let (admin_config, mut ledger_obj, loan_config_obj, escrow_vault_obj, rate_oracle_obj,
              gov_cap, oracle_cap, partner_cap, clock) = full_setup(&mut scenario);
        let initial_points = 1000;

        next_tx(&mut scenario, PARTNER1_ADDR);
        integration::earn_points(&admin_config, &mut ledger_obj, &partner_cap, USER1_ADDR, initial_points, ctx(&mut scenario));
        assert!(ledger::get_available_balance(&ledger_obj, USER1_ADDR) == initial_points, 0);

        next_tx(&mut scenario, USER1_ADDR);
        let spend_amount = 300;
        integration::spend_points(&admin_config, &mut ledger_obj, spend_amount, ctx(&mut scenario));
        assert!(ledger::get_available_balance(&ledger_obj, USER1_ADDR) == initial_points - spend_amount, 2);

        next_tx(&mut scenario, USER1_ADDR);
        let lock_amount = 200;
        integration::lock_points(&admin_config, &mut ledger_obj, lock_amount, ctx(&mut scenario));
        assert!(ledger::get_locked_balance(&ledger_obj, USER1_ADDR) == lock_amount, 5);

        next_tx(&mut scenario, USER1_ADDR);
        let unlock_amount = 100;
        integration::unlock_points(&admin_config, &mut ledger_obj, unlock_amount, ctx(&mut scenario));
        assert!(ledger::get_locked_balance(&ledger_obj, USER1_ADDR) == lock_amount - unlock_amount, 8);

        // Cleanup
        return_shared(admin_config); return_shared(ledger_obj); return_shared(loan_config_obj);
        return_shared(escrow_vault_obj); return_shared(rate_oracle_obj);
        return_to_sender(&mut scenario, partner_cap);
        next_tx(&mut scenario, ADMIN_ADDR); return_to_sender(&mut scenario, gov_cap); return_to_sender(&mut scenario, oracle_cap);
        destroy_for_testing(clock); end_scenario(scenario);
    }

    #[test]
    fun test_redeem_points_flow() {
        let scenario = begin(ADMIN_ADDR);
        let (admin_config, mut ledger_obj, loan_config_obj, mut escrow_vault_obj, mut rate_oracle_obj,
              gov_cap, oracle_cap, partner_cap, mut clock) = full_setup(&mut scenario);
        
        // Fund the escrow vault
        mint_usdc(&mut scenario, 1000, ADMIN_ADDR);
        next_tx(&mut scenario, ADMIN_ADDR);
        let usdc_to_deposit = take_from_sender<Coin<USDC>>(&scenario);
        escrow::deposit(&mut escrow_vault_obj, usdc_to_deposit, ctx(&mut scenario));
        
        // Give user some points
        next_tx(&mut scenario, PARTNER1_ADDR);
        integration::earn_points(&admin_config, &mut ledger_obj, &partner_cap, USER1_ADDR, 500, ctx(&mut scenario));
        
        // Update rate (1 point = 2 USDC)
        next_tx(&mut scenario, ADMIN_ADDR);
        oracle::update_rate(&mut rate_oracle_obj, &oracle_cap, 2_000_000_000_000_000_000, ctx(&mut scenario));
        
        // User redeems points for USDC
        next_tx(&mut scenario, USER1_ADDR);
        let points_to_redeem = 100;
        integration::redeem_points<USDC>(
            &admin_config, &mut ledger_obj, &mut escrow_vault_obj, 
            &rate_oracle_obj, points_to_redeem, &clock, ctx(&mut scenario)
        );
        
        // Check results
        assert!(ledger::get_available_balance(&ledger_obj, USER1_ADDR) == 400, 0); // 500 - 100
        let received_usdc = take_from_sender<Coin<USDC>>(&scenario);
        assert!(coin_value(&received_usdc) == 200 * ONE_COIN, 1); // 100 points * 2 = 200 USDC
        
        burn_for_testing(received_usdc);
        
        // Cleanup
        return_shared(admin_config); return_shared(ledger_obj); return_shared(loan_config_obj);
        return_shared(escrow_vault_obj); return_shared(rate_oracle_obj);
        return_to_sender(&mut scenario, partner_cap);
        next_tx(&mut scenario, ADMIN_ADDR); return_to_sender(&mut scenario, gov_cap); return_to_sender(&mut scenario, oracle_cap);
        destroy_for_testing(clock); end_scenario(scenario);
    }

    #[test]
    fun test_loan_open_repay_flow() {
        let scenario = begin(ADMIN_ADDR);
        let (admin_config, mut ledger_obj, loan_config_obj, mut escrow_vault_obj, mut rate_oracle_obj,
              gov_cap, oracle_cap, partner_cap, mut clock) = full_setup(&mut scenario);
        
        // Create a stake position for loan collateral
        mint_usdc(&mut scenario, 1000, USER1_ADDR);
        next_tx(&mut scenario, USER1_ADDR);
        let coin_to_stake = take_from_sender<Coin<USDC>>(&scenario);
        integration::route_stake<USDC>(
            &admin_config, &mut ledger_obj, &mut escrow_vault_obj, 
            coin_to_stake, 100, &clock, ctx(&mut scenario)
        );
        
        // Take stake position for loan
        let mut stake = take_from_sender<StakePosition<USDC>>(&scenario);
        
        // Open a loan against stake
        next_tx(&mut scenario, USER1_ADDR);
        let loan_amount = 400; // Within 70% LTV of 1000
        
        // Open loan
        loan::open_loan<USDC>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake,
            loan_amount, 1000, // 10% interest rate
            &clock, ctx(&mut scenario)
        );
        
        // Verify loan created
        let loan = take_from_sender<Loan<USDC>>(&scenario);
        let (borrower, _stake_id, principal, rate, _) = loan::get_loan_details(&loan);
        assert!(borrower == USER1_ADDR, 0);
        assert!(principal == loan_amount, 1);
        assert!(rate == 1000, 2); // 10%
        
        // Return stake position (needed for repayment)
        return_to_sender(&mut scenario, stake);
        
        // Advance time
        increment_for_testing(&mut clock, 50);
        
        // Repay loan
        next_tx(&mut scenario, USER1_ADDR);
        let stake_to_use = take_from_sender<StakePosition<USDC>>(&scenario);
        loan::repay_loan<USDC>(
            &admin_config, &mut ledger_obj, loan, &mut stake_to_use,
            &clock, ctx(&mut scenario)
        );
        
        // Verify loan repaid (stake unencumbered)
        assert!(!sp::is_encumbered(&stake_to_use), 3);
        
        // Cleanup
        return_to_sender(&mut scenario, stake_to_use);
        return_shared(admin_config); return_shared(ledger_obj); return_shared(loan_config_obj);
        return_shared(escrow_vault_obj); return_shared(rate_oracle_obj);
        return_to_sender(&mut scenario, partner_cap);
        next_tx(&mut scenario, ADMIN_ADDR); return_to_sender(&mut scenario, gov_cap); return_to_sender(&mut scenario, oracle_cap);
        destroy_for_testing(clock); end_scenario(scenario);
    }

    #[test]
    #[expected_failure(abort_code = CONFIG_PAUSED_ERROR)] // Fixed: Use direct constant instead of function call
    fun test_pause_mechanism() {
        let scenario = begin(ADMIN_ADDR);
        let (mut admin_config, mut ledger_obj, loan_config_obj, escrow_vault_obj, rate_oracle_obj,
              gov_cap, oracle_cap, partner_cap, clock) = full_setup(&mut scenario);
        
        // Pause the protocol
        next_tx(&mut scenario, ADMIN_ADDR);
        admin::set_pause_state(&mut admin_config, &gov_cap, true, ctx(&mut scenario));
        
        // Try to earn points (should fail)
        next_tx(&mut scenario, PARTNER1_ADDR);
        integration::earn_points(
            &admin_config, &mut ledger_obj, &partner_cap, 
            USER1_ADDR, 100, ctx(&mut scenario)
        );
        
        // Cleanup (won't reach due to expected failure)
        return_shared(admin_config); return_shared(ledger_obj); return_shared(loan_config_obj);
        return_shared(escrow_vault_obj); return_shared(rate_oracle_obj);
        return_to_sender(&mut scenario, partner_cap);
        next_tx(&mut scenario, ADMIN_ADDR); return_to_sender(&mut scenario, gov_cap); return_to_sender(&mut scenario, oracle_cap);
        destroy_for_testing(clock); end_scenario(scenario);
    }
}