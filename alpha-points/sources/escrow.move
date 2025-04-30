// escrow.move - Holds underlying assets backing points/stakes
module alpha_points::escrow {
    use sui::object;
    use sui::coin::{Coin};
    use sui::balance::{Balance, value as balance_value};
    use sui::tx_context;
    use sui::transfer::share_object;
    use sui::event;

    use alpha_points::admin::GovernCap; // Only need GovernCap

    // === Structs ===
    public struct EscrowVault<phantom T> has key { id: object::UID, balance: Balance<T> }

    // === Events ===
    public struct VaultCreated<phantom T> has copy, drop { vault_id: object::ID, creator: address }
    public struct EscrowDeposited<phantom T> has copy, drop { vault_id: object::ID, amount: u64, by: address }
    public struct EscrowWithdrawn<phantom T> has copy, drop { vault_id: object::ID, amount: u64, by: address, recipient: address }
    public struct VaultDestroyed has copy, drop { vault_id: object::ID, destroyed_by: address }

    // === Errors ===
    const EZERO_DEPOSIT: u64 = 1;
    const EINSUFFICIENT_FUNDS: u64 = 2;
    // EUNAUTHORIZED removed (implicit check)
    const EVAULT_NOT_EMPTY: u64 = 4;

    // === Public Functions ===
    public entry fun create_escrow_vault<T: store>( 
        _gov_cap: &GovernCap, 
        ctx: &mut tx_context::TxContext 
    ) {
        let vault_id = object::new(ctx);
        let vault = EscrowVault<T> {
            id: vault_id,
            balance: sui::balance::zero<T>()
        };
        
        // Fixed: using object::uid_to_inner instead of id()
        let vault_id_inner = object::uid_to_inner(&vault.id);
        event::emit(VaultCreated<T> { 
            vault_id: vault_id_inner, 
            creator: tx_context::sender(ctx) 
        });
        
        share_object(vault);
    }
    
    public entry fun destroy_empty_escrow_vault<T: store>( 
        _gov_cap: &GovernCap, 
        vault: EscrowVault<T>, 
        ctx: &tx_context::TxContext 
    ) {
        let EscrowVault { id, balance } = vault;
        let balance_amount = balance_value(&balance);
        assert!(balance_amount == 0, EVAULT_NOT_EMPTY);
        
        // Fixed: using object::uid_to_inner instead of id()
        let vault_id = object::uid_to_inner(&id);
        event::emit(VaultDestroyed { 
            vault_id, 
            destroyed_by: tx_context::sender(ctx) 
        });
        
        sui::balance::destroy_zero(balance);
        object::delete(id);
    }

    // === Package-Protected Functions ===
    public(package) fun deposit<T: store>( 
        vault: &mut EscrowVault<T>, 
        coin_to_deposit: Coin<T>, 
        ctx: &tx_context::TxContext 
    ) {
        let deposit_amount = sui::coin::value(&coin_to_deposit);
        assert!(deposit_amount > 0, EZERO_DEPOSIT);
        
        let coin_balance = sui::coin::into_balance(coin_to_deposit);
        sui::balance::join(&mut vault.balance, coin_balance);
        
        // Fixed: using object::uid_to_inner instead of id()
        let vault_id = object::uid_to_inner(&vault.id);
        event::emit(EscrowDeposited<T> { 
            vault_id, 
            amount: deposit_amount, 
            by: tx_context::sender(ctx) 
        });
    }
    
    public(package) fun withdraw<T: store>( 
        vault: &mut EscrowVault<T>, 
        amount: u64, 
        recipient: address, 
        ctx: &mut tx_context::TxContext 
    ) {
        assert!(balance_value(&vault.balance) >= amount, EINSUFFICIENT_FUNDS);
        
        let withdrawn_balance = sui::balance::split(&mut vault.balance, amount);
        let withdrawn_coin = sui::coin::from_balance(withdrawn_balance, ctx);
        
        // Fixed: using object::uid_to_inner instead of id()
        let vault_id = object::uid_to_inner(&vault.id);
        event::emit(EscrowWithdrawn<T> { 
            vault_id, 
            amount, 
            by: tx_context::sender(ctx), 
            recipient 
        });
        
        sui::transfer::public_transfer(withdrawn_coin, recipient);
    }

    // === Public View Functions ===
    public fun total_value<T>(vault: &EscrowVault<T>): u64 { 
        balance_value(&vault.balance) 
    }
}

// === Test Submodule ===
#[test_only]
module alpha_points::escrow_tests {
    use sui::test_scenario::{
        Scenario, next_tx, ctx, take_shared, return_shared, 
        take_from_sender, return_to_sender, end as end_scenario, begin
    };
    use sui::coin::{mint_for_testing, burn_for_testing, value as coin_value};

    // Use admin's test_only init instead of calling the internal function directly
    use alpha_points::admin::{GovernCap, OracleCap, init_for_testing}; 
    use alpha_points::escrow::{
        EscrowVault, total_value, deposit, withdraw, 
        destroy_empty_escrow_vault, create_escrow_vault, 
        EVAULT_NOT_EMPTY, EINSUFFICIENT_FUNDS
    }; // Import needed items

    const ADMIN_ADDR: address = @0xA1;
    const USER1_ADDR: address = @0xB1;
    const USER2_ADDR: address = @0xB2;

    // Test coin type needs public and store
    public struct TEST_COIN has store, drop {}

    // Helper to initialize admin and get GovernCap
    fun setup_admin_get_cap(scenario: &mut Scenario): GovernCap {
        next_tx(scenario, ADMIN_ADDR);
        
        // Initialize admin module using the test function
        init_for_testing(ctx(scenario));
        
        // Fixed: properly handle OracleCap by transferring it back to sender
        let oracle_cap = take_from_sender<OracleCap>(scenario);
        return_to_sender(scenario, oracle_cap);
        
        take_from_sender<GovernCap>(scenario)
    }

    #[test]
    fun test_create_vault_and_deposit_withdraw() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);

        next_tx(&mut scenario, ADMIN_ADDR);
        create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario)); // Call directly
        let mut vault = take_shared<EscrowVault<TEST_COIN>>(&scenario);
        assert!(total_value(&vault) == 0, 0);

        next_tx(&mut scenario, USER1_ADDR);
        let coin = mint_for_testing<TEST_COIN>(100, ctx(&mut scenario));
        deposit(&mut vault, coin, ctx(&mut scenario)); // Call directly
        assert!(total_value(&vault) == 100, 1);

        next_tx(&mut scenario, USER2_ADDR); // Simulate another user/contract withdrawing
        withdraw(&mut vault, 70, USER2_ADDR, ctx(&mut scenario)); // Call directly
        assert!(total_value(&vault) == 30, 2);

        // Verify USER2 received the coin by taking it
        let received_coin = take_from_sender<Coin<TEST_COIN>>(&scenario);
        assert!(coin_value(&received_coin) == 70, 3);
        burn_for_testing(received_coin); // Clean up

        return_shared(vault);
        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EINSUFFICIENT_FUNDS)] // Use code from escrow module
    fun test_withdraw_insufficient_funds() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);

        next_tx(&mut scenario, ADMIN_ADDR);
        create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario));
        let mut vault = take_shared<EscrowVault<TEST_COIN>>(&scenario);

        next_tx(&mut scenario, USER1_ADDR);
        let coin = mint_for_testing<TEST_COIN>(50, ctx(&mut scenario));
        deposit(&mut vault, coin, ctx(&mut scenario));

        next_tx(&mut scenario, USER1_ADDR);
        withdraw(&mut vault, 100, USER1_ADDR, ctx(&mut scenario)); // Fails

        // Cleanup (won't reach)
        return_shared(vault);
        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }

    #[test]
    fun test_destroy_empty_vault() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);

        next_tx(&mut scenario, ADMIN_ADDR);
        create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario));
        let vault = take_shared<EscrowVault<TEST_COIN>>(&scenario);

        destroy_empty_escrow_vault<TEST_COIN>(&gov_cap, vault, ctx(&mut scenario)); // Consumes vault

        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EVAULT_NOT_EMPTY)] // Use code from escrow module
    fun test_destroy_non_empty_vault_fails() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);

        next_tx(&mut scenario, ADMIN_ADDR);
        create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario));
        let mut vault = take_shared<EscrowVault<TEST_COIN>>(&scenario);

        next_tx(&mut scenario, USER1_ADDR);
        let coin = mint_for_testing<TEST_COIN>(1, ctx(&mut scenario));
        deposit(&mut vault, coin, ctx(&mut scenario));

        next_tx(&mut scenario, ADMIN_ADDR);
        // Need to take shared object again to pass by value
        return_shared(vault);
        let vault_to_destroy = take_shared<EscrowVault<TEST_COIN>>(&scenario);
        destroy_empty_escrow_vault<TEST_COIN>(&gov_cap, vault_to_destroy, ctx(&mut scenario)); // Fails

        // Cleanup (won't reach)
        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }
}