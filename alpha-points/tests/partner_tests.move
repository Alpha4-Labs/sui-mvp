#[test_only]
module alpha_points::partner_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use std::string::{Self, String};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use alpha_points::partner::{Self, PartnerCap};
    use alpha_points::admin::{Self, GovernCap};

    const ADMIN_ADDR: address = @0xAD;
    const PARTNER_ADDR: address = @0xB;

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        scenario
    }

    #[test]
    fun test_grant_partner_cap() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let partner_name = string::utf8(b"Test Partner");
            partner::grant_partner_cap(&govern_cap, PARTNER_ADDR, partner_name, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let name = partner::get_partner_name(&partner_cap);
            assert_eq(name, string::utf8(b"Test Partner"));
            ts::return_to_sender(&scenario, partner_cap);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_revoke_partner_cap() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let partner_name = string::utf8(b"Test Partner");
            partner::grant_partner_cap(&govern_cap, PARTNER_ADDR, partner_name, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            transfer::public_transfer(partner_cap, ADMIN_ADDR);
        };
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            partner::revoke_partner_cap(&govern_cap, partner_cap, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_transfer_partner_cap() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let govern_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let partner_name = string::utf8(b"Test Partner");
            partner::grant_partner_cap(&govern_cap, PARTNER_ADDR, partner_name, ctx);
            ts::return_to_sender(&scenario, govern_cap);
        };
        let new_partner = @0xC;
        ts::next_tx(&mut scenario, PARTNER_ADDR);
        {
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            partner::transfer_partner_cap(partner_cap, new_partner, ctx);
        };
        ts::next_tx(&mut scenario, new_partner);
        {
            let partner_cap = ts::take_from_sender<PartnerCap>(&scenario);
            let name = partner::get_partner_name(&partner_cap);
            assert_eq(name, string::utf8(b"Test Partner"));
            ts::return_to_sender(&scenario, partner_cap);
        };
        ts::end(scenario);
    }
}