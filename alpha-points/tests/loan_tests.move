#[test_only]
module alpha_points::loan_tests {
    use sui::test_scenario as ts;
    use sui::test_utils::assert_eq;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::clock::{Self, Clock};
    
    use alpha_points::loan::{Self, Loan, LoanConfig};
    use alpha_points::admin::{Self, Config, GovernCap, OracleCap};
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::escrow::{Self, EscrowVault};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::integration;
    
    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const STAKE_AMOUNT: u64 = 1000;
    const DURATION_EPOCHS: u64 = 30;
    const MAX_LTV_BPS: u64 = 7000; // 70%
    const INTEREST_RATE_BPS: u64 = 500; // 5%
    
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
                1000000000, // 1.0 with 9 decimals (1 SUI = 1 AlphaPoint)
                9,
                10, // 10 epochs staleness threshold
                ctx
            );
            
            // Initialize loan config
            loan::init_loan_config(
                &govern_cap,
                MAX_LTV_BPS,
                INTEREST_RATE_BPS,
                ctx
            );
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Mint some SUI to USER_ADDR
        {
            let ctx = ts::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(STAKE_AMOUNT, ctx);
            transfer::public_transfer(coin, USER_ADDR);
        };
        
        // User stakes SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::route_stake<SUI>(
                &config,
                &mut escrow_vault,
                &clock,
                coin,
                DURATION_EPOCHS,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        (scenario, clock)
    }
    
    #[test]
    fun test_open_loan() {
        let (scenario, clock) = setup_test();
        
        // Open loan against staked SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Calculate maximum borrowable points (70% of 1000 = 700)
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable / 2; // Borrow half of max
            
            loan::open_loan<SUI>(
                &config,
                &loan_config,
                &mut ledger,
                &mut stake,
                &oracle,
                borrow_amount,
                &clock,
                ctx
            );
            
            // Verify stake is now encumbered
            assert_eq(stake_position::is_encumbered(&stake), true);
            
            // Check points were credited
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), borrow_amount);
            
            ts::return_shared(config);
            ts::return_shared(loan_config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
            ts::return_shared(oracle);
        };
        
        // Verify loan was created
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let loan = ts::take_from_sender<Loan<SUI>>(&scenario);
            
            // Check loan details
            assert_eq(loan::get_borrower(&loan), USER_ADDR);
            let (principal, interest, _opened_epoch) = loan::get_loan_details(&loan);
            assert_eq(principal, (STAKE_AMOUNT * MAX_LTV_BPS) / 10000 / 2);
            assert_eq(interest, 0); // No interest accrued yet
            
            ts::return_to_sender(&scenario, loan);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure]
    fun test_open_loan_exceed_ltv() {
        let (scenario, clock) = setup_test();
        
        // Try to open loan exceeding LTV
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Calculate maximum borrowable points (70% of 1000 = 700)
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable + 1; // Exceed max
            
            // This should fail
            loan::open_loan<SUI>(
                &config,
                &loan_config,
                &mut ledger,
                &mut stake,
                &oracle,
                borrow_amount,
                &clock,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(loan_config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
            ts::return_shared(oracle);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_repay_loan() {
        let (scenario, clock) = setup_test();
        
        // Open loan against staked SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Calculate maximum borrowable points (70% of 1000 = 700)
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable / 2; // Borrow half of max
            
            loan::open_loan<SUI>(
                &config,
                &loan_config,
                &mut ledger,
                &mut stake,
                &oracle,
                borrow_amount,
                &clock,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(loan_config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
            ts::return_shared(oracle);
        };
        
        // Advance clock to accrue some interest
        clock::increment_for_testing(&mut clock, 10);
        
        // Repay loan
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let loan = ts::take_from_sender<Loan<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Get repayment amount - not used in the test but checking that it works
            let (_repayment_amount, _) = loan::get_current_repayment_amount(&loan, &clock);
            
            loan::repay_loan<SUI>(
                &config,
                &mut ledger,
                loan,
                &mut stake,
                &clock,
                ctx
            );
            
            // Verify stake is no longer encumbered
            assert_eq(stake_position::is_encumbered(&stake), false);
            
            // Check points were deducted
            // Initial borrow was max_borrowable/2, now it's less due to repayment
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let initial_borrow = max_borrowable / 2;
            assert!(ledger::get_available_balance(&ledger, USER_ADDR) < initial_borrow, 0);
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure]
    fun test_repay_loan_insufficient_points() {
        let (scenario, clock) = setup_test();
        
        // Open loan against staked SUI
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Calculate maximum borrowable points (70% of 1000 = 700)
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable / 2; // Borrow half of max
            
            loan::open_loan<SUI>(
                &config,
                &loan_config,
                &mut ledger,
                &mut stake,
                &oracle,
                borrow_amount,
                &clock,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(loan_config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
            ts::return_shared(oracle);
        };
        
        // Advance clock to accrue some interest
        clock::increment_for_testing(&mut clock, 10);
        
        // Spend all points so repayment will fail
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let balance = max_borrowable / 2; // Same as borrowed amount
            
            integration::spend_points(
                &config,
                &mut ledger,
                balance,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Try to repay loan with insufficient points - should fail
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let loan = ts::take_from_sender<Loan<SUI>>(&scenario);
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            loan::repay_loan<SUI>(
                &config,
                &mut ledger,
                loan,
                &mut stake,
                &clock,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, loan);
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_calculate_interest() {
        let (scenario, clock) = setup_test();
        
        // Test interest calculation directly
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            
            let principal = 1000;
            let elapsed_epochs = 10;
            
            // Calculate interest (5% annualized, prorated)
            let interest = loan::calculate_interest(
                &loan_config,
                principal,
                elapsed_epochs
            );
            
            // Expected: 1000 * 5% * (10/365) ≈ 13.7, rounded to 14
            let expected = (principal * INTEREST_RATE_BPS * elapsed_epochs) / (10000 * 365);
            assert_eq(interest, expected);
            
            ts::return_shared(loan_config);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}