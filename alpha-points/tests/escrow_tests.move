#[test_only]
module alpha_points::escrow_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use alpha_points::escrow::{Self, EscrowVault, EInsufficientFunds};
    use alpha_points::admin::{Self, GovernCap};

    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const AMOUNT: u64 = 1000;

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        scenario
    }

    #[test]
    fun test_create_escrow_vault() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            assert_eq(escrow::total_value<SUI>(&vault), 0);
            ts::return_shared(vault);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_deposit() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ctx);
            transfer::public_transfer(coin, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            // Take govern_cap from ADMIN_ADDR for test
            let govern_cap = ts::take_from_address<GovernCap>(&scenario, ADMIN_ADDR);
            let ctx = ts::ctx(&mut scenario);
            
            escrow::test_deposit<SUI>(&mut vault, &govern_cap, coin, ctx);
            assert_eq(escrow::total_value<SUI>(&vault), AMOUNT);
            
            ts::return_shared(vault);
            ts::return_to_address(ADMIN_ADDR, govern_cap);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_withdraw() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        // Deposit into vault
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let mut vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ctx);
            escrow::test_deposit<SUI>(&mut vault, &govern_cap, coin, ctx);
            
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        // Withdraw from vault
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let mut vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let withdraw_amount = AMOUNT / 2;
            let ctx = ts::ctx(&mut scenario);
            
            escrow::test_withdraw<SUI>(&mut vault, &govern_cap, withdraw_amount, USER_ADDR, ctx);
            assert_eq(escrow::total_value<SUI>(&vault), AMOUNT - withdraw_amount);
            
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        // Check user received coins
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert_eq(coin::value(&coin), AMOUNT / 2);
            ts::return_to_sender(&scenario, coin);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EInsufficientFunds)]
    fun test_withdraw_insufficient_funds() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            escrow::create_escrow_vault<SUI>(&govern_cap, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        // Deposit into vault
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let mut vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let coin = coin::mint_for_testing<SUI>(AMOUNT, ctx);
            escrow::test_deposit<SUI>(&mut vault, &govern_cap, coin, ctx);
            
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        // Try to withdraw more than available (should fail)
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let mut vault = ts::take_shared<EscrowVault<SUI>>(&scenario);
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let withdraw_amount = AMOUNT * 2; // Try to withdraw twice the deposit
            let ctx = ts::ctx(&mut scenario);
            
            // This should abort with EInsufficientFunds
            escrow::test_withdraw<SUI>(&mut vault, &govern_cap, withdraw_amount, USER_ADDR, ctx);
            
            // These won't execute if test properly aborts
            ts::return_shared(vault);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::end(scenario);
    }
}