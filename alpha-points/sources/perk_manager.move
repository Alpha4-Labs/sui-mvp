/// Module for managing Perk Definitions and Claims by users.
module alpha_points::perk_manager {
    use std::string::{Self, String};
    use sui::dynamic_field::{Self as df};
    use sui::event;
    use sui::clock;
    use alpha_points::ledger;
    use alpha_points::partner_flex;
    use alpha_points::oracle;

    // === Error Constants ===
    const EInvalidRevenueSplitPercentage: u64 = 101;
    const EPerkNotActive: u64 = 102;
    const EMaxClaimsReached: u64 = 103;
    const ENotPerkCreator: u64 = 104;
    const EWrongPerkDefinition: u64 = 108;
    const EPerkNotConsumable: u64 = 109;
    const EMaxUsesReachedOnPerk: u64 = 110;
    const E_TOO_MANY_TAGS: u64 = 111;
    const E_PERK_TYPE_NOT_ALLOWED: u64 = 112;
    const E_PERK_TYPE_BLACKLISTED: u64 = 113;
    const E_COST_EXCEEDS_LIMIT: u64 = 114;
    const E_INVALID_REVENUE_SHARE: u64 = 115;
    const E_CONSUMABLE_PERKS_DISABLED: u64 = 116;
    const E_EXPIRING_PERKS_DISABLED: u64 = 117;
    const E_UNIQUE_METADATA_DISABLED: u64 = 118;
    const E_TAG_NOT_ALLOWED: u64 = 119;
    const E_TAG_BLACKLISTED: u64 = 120;
    const E_MAX_CLAIMS_EXCEEDS_LIMIT: u64 = 121;
    const E_MAX_PERKS_REACHED: u64 = 122;

    // Address for the platform's share of revenue.
    // TODO: Consider making this configurable via an AdminCap-controlled object in future.
    const PLATFORM_RECIPIENT_ADDRESS: address = @0xDEADBEEF; // Replace with actual platform address

    // === Structs ===

    /// Defines the revenue split policy for a perk.
    public struct RevenueSplitPolicy has store, copy, drop {
        partner_share_percentage: u8,   // e.g., 90 for 90%
        platform_share_percentage: u8,  // e.g., 10 for 10%
        partner_recipient_address: address, // Address of the partner to receive their share
        platform_recipient_address: address // Address for the platform's share
    }

    /// Defines a perk that partners can create and users can claim.
    public struct PerkDefinition has key, store {
        id: sui::object::UID,
        name: String,
        description: String,
        creator_partner_cap_id: sui::object::ID,
        perk_type: String,
        usdc_price: u64,                    // Price in USDC (e.g., 1000 = $10.00)
        current_alpha_points_price: u64,     // Current price in Alpha Points (dynamically updated)
        last_price_update_timestamp_ms: u64, // When the Alpha Points price was last updated
        revenue_split_policy: RevenueSplitPolicy,
        max_claims: std::option::Option<u64>,
        total_claims_count: u64,
        is_active: bool,
        definition_metadata_id: sui::object::ID,
        generates_unique_claim_metadata: bool,
        max_uses_per_claim: std::option::Option<u64>,
        expiration_timestamp_ms: std::option::Option<u64>,
        tags: vector<String>,
        tag_metadata_id: sui::object::ID
    }

    /// Represents an instance of a perk claimed by a user.
    public struct ClaimedPerk has key, store {
        id: sui::object::UID,
        perk_definition_id: sui::object::ID,     // Links to the PerkDefinition
        owner: address,             // The user who claimed/owns this instance
        claim_timestamp_ms: u64,
        status: String,             // e.g., "ACTIVE", "FULLY_CONSUMED", "EXPIRED"
        // Optional: ID of a DynamicObject for claim-instance specific data,
        // e.g., a unique generated discount code.
        claim_specific_metadata_id: std::option::Option<sui::object::ID>,
        // New field for consumable perks
        remaining_uses: std::option::Option<u64> // Tracks uses if perk_definition.max_uses_per_claim is Some
    }

    // Object to store definition metadata as dynamic fields - needs to be public if used across modules or in signatures in certain ways
    public struct DefinitionMetadataStore has key, store {
        id: sui::object::UID,
        // Marker field, can be anything simple or even just rely on ID
        marker: bool
    }

    // Object to store claim-specific metadata if generated - needs to be public
    public struct ClaimSpecificMetadataStore has key, store {
        id: sui::object::UID,
        marker: bool
    }

    // New struct for tag metadata
    public struct TagMetadataStore has key, store {
        id: sui::object::UID,
        marker: bool
    }

    // === Events ===

    public struct PerkDefinitionCreated has copy, drop {
        perk_definition_id: sui::object::ID,
        creator_partner_cap_id: sui::object::ID,
        name: String,
        perk_type: String,
        cost_alpha_points: u64
    }

    public struct PerkClaimed has copy, drop {
        claimed_perk_id: sui::object::ID,
        perk_definition_id: sui::object::ID,
        user_address: address,
        partner_cap_id: sui::object::ID, // Creator partner cap
        cost_alpha_points: u64,
        partner_points_share: u64,
        platform_points_share: u64
    }

    public struct ClaimedPerkStatusUpdated has copy, drop {
        claimed_perk_id: sui::object::ID,
        perk_definition_id: sui::object::ID,
        new_status: String
    }

    public struct PerkDefinitionActivityUpdated has copy, drop {
        perk_definition_id: sui::object::ID,
        is_active: bool
    }

    public struct PerkDefinitionSettingsUpdated has copy, drop {
        perk_definition_id: sui::object::ID,
        updated_by_partner_cap_id: sui::object::ID,
        new_max_uses_per_claim: std::option::Option<u64>,
        new_expiration_timestamp_ms: std::option::Option<u64>
        // new_blacklist_id: Option<ID> // If blacklist feature is added
    }

    // New event for tag updates
    public struct PerkTagsUpdated has copy, drop {
        perk_definition_id: sui::object::ID,
        updated_by_partner_cap_id: sui::object::ID,
        new_tags: vector<String>
    }

    // New event for price updates
    public struct PerkPriceUpdated has copy, drop {
        perk_definition_id: sui::object::ID,
        usdc_price: u64,
        new_alpha_points_price: u64,
        timestamp_ms: u64
    }

    // New event for enhanced revenue split
    public struct PerkClaimedWithTVLReinvestment has copy, drop {
        claimed_perk_id: sui::object::ID,
        perk_definition_id: sui::object::ID,
        user_address: address,
        partner_cap_id: sui::object::ID,
        total_cost_alpha_points: u64,
        producer_direct_share: u64,        // 70% to producer
        tvl_reinvestment_share: u64,       // 20% reinvested in TVL
        deployer_share: u64,               // 10% to deployer
        tvl_increase_usdc: u64             // USDC value added to partner's TVL
    }

    // === Core Functions ===

    /// Creates a new PerkDefinition with USDC-based pricing.
    public entry fun create_perk_definition(
        partner_cap: &mut partner_flex::PartnerCapFlex,
        rate_oracle: &oracle::RateOracle,
        name: String,
        description: String,
        perk_type: String,
        usdc_price: u64,
        partner_share_percentage: u8,
        max_uses_per_claim: std::option::Option<u64>,
        expiration_timestamp_ms: std::option::Option<u64>,
        generates_unique_claim_metadata: bool,
        tags: vector<String>,
        max_claims: std::option::Option<u64>,
        initial_definition_metadata_keys: vector<String>,
        initial_definition_metadata_values: vector<String>,
        is_active: bool,
        clock_obj: &clock::Clock,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let control_settings = partner_flex::get_perk_control_settings(partner_cap);
        let (rate, decimals) = oracle::get_rate(rate_oracle);
        let initial_alpha_points_price = oracle::convert_asset_to_points(usdc_price, rate, decimals);
        let current_time = clock::timestamp_ms(clock_obj);

        // Check perk type restrictions
        assert!(
            std::vector::is_empty(partner_flex::get_allowed_perk_types(control_settings)) || 
            std::vector::contains(partner_flex::get_allowed_perk_types(control_settings), &perk_type),
            E_PERK_TYPE_NOT_ALLOWED
        );
        assert!(
            !std::vector::contains(partner_flex::get_blacklisted_perk_types(control_settings), &perk_type),
            E_PERK_TYPE_BLACKLISTED
        );

        // Check cost limit
        assert!(initial_alpha_points_price <= partner_flex::get_max_cost_per_perk(control_settings), E_COST_EXCEEDS_LIMIT);

        // Check revenue share limits
        assert!(
            partner_share_percentage >= partner_flex::get_min_partner_share_percentage(control_settings) &&
            partner_share_percentage <= partner_flex::get_max_partner_share_percentage(control_settings),
            E_INVALID_REVENUE_SHARE
        );

        // Check feature flags
        if (std::option::is_some(&max_uses_per_claim)) {
            assert!(partner_flex::get_allow_consumable_perks(control_settings), E_CONSUMABLE_PERKS_DISABLED);
        };
        if (std::option::is_some(&expiration_timestamp_ms)) {
            assert!(partner_flex::get_allow_expiring_perks(control_settings), E_EXPIRING_PERKS_DISABLED);
        };
        if (generates_unique_claim_metadata) {
            assert!(partner_flex::get_allow_unique_metadata(control_settings), E_UNIQUE_METADATA_DISABLED);
        };

        // Validate tags against master control
        let mut i = 0;
        let tags_len = std::vector::length(&tags);
        while (i < tags_len) {
            let tag = std::vector::borrow(&tags, i);
            assert!(
                std::vector::is_empty(partner_flex::get_allowed_tags(control_settings)) || 
                std::vector::contains(partner_flex::get_allowed_tags(control_settings), tag),
                E_TAG_NOT_ALLOWED
            );
            assert!(
                !std::vector::contains(partner_flex::get_blacklisted_tags(control_settings), tag),
                E_TAG_BLACKLISTED
            );
            i = i + 1;
        };

        // Check max claims limit
        if (std::option::is_some(&max_claims)) {
            let max_claims_val = *std::option::borrow(&max_claims);
            assert!(max_claims_val <= partner_flex::get_max_claims_per_perk(control_settings), E_MAX_CLAIMS_EXCEEDS_LIMIT);
        };

        // Check total perks limit
        assert!(
            partner_flex::get_total_perks_created(partner_cap) < partner_flex::get_max_perks_per_partner(control_settings),
            E_MAX_PERKS_REACHED
        );

        let partner_cap_owner_address = sui::tx_context::sender(ctx);
        assert!(partner_share_percentage <= 100, EInvalidRevenueSplitPercentage);
        let platform_share_percentage = 100 - partner_share_percentage;

        let policy = RevenueSplitPolicy {
            partner_share_percentage,
            platform_share_percentage,
            partner_recipient_address: partner_cap_owner_address,
            platform_recipient_address: PLATFORM_RECIPIENT_ADDRESS
        };

        // Create and populate the dynamic object for definition metadata
        let mut metadata_store = DefinitionMetadataStore { id: sui::object::new(ctx), marker: true };
        let metadata_store_uid_mut_ref = &mut metadata_store.id;

        let mut i = 0;
        assert!(std::vector::length(&initial_definition_metadata_keys) == std::vector::length(&initial_definition_metadata_values), 0);
        let metadata_len = std::vector::length(&initial_definition_metadata_keys); 
        while (i < metadata_len) {
            let key = *std::vector::borrow(&initial_definition_metadata_keys, i);
            let value = *std::vector::borrow(&initial_definition_metadata_values, i);
            df::add(metadata_store_uid_mut_ref, key, value);
            i = i + 1;
        };
        let definition_metadata_object_id = sui::object::id(&metadata_store);
        sui::transfer::public_share_object(metadata_store);

        // Create tag metadata store
        let tag_metadata_store = TagMetadataStore { id: sui::object::new(ctx), marker: true };
        let tag_metadata_object_id = sui::object::id(&tag_metadata_store);
        sui::transfer::public_share_object(tag_metadata_store);

        let perk_def_uid = sui::object::new(ctx);
        let new_perk_definition_id_val = sui::object::uid_to_inner(&perk_def_uid);

        let perk_definition = PerkDefinition {
            id: perk_def_uid,
            name: name,
            description: description,
            creator_partner_cap_id: sui::object::id(partner_cap),
            perk_type: perk_type,
            usdc_price: usdc_price,
            current_alpha_points_price: initial_alpha_points_price,
            last_price_update_timestamp_ms: current_time,
            revenue_split_policy: policy,
            max_claims: max_claims,
            total_claims_count: 0,
            is_active: is_active,
            definition_metadata_id: definition_metadata_object_id,
            generates_unique_claim_metadata,
            max_uses_per_claim: max_uses_per_claim,
            expiration_timestamp_ms: expiration_timestamp_ms,
            tags: tags,
            tag_metadata_id: tag_metadata_object_id
        };

        event::emit(PerkDefinitionCreated {
            perk_definition_id: new_perk_definition_id_val,
            creator_partner_cap_id: sui::object::id(partner_cap),
            name: perk_definition.name,
            perk_type: perk_definition.perk_type,
            cost_alpha_points: initial_alpha_points_price
        });
        
        // Record that a perk has been created
        partner_flex::record_perk_created(partner_cap, ctx);
        
        sui::transfer::share_object(perk_definition);
    }

    /// Updates the Alpha Points price of a perk based on current exchange rates.
    public entry fun update_perk_price(
        perk_definition: &mut PerkDefinition,
        rate_oracle: &oracle::RateOracle,
        clock_obj: &clock::Clock,
        _ctx: &mut sui::tx_context::TxContext
    ) {
        let current_time = clock::timestamp_ms(clock_obj);
        let (rate, decimals) = oracle::get_rate(rate_oracle);
        let new_alpha_points_price = oracle::convert_asset_to_points(perk_definition.usdc_price, rate, decimals);
        
        perk_definition.current_alpha_points_price = new_alpha_points_price;
        perk_definition.last_price_update_timestamp_ms = current_time;

        event::emit(PerkPriceUpdated {
            perk_definition_id: sui::object::id(perk_definition),
            usdc_price: perk_definition.usdc_price,
            new_alpha_points_price: new_alpha_points_price,
            timestamp_ms: current_time
        });
    }

    /// Allows a user to claim a perk using the current Alpha Points price.
    /// Now implements 70/20/10 revenue split with TVL reinvestment
    public entry fun claim_perk(
        perk_definition: &mut PerkDefinition,
        partner_cap: &mut partner_flex::PartnerCapFlex, // Added to access partner's TVL and quotas
        ledger: &mut ledger::Ledger,
        rate_oracle: &oracle::RateOracle,  // Added for price validation and TVL conversion
        clock_obj: &clock::Clock, // Fixed parameter type
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(perk_definition.is_active, EPerkNotActive);

        // Verify the partner cap matches the perk creator
        assert!(sui::object::id(partner_cap) == perk_definition.creator_partner_cap_id, ENotPerkCreator);

        // Update price if needed (e.g., if price is too old)
        let current_time = clock::timestamp_ms(clock_obj); // Fixed clock usage
        if (current_time - perk_definition.last_price_update_timestamp_ms > PRICE_UPDATE_THRESHOLD_MS) {
            update_perk_price(perk_definition, rate_oracle, clock_obj, ctx); // Fixed function call
        };

        if (std::option::is_some(&perk_definition.max_claims)) {
            assert!(perk_definition.total_claims_count < *std::option::borrow(&perk_definition.max_claims), EMaxClaimsReached);
        };

        let user_address = sui::tx_context::sender(ctx);
        let cost = perk_definition.current_alpha_points_price;

        // NEW: Check partner's minting quota and throttle limits
        let current_epoch = sui::tx_context::epoch(ctx);
        partner_flex::reset_daily_mint_throttle(partner_cap, current_epoch);
        
        // Validate partner can mint the points they'll receive (70% of cost)
        let partner_share_70_percent = (cost * 70) / 100;
        partner_flex::validate_mint_quota(partner_cap, partner_share_70_percent, current_epoch, ctx);

        // 1. Spend user's points
        ledger::internal_spend(ledger, user_address, cost, ctx);

        // 2. NEW REVENUE SPLIT: 70% to producer, 20% to TVL reinvestment, 10% to deployer
        let producer_direct_share = (cost * 70) / 100;  // 70% directly to producer
        let tvl_reinvestment_share = (cost * 20) / 100; // 20% reinvested in partner's TVL
        let deployer_share = cost - producer_direct_share - tvl_reinvestment_share; // 10% to deployer

        // 3. Earn points for producer and deployer (TVL reinvestment handled separately)
        let policy = &perk_definition.revenue_split_policy;
        ledger::internal_earn(ledger, policy.partner_recipient_address, producer_direct_share, ctx);
        ledger::internal_earn(ledger, policy.platform_recipient_address, deployer_share, ctx);

        // 4. NEW: Reinvest the 20% share into partner's TVL
        partner_flex::reinvest_perk_revenue_alpha_points(partner_cap, tvl_reinvestment_share, rate_oracle, ctx);

        // 5. Record the minting against partner's quota
        partner_flex::record_points_minted(partner_cap, producer_direct_share, current_epoch, ctx);

        // 6. Update PerkDefinition stats
        perk_definition.total_claims_count = perk_definition.total_claims_count + 1;

        // 7. Create ClaimedPerk object
        let claimed_perk_uid = sui::object::new(ctx);
        let mut claim_specific_id_option = std::option::none();
        let initial_remaining_uses = perk_definition.max_uses_per_claim;

        if (perk_definition.generates_unique_claim_metadata) {
            let claim_metadata_store = ClaimSpecificMetadataStore { id: sui::object::new(ctx), marker: true };
            let claim_metadata_object_id = sui::object::id(&claim_metadata_store);
            sui::transfer::public_share_object(claim_metadata_store);
            claim_specific_id_option = std::option::some(claim_metadata_object_id);
        };

        let claimed_perk = ClaimedPerk {
            id: claimed_perk_uid,
            perk_definition_id: sui::object::id(perk_definition),
            owner: user_address,
            claim_timestamp_ms: clock::timestamp_ms(clock_obj),
            status: string::utf8(b"ACTIVE"),
            claim_specific_metadata_id: claim_specific_id_option,
            remaining_uses: initial_remaining_uses
        };

        event::emit(PerkClaimedWithTVLReinvestment {
            claimed_perk_id: sui::object::id(&claimed_perk),
            perk_definition_id: sui::object::id(perk_definition),
            user_address: user_address,
            partner_cap_id: perk_definition.creator_partner_cap_id,
            total_cost_alpha_points: cost,
            producer_direct_share: producer_direct_share,
            tvl_reinvestment_share: tvl_reinvestment_share,
            deployer_share: deployer_share,
            tvl_increase_usdc: oracle::price_in_usdc(rate_oracle, tvl_reinvestment_share)
        });

        // Keep original event for backward compatibility
        event::emit(PerkClaimed {
            claimed_perk_id: sui::object::id(&claimed_perk),
            perk_definition_id: sui::object::id(perk_definition),
            user_address: user_address,
            partner_cap_id: perk_definition.creator_partner_cap_id,
            cost_alpha_points: cost,
            partner_points_share: producer_direct_share, // Updated to reflect new split
            platform_points_share: deployer_share // Updated to reflect new split
        });

        // 8. Transfer ClaimedPerk to the user
        sui::transfer::public_transfer(claimed_perk, user_address);
    }

    /// Updates the status of a claimed perk.
    /// Authorization for who can call this needs to be defined (e.g., perk creator, admin, or user for self-service status changes).
    public entry fun update_claimed_perk_status(
        creator_partner_cap: &partner_flex::PartnerCapFlex, // Changed from PartnerCap to PartnerCapFlex
        claimed_perk: &mut ClaimedPerk,
        perk_definition: &PerkDefinition,
        new_status: String,
        _ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(sui::object::id(perk_definition) == claimed_perk.perk_definition_id, EWrongPerkDefinition);
        assert!(sui::object::id(creator_partner_cap) == perk_definition.creator_partner_cap_id, ENotPerkCreator);

        claimed_perk.status = new_status;

        event::emit(ClaimedPerkStatusUpdated {
            claimed_perk_id: sui::object::id(claimed_perk),
            perk_definition_id: claimed_perk.perk_definition_id,
            new_status: claimed_perk.status
        });
    }

    /// Allows the creator of a PerkDefinition to activate or deactivate it.
    public entry fun set_perk_definition_active_status(
        partner_cap: &partner_flex::PartnerCapFlex, // Changed from PartnerCap to PartnerCapFlex
        perk_definition: &mut PerkDefinition,
        is_active: bool,
        _ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(sui::object::id(partner_cap) == perk_definition.creator_partner_cap_id, ENotPerkCreator);

        perk_definition.is_active = is_active;

        event::emit(PerkDefinitionActivityUpdated {
            perk_definition_id: sui::object::id(perk_definition),
            is_active: perk_definition.is_active
        });
    }

    /// Allows the creator of a PerkDefinition to update its settings.
    public entry fun update_perk_definition_settings(
        partner_cap: &partner_flex::PartnerCapFlex, // Changed from PartnerCap to PartnerCapFlex
        perk_definition: &mut PerkDefinition,
        new_max_uses_per_claim: std::option::Option<u64>,
        new_expiration_timestamp_ms: std::option::Option<u64>,
        _ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(sui::object::id(partner_cap) == perk_definition.creator_partner_cap_id, ENotPerkCreator);

        perk_definition.max_uses_per_claim = new_max_uses_per_claim;
        perk_definition.expiration_timestamp_ms = new_expiration_timestamp_ms;

        event::emit(PerkDefinitionSettingsUpdated {
            perk_definition_id: sui::object::id(perk_definition),
            updated_by_partner_cap_id: sui::object::id(partner_cap),
            new_max_uses_per_claim: perk_definition.max_uses_per_claim,
            new_expiration_timestamp_ms: perk_definition.expiration_timestamp_ms
        });
    }

    /// Allows a user or authorized entity to record a "use" of a consumable perk.
    public entry fun consume_perk_use(
        claimed_perk: &mut ClaimedPerk,
        perk_definition: &PerkDefinition, // To check if it's consumable
        // Potentially authorization here: e.g., partner_cap or user themselves if self-service consumption
        _ctx: &mut sui::tx_context::TxContext // For event emission or future authorization - marked unused by compiler
    ) {
        assert!(sui::object::id(perk_definition) == claimed_perk.perk_definition_id, EWrongPerkDefinition);
        // Potentially check tx_context::sender(ctx) for authorization if needed.

        assert!(std::option::is_some(&claimed_perk.remaining_uses), EPerkNotConsumable); // Custom error needed
        let remaining = std::option::borrow_mut(&mut claimed_perk.remaining_uses);
        assert!(*remaining > 0, EMaxUsesReachedOnPerk); // Use new error EMaxUsesReachedOnPerk
        
        *remaining = *remaining - 1;

        if (*remaining == 0) {
            claimed_perk.status = string::utf8(b"FULLY_CONSUMED");
        }
        // Event for consumption could be added here.
    }

    /// Updates the tags of a perk definition.
    public entry fun update_perk_tags(
        partner_cap: &partner_flex::PartnerCapFlex,
        perk_definition: &mut PerkDefinition,
        new_tags: vector<String>,
        _ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(sui::object::id(partner_cap) == perk_definition.creator_partner_cap_id, ENotPerkCreator);
        assert!(std::vector::length(&new_tags) <= 5, E_TOO_MANY_TAGS);

        perk_definition.tags = new_tags;

        event::emit(PerkTagsUpdated {
            perk_definition_id: sui::object::id(perk_definition),
            updated_by_partner_cap_id: sui::object::id(partner_cap),
            new_tags: perk_definition.tags
        });
    }

    // --- Helper / View Functions (Example) ---

    public fun get_perk_definition_details(perk_def: &PerkDefinition): (String, String, u64, bool, std::option::Option<u64>, std::option::Option<u64>) {
        (
            perk_def.name,
            perk_def.description,
            perk_def.current_alpha_points_price,
            perk_def.is_active,
            perk_def.max_uses_per_claim,      // Added
            perk_def.expiration_timestamp_ms // Added
        )
    }

    public fun get_claimed_perk_status(claimed_perk: &ClaimedPerk): String {
        claimed_perk.status
    }

    public fun get_claimed_perk_remaining_uses(claimed_perk: &ClaimedPerk): std::option::Option<u64> {
        claimed_perk.remaining_uses
    }

    // New helper functions for tags
    public fun get_perk_tags(perk_def: &PerkDefinition): &vector<String> {
        &perk_def.tags
    }

    public fun has_tag(perk_def: &PerkDefinition, tag: &String): bool {
        let tags = &perk_def.tags;
        let mut i = 0;
        let len = std::vector::length(tags);
        while (i < len) {
            if (std::string::as_bytes(std::vector::borrow(tags, i)) == std::string::as_bytes(tag)) {
                return true
            };
            i = i + 1;
        };
        false
    }

    // New constants
    const PRICE_UPDATE_THRESHOLD_MS: u64 = 3600000; // 1 hour in milliseconds

    // New helper functions
    public fun get_current_price(perk_def: &PerkDefinition): (u64, u64) {
        (perk_def.usdc_price, perk_def.current_alpha_points_price)
    }

    public fun get_last_price_update(perk_def: &PerkDefinition): u64 {
        perk_def.last_price_update_timestamp_ms
    }
} 