#[test_only]
module alpha_points::sui_ns_proxy_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::assert_eq;
    use std::string::{Self, String};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use alpha_points::partner::{Self, PartnerCap};
    use alpha_points::admin::{Self, AdminCap};
    use alpha_points::sui_ns_proxy::{Self, SubnameMintedViaProxy};

    const ADMIN_ADDR: address = @0xAD;
    const PARTNER_ADDR: address = @0xB;
    const USER_ADDR: address = @0xC;

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        scenario
    }

    #[test]
    fun test_proxy_mint_subname() {
        let mut scenario = setup_test();
        
        // Grant partner cap
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let partner_name = string::utf8(b"Test Partner");
            partner::grant_partner_cap(&admin_cap, PARTNER_ADDR, partner_name, ctx);
            ts::return_to_sender(&scenario, admin_cap);
        };

        // Partner proxies mint subname
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let subname = string::utf8(b"testname");
            let parent_domain = string::utf8(b"alpha4.sui");
            
            sui_ns_proxy::proxy_mint_subname(
                &partner_cap,
                USER_ADDR,
                subname,
                parent_domain,
                ctx
            );
            
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = sui_ns_proxy::EInvalidSubname)]
    fun test_invalid_subname() {
        let mut scenario = setup_test();
        
        // Grant partner cap
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let partner_name = string::utf8(b"Test Partner");
            partner::grant_partner_cap(&admin_cap, PARTNER_ADDR, partner_name, ctx);
            ts::return_to_sender(&scenario, admin_cap);
        };

        // Partner tries to proxy mint invalid subname
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let subname = string::utf8(b"test@name"); // Invalid character
            let parent_domain = string::utf8(b"alpha4.sui");
            
            sui_ns_proxy::proxy_mint_subname(
                &partner_cap,
                USER_ADDR,
                subname,
                parent_domain,
                ctx
            );
            
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = sui_ns_proxy::EPartnerNotAuthorized)]
    fun test_paused_partner() {
        let mut scenario = setup_test();
        
        // Grant partner cap
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let partner_name = string::utf8(b"Test Partner");
            partner::grant_partner_cap(&admin_cap, PARTNER_ADDR, partner_name, ctx);
            ts::return_to_sender(&scenario, admin_cap);
        };

        // Pause partner
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            partner::set_partner_paused(&admin_cap, &mut partner_cap, true, ctx);
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_to_sender(&scenario, partner_cap);
        };

        // Partner tries to proxy mint while paused
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let subname = string::utf8(b"testname");
            let parent_domain = string::utf8(b"alpha4.sui");
            
            sui_ns_proxy::proxy_mint_subname(
                &partner_cap,
                USER_ADDR,
                subname,
                parent_domain,
                ctx
            );
            
            ts::return_to_sender(&scenario, partner_cap);
        };
        
        ts::end(scenario);
    }
} 