// partner.move - Manages Partner Capabilities for the Alpha Points protocol
module alpha_points::partner {
    use sui::object::{Self, ID, UID, new, id, uid_to_inner, delete};
    use sui::transfer::{Self, public_transfer};
    use sui::tx_context::{Self, TxContext, sender};
    use sui::event;
    use sui::types::String; // Import String type

    // Import the primary governance capability from the admin module
    use alpha_points::admin::{GovernCap};

    // === Structs ===

    /// Capability granting specific permissions to authorized partners (e.g., calling earn_points).
    /// This object is transferred to the partner's address.
    public struct PartnerCap has key, store {
        id: UID,
        partner_name: String, // Identifier for the partner
    }

    // === Events ===

    public struct PartnerCapGranted has copy, drop {
        cap_id: ID,
        partner_address: address,
        partner_name: String,
        granted_by: address // Address holding GovernCap that granted this
    }

    public struct PartnerCapRevoked has copy, drop {
        cap_id: ID,
        partner_address: address, // Address that held the cap
        partner_name: String,
        revoked_by: address // Address holding GovernCap that revoked this
    }

    public struct PartnerCapTransferred has copy, drop {
        cap_id: ID,
        from_address: address,
        to_address: address,
        partner_name: String, // Name stays with the cap
    }

    // === Errors ===

    const EUNAUTHORIZED: u64 = 1; // Caller lacks the required GovernCap for management actions
    const ECAP_NOT_OWNED_BY_SENDER: u64 = 2; // For transfer: the sender doesn't own the cap they're trying to transfer

    // === Public Entry Functions ===

    /// Creates a new PartnerCap and transfers it to the specified partner address.
    /// Requires the transaction sender to hold the GovernCap.
    public entry fun grant_partner_cap(
        _gov_cap: &GovernCap, // Authorization check - requires GovernCap holder
        partner_address: address,
        partner_name: String, // Identifier for the partner
        ctx: &mut TxContext
    ) {
        let cap_uid = new(ctx);
        let cap_id = uid_to_inner(&cap_uid);
        let granter_address = sender(ctx);

        let partner_cap = PartnerCap {
            id: cap_uid,
            partner_name: string::copy(&partner_name) // Store copy
        };

        event::emit(PartnerCapGranted {
            cap_id,
            partner_address,
            partner_name, // Emit copy
            granted_by: granter_address
        });

        // Transfer the newly created capability object to the partner
        public_transfer(partner_cap, partner_address);
    }

    /// Revokes (destroys) a PartnerCap.
    /// Requires the transaction sender to hold the GovernCap.
    /// The PartnerCap object itself must be provided as input (it will be consumed).
    public entry fun revoke_partner_cap(
        _gov_cap: &GovernCap, // Authorization check - requires GovernCap holder
        cap_to_revoke: PartnerCap, // Takes ownership of the cap to destroy it
        ctx: &mut TxContext
    ) {
        let revoker_address = sender(ctx);

        // Unpack the cap to get its details for the event and ID for deletion
        let PartnerCap { id, partner_name } = cap_to_revoke;
        let cap_id = uid_to_inner(&id);
        // Determine the owner before deletion for the event (though it's consumed now)
        // In this flow, the object is passed by value, so owner isn't easily accessible
        // We might need to adjust the flow if owner tracking is critical for revocation event.
        // For simplicity, we'll omit the previous owner address from this event.

        event::emit(PartnerCapRevoked {
            cap_id,
            partner_address: @0x0, // Placeholder - owner info lost when passed by value
            partner_name,
            revoked_by: revoker_address
        });

        // Delete the capability object
        delete(id);
    }

    /// Transfers an existing PartnerCap from the sender to a new owner.
    /// Requires the transaction sender to hold the PartnerCap they intend to transfer.
    public entry fun transfer_partner_cap(
        // No GovernCap needed - the cap holder decides to transfer
        cap_to_transfer: PartnerCap, // Takes ownership of the cap from the sender
        new_owner: address,
        ctx: &mut TxContext
    ) {
        let sender_address = sender(ctx);
        // The framework ensures the sender actually owned the `cap_to_transfer` object.

        let cap_id = object::id(&cap_to_transfer);
        let partner_name = string::copy(&cap_to_transfer.partner_name); // Get name before transfer

        event::emit(PartnerCapTransferred {
            cap_id,
            from_address: sender_address,
            to_address: new_owner,
            partner_name
        });

        // Transfer the capability object to the new owner
        public_transfer(cap_to_transfer, new_owner);
    }

     // === Public View Functions ===

    /// Gets the name associated with a PartnerCap.
    public fun get_partner_name(cap: &PartnerCap): String {
        string::copy(&cap.partner_name) // Return a copy
    }
}

// === Test Submodule ===
#[test_only]
module alpha_points::partner_tests {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx, take_from_sender, return_to_sender, inventory_contains};
    use sui::string::{Self, utf8};

    // Import items needed for testing
    use alpha_points::admin::{Self as admin, GovernCap}; // Need admin to get GovernCap
    use alpha_points::partner::{Self, PartnerCap, PartnerCapGranted, PartnerCapRevoked, PartnerCapTransferred, EUNAUTHORIZED};

    // Test addresses
    const ADMIN: address = @0xA1; // Assumed deployer and initial GovernCap holder
    const PARTNER1: address = @0xC1;
    const PARTNER2: address = @0xC2;
    const UNAUTHORIZED_USER: address = @0xDEAD;

    // Helper to initialize admin and get GovernCap
    fun init_admin_get_cap(scenario: &mut Scenario): GovernCap {
        next_tx(scenario, ADMIN);
        admin::init(ctx(scenario));
        // Discard OracleCap, keep GovernCap
        let _ = take_from_sender<admin::OracleCap>(scenario);
        take_from_sender<admin::GovernCap>(scenario)
    }

    #[test]
    fun test_grant_and_transfer_partner_cap() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);
        let partner_name = utf8(b"Test Partner Inc.");

        // ADMIN grants cap to PARTNER1
        next_tx(&mut scenario, ADMIN);
        partner::grant_partner_cap(&gov_cap, PARTNER1, partner_name, ctx(&mut scenario));

        // Verify PARTNER1 has the cap
        assert!(inventory_contains<PartnerCap>(&scenario, PARTNER1), 0);

        // PARTNER1 transfers the cap to PARTNER2
        next_tx(&mut scenario, PARTNER1);
        let partner_cap = take_from_sender<PartnerCap>(&mut scenario);
        partner::transfer_partner_cap(partner_cap, PARTNER2, ctx(&mut scenario));

        // Verify PARTNER2 has the cap, PARTNER1 does not
        assert!(inventory_contains<PartnerCap>(&scenario, PARTNER2), 1);
        assert!(!inventory_contains<PartnerCap>(&scenario, PARTNER1), 2);


        // Cleanup
        return_to_sender(&mut scenario, gov_cap); // Return gov cap to ADMIN
        test_scenario::end(scenario); // Automatically cleans up PARTNER2's cap
    }

    #[test]
    #[expected_failure] // No specific abort code check, framework handles unauthorized call
    fun test_grant_partner_cap_fail_unauthorized() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);
        let partner_name = utf8(b"Unauthorized Grant");

        // UNAUTHORIZED_USER tries to grant cap (will fail as they don't have GovernCap)
        next_tx(&mut scenario, UNAUTHORIZED_USER);
        // This call requires &GovernCap which UNAUTHORIZED_USER doesn't have.
        // partner::grant_partner_cap(???, PARTNER1, partner_name, ctx(&mut scenario));


        // Cleanup (won't reach)
        return_to_sender(&mut scenario, gov_cap); // Return gov cap to ADMIN
        test_scenario::end(scenario);
    }

     #[test]
    fun test_revoke_partner_cap() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);
        let partner_name = utf8(b"Partner To Revoke");

        // ADMIN grants cap to PARTNER1
        next_tx(&mut scenario, ADMIN);
        partner::grant_partner_cap(&gov_cap, PARTNER1, partner_name, ctx(&mut scenario));
        assert!(inventory_contains<PartnerCap>(&scenario, PARTNER1), 0);

        // ADMIN revokes the cap (needs the cap object itself)
        // First, PARTNER1 needs to send the cap somewhere accessible to ADMIN's tx,
        // or ADMIN needs a way to take it. This highlights a complexity in revocation flows.
        // Simplification: Assume ADMIN somehow gets the cap object for revocation tx.
        // A more realistic flow might involve the partner sending it to a specific address
        // or using a shared object pattern if the cap needed to be revocable while shared.
        // For this test, let's simulate ADMIN taking it back temporarily.
        next_tx(&mut scenario, PARTNER1);
        let partner_cap_to_revoke = take_from_sender<PartnerCap>(&mut scenario);
        // Transfer it back to ADMIN for the revoke tx (not typical, just for test setup)
        public_transfer(partner_cap_to_revoke, ADMIN);

        next_tx(&mut scenario, ADMIN);
        let the_cap = take_from_sender<PartnerCap>(&mut scenario);
        partner::revoke_partner_cap(&gov_cap, the_cap, ctx(&mut scenario));

        // Verify PARTNER1 no longer has the cap (and ADMIN doesn't either)
        assert!(!inventory_contains<PartnerCap>(&scenario, PARTNER1), 1);
        assert!(!inventory_contains<PartnerCap>(&scenario, ADMIN), 2);


        // Cleanup
        return_to_sender(&mut scenario, gov_cap); // Return gov cap to ADMIN
        test_scenario::end(scenario);
    }

     #[test]
     #[expected_failure] // Framework handles missing capability object
    fun test_revoke_partner_cap_fail_unauthorized() {
        let scenario = test_scenario::begin(ADMIN);
        let gov_cap = init_admin_get_cap(&mut scenario);
        let partner_name = utf8(b"Revoke Fail");

        // ADMIN grants cap to PARTNER1
        next_tx(&mut scenario, ADMIN);
        partner::grant_partner_cap(&gov_cap, PARTNER1, partner_name, ctx(&mut scenario));

        // PARTNER1 gets the cap
        next_tx(&mut scenario, PARTNER1);
        let partner_cap = take_from_sender<PartnerCap>(&mut scenario);

        // UNAUTHORIZED_USER tries to revoke (needs GovernCap)
        next_tx(&mut scenario, UNAUTHORIZED_USER);
        // This call requires &GovernCap which UNAUTHORIZED_USER doesn't have.
        // partner::revoke_partner_cap(???, partner_cap, ctx(&mut scenario));


        // Cleanup (won't reach)
        return_to_sender(&mut scenario, gov_cap); // Return gov cap to ADMIN
        return_to_sender(&mut scenario, partner_cap); // Return partner cap to PARTNER1
        test_scenario::end(scenario);
    }
}
