#[test_only]
module alpha_points::lz_bridge_tests {
    use sui::test_scenario as ts;
    use sui::test_utils::assert_eq;
    use std::vector;
    use sui::bcs;
    
    use alpha_points::lz_bridge::{Self, LZConfig};
    use alpha_points::admin::{Self, Config, GovernCap};
    use alpha_points::ledger::{Self, Ledger};
    
    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const MOCK_LZ_ENDPOINT: address = @0xE;
    
    const CHAIN_ID_ETHEREUM: u64 = 1;
    const CHAIN_ID_AVALANCHE: u64 = 2;
    const POINTS_AMOUNT: u64 = 1000;
    
    // Helper function to set up a test scenario with initialized modules
    fun setup_test(): ts::Scenario {
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
        
        // Initialize lz_bridge module
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            lz_bridge::init_lz_config(&govern_cap, MOCK_LZ_ENDPOINT, ctx);
            
            // Get the LZConfig to set trusted remotes
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            
            // Configure trusted remotes
            let ethereum_remote = x"deadbeef"; // Mocked Ethereum remote address
            lz_bridge::set_trusted_remote(&govern_cap, &mut lz_config, CHAIN_ID_ETHEREUM, ethereum_remote, ctx);
            
            let avalanche_remote = x"beefdead"; // Mocked Avalanche remote address
            lz_bridge::set_trusted_remote(&govern_cap, &mut lz_config, CHAIN_ID_AVALANCHE, avalanche_remote, ctx);
            
            ts::return_shared(lz_config);
            ts::return_to_sender(&scenario, govern_cap);
        };
        
        scenario
    }
    
    #[test]
    fun test_init_lz_config() {
        let scenario = setup_test();
        
        // Verify config was initialized
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            
            // Check values
            assert_eq(lz_bridge::is_bridge_enabled(&lz_config), true);
            assert_eq(lz_bridge::get_lz_endpoint(&lz_config), MOCK_LZ_ENDPOINT);
            
            ts::return_shared(lz_config);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_set_bridge_enabled() {
        let scenario = setup_test();
        
        // Disable bridge
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            lz_bridge::set_bridge_enabled(&govern_cap, &mut lz_config, false, ctx);
            
            // Verify bridge is disabled
            assert_eq(lz_bridge::is_bridge_enabled(&lz_config), false);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(lz_config);
        };
        
        // Enable bridge
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            lz_bridge::set_bridge_enabled(&govern_cap, &mut lz_config, true, ctx);
            
            // Verify bridge is enabled
            assert_eq(lz_bridge::is_bridge_enabled(&lz_config), true);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(lz_config);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_trusted_remote_operations() {
        let scenario = setup_test();
        
        // Get trusted remote
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            
            // Check Ethereum trusted remote
            let eth_remote = lz_bridge::get_trusted_remote(&lz_config, CHAIN_ID_ETHEREUM);
            assert_eq(eth_remote, x"deadbeef");
            
            // Check Avalanche trusted remote
            let avax_remote = lz_bridge::get_trusted_remote(&lz_config, CHAIN_ID_AVALANCHE);
            assert_eq(avax_remote, x"beefdead");
            
            ts::return_shared(lz_config);
        };
        
        // Update trusted remote
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            let new_eth_remote = x"0102030405";
            lz_bridge::set_trusted_remote(&govern_cap, &mut lz_config, CHAIN_ID_ETHEREUM, new_eth_remote, ctx);
            
            // Verify update
            let eth_remote = lz_bridge::get_trusted_remote(&lz_config, CHAIN_ID_ETHEREUM);
            assert_eq(eth_remote, new_eth_remote);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(lz_config);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_send_bridge_packet() {
        let scenario = setup_test();
        
        // First give user some points
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Directly earn points for test
            ledger::test_earn(&mut ledger, &govern_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            
            ts::return_to_sender(&scenario, govern_cap);
            ts::return_shared(ledger);
        };
        
        // Send bridge packet
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let config = ts::take_shared<Config>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Mock destination address on Ethereum
            let destination_addr = x"000000000000000000000000a1b2c3d4e5f67890";
            
            lz_bridge::test_send_bridge_packet(
                &config,
                &lz_config,
                &mut ledger,
                CHAIN_ID_ETHEREUM,
                destination_addr,
                POINTS_AMOUNT / 2, // Send half the points
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(lz_config);
            ts::return_shared(ledger);
        };
        
        // Verify points were deducted
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT / 2);
            
            ts::return_shared(ledger);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    fun test_receive_bridge_packet() {
        let scenario = setup_test();
        
        // Receive bridge packet
        ts::next_tx(&mut scenario, MOCK_LZ_ENDPOINT);
        {
            let config = ts::take_shared<Config>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Create mock payload
            let src_chain_id = CHAIN_ID_ETHEREUM;
            let src_address = x"deadbeef"; // Must match trusted remote
            let dest_address = USER_ADDR;
            let amount = POINTS_AMOUNT;
            
            let payload = create_mock_payload(dest_address, amount);
            
            lz_bridge::test_receive_bridge_packet(
                &config,
                &lz_config,
                &mut ledger,
                src_chain_id,
                src_address,
                payload,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(lz_config);
            ts::return_shared(ledger);
        };
        
        // Verify points were credited
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            
            ts::return_shared(ledger);
        };
        
        ts::end(scenario);
    }
    
    #[test]
    #[expected_failure]
    fun test_receive_bridge_packet_untrusted() {
        let scenario = setup_test();
        
        // Receive bridge packet from untrusted source
        ts::next_tx(&mut scenario, MOCK_LZ_ENDPOINT);
        {
            let config = ts::take_shared<Config>(&scenario);
            let lz_config = ts::take_shared<LZConfig>(&scenario);
            let ledger = ts::take_shared<Ledger>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            
            // Create mock payload
            let src_chain_id = CHAIN_ID_ETHEREUM;
            // Using a different byte sequence that doesn't match the trusted remote
            let src_address = x"1122334455"; 
            let dest_address = USER_ADDR;
            let amount = POINTS_AMOUNT;
            
            let payload = create_mock_payload(dest_address, amount);
            
            // This should fail due to untrusted remote
            lz_bridge::test_receive_bridge_packet(
                &config,
                &lz_config,
                &mut ledger,
                src_chain_id,
                src_address,
                payload,
                ctx
            );
            
            ts::return_shared(config);
            ts::return_shared(lz_config);
            ts::return_shared(ledger);
        };
        
        ts::end(scenario);
    }
    
    /// Helper to create a mock LayerZero payload
    fun create_mock_payload(dest_address: address, amount: u64): vector<u8> {
        let payload = vector::empty<u8>();
        
        // Add dest_address bytes
        let addr_bytes = bcs::to_bytes(&dest_address);
        vector::append(&mut payload, addr_bytes);
        
        // Add amount bytes
        let amount_bytes = bcs::to_bytes(&amount);
        vector::append(&mut payload, amount_bytes);
        
        payload
    }
}