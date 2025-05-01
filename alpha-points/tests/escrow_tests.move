#[test_only]
module alpha_points::escrow_tests {
    use sui::test_scenario as ts;
    use sui::test_utils::assert_eq;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    
    use alpha_points::escrow::{Self, EscrowVault};
    use alpha_points::admin::{Self, GovernCap};
    
    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const AMOUNT: u64 = 1000;
    
    // Helper function to set up a test scenario with initialized modules
    fun setup_test(): ts::Scenario {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Initialize admin module first to get GovernCap
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        
        scenario
    }
    
    #[test]
    fun test_create_escrow_vault() {
        let scenario = setup_test();
        
        // Create escrow vault
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Verify vault was created
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            
            // Vault should start with zero balance
            assert_eq(escrow::total_value(&vault), 0);
            
            ts::return_shared(vault);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_deposit() {
        let scenario = setup_test();
        
        // Create escrow vault
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Mint some test coins and send to USER_ADDR
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ctx);
            transfer::public_transfer(coin, USER_ADDR);
        };
        
        // USER_ADDR deposits coins
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            let govern_cap = ts::take_from_address<GovernCap>(&scenario, ADMIN_ADDR);
            let ctx = ts::ctx(&mut scenario);
            
            // Use test_deposit to simulate integration module calling deposit
            escrow::test_deposit(&mut vault, &govern_cap, coin, ctx);
            
            // Verify deposit
            assert_eq(escrow::total_value(&vault), AMOUNT);
            
            ts::return_shared(vault);
            ts::return_to_address(ADMIN_ADDR, govern_cap);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_withdraw() {
        let scenario = setup_test();
        
        // Create escrow vault
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Mint some test coins and deposit them
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ctx);
            escrow::test_deposit(&mut vault, &govern_cap, coin, ctx);
            
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Withdraw half the coins to USER_ADDR
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let withdraw_amount = AMOUNT / 2;
            let ctx = ts::ctx(&mut scenario);
            
            escrow::test_withdraw(&mut vault, &govern_cap, withdraw_amount, USER_ADDR, ctx);
            
            // Verify remaining balance
            assert_eq(escrow::total_value(&vault), AMOUNT - withdraw_amount);
            
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Verify USER_ADDR received the coins
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&coin), AMOUNT / 2);
            ts::return_to_sender(&scenario, coin);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure]
    fun test_withdraw_insufficient_funds() {
        let scenario = setup_test();
        
        // Create escrow vault
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Mint some test coins and deposit them
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ctx);
            escrow::test_deposit(&mut vault, &govern_cap, coin, ctx);
            
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Try to withdraw more than available - should fail
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let withdraw_amount = AMOUNT * 2; // More than available
            let ctx = ts::ctx(&mut scenario);
            
            // This should fail with EInsufficientFunds
            escrow::test_withdraw(&mut vault, &govern_cap, withdraw_amount, USER_ADDR, ctx);
            
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        ts::end(scenario);
    }
}