/// Module that manages capabilities for authorized partners.
module alpha_points::partner {
    use sui::object;
    use sui::transfer;
    use sui::tx_context;
    use sui::event;
    use std::string::String;
    
    use alpha_points::admin::GovernCap;
    
    /// Owned capability object for partners
    public struct PartnerCap has key, store {
        id: object::UID,
        partner_name: String
    }
    
    // Events
    public struct PartnerCapGranted has copy, drop {
        id: object::ID,
        partner_address: address,
        partner_name: String
    }
    
    public struct PartnerCapRevoked has copy, drop {
        id: object::ID,
        partner_name: String
    }
    
    public struct PartnerCapTransferred has copy, drop {
        id: object::ID,
        from: address,
        to: address,
        partner_name: String
    }
    
    // === Core module functions ===
    
    /// Creates PartnerCap, transfers to partner_address
    public entry fun grant_partner_cap(
        _gov_cap: &GovernCap,
        partner_address: address,
        name: String,
        ctx: &mut tx_context::TxContext
    ) {
        let id = object::new(ctx);
        
        // Create partner capability
        let partner_cap = PartnerCap {
            id,
            partner_name: name
        };
        
        // Emit event
        event::emit(PartnerCapGranted {
            id: object::uid_to_inner(&partner_cap.id),
            partner_address,
            partner_name: name
        });
        
        // Transfer to partner
        transfer::public_transfer(partner_cap, partner_address);
    }
    
    /// Destroys the partner capability
    public entry fun revoke_partner_cap(
        _gov_cap: &GovernCap,
        cap: PartnerCap,
        _ctx: &tx_context::TxContext
    ) {
        let PartnerCap {
            id,
            partner_name
        } = cap;
        
        // Emit event
        event::emit(PartnerCapRevoked {
            id: object::uid_to_inner(&id),
            partner_name
        });
        
        // Delete the object
        object::delete(id);
    }
    
    /// Transfers existing partner capability
    public entry fun transfer_partner_cap(
        cap: PartnerCap,
        to: address,
        ctx: &tx_context::TxContext
    ) {
        let from = tx_context::sender(ctx);
        
        // Emit event
        event::emit(PartnerCapTransferred {
            id: object::uid_to_inner(&cap.id),
            from,
            to,
            partner_name: cap.partner_name
        });
        
        // Transfer to new owner
        transfer::public_transfer(cap, to);
    }
    
    /// Returns the partner name
    public fun get_partner_name(cap: &PartnerCap): String {
        cap.partner_name
    }
}