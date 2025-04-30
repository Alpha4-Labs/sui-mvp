// partner.move - Manages Partner Capabilities for the Alpha Points protocol
module alpha_points::partner {
    // Removed unnecessary imports
    use sui::object::{UID, ID};
    use sui::transfer::public_transfer;
    use sui::tx_context::TxContext;
    use sui::event;
    use std::string::String;

    use alpha_points::admin::GovernCap;

    // === Structs ===
    public struct PartnerCap has key, store { id: UID, partner_name: String }

    // === Events ===
    public struct PartnerCapGranted has copy, drop { 
        partner_cap_id: ID, 
        partner_address: address, 
        partner_name: String, 
        granted_by: address 
    }
    
    public struct PartnerCapRevoked has copy, drop { 
        partner_cap_id: ID, 
        revoked_by: address 
    }
    
    public struct PartnerCapTransferred has copy, drop { 
        partner_cap_id: ID, 
        from: address, 
        to: address 
    }

    // === Public Entry Functions ===
    public entry fun grant_partner_cap(
        _gov_cap: &GovernCap, 
        partner_address: address, 
        partner_name: String, 
        ctx: &mut TxContext
    ) {
        // Create a new partner capability
        let partner_cap_id = object::new(ctx);
        let partner_cap = PartnerCap {
            id: partner_cap_id,
            partner_name
        };
        
        // Emit event
        // Fixed: using object::uid_to_inner instead of id()
        let cap_id = object::uid_to_inner(&partner_cap.id);
        event::emit(PartnerCapGranted {
            partner_cap_id: cap_id,
            partner_address,
            partner_name,
            granted_by: tx_context::sender(ctx)
        });
        
        // Transfer the capability to the partner
        public_transfer(partner_cap, partner_address);
    }
    
    public entry fun revoke_partner_cap(
        _gov_cap: &GovernCap, 
        cap_to_revoke: PartnerCap, 
        ctx: &TxContext
    ) {
        // Get the ID before destroying
        // Fixed: using object::uid_to_inner instead of id()
        let cap_id = object::uid_to_inner(&cap_to_revoke.id);
        
        // Destroy the capability
        let PartnerCap { id, partner_name: _ } = cap_to_revoke;
        object::delete(id);
        
        // Emit event
        event::emit(PartnerCapRevoked {
            partner_cap_id: cap_id,
            revoked_by: tx_context::sender(ctx)
        });
    }
    
    public entry fun transfer_partner_cap(
        cap_to_transfer: PartnerCap, 
        new_owner: address, 
        ctx: &TxContext
    ) {
        // Framework ensures only the current owner can call this
        // Fixed: using object::uid_to_inner instead of id()
        let cap_id = object::uid_to_inner(&cap_to_transfer.id);
        let current_owner = tx_context::sender(ctx);
        
        // Emit event before transfer
        event::emit(PartnerCapTransferred {
            partner_cap_id: cap_id,
            from: current_owner,
            to: new_owner
        });
        
        // Transfer the capability to the new owner
        public_transfer(cap_to_transfer, new_owner);
    }
    
    public fun get_partner_name(cap: &PartnerCap): String { 
        cap.partner_name 
    }
}

// === Test Submodule ===
#[test_only]
module alpha_points::partner_tests {
    // Use the proper imports for test_scenario types
    use sui::test_scenario::{
        Self, Scenario, next_tx, ctx, take_from_sender, 
        return_to_sender, end as end_scenario, begin
    };
    use std::string::utf8;
    use sui::transfer::public_transfer;

    use alpha_points::admin::{init_for_testing, GovernCap, OracleCap}; // Using test-init
    use alpha_points::partner::{grant_partner_cap, revoke_partner_cap, transfer_partner_cap, PartnerCap};

    const ADMIN_ADDR: address = @0xA1;
    const PARTNER1_ADDR: address = @0xC1;
    const PARTNER2_ADDR: address = @0xC2;
    const UNAUTHORIZED_USER: address = @0xDEAD;

    // Helper uses public test init
    fun setup_admin_get_cap(scenario: &mut Scenario): GovernCap {
        next_tx(scenario, ADMIN_ADDR);
        
        // Initialize admin module directly for testing using the test function
        init_for_testing(ctx(scenario));
        
        // Fixed: properly handle OracleCap by transferring it back to sender
        let oracle_cap = take_from_sender<OracleCap>(scenario);
        return_to_sender(scenario, oracle_cap);
        
        take_from_sender<GovernCap>(scenario)
    }

    #[test]
    fun test_grant_and_transfer_partner_cap() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);
        let partner_name = utf8(b"Test Partner Inc."); // Use std::string::utf8

        next_tx(&mut scenario, ADMIN_ADDR);
        grant_partner_cap(&gov_cap, PARTNER1_ADDR, partner_name, ctx(&mut scenario));

        // Verify PARTNER1 has the cap by taking it
        next_tx(&mut scenario, PARTNER1_ADDR);
        let partner_cap = take_from_sender<PartnerCap>(&scenario);

        // PARTNER1 transfers the cap to PARTNER2
        transfer_partner_cap(partner_cap, PARTNER2_ADDR, ctx(&mut scenario)); // Cap consumed

        // Verify PARTNER2 has the cap by taking it
        next_tx(&mut scenario, PARTNER2_ADDR);
        let _partner_cap_p2 = take_from_sender<PartnerCap>(&scenario);
        return_to_sender(&mut scenario, _partner_cap_p2);

        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure]
    fun test_grant_partner_cap_fail_unauthorized() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);
        
        // UNAUTHORIZED_USER doesn't have gov_cap but tries to use it
        next_tx(&mut scenario, UNAUTHORIZED_USER);
        let partner_name = utf8(b"Unauthorized Partner");
        // This will fail because UNAUTHORIZED_USER doesn't own the gov_cap
        grant_partner_cap(&gov_cap, PARTNER1_ADDR, partner_name, ctx(&mut scenario));
        
        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }

    #[test]
    fun test_revoke_partner_cap() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);
        let partner_name = utf8(b"Partner To Revoke"); // Use std::string::utf8

        next_tx(&mut scenario, ADMIN_ADDR);
        grant_partner_cap(&gov_cap, PARTNER1_ADDR, partner_name, ctx(&mut scenario));

        next_tx(&mut scenario, PARTNER1_ADDR);
        let partner_cap_to_revoke = take_from_sender<PartnerCap>(&scenario);
        public_transfer(partner_cap_to_revoke, ADMIN_ADDR); // Transfer to admin

        next_tx(&mut scenario, ADMIN_ADDR);
        let the_cap = take_from_sender<PartnerCap>(&scenario);
        revoke_partner_cap(&gov_cap, the_cap, ctx(&mut scenario));

        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure]
    fun test_revoke_partner_cap_fail_unauthorized() {
        let scenario = begin(ADMIN_ADDR);
        let gov_cap = setup_admin_get_cap(&mut scenario);
        let partner_name = utf8(b"Partner Cap");
        
        next_tx(&mut scenario, ADMIN_ADDR);
        grant_partner_cap(&gov_cap, PARTNER1_ADDR, partner_name, ctx(&mut scenario));
        
        next_tx(&mut scenario, PARTNER1_ADDR);
        let partner_cap = take_from_sender<PartnerCap>(&scenario);
        
        // PARTNER1 tries to revoke cap without gov_cap
        revoke_partner_cap(&gov_cap, partner_cap, ctx(&mut scenario));
        
        // Cleanup (won't reach)
        return_to_sender(&mut scenario, gov_cap);
        end_scenario(scenario);
    }
}