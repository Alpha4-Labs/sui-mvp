#[test_only]
module alpha_points::lz_bridge_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use std::vector;
    use sui::bcs;
    use sui::tx_context::{TxContext};

    use alpha_points::lz_bridge::{Self, LZConfig, EUntrustedRemote};
    use alpha_points::admin::{Self, Config, GovernCap};
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::ledger::SupplyOracle;
    use alpha_points::stake_position;

    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const MOCK_LZ_ENDPOINT: address = @0xE;

    const CHAIN_ID_ETHEREUM: u64 = 1;
    const CHAIN_ID_AVALANCHE: u64 = 2;
    const POINTS_AMOUNT: u64 = 1000;

    fun setup_test(): Scenario {
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
        
        // Initialize LayerZero config
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Create LayerZero config
            lz_bridge::init_lz_config(&govern_cap, MOCK_LZ_ENDPOINT, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        // Configure trusted remotes in a separate transaction
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut lz_config = ts::take_shared<LZConfig>(&scenario);
            
            // Add Ethereum remote
            let ctx = ts::ctx(&mut scenario);
            let ethereum_remote = x"deadbeef";
            lz_bridge::set_trusted_remote(&govern_cap, &mut lz_config, CHAIN_ID_ETHEREUM, ethereum_remote, ctx);
            
            // Add Avalanche remote
            let ctx = ts::ctx(&mut scenario);
            let avalanche_remote = x"beefdead";
            lz_bridge::set_trusted_remote(&govern_cap, &mut lz_config, CHAIN_ID_AVALANCHE, avalanche_remote, ctx);
            
            ts::return_shared(lz_config);
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        scenario
    }

    #[test]
    fun test_init_lz_config() {
        let mut scenario = setup_test();
        
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            
            // Verify initial config
            assert_eq(lz_bridge::is_bridge_enabled(&lz_config), true);
            assert_eq(lz_bridge::get_lz_endpoint(&lz_config), MOCK_LZ_ENDPOINT);
            
            ts::return_shared(lz_config);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_set_bridge_enabled() {
        let mut scenario = setup_test();
        
        // Disable bridge
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut lz_config = ts::take_shared<LZConfig>(&scenario);
            
            let ctx = ts::ctx(&mut scenario);
            lz_bridge::set_bridge_enabled(&govern_cap, &mut lz_config, false, ctx);
            
            assert_eq(lz_bridge::is_bridge_enabled(&lz_config), false);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(lz_config);
        };
        
        // Enable bridge again
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut lz_config = ts::take_shared<LZConfig>(&scenario);
            
            let ctx = ts::ctx(&mut scenario);
            lz_bridge::set_bridge_enabled(&govern_cap, &mut lz_config, true, ctx);
            
            assert_eq(lz_bridge::is_bridge_enabled(&lz_config), true);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(lz_config);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_trusted_remote_operations() {
        let mut scenario = setup_test();
        
        // Verify initial remotes
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            
            // Check Ethereum remote
            let eth_remote = lz_bridge::get_trusted_remote(&lz_config, CHAIN_ID_ETHEREUM);
            assert_eq(eth_remote, x"deadbeef");
            
            // Check Avalanche remote
            let avax_remote = lz_bridge::get_trusted_remote(&lz_config, CHAIN_ID_AVALANCHE);
            assert_eq(avax_remote, x"beefdead");
            
            ts::return_shared(lz_config);
        };
        
        // Update Ethereum remote
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut lz_config = ts::take_shared<LZConfig>(&scenario);
            
            let ctx = ts::ctx(&mut scenario);
            let new_eth_remote = x"0102030405";
            lz_bridge::set_trusted_remote(&govern_cap, &mut lz_config, CHAIN_ID_ETHEREUM, new_eth_remote, ctx);
            
            // Verify update
            let eth_remote = lz_bridge::get_trusted_remote(&lz_config, CHAIN_ID_ETHEREUM);
            assert_eq(eth_remote, x"0102030405");
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(lz_config);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_send_bridge_packet() {
        let mut scenario = setup_test();
        
        // Add points to user
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            
            let ctx = ts::ctx(&mut scenario);
            let mut mint_stats = ledger::get_or_create_mint_stats(ctx);
            let epoch = 0;
            let mut clock = sui::clock::create_for_testing(ctx);
            let mut supply_oracle = ledger::mock_supply_oracle(ctx);
            ledger::test_earn(&mut ledger, &govern_cap, USER_ADDR, POINTS_AMOUNT, ctx, &mut mint_stats, epoch, &option::none<stake_position::StakePosition<u8>>(), 0, &clock, &mut supply_oracle);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(ledger);
        };
        
        // User sends points via bridge
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let destination_addr = x"000000000000000000000000a1b2c3d4e5f67890";
            let send_amount = POINTS_AMOUNT / 2;
            
            lz_bridge::test_send_bridge_packet(
                &config, &lz_config, &mut ledger, CHAIN_ID_ETHEREUM, destination_addr, send_amount, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(lz_config);
            ts::return_shared(ledger);
        };
        
        // Verify points were deducted
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            
            ts::return_shared(ledger);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_receive_bridge_packet() {
        let mut scenario = setup_test();
        
        // Endpoint receives packet
        ts::next_tx(&mut scenario, MOCK_LZ_ENDPOINT);
        {
            let config = ts::take_shared<Config>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let src_chain_id = CHAIN_ID_ETHEREUM;
            let src_address = x"deadbeef"; // Must match trusted remote
            let dest_address = USER_ADDR;
            let amount = POINTS_AMOUNT;
            
            // Create mock payload
            let payload = create_mock_payload(dest_address, amount);
            
            lz_bridge::test_receive_bridge_packet(
                &config, &lz_config, &mut ledger, src_chain_id, src_address, payload, ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(lz_config);
            ts::return_shared(ledger);
        };
        
        // Verify points were credited
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EUntrustedRemote)]
    fun test_receive_bridge_packet_untrusted() {
        let mut scenario = setup_test();
        
        // Try to receive from untrusted remote (should fail)
        ts::next_tx(&mut scenario, MOCK_LZ_ENDPOINT);
        {
            let config = ts::take_shared<Config>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let src_chain_id = CHAIN_ID_ETHEREUM;
            let src_address = x"11223344"; // Different from trusted remote
            let dest_address = USER_ADDR;
            let amount = POINTS_AMOUNT;
            
            // Create mock payload
            let payload = create_mock_payload(dest_address, amount);
            
            // This should fail with EUntrustedRemote
            lz_bridge::test_receive_bridge_packet(
                &config, &lz_config, &mut ledger, src_chain_id, src_address, payload, ctx
            );
            
            // These won't execute if the test aborts as expected
            ts::return_shared(config);
            ts::return_shared(lz_config);
            ts::return_shared(ledger);
        };
        
        ts::end(scenario);
    }

    // Helper function to create mock payload for testing
    fun create_mock_payload(dest_address: address, amount: u64): vector<u8> {
        let mut payload = vector::empty<u8>();
        let addr_bytes = bcs::to_bytes(&dest_address);
        vector::append(&mut payload, addr_bytes);
        let amount_bytes = bcs::to_bytes(&amount);
        vector::append(&mut payload, amount_bytes);
        payload
    }
}