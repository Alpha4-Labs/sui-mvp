/// Module that manages capabilities for authorized partners.
module alpha_points::partner {
    // use sui::object; // Removed as it's a duplicate alias provided by default
    // use sui::tx_context; // Removed as it's a duplicate alias provided by default
    use sui::event;
    use std::string::String;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use alpha_points::oracle::{Self, RateOracle};
    
    use alpha_points::admin::AdminCap;
    
    /// Event for when partner settings are updated
    public struct PartnerSettingsUpdated has copy, drop {
        partner_cap_id: object::ID,
        paused: bool,
        daily_quota_pts: u64
    }
    
    /// Owned capability object for partners
    public struct PartnerCap has key, store {
        id: object::UID,
        partner_name: String,
        paused: bool,
        daily_quota_pts: u64,
        mint_remaining_today: u64,
        collateral_value_usdc_at_creation: u64,
        last_epoch: u64
    }
    
    // Events
    public struct PartnerCapGranted has copy, drop {
        id: object::ID,
        partner_address: address,
        partner_name: String
    }
    
    public struct PartnerCapCreatedWithCollateral has copy, drop {
        id: object::ID,
        partner_address: address,
        partner_name: String,
        collateral_sui_amount: u64,
        collateral_value_usdc: u64,
        daily_quota_pts: u64
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
    
    // CONSTANTS
    const E_COLLATERAL_VALUE_ZERO: u64 = 101;
    const POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT: u64 = 1000; // Example: 1 USDC collateral value = 1000 daily points quota
    
    // === Core module functions ===
    
    /// Creates PartnerCap via collateral deposit (permissionless)
    /// The SUI collateral is consumed (burned) to activate the PartnerCap.
    public entry fun create_partner_cap_with_collateral(
        sui_collateral: Coin<SUI>,
        rate_oracle: &RateOracle,
        partner_name: String,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        let sui_collateral_amount = coin::value(&sui_collateral);

        // Use the oracle to get the value of SUI in USDC (or a base unit the oracle provides)
        // Assuming oracle::price_in_usdc converts the SUI amount to a USDC equivalent value.
        // The oracle.move currently has a placeholder for price_in_usdc, this will need actual implementation.
        let collateral_value_usdc = oracle::price_in_usdc(rate_oracle, sui_collateral_amount);
        assert!(collateral_value_usdc > 0, E_COLLATERAL_VALUE_ZERO);

        // Determine daily_quota_pts based on collateral_value_usdc
        let daily_quota = collateral_value_usdc * POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT;

        let cap_id = object::new(ctx);

        let partner_cap = PartnerCap {
            id: cap_id,
            partner_name: partner_name,
            paused: false,
            daily_quota_pts: daily_quota,
            mint_remaining_today: daily_quota,
            collateral_value_usdc_at_creation: collateral_value_usdc,
            last_epoch: current_epoch
        };

        event::emit(PartnerCapCreatedWithCollateral {
            id: object::uid_to_inner(&partner_cap.id),
            partner_address,
            partner_name: partner_name,
            collateral_sui_amount: sui_collateral_amount,
            collateral_value_usdc,
            daily_quota_pts: daily_quota
        });

        // Consume the SUI collateral by transferring it to the zero address (burn).
        transfer::public_transfer(sui_collateral, @0x0);

        transfer::public_transfer(partner_cap, partner_address);
    }
    
    /// Creates PartnerCap, transfers to partner_address
    public entry fun grant_partner_cap(
        _admin_cap: &AdminCap,
        partner_address: address,
        name: String,
        ctx: &mut tx_context::TxContext
    ) {
        let id = object::new(ctx);
        let current_epoch = tx_context::epoch(ctx);
        
        // Create partner capability
        let partner_cap = PartnerCap {
            id,
            partner_name: name,
            paused: false,
            daily_quota_pts: 0,
            mint_remaining_today: 0,
            collateral_value_usdc_at_creation: 0,
            last_epoch: current_epoch
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
        _admin_cap: &AdminCap,
        cap: PartnerCap,
        _ctx: &mut tx_context::TxContext
    ) {
        let PartnerCap {
            id,
            partner_name,
            collateral_value_usdc_at_creation: _collateral_value_usdc_at_creation,
            daily_quota_pts: _daily_quota_pts,
            mint_remaining_today: _mint_remaining_today,
            paused: _paused,
            last_epoch: _last_epoch
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
        ctx: &mut tx_context::TxContext
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
    
    /// Returns a reference to the UID (id) of the PartnerCap
    public fun get_id(cap: &PartnerCap): &object::UID {
        &cap.id
    }
    
    // Added for integration.move
    public fun get_paused(cap: &PartnerCap): bool {
        cap.paused
    }
    
    /// Returns the last epoch when mint_remaining_today was reset
    public fun get_last_epoch(cap: &PartnerCap): u64 {
        cap.last_epoch
    }
    
    /// Resets mint_remaining_today to daily_quota_pts and updates last_epoch
    public fun reset_mint_today_mut(partner: &mut PartnerCap, current_epoch: u64) {
        partner.mint_remaining_today = partner.daily_quota_pts;
        partner.last_epoch = current_epoch;
    }
    
    // Renamed and updated for integration.move (removed assertion)
    public fun decrease_mint_remaining_today_mut(partner: &mut PartnerCap, pts: u64) {
        if (partner.mint_remaining_today >= pts) {
            partner.mint_remaining_today = partner.mint_remaining_today - pts;
        } else {
            partner.mint_remaining_today = 0; // Prevent underflow
        };
    }
    
    public fun get_daily_quota_pts(partner: &PartnerCap): u64 {
        partner.daily_quota_pts
    }
    
    public fun get_mint_remaining_today(partner: &PartnerCap): u64 {
        partner.mint_remaining_today
    }
    
    // Admin function to set partner pause status
    public entry fun set_partner_paused(
        _admin_cap: &AdminCap,
        cap: &mut PartnerCap,
        paused_status: bool,
        _ctx: &mut tx_context::TxContext // Context for event emission or future use
    ) {
        cap.paused = paused_status;
        event::emit(PartnerSettingsUpdated {
            partner_cap_id: object::uid_to_inner(&cap.id),
            paused: cap.paused,
            daily_quota_pts: cap.daily_quota_pts
        });
    }
    
    // Admin function to set partner daily quota
    public entry fun set_partner_daily_quota(
        _admin_cap: &AdminCap,
        cap: &mut PartnerCap,
        new_quota: u64,
        _ctx: &mut tx_context::TxContext // Context for event emission or future use
    ) {
        cap.daily_quota_pts = new_quota;
        // Optionally reset mint_remaining_today if quota changes, or handle as needed
        // For now, just updating the quota.
        // cap.mint_remaining_today = new_quota; // Example: reset remaining if quota increases
        event::emit(PartnerSettingsUpdated {
            partner_cap_id: object::uid_to_inner(&cap.id),
            paused: cap.paused,
            daily_quota_pts: cap.daily_quota_pts
        });
    }
}