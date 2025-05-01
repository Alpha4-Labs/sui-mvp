#[test_only]
module alpha_points::loan_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::tx_context::{TxContext};

    use alpha_points::loan::{Self, Loan, LoanConfig, EExceedsLTV, EInsufficientPoints};
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
        
        // Setup vault, oracle, loan_config
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
            
            // Create loan config
            {
                let ctx = ts::ctx(&mut scenario);
                loan::init_loan_config(&govern_cap, MAX_LTV_BPS, INTEREST_RATE_BPS, ctx);
            };
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_to_sender(&scenario, oracle_cap);
        };
        
        // Give SUI to user for staking
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(STAKE_AMOUNT, ctx);
            transfer::public_transfer(coin, USER_ADDR);
        };
        
        // User stakes the SUI to get a stake position
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut escrow_vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            integration::route_stake<SUI>(&config, &mut escrow_vault, &clock, coin, DURATION_EPOCHS, ctx);
            
            ts::return_shared(config);
            ts::return_shared(escrow_vault);
        };
        
        (scenario, clock)
    }

    #[test]
    fun test_calculate_interest() {
        let (mut scenario, clock) = setup_test();
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            
            // Test interest calculation
            let principal = 1000;
            let elapsed_epochs = 10;
            let interest = loan::calculate_interest(&loan_config, principal, elapsed_epochs);
            
            // Interest = principal * rate * time / (10000 * 365)
            // Interest = 1000 * 500 * 10 / (10000 * 365) ≈ 1.37...
            // Since Move uses integer math, this should be 1
            let expected = (principal * INTEREST_RATE_BPS * elapsed_epochs) / (10000 * 365);
            assert_eq(interest, expected);
            assert_eq(interest, 1);
            
            ts::return_shared(loan_config);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_open_loan() {
        let (mut scenario, clock) = setup_test();
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            // Calculate max borrowable amount based on LTV
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable / 2;
            
            // Open loan
            loan::open_loan<SUI>(
                &config, &loan_config, &mut ledger, &mut stake, &oracle, borrow_amount, &clock, ctx
            );
            
            // Verify stake is encumbered
            assert_eq(stake_position::is_encumbered(&stake), true);
            
            // Verify user received points
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), borrow_amount);
            
            ts::return_shared(config);
            ts::return_shared(loan_config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
            ts::return_shared(oracle);
        };
        
        // Verify loan details
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let loan = ts::take_from_sender<Loan<SUI>>(&scenario);
            
            // Check borrower
            assert_eq(loan::get_borrower(&loan), USER_ADDR);
            
            // Check principal and interest
            let (principal, interest, _opened_epoch) = loan::get_loan_details(&loan);
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            assert_eq(principal, max_borrowable / 2);
            assert_eq(interest, 0); // No interest accrued yet
            
            ts::return_to_sender(&scenario, loan);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EExceedsLTV)]
    fun test_open_loan_exceed_ltv() {
        let (mut scenario, clock) = setup_test();
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            // Calculate max borrowable + 1 (exceeds LTV)
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable + 1;
            
            // Try to open a loan that exceeds LTV (should fail with EExceedsLTV)
            loan::open_loan<SUI>(
                &config, &loan_config, &mut ledger, &mut stake, &oracle, borrow_amount, &clock, ctx
            );
            
            // These won't execute if the test aborts as expected
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
        let (mut scenario, mut clock) = setup_test();
        
        // Open a loan
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Calculate loan amount
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable / 2;
            
            // Open the loan
            loan::open_loan<SUI>(
                &config, &loan_config, &mut ledger, &mut stake, &oracle, borrow_amount, &clock, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(loan_config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
            ts::return_shared(oracle);
        };
        
        // Advance time to accumulate interest
        clock::increment_for_testing(&mut clock, 10 * 86400000); // 10 days
        
        // Repay the loan
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let loan_obj = ts::take_from_sender<Loan<SUI>>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            // Get repayment amount before repaying
            let (repayment_amount, _accrued_interest) = loan::get_current_repayment_amount(&loan_obj, &clock);

            // Repay the loan
            loan::repay_loan<SUI>(
                &config, &mut ledger, loan_obj, &mut stake, &clock, ctx
            );
            
            // Verify stake is no longer encumbered
            assert_eq(stake_position::is_encumbered(&stake), false);
            
            // Verify points were deducted
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
    #[expected_failure(abort_code = EInsufficientPoints)]
    fun test_repay_loan_insufficient_points() {
        let (mut scenario, mut clock) = setup_test();
        
        // Open a loan
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let loan_config = ts::take_shared<LoanConfig>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let oracle = ts::take_shared<RateOracle>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Calculate loan amount
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let borrow_amount = max_borrowable / 2;
            
            // Open the loan
            loan::open_loan<SUI>(
                &config, &loan_config, &mut ledger, &mut stake, &oracle, borrow_amount, &clock, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(loan_config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
            ts::return_shared(oracle);
        };
        
        // Advance time to accumulate some interest
        clock::increment_for_testing(&mut clock, 10 * 86400000); // 10 days
        
        // Spend all the points the user has
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Calculate and spend all available balance
            let max_borrowable = (STAKE_AMOUNT * MAX_LTV_BPS) / 10000;
            let available_balance = max_borrowable / 2;
            integration::spend_points(&config, &mut ledger, available_balance, ctx);
            
            ts::return_shared(config);
            ts::return_shared(ledger);
        };
        
        // Try to repay loan (should fail due to insufficient points)
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let loan_obj = ts::take_from_sender<Loan<SUI>>(&scenario);
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            let ctx = ts::ctx(&mut scenario);

            // This should fail with EInsufficientPoints
            loan::repay_loan<SUI>(
                &config, &mut ledger, loan_obj, &mut stake, &clock, ctx
            );
            
            // These won't execute if the test aborts as expected
            ts::return_shared(config);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}