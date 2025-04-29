// escrow.move - Holds underlying assets backing points/stakes
module alpha_points::escrow {
    use sui::object::{Self, ID, UID, delete};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance, zero, value, join, split};
    use sui::tx_context::{Self, TxContext, sender};
    use sui::transfer::{Self, share_object, public_transfer};
    use sui::event;

    // Import the capability type from the admin module
    use alpha_points::admin::{GovernCap}; // Removed unused Config import

    // Functions marked public(package) are callable from other modules in this package
    // (Replacing deprecated 'friend')

    // === Structs ===
    // Added 'public' visibility
    public struct EscrowVault<phantom T> has key {
        id: UID,
        balance: Balance<T>,
    }

    // === Events ===
    // Added 'public' visibility
    public struct VaultCreated<phantom T> has copy, drop {
        vault_id: ID,
        creator: address
    }

    // Added 'public' visibility and renamed 'depositor' to 'by'
    public struct EscrowDeposited<phantom T> has copy, drop { // Renamed Event struct
        vault_id: ID,
        amount: u64,
        by: address // Address that initiated the deposit tx
    }

    // Added 'public' visibility, renamed 'recipient' to 'by' (initiator), added 'recipient' field
    public struct EscrowWithdrawn<phantom T> has copy, drop { // Renamed Event struct
        vault_id: ID,
        amount: u64,
        by: address, // Address that initiated the withdraw tx
        recipient: address // Address that received the withdrawn assets
    }

    // Event for vault destruction
     public struct VaultDestroyed has copy, drop {
        vault_id: ID,
        destroyed_by: address
    }

    // === Errors ===
    // Standardized error codes
    const EZERO_DEPOSIT: u64 = 1;       // Cannot deposit zero amount
    const EINSUFFICIENT_FUNDS: u64 = 2; // Not enough balance in vault to withdraw
    const EUNAUTHORIZED: u64 = 3;       // Caller lacks required capability (GovernCap)
    const EVAULT_NOT_EMPTY: u64 = 4;    // Cannot destroy a vault that still holds assets

    // === Public Functions ===

    /// Creates a new, empty EscrowVault for asset type T.
    /// Requires GovernCap for authorization. The vault is shared upon creation.
    public entry fun create_escrow_vault<T: store>( // T needs store to be held in Balance
        _gov_cap: &GovernCap, // Authorization check
        ctx: &mut TxContext
    ) {
        let vault = EscrowVault<T> {
            id: object::new(ctx),
            balance: zero<T>(),
        };

        let creator_address = sender(ctx);
        event::emit(VaultCreated<T> {
            vault_id: object::id(&vault),
            creator: creator_address
        });

        // Share the vault object so it can be accessed by other transactions/modules
        share_object(vault);
    }

    /// Destroys an EscrowVault. Requires GovernCap.
    /// Vault must be empty (balance must be zero).
    public entry fun destroy_empty_escrow_vault<T: store>(
        _gov_cap: &GovernCap, // Authorization check
        vault: EscrowVault<T>, // Takes ownership of the vault object
        ctx: &TxContext
    ) {
        // Ensure the vault is empty before allowing destruction
        assert!(value(&vault.balance) == 0, EVAULT_NOT_EMPTY);

        let vault_id = object::id(&vault);
        let destroyer_address = sender(ctx);

        // Unpack the vault struct to get the UID for deletion
        let EscrowVault { id, balance } = vault;
        balance::destroy_zero(balance); // Destroy the zero balance object
        delete(id); // Delete the EscrowVault object itself

        event::emit(VaultDestroyed {
            vault_id,
            destroyed_by: destroyer_address
        });
    }


    // === Package-Protected Functions ===
    // (Callable only from within the 'alpha_points' package)

    /// Deposits a Coin<T> into the specified EscrowVault.
    /// Called by other modules within the package (e.g., integration::route_stake).
    public(package) fun deposit<T: store>(
        vault: &mut EscrowVault<T>,
        coin_to_deposit: Coin<T>,
        ctx: &TxContext
    ) {
        let amount = coin::value(&coin_to_deposit);
        assert!(amount > 0, EZERO_DEPOSIT);

        let deposited_balance = coin::into_balance(coin_to_deposit);
        join(&mut vault.balance, deposited_balance);

        // Emit event using the sender of the current transaction context
        event::emit(EscrowDeposited<T> {
            vault_id: object::id(vault),
            amount,
            by: sender(ctx) // The address executing this deposit action
        });
    }

    /// Withdraws a specified amount of assets from the EscrowVault, returning a Coin<T>.
    /// Transfers the withdrawn Coin<T> to the specified recipient address.
    /// Called by other modules within the package (e.g., integration::redeem_stake, integration::redeem_points).
    public(package) fun withdraw<T: store>(
        vault: &mut EscrowVault<T>,
        amount: u64,
        recipient: address,
        ctx: &TxContext
    ) {
        // Amount > 0 check can often be omitted if the calling logic ensures it,
        // or rely on balance::split potentially handling 0 amount gracefully (check Sui docs).
        // Adding it for explicit safety:
        assert!(amount > 0, EZERO_DEPOSIT); // Reusing EZERO_DEPOSIT or add specific withdraw error

        assert!(value(&vault.balance) >= amount, EINSUFFICIENT_FUNDS);

        let withdrawn_balance = split(&mut vault.balance, amount);
        let withdrawn_coin = coin::from_balance(withdrawn_balance, ctx);

        let withdrawer_address = sender(ctx);

        event::emit(EscrowWithdrawn<T> {
            vault_id: object::id(vault),
            amount,
            by: withdrawer_address, // The address executing this withdraw action
            recipient // The address receiving the withdrawn coin
        });

        // Transfer the newly created coin to the recipient
        public_transfer(withdrawn_coin, recipient);
    }

    // === Public View Functions ===

    /// Returns the total balance of assets held within the EscrowVault.
    public fun total_value<T>(vault: &EscrowVault<T>): u64 {
        value(&vault.balance)
    }
}

// === Test Submodule (Optional but Recommended) ===
#[test_only]
module alpha_points::escrow_tests {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx, take_shared, return_shared, take_from_sender, return_to_sender, inventory_contains};
    use sui::coin::{Self, Coin, mint_for_testing, burn_for_testing};
    use sui::balance::value;
    use sui::object::id;

    use alpha_points::admin::{Self as admin, GovernCap}; // Import admin module for testing
    use alpha_points::escrow::{Self, EscrowVault, VaultCreated, EscrowDeposited, EscrowWithdrawn, VaultDestroyed, EZERO_DEPOSIT, EINSUFFICIENT_FUNDS, EVAULT_NOT_EMPTY};

    // Test addresses
    const ADMIN: address = @0xA1;
    const USER1: address = @0xB1;
    const USER2: address = @0xB2;

    // Test coin type
    struct TEST_COIN {}

    // Helper to initialize admin and get GovernCap
    fun init_admin_get_cap(scenario: &mut Scenario): GovernCap {
        next_tx(scenario, ADMIN);
        admin::init(ctx(scenario));
        take_from_sender<GovernCap>(scenario) // Take gov cap, ignore others for escrow tests
    }

    #[test]
    fun test_create_vault_and_deposit_withdraw() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);

        // Create vault
        next_tx(&mut scenario, ADMIN);
        escrow::create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario));
        let vault = take_shared<EscrowVault<TEST_COIN>>(&mut scenario);
        assert!(escrow::total_value(&vault) == 0, 0);

        // Deposit
        next_tx(&mut scenario, USER1);
        let coin = mint_for_testing<TEST_COIN>(100, ctx(&mut scenario));
        escrow::deposit(&mut vault, coin, ctx(&mut scenario));
        assert!(escrow::total_value(&vault) == 100, 1);

        // Withdraw
        next_tx(&mut scenario, USER2); // Simulate another user/contract withdrawing
        escrow::withdraw(&mut vault, 70, USER2, ctx(&mut scenario)); // Withdraw to USER2
        assert!(escrow::total_value(&vault) == 30, 2); // 100 - 70 = 30 left

        // Verify USER2 received the coin
        assert!(inventory_contains<Coin<TEST_COIN>>(&scenario, USER2), 3);

        // Cleanup
        return_shared(vault);
        return_to_sender(&mut scenario, gov_cap); // Return gov cap to ADMIN
        test_scenario::end(scenario); // Automatically cleans up USER2's coin
    }

     #[test]
     #[expected_failure(abort_code = escrow::EINSUFFICIENT_FUNDS)]
    fun test_withdraw_insufficient_funds() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);

        // Create vault
        next_tx(&mut scenario, ADMIN);
        escrow::create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario));
        let vault = take_shared<EscrowVault<TEST_COIN>>(&mut scenario);

        // Deposit 50
        next_tx(&mut scenario, USER1);
        let coin = mint_for_testing<TEST_COIN>(50, ctx(&mut scenario));
        escrow::deposit(&mut vault, coin, ctx(&mut scenario));

        // Try to withdraw 100 (fails)
        next_tx(&mut scenario, USER1);
        escrow::withdraw(&mut vault, 100, USER1, ctx(&mut scenario));

        // Cleanup (won't be reached)
        return_shared(vault);
        return_to_sender(&mut scenario, gov_cap);
        test_scenario::end(scenario);
    }

     #[test]
    fun test_destroy_empty_vault() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);

        // Create vault
        next_tx(&mut scenario, ADMIN);
        escrow::create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario));
        let vault = take_shared<EscrowVault<TEST_COIN>>(&mut scenario);
        let vault_id = id(&vault);

        // Destroy vault (should succeed as it's empty)
        escrow::destroy_empty_escrow_vault<TEST_COIN>(&gov_cap, vault, ctx(&mut scenario));

        // Verify vault is gone (attempting to take it again would fail, difficult to test directly)
        // Test framework should handle object deletion checks implicitly if end() passes.

        // Cleanup
        return_to_sender(&mut scenario, gov_cap);
        test_scenario::end(scenario);
    }

     #[test]
     #[expected_failure(abort_code = escrow::EVAULT_NOT_EMPTY)]
    fun test_destroy_non_empty_vault_fails() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);

        // Create vault
        next_tx(&mut scenario, ADMIN);
        escrow::create_escrow_vault<TEST_COIN>(&gov_cap, ctx(&mut scenario));
        let mut vault = take_shared<EscrowVault<TEST_COIN>>(&mut scenario);

        // Deposit
        next_tx(&mut scenario, USER1);
        let coin = mint_for_testing<TEST_COIN>(1, ctx(&mut scenario));
        escrow::deposit(&mut vault, coin, ctx(&mut scenario));

        // Try to destroy (should fail)
        next_tx(&mut scenario, ADMIN);
        escrow::destroy_empty_escrow_vault<TEST_COIN>(&gov_cap, vault, ctx(&mut scenario));

        // Cleanup (won't be reached)
        return_to_sender(&mut scenario, gov_cap);
        test_scenario::end(scenario);
    }
}