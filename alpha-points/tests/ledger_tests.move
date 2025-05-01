#[test_only]
module alpha_points::ledger_tests {
    use sui::test_scenario as ts;
    use sui::test_utils::assert_eq;
    use sui::transfer;
    
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::admin::{Self, GovernCap};
    
    const USER_ADDR: address = @0xA;
    const ADMIN_ADDR: address = @0xB;
    const POINTS_AMOUNT: u64 = 1000;
    
    // Helper function to set up a test scenario with initialized ledger
    fun setup_test(): ts::Scenario {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module first to get Config
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        // Initialize the ledger
        {
            let ctx = ts::ctx(&mut scenario);
            ledger::init_for_testing(ctx);
        };
        
        scenario
    }
    
    #[test]
    fun test_ledger_init() {
        let scenario = setup_test();
        
        // Check that the ledger was created and has expected initial state
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_total_supply(&ledger), 0);
            ts::return_shared(ledger);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_earn_points() {
        let scenario = setup_test();
        
        // Admin transfers govern cap to act as integration/authorized module
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        
        // Earn points for USER_ADDR
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Call internal_earn via test_earn helper (simulates integration module)
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            // Verify the balance was updated correctly
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), 0);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_spend_points() {
        let scenario = setup_test();
        
        // Setup: Admin transfers govern cap and user earns points first
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        // Now test spending points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Spend half of the points
            let spend_amount = POINTS_AMOUNT / 2;
            ledger::test_spend(&mut ledger, &gov_cap, USER_ADDR, spend_amount, ctx);
            
            // Verify the balance was updated correctly
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT - spend_amount);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT - spend_amount);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure(abort_code = ledger::EInsufficientBalance)]
    fun test_spend_points_insufficient_balance() {
        let scenario = setup_test();
        
        // Setup: Admin transfers govern cap and user earns points first
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            // Try to spend more than available - should abort
            ledger::test_spend(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT + 1, ctx);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_lock_points() {
        let scenario = setup_test();
        
        // Setup: Admin transfers govern cap and user earns points first
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        // Test locking points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Lock half of the points
            let lock_amount = POINTS_AMOUNT / 2;
            ledger::test_lock(&mut ledger, &gov_cap, USER_ADDR, lock_amount, ctx);
            
            // Verify balances are correct
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT - lock_amount);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), lock_amount);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_unlock_points() {
        let scenario = setup_test();
        
        // Setup: Admin transfers govern cap, user earns and locks points
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            // Lock all points
            ledger::test_lock(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        // Test unlocking points
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Unlock half of the points
            let unlock_amount = POINTS_AMOUNT / 2;
            ledger::test_unlock(&mut ledger, &gov_cap, USER_ADDR, unlock_amount, ctx);
            
            // Verify balances are correct
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), unlock_amount);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), POINTS_AMOUNT - unlock_amount);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure(abort_code = ledger::EInsufficientLockedBalance)]
    fun test_unlock_points_insufficient_locked() {
        let scenario = setup_test();
        
        // Setup: Admin transfers govern cap and user earns points
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            // Lock half the points
            let lock_amount = POINTS_AMOUNT / 2;
            ledger::test_lock(&mut ledger, &gov_cap, USER_ADDR, lock_amount, ctx);
            
            // Try to unlock more than locked - should abort
            ledger::test_unlock(&mut ledger, &gov_cap, USER_ADDR, lock_amount + 1, ctx);
            
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_calculate_points_to_earn() {
        let scenario = setup_test();
        
        // Dummy test for points calculation function
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let amount = 1000;
            let duration = 90; // days
            let participation_level = 2; // some value representing activity
            
            // Call the calculation function and check the result
            let points = ledger::calculate_points_to_earn(amount, duration, participation_level);
            
            // Points should increase with amount, duration, and participation
            assert!(points > 0, 0);
            
            // Test with zero values
            assert_eq(ledger::calculate_points_to_earn(0, duration, participation_level), 0);
            assert_eq(ledger::calculate_points_to_earn(amount, 0, participation_level), 0);
        };
        
        ts::end(scenario);
    }
}