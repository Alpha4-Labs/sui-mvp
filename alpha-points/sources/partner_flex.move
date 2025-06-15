/// Module that manages flexible partner capabilities with locked collateral and yield options.
/// Version: 1.0.0
#[allow(unused_use)]
module alpha_points::partner_flex {
    use std::string::String;
    use std::type_name;
    // use std::option; // Removed, module 'option' alias provided by default

    // use sui::object; // Removed, module 'object' alias provided by default
    // use sui::tx_context; // Removed, module 'tx_context' alias provided by default
    use sui::event;
    use sui::coin;
    use sui::coin::Coin;
    use sui::sui::SUI;
    use sui::balance;
    use sui::balance::Balance;

    use alpha_points::oracle::{Self, RateOracle};
    use alpha_points::admin::AdminCap; // Ensure AdminCap is imported
    use sui::dynamic_field::{Self as df};
    // Removed unnecessary alias imports - these are provided by default

    // === Error Constants ===
    const E_COLLATERAL_VALUE_ZERO: u64 = 101;
    const E_INSUFFICIENT_MINT_QUOTA_TODAY: u64 = 102;
    const E_TOTAL_LIFETIME_QUOTA_REACHED: u64 = 103;
    const E_CAP_IS_PAUSED: u64 = 104;
    const E_VAULT_NOT_FOUND_FOR_CAP: u64 = 105;
    const E_INVALID_VAULT_PROVIDED: u64 = 106;
    // const E_SENDER_NOT_PARTNER_CAP_OWNER: u64 = 107; // Removed unused constant
    const E_ZERO_COLLATERAL_AMOUNT: u64 = 108;
    const E_YIELD_ALREADY_ACTIVE: u64 = 201;
    const E_YIELD_NOT_ACTIVE: u64 = 202;
    const E_YIELD_TICKET_MISMATCH: u64 = 203;
    const E_YIELD_INVALID_STATE_FOR_OPERATION: u64 = 204;
    const E_INSUFFICIENT_SUI_IN_VAULT: u64 = 205; // Kept one instance of this error
    const E_NOT_OWNER: u64 = 210;
    // New error constants for multi-collateral support
    const E_INSUFFICIENT_COLLATERAL_FOR_WITHDRAWAL: u64 = 301;
    const E_INVALID_FLOOR_VALUE: u64 = 302;
    // Removed unused constant E_USDC_COLLATERAL_ALREADY_EXISTS
    const E_NFT_COLLATERAL_ALREADY_EXISTS: u64 = 304;

    // === System Constants ===
    const POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT: u64 = 1000; // 1 USDC value = 1000 Alpha Points lifetime quota base
    const DAILY_MINT_THROTTLE_PERCENT_BASIS_POINTS: u64 = 300; // 3.00% of current_effective_usdc_value for daily point minting
    const ONE_HUNDRED_PERCENT_BASIS_POINTS: u64 = 100_00;      // 100.00%
    const PERK_REVENUE_REINVESTMENT_PERCENT_BASIS_POINTS: u64 = 20_00; // 20.00% of partner's perk revenue (in Alpha Points) is reinvested
    // Multi-collateral constants
    const USDC_LTV_RATIO_BASIS_POINTS: u64 = 100_00; // 100% LTV for USDC (stable)
    const NFT_LTV_RATIO_BASIS_POINTS: u64 = 70_00;   // 70% LTV for NFTs (more volatile)

    // === Structs ===

    /// Vault to hold the locked SUI collateral for a PartnerCapFlex.
    /// This object is shared.
    public struct CollateralVault has key, store {
        id: object::UID,
        partner_cap_flex_id: object::ID, // ID of the PartnerCapFlex this vault is for
        locked_sui_balance: Balance<SUI> // Stores SUI as a Balance now
    }

    /// Info for USDC collateral stored as dynamic field
    public struct UsdcCollateralInfo<phantom USDCType> has store {
        coin_balance: Balance<USDCType>,
        usdc_amount: u64, // Amount in USDC units
        effective_usdc_value: u64, // Value for quota calculation (with LTV applied)
    }

    /// Info for NFT collateral stored as dynamic field  
    public struct NftCollateralInfo<phantom NFTType> has store, drop {
        nft_kiosk_id: object::ID,
        estimated_floor_value_usdc: u64, // Partner's estimated floor value
        effective_usdc_value: u64, // Value for quota calculation (with LTV applied)
        collection_info: String, // Optional collection identifier
    }

    /// Represents the partner's claim on SUI deposited with a third-party yield generator.
    /// This ticket is owned by the PartnerCapFlex owner.
    public struct YieldEscrowTicket<ReceiptTokenType: store> has key, store {
        id: object::UID,
        partner_cap_flex_id: object::ID,         // ID of the PartnerCapFlex this ticket is associated with
        yield_generator_address: address, // Address of the third-party yield protocol
        deposited_sui_amount: u64,        // Original SUI amount this ticket represents (from CollateralVault)
        receipt_token: ReceiptTokenType,    // The actual token/object from the yield generator
    }

    /// State of the collateral when it's opted into yield generation.
    /// This struct is stored as a dynamic field on the PartnerCapFlex object.
    public struct YieldOptInState has store, copy, drop {
        // True if SUI from CollateralVault is currently deposited with a yield generator
        is_collateral_deployed_to_yield: bool,
        // If deployed, this is the ID of the YieldEscrowTicket the partner holds
        active_escrow_ticket_id: option::Option<object::ID>,
        // If deployed, this is the address of the yield generator
        yield_generator_address: option::Option<address>,
        // If deployed, this is the original SUI amount that was sent to the yield generator
        amount_sui_deployed_to_yield: option::Option<u64>,
    }

    /// Flexible Partner Capability object with locked, retrievable SUI collateral.
    public struct PartnerCapFlex has key, store {
        id: object::UID,
        partner_name: String,
        partner_address: address,
        current_effective_usdc_value: u64,
        total_lifetime_quota_points: u64,
        total_points_minted_lifetime: u64,      // Track total points minted across all time
        daily_throttle_points: u64,             // Max points that can be minted per day
        points_minted_today: u64,               // Points minted in current epoch/day
        last_throttle_reset_ms: u64,
        total_perks_created: u64,               // Track number of perks created (separate from points)
        is_yield_opted_in: bool,
        yield_generator_address: option::Option<address>,
        yield_escrow_ticket_id: option::Option<object::ID>,
        locked_sui_coin_id: option::Option<object::ID>,
        perk_control_settings: PerkControlSettings
    }

    /// Master control settings for all perks created by this PartnerCap
    public struct PerkControlSettings has store, copy, drop {
        // Global settings that apply to all perks
        max_perks_per_partner: u64,
        max_claims_per_perk: u64,
        max_cost_per_perk: u64,
        allowed_perk_types: vector<String>,
        blacklisted_perk_types: vector<String>,
        // Revenue control
        min_partner_share_percentage: u8,
        max_partner_share_percentage: u8,
        // Feature flags
        allow_consumable_perks: bool,
        allow_expiring_perks: bool,
        allow_unique_metadata: bool,
        // Tag control
        allowed_tags: vector<String>,
        blacklisted_tags: vector<String>
    }

    // === Events ===

    public struct PartnerCapCreated has copy, drop {
        partner_cap_id: object::ID,
        partner_name: String,
        partner_address: address,
        initial_usdc_value: u64
    }
    
    public struct CollateralVaultCreated has copy, drop {
        collateral_vault_id: object::ID,
        partner_cap_flex_id: object::ID,
        initial_locked_sui_amount: u64
    }

    public struct SuiCollateralRetrieved has copy, drop {
        partner_cap_flex_id: object::ID,
        collateral_vault_id: object::ID,
        retrieved_sui_amount: u64,
        recipient_address: address,
        new_effective_usdc_value: u64 // Could be 0 if all collateral removed
    }
    
    public struct EffectiveCollateralIncreasedByPerkRevenue has copy, drop {
        partner_cap_flex_id: object::ID,
        alpha_points_reinvested_partner_share: u64, // The partner's share of Alpha Points from perk sale
        usdc_value_increase_from_reinvestment: u64,
        new_current_effective_usdc_value: u64,
        new_total_lifetime_quota_points: u64,
        new_daily_mint_throttle_cap_points: u64,
    }

    public struct MintThrottleReset has copy, drop {
        partner_cap_flex_id: object::ID,
        new_daily_mint_throttle_cap_points: u64,
        mint_remaining_today: u64,
        current_epoch: u64
    }
    
    public struct PartnerCapFlexPaused has copy, drop {
        partner_cap_flex_id: object::ID,
        paused_status: bool
    }

    // --- Yield Feature Events ---
    public struct YieldOptInStateCreated has copy, drop { // When DF is first added
        partner_cap_flex_id: object::ID,
    }

    public struct SuiDepositedToYieldProtocol has copy, drop {
        partner_cap_flex_id: object::ID,
        collateral_vault_id: object::ID, // Vault from which SUI was taken
        yield_escrow_ticket_id: object::ID,
        yield_generator_address: address,
        sui_amount_deposited: u64
    }

    public struct SuiWithdrawnFromYieldProtocol has copy, drop {
        partner_cap_flex_id: object::ID,
        collateral_vault_id: object::ID, // Vault to which SUI was returned
        consumed_escrow_ticket_id: object::ID,
        yield_generator_address: address,
        sui_amount_withdrawn: u64
    }

    public struct YieldOptInDisabled has copy, drop {
        partner_cap_flex_id: object::ID,
        was_collateral_deployed: bool // Info if SUI was deployed when disabled (should ideally be withdrawn first)
    }
    
    // New event for perk control settings updates
    public struct PerkControlSettingsUpdated has copy, drop {
        partner_cap_flex_id: object::ID,
        updated_by: address,
        new_settings: PerkControlSettings
    }

    // === Multi-Collateral Events ===

    public struct UsdcCollateralAdded has copy, drop {
        partner_cap_flex_id: object::ID,
        usdc_amount: u64,
        effective_usdc_value: u64,
        new_total_effective_value: u64,
        new_lifetime_quota: u64,
        new_daily_quota: u64
    }

    public struct NftCollateralAdded has copy, drop {
        partner_cap_flex_id: object::ID,
        nft_kiosk_id: object::ID,
        estimated_floor_value_usdc: u64,
        effective_usdc_value: u64,
        collection_info: String,
        new_total_effective_value: u64,
        new_lifetime_quota: u64,
        new_daily_quota: u64
    }

    public struct CollateralWithdrawn has copy, drop {
        partner_cap_flex_id: object::ID,
        collateral_type: String, // "SUI", "USDC", "NFT"
        withdrawn_effective_value: u64,
        new_total_effective_value: u64,
        new_lifetime_quota: u64,
        new_daily_quota: u64
    }

    // === Core Functions for PartnerCapFlex ===

    /// Helper functions for dynamic field keys
    fun usdc_collateral_df_key<USDCType>(): vector<u8> {
        let mut key = b"usdc_collateral_";
        std::vector::append(&mut key, *std::ascii::as_bytes(&std::type_name::into_string(std::type_name::get<USDCType>())));
        key
    }

    fun nft_collateral_df_key<NFTType>(): vector<u8> {
        let mut key = b"nft_collateral_";
        std::vector::append(&mut key, *std::ascii::as_bytes(&std::type_name::into_string(std::type_name::get<NFTType>())));
        key
    }

    /// Calculates the lifetime quota and daily throttle based on a given USDC value.
    fun calculate_quota_and_throttle(effective_usdc_value: u64): (u64, u64) {
        let lifetime_quota = effective_usdc_value * POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT;
        
        // Daily throttle: (effective_usdc_value * 3/100) * POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT
        // To avoid precision loss with integer division, multiply first:
        // (effective_usdc_value * DAILY_MINT_THROTTLE_PERCENT_BASIS_POINTS / ONE_HUNDRED_PERCENT_BASIS_POINTS) * POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT
        // Simplified: (effective_usdc_value * 300 * 1000) / 10000 = effective_usdc_value * 30
        // Let's use the basis points constants for clarity and maintainability:
        let daily_throttle_usdc_equivalent = (effective_usdc_value * DAILY_MINT_THROTTLE_PERCENT_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        let daily_throttle_points = daily_throttle_usdc_equivalent * POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT;
        
        (lifetime_quota, daily_throttle_points)
    }

    /// Creates a new PartnerCapFlex by locking SUI collateral.
    public entry fun create_partner_cap_flex_with_collateral(
        sui_collateral_coin: Coin<SUI>, // SUI coin provided by the partner to be locked
        rate_oracle: &RateOracle,
        partner_name: String,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        let sui_collateral_amount = coin::value(&sui_collateral_coin);

        assert!(sui_collateral_amount > 0, E_ZERO_COLLATERAL_AMOUNT);

        let locked_usdc_value = oracle::price_in_usdc(rate_oracle, sui_collateral_amount);
        assert!(locked_usdc_value > 0, E_COLLATERAL_VALUE_ZERO);

        let (initial_lifetime_quota, initial_daily_throttle) = calculate_quota_and_throttle(locked_usdc_value);

        let cap_uid = object::new(ctx);
        let cap_id = object::uid_to_inner(&cap_uid);

        // Create and share the CollateralVault
        let vault_uid = object::new(ctx);
        let vault_id = object::uid_to_inner(&vault_uid);
        let collateral_vault = CollateralVault {
            id: vault_uid,
            partner_cap_flex_id: cap_id,
            locked_sui_balance: coin::into_balance(sui_collateral_coin) // Move the coin's balance into the vault
        };
        sui::transfer::share_object(collateral_vault); // Share the vault so it can be accessed later
        
        event::emit(CollateralVaultCreated {
            collateral_vault_id: vault_id,
            partner_cap_flex_id: cap_id,
            initial_locked_sui_amount: sui_collateral_amount
        });

        let partner_cap_flex = PartnerCapFlex {
            id: cap_uid,
            partner_name: partner_name,
            partner_address: partner_address,
            current_effective_usdc_value: locked_usdc_value,
            total_lifetime_quota_points: initial_lifetime_quota,
            total_points_minted_lifetime: 0,
            daily_throttle_points: initial_daily_throttle,
            points_minted_today: 0,
            last_throttle_reset_ms: current_epoch,
            total_perks_created: 0,
            is_yield_opted_in: false,
            yield_generator_address: option::none(),
            yield_escrow_ticket_id: option::none(),
            locked_sui_coin_id: option::some(vault_id),
            perk_control_settings: PerkControlSettings {
                max_perks_per_partner: 0,
                max_claims_per_perk: 0,
                max_cost_per_perk: 0,
                allowed_perk_types: vector::empty(),
                blacklisted_perk_types: vector::empty(),
                min_partner_share_percentage: 0,
                max_partner_share_percentage: 0,
                allow_consumable_perks: false,
                allow_expiring_perks: false,
                allow_unique_metadata: false,
                allowed_tags: vector::empty(),
                blacklisted_tags: vector::empty()
            },
        };

        event::emit(PartnerCapCreated {
            partner_cap_id: cap_id,
            partner_name: partner_name,
            partner_address: partner_address,
            initial_usdc_value: locked_usdc_value
        });

        sui::transfer::public_transfer(partner_cap_flex, partner_address);
    }

    /// Creates a new PartnerCapFlex by locking USDC collateral.
    public entry fun create_partner_cap_flex_with_usdc_collateral<USDCType>(
        usdc_collateral_coin: Coin<USDCType>, // USDC coin provided by the partner to be locked
        partner_name: String,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        let usdc_collateral_amount = coin::value(&usdc_collateral_coin);

        assert!(usdc_collateral_amount > 0, E_ZERO_COLLATERAL_AMOUNT);

        // For USDC, use 1:1 conversion and 100% LTV
        let locked_usdc_value = usdc_collateral_amount;
        let effective_usdc_value = (locked_usdc_value * USDC_LTV_RATIO_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        assert!(effective_usdc_value > 0, E_COLLATERAL_VALUE_ZERO);

        let (initial_lifetime_quota, initial_daily_throttle) = calculate_quota_and_throttle(effective_usdc_value);

        let cap_uid = object::new(ctx);
        let cap_id = object::uid_to_inner(&cap_uid);

        let mut partner_cap_flex = PartnerCapFlex {
            id: cap_uid,
            partner_name: partner_name,
            partner_address: partner_address,
            current_effective_usdc_value: effective_usdc_value,
            total_lifetime_quota_points: initial_lifetime_quota,
            total_points_minted_lifetime: 0,
            daily_throttle_points: initial_daily_throttle,
            points_minted_today: 0,
            last_throttle_reset_ms: current_epoch,
            total_perks_created: 0,
            is_yield_opted_in: false,
            yield_generator_address: option::none(),
            yield_escrow_ticket_id: option::none(),
            locked_sui_coin_id: option::none(), // No SUI vault for USDC-backed caps
            perk_control_settings: PerkControlSettings {
                max_perks_per_partner: 0,
                max_claims_per_perk: 0,
                max_cost_per_perk: 0,
                allowed_perk_types: vector::empty(),
                blacklisted_perk_types: vector::empty(),
                min_partner_share_percentage: 0,
                max_partner_share_percentage: 0,
                allow_consumable_perks: false,
                allow_expiring_perks: false,
                allow_unique_metadata: false,
                allowed_tags: vector::empty(),
                blacklisted_tags: vector::empty()
            },
        };

        // Store USDC collateral info as dynamic field
        let usdc_info = UsdcCollateralInfo<USDCType> {
            coin_balance: coin::into_balance(usdc_collateral_coin),
            usdc_amount: usdc_collateral_amount,
            effective_usdc_value: effective_usdc_value,
        };
        df::add(&mut partner_cap_flex.id, usdc_collateral_df_key<USDCType>(), usdc_info);

        event::emit(PartnerCapCreated {
            partner_cap_id: cap_id,
            partner_name: partner_name,
            partner_address: partner_address,
            initial_usdc_value: effective_usdc_value
        });

        sui::transfer::public_transfer(partner_cap_flex, partner_address);
    }

    /// Creates a new PartnerCapFlex by locking NFT collateral.
    public entry fun create_partner_cap_flex_with_nft_collateral<NFTType>(
        nft_kiosk_id: object::ID, // Kiosk containing the NFT
        estimated_floor_value_usdc: u64, // Partner's estimated floor value in USDC
        collection_info: String, // Collection identifier
        partner_name: String,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);

        assert!(estimated_floor_value_usdc > 0, E_INVALID_FLOOR_VALUE);

        // For NFTs, apply 70% LTV ratio
        let effective_usdc_value = (estimated_floor_value_usdc * NFT_LTV_RATIO_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        assert!(effective_usdc_value > 0, E_COLLATERAL_VALUE_ZERO);

        let (initial_lifetime_quota, initial_daily_throttle) = calculate_quota_and_throttle(effective_usdc_value);

        let cap_uid = object::new(ctx);
        let cap_id = object::uid_to_inner(&cap_uid);

        let mut partner_cap_flex = PartnerCapFlex {
            id: cap_uid,
            partner_name: partner_name,
            partner_address: partner_address,
            current_effective_usdc_value: effective_usdc_value,
            total_lifetime_quota_points: initial_lifetime_quota,
            total_points_minted_lifetime: 0,
            daily_throttle_points: initial_daily_throttle,
            points_minted_today: 0,
            last_throttle_reset_ms: current_epoch,
            total_perks_created: 0,
            is_yield_opted_in: false,
            yield_generator_address: option::none(),
            yield_escrow_ticket_id: option::none(),
            locked_sui_coin_id: option::none(), // No SUI vault for NFT-backed caps
            perk_control_settings: PerkControlSettings {
                max_perks_per_partner: 0,
                max_claims_per_perk: 0,
                max_cost_per_perk: 0,
                allowed_perk_types: vector::empty(),
                blacklisted_perk_types: vector::empty(),
                min_partner_share_percentage: 0,
                max_partner_share_percentage: 0,
                allow_consumable_perks: false,
                allow_expiring_perks: false,
                allow_unique_metadata: false,
                allowed_tags: vector::empty(),
                blacklisted_tags: vector::empty()
            },
        };

        // Store NFT collateral info as dynamic field
        let nft_info = NftCollateralInfo<NFTType> {
            nft_kiosk_id: nft_kiosk_id,
            estimated_floor_value_usdc: estimated_floor_value_usdc,
            effective_usdc_value: effective_usdc_value,
            collection_info: collection_info,
        };
        df::add(&mut partner_cap_flex.id, nft_collateral_df_key<NFTType>(), nft_info);

        event::emit(PartnerCapCreated {
            partner_cap_id: cap_id,
            partner_name: partner_name,
            partner_address: partner_address,
            initial_usdc_value: effective_usdc_value
        });

        sui::transfer::public_transfer(partner_cap_flex, partner_address);
    }
    
    /// Admin function to grant a PartnerCapFlex without initial SUI collateral.
    /// The effective USDC value for quota/throttle purposes is set by the admin.
    public entry fun grant_partner_cap_flex_admin(
        _admin_cap: &AdminCap, // Requires AdminCap for authorization
        partner_address: address,
        name: String,
        initial_effective_usdc_value_for_quota: u64, // Admin sets the starting "value"
        ctx: &mut tx_context::TxContext
    ) {
        let current_epoch = tx_context::epoch(ctx);
        let (lifetime_quota, daily_throttle) = calculate_quota_and_throttle(initial_effective_usdc_value_for_quota);
        let cap_uid = object::new(ctx);

        let partner_cap_flex = PartnerCapFlex {
            id: cap_uid,
            partner_name: name,
            partner_address: partner_address,
            current_effective_usdc_value: initial_effective_usdc_value_for_quota,
            total_lifetime_quota_points: lifetime_quota,
            total_points_minted_lifetime: 0,
            daily_throttle_points: daily_throttle,
            points_minted_today: 0,
            last_throttle_reset_ms: current_epoch,
            total_perks_created: 0,
            is_yield_opted_in: false,
            yield_generator_address: option::none(),
            yield_escrow_ticket_id: option::none(),
            locked_sui_coin_id: option::none(),
            perk_control_settings: PerkControlSettings {
                max_perks_per_partner: 0,
                max_claims_per_perk: 0,
                max_cost_per_perk: 0,
                allowed_perk_types: vector::empty(),
                blacklisted_perk_types: vector::empty(),
                min_partner_share_percentage: 0,
                max_partner_share_percentage: 0,
                allow_consumable_perks: false,
                allow_expiring_perks: false,
                allow_unique_metadata: false,
                allowed_tags: vector::empty(),
                blacklisted_tags: vector::empty()
            },
        };
        
        let cap_id = object::uid_to_inner(&partner_cap_flex.id);
        event::emit(PartnerCapCreated {
            partner_cap_id: cap_id,
            partner_name: name,
            partner_address: partner_address,
            initial_usdc_value: initial_effective_usdc_value_for_quota
        });
        
        sui::transfer::public_transfer(partner_cap_flex, partner_address);
    }
    
    /// Resets the daily mint throttle for a partner if the current epoch has advanced.
    /// This function should be called before any minting operation or when displaying mint_remaining_today.
    public fun reset_daily_mint_throttle(cap: &mut PartnerCapFlex, current_epoch: u64) {
        if (cap.last_throttle_reset_ms < current_epoch) {
            // Recalculate daily cap in case current_effective_usdc_value changed due to perk reinvestment
            let (_, daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
            cap.daily_throttle_points = daily_throttle;
            cap.points_minted_today = 0; // Reset daily counter
            cap.last_throttle_reset_ms = current_epoch;

            event::emit(MintThrottleReset {
                partner_cap_flex_id: object::uid_to_inner(&cap.id),
                new_daily_mint_throttle_cap_points: cap.daily_throttle_points,
                mint_remaining_today: cap.daily_throttle_points, // Start fresh with full quota
                current_epoch: current_epoch
            });
        }
    }

    /// Records points minted by a partner against their daily throttle and lifetime quota.
    /// This function should be called by the module responsible for actually minting Alpha Points (e.g., Ledger module)
    /// after verifying the partner's authorization via the PartnerCapFlex.
    /// It ensures that the daily throttle is reset if the epoch has advanced.
    public fun record_points_minted(
        cap: &mut PartnerCapFlex, 
        points_to_mint: u64, 
        current_epoch: u64, 
        ctx: &mut tx_context::TxContext // For potential future event emission from this function, though currently handled by caller
    ) {
        assert!(!cap.is_yield_opted_in, E_CAP_IS_PAUSED);
        
        // Ensure daily throttle is up-to-date for the current epoch
        reset_daily_mint_throttle(cap, current_epoch);

        // Check daily quota
        let remaining_daily_quota = if (cap.daily_throttle_points > cap.points_minted_today) {
            cap.daily_throttle_points - cap.points_minted_today
        } else {
            0
        };
        assert!(remaining_daily_quota >= points_to_mint, E_INSUFFICIENT_MINT_QUOTA_TODAY);
        
        // Check lifetime quota
        let new_total_points_minted = cap.total_points_minted_lifetime + points_to_mint;
        assert!(new_total_points_minted <= cap.total_lifetime_quota_points, E_TOTAL_LIFETIME_QUOTA_REACHED);

        // Update counters
        cap.points_minted_today = cap.points_minted_today + points_to_mint;
        cap.total_points_minted_lifetime = new_total_points_minted;
        
        let _ = ctx; // Keep ctx for future use, avoid unused warning for now
    }
    
    /// Increases a partner's effective collateral based on a portion of their perk revenue (in Alpha Points).
    /// This function should be called by the perk_manager module after a partner's perk has been claimed
    /// and the partner has received their share of Alpha Points revenue.
    /// The `alpha_points_earned_by_partner_from_perk` argument should be the partner's share BEFORE any reinvestment deduction.
    public fun reinvest_perk_revenue_alpha_points(
        cap: &mut PartnerCapFlex,
        alpha_points_earned_by_partner_from_perk: u64, // Partner's share of Alpha Points from a perk sale
        rate_oracle: &RateOracle, // Oracle to convert Alpha Points to USDC value
        _ctx: &mut tx_context::TxContext // For event emission
    ) {
        if (alpha_points_earned_by_partner_from_perk == 0) {
            return // Nothing to reinvest
        };

        let reinvestment_alpha_points_partner_share = (alpha_points_earned_by_partner_from_perk * PERK_REVENUE_REINVESTMENT_PERCENT_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        
        if (reinvestment_alpha_points_partner_share == 0) {
            event::emit(EffectiveCollateralIncreasedByPerkRevenue { // Still emit, but with zero values if rounding results in 0
                partner_cap_flex_id: object::uid_to_inner(&cap.id),
                alpha_points_reinvested_partner_share: 0,
                usdc_value_increase_from_reinvestment: 0,
                new_current_effective_usdc_value: cap.current_effective_usdc_value,
                new_total_lifetime_quota_points: cap.total_lifetime_quota_points,
                new_daily_mint_throttle_cap_points: cap.daily_throttle_points,
            });
            return 
        };

        // CRITICAL: Requires oracle::convert_alpha_points_to_usdc(rate_oracle, points_amount) -> usdc_value
        let usdc_value_increase = oracle::price_in_usdc(rate_oracle, reinvestment_alpha_points_partner_share);

        if (usdc_value_increase == 0) {
             event::emit(EffectiveCollateralIncreasedByPerkRevenue { // Emit with zero increase if USDC value is negligible
                partner_cap_flex_id: object::uid_to_inner(&cap.id),
                alpha_points_reinvested_partner_share: reinvestment_alpha_points_partner_share,
                usdc_value_increase_from_reinvestment: 0,
                new_current_effective_usdc_value: cap.current_effective_usdc_value,
                new_total_lifetime_quota_points: cap.total_lifetime_quota_points,
                new_daily_mint_throttle_cap_points: cap.daily_throttle_points,
            });
            return // Reinvested points had negligible USDC value
        };

        cap.current_effective_usdc_value = cap.current_effective_usdc_value + usdc_value_increase;
        
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;
        // Note: mint_remaining_today is NOT automatically increased here. It will adjust upon the next daily reset.

        event::emit(EffectiveCollateralIncreasedByPerkRevenue {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            alpha_points_reinvested_partner_share: reinvestment_alpha_points_partner_share,
            usdc_value_increase_from_reinvestment: usdc_value_increase,
            new_current_effective_usdc_value: cap.current_effective_usdc_value,
            new_total_lifetime_quota_points: cap.total_lifetime_quota_points,
            new_daily_mint_throttle_cap_points: cap.daily_throttle_points,
        });
    }

    /// Allows a partner to retrieve their locked SUI from the CollateralVault.
    /// This action will remove the SUI from the vault, delete the vault, 
    /// and reset the partner's collateral-backed effective value and quotas to zero.
    /// The PartnerCapFlex object itself remains, but becomes essentially an admin-managed cap with 0 effective value
    /// unless an admin later sets a new effective value.
    public entry fun retrieve_locked_sui_from_vault(
        cap: &mut PartnerCapFlex,
        vault: CollateralVault, // The specific CollateralVault object, passed by value to consume it
        ctx: &mut tx_context::TxContext
    ) {
        let recipient = tx_context::sender(ctx);
        // Ensure the provided vault is the one linked to this PartnerCapFlex
        assert!(option::is_some(&cap.yield_escrow_ticket_id), E_VAULT_NOT_FOUND_FOR_CAP);
        let vault_id_from_cap = option::borrow(&cap.yield_escrow_ticket_id);
        assert!(object::uid_to_inner(&vault.id) == *vault_id_from_cap, E_INVALID_VAULT_PROVIDED);
        assert!(vault.partner_cap_flex_id == object::uid_to_inner(&cap.id), E_INVALID_VAULT_PROVIDED);
        // Ensure no SUI is currently deployed to yield from this vault/cap
        let df_key = yield_opt_in_state_df_key();
        if (df::exists_with_type<vector<u8>, YieldOptInState>(&cap.id, df_key)) {
            let yield_state = df::borrow<vector<u8>, YieldOptInState>(&cap.id, df_key);
            assert!(!yield_state.is_collateral_deployed_to_yield, E_YIELD_INVALID_STATE_FOR_OPERATION);
        };

        let CollateralVault { id: vault_uid, partner_cap_flex_id: _, locked_sui_balance } = vault;
        let retrieved_sui_amount = balance::value(&locked_sui_balance);
        
        // Transfer the SUI balance to the recipient (partner)
        sui::transfer::public_transfer(coin::from_balance(locked_sui_balance, ctx), recipient);
        object::delete(vault_uid); // Delete the now-empty and consumed vault object

        // Update PartnerCapFlex state
        cap.current_effective_usdc_value = 0; // Reset effective value as physical collateral is gone
        cap.total_lifetime_quota_points = 0; // Will be 0
        cap.daily_throttle_points = 0; // Will be 0
        
        // Reset daily quota tracking if it was greater than the new (zero) daily cap
        if (cap.points_minted_today > cap.daily_throttle_points) {
            cap.points_minted_today = cap.daily_throttle_points; // Will be 0
        };
        // total_points_minted_lifetime and total_perks_created remain, representing historical activity

        event::emit(SuiCollateralRetrieved {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            collateral_vault_id: *option::borrow(&cap.yield_escrow_ticket_id), // Ensure borrow is used if previously was vault_id_from_cap
            retrieved_sui_amount: retrieved_sui_amount,
            recipient_address: recipient,
            new_effective_usdc_value: cap.current_effective_usdc_value // Will be 0
        });
    }
    
    // --- Basic Getters ---
    public fun id(cap: &PartnerCapFlex): &object::UID { &cap.id }
    public fun partner_name(cap: &PartnerCapFlex): String { cap.partner_name }
    public fun partner_address(cap: &PartnerCapFlex): address { cap.partner_address }
    public fun is_paused(cap: &PartnerCapFlex): bool { cap.is_yield_opted_in }
    public fun locked_sui_vault_id(cap: &PartnerCapFlex): option::Option<object::ID> { cap.yield_escrow_ticket_id }
    public fun initial_locked_usdc_value(cap: &PartnerCapFlex): u64 { cap.current_effective_usdc_value }
    public fun current_effective_usdc_value(cap: &PartnerCapFlex): u64 { cap.current_effective_usdc_value }
    public fun total_lifetime_quota_points(cap: &PartnerCapFlex): u64 { cap.total_lifetime_quota_points }
    public fun total_points_minted(cap: &PartnerCapFlex): u64 { cap.total_points_minted_lifetime }
    public fun daily_mint_throttle_cap_points(cap: &PartnerCapFlex): u64 { cap.daily_throttle_points }
    public fun mint_remaining_today(cap: &PartnerCapFlex): u64 { 
        if (cap.daily_throttle_points > cap.points_minted_today) {
            cap.daily_throttle_points - cap.points_minted_today
        } else {
            0
        }
    }
    public fun last_mint_timestamp_ms(cap: &PartnerCapFlex): u64 { cap.last_throttle_reset_ms }

    // --- Yield Opt-In Functions (Operating on SUI in CollateralVault) ---

    /// Helper function to get the dynamic field key for YieldOptInState.
    fun yield_opt_in_state_df_key(): vector<u8> {
        b"yield_opt_in_state_v1" // Added v1 for potential future upgrades of this state struct
    }

    /// Ensures a YieldOptInState dynamic field exists for the PartnerCapFlex, creating a default one if not.
    /// Returns a mutable reference to the YieldOptInState.
    /// This function is internal and used by other yield management functions.
    fun ensure_yield_opt_in_state_mut(
        cap_id_ref: &mut object::UID, // Reference to the PartnerCapFlex's UID, changed to &mut object::UID
        _ctx: &mut tx_context::TxContext   // For creating the object if it doesn't exist
    ): &mut YieldOptInState {
        let df_key = yield_opt_in_state_df_key();
        if (!df::exists_with_type<vector<u8>, YieldOptInState>(cap_id_ref, df_key)) {
            let new_state = YieldOptInState {
                is_collateral_deployed_to_yield: false,
                active_escrow_ticket_id: option::none(),
                yield_generator_address: option::none(),
                amount_sui_deployed_to_yield: option::none(),
            };
            df::add(cap_id_ref, df_key, new_state);
            event::emit(YieldOptInStateCreated {
                partner_cap_flex_id: object::uid_to_inner(cap_id_ref),
            });
        };
        df::borrow_mut<vector<u8>, YieldOptInState>(cap_id_ref, df_key)
    }

    /// (STUB) Deploys a specified amount of SUI from the PartnerCapFlex's CollateralVault 
    /// to a third-party yield generator. The Vault must contain sufficient SUI.
    /// A YieldEscrowTicket is created and transferred to the partner (transaction sender).
    #[allow(unused_type_parameter)]
    public entry fun deploy_vault_sui_to_yield_generator<ReceiptTokenType: store + key + drop>(
        cap: &mut PartnerCapFlex,
        vault: &mut CollateralVault,      // Vault containing the SUI to deploy
        amount_to_deploy: u64,           // Amount of SUI (in MIST) from the vault to deploy
        yield_generator_address: address, // Address of the yield protocol contract
        // ... other parameters specific to the yield generator's deposit function ...
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        // 0. Authorization and Sanity Checks
        assert!(option::is_some(&cap.yield_escrow_ticket_id) && 
                *option::borrow(&cap.yield_escrow_ticket_id) == object::uid_to_inner(&vault.id), 
                E_INVALID_VAULT_PROVIDED);
        assert!(vault.partner_cap_flex_id == object::uid_to_inner(&cap.id), E_INVALID_VAULT_PROVIDED);
        assert!(amount_to_deploy > 0, E_ZERO_COLLATERAL_AMOUNT); // Cannot deploy zero
        assert!(balance::value(&vault.locked_sui_balance) >= amount_to_deploy, E_INSUFFICIENT_SUI_IN_VAULT);

        // 1. Ensure YieldOptInState exists and check if collateral is already deployed
        let df_key = yield_opt_in_state_df_key();
        let cap_id_for_event = object::uid_to_inner(&cap.id); // Get ID for event first

        if (!df::exists_with_type<vector<u8>, YieldOptInState>(&cap.id, df_key)) { // Pass &cap.id directly
            let new_state = YieldOptInState {
                is_collateral_deployed_to_yield: false,
                active_escrow_ticket_id: option::none(),
                yield_generator_address: option::none(),
                amount_sui_deployed_to_yield: option::none(),
            };
            df::add(&mut cap.id, df_key, new_state); // Mutable borrow of cap.id here, ctx also used
            event::emit(YieldOptInStateCreated {
                partner_cap_flex_id: cap_id_for_event, // Use pre-fetched ID
            });
        };

        // Now, borrow for the check. This borrow is temporary.
        let yield_state_check = df::borrow<vector<u8>, YieldOptInState>(&cap.id, df_key); // Pass &cap.id
        assert!(!yield_state_check.is_collateral_deployed_to_yield, E_YIELD_ALREADY_ACTIVE);
        // yield_state_check borrow ends here

        // 2. Extract SUI Coin from vault's balance
        let sui_to_deploy_coin = coin::take(&mut vault.locked_sui_balance, amount_to_deploy, ctx);

        // 3. STUB: Call the external yield_generator_address::deposit function.
        //    This function would consume `sui_to_deploy_coin`.
        //    It is expected to return a `receipt_token_object` of type `ReceiptTokenType`.
        //    Example: 
        //    let receipt_token_object: ReceiptTokenType = yield_protocol::deposit(
        //        yield_generator_address, 
        //        sui_to_deploy_coin, 
        //        // ... any other args ...
        //    );
        // For the stub, we'll create a placeholder ReceiptTokenType object if the type constraint allows.
        // This is a major simplification. In reality, ReceiptTokenType comes from the external call.
        // If ReceiptTokenType is a generic `store` object without `key`, we can't just `object::new` it.
        // The `key` ability for `ReceiptTokenType` is needed if we are to create a dummy one like this.
        let placeholder_receipt_token_uid = object::new(ctx);
        let receipt_token_object: ReceiptTokenType = create_placeholder_receipt_token_stub<ReceiptTokenType>(placeholder_receipt_token_uid, ctx); // Placeholder - this needs a real object from the protocol
        // Ensure sui_to_deploy_coin is conceptually "consumed" by the stubbed deposit call
        sui::transfer::public_transfer(sui_to_deploy_coin, @0x0); // Qualified call - Burn the coin as a placeholder for consumption by external call

        // 4. Create the YieldEscrowTicket
        let ticket_uid = object::new(ctx);
        let new_ticket_id_val: object::ID = object::uid_to_inner(&ticket_uid); // Temporary variable for ID
        let new_ticket = YieldEscrowTicket<ReceiptTokenType> {
            id: ticket_uid,
            partner_cap_flex_id: object::uid_to_inner(&cap.id), // Immutable borrow of cap.id here is fine now
            yield_generator_address: yield_generator_address,
            deposited_sui_amount: amount_to_deploy,
            receipt_token: receipt_token_object, 
        };
        // let new_ticket_id = object::uid_to_inner(&new_ticket.id); // Already got as new_ticket_id_val

        // 5. Update YieldOptInState (re-borrow mutably)
        let yield_state_update = df::borrow_mut<vector<u8>, YieldOptInState>(&mut cap.id, df_key);
        yield_state_update.is_collateral_deployed_to_yield = true;
        yield_state_update.active_escrow_ticket_id = option::some(new_ticket_id_val);
        yield_state_update.yield_generator_address = option::some(yield_generator_address);
        yield_state_update.amount_sui_deployed_to_yield = option::some(amount_to_deploy);
        // yield_state_update borrow ends here

        // 6. Emit Event
        event::emit(SuiDepositedToYieldProtocol {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            collateral_vault_id: object::uid_to_inner(&vault.id),
            yield_escrow_ticket_id: new_ticket_id_val, // Use the stored ID
            yield_generator_address: yield_generator_address,
            sui_amount_deposited: amount_to_deploy
        });
        
        // 7. Transfer YieldEscrowTicket to the partner
        sui::transfer::public_transfer(new_ticket, partner_address); // Qualified call
        // Note: vault.locked_sui_balance was already updated by coin::take.
    }
    
    /// Placeholder function for STUB purposes only. 
    /// In a real scenario, the ReceiptTokenType object comes from the external yield protocol.
    fun create_placeholder_receipt_token_stub<T: key + store + drop>(_uid: object::UID, _ctx: &mut tx_context::TxContext): T {
        // This is highly problematic as we don't know the structure of T.
        // For a STUB to work, T might need to be a simple struct we define for testing.
        // Or, this function just aborts if T is not a known test type.
        // object::new() was already called to get uid. This function would wrap it.
        // However, a generic T cannot be instantiated this way. 
        // This STUB is fundamentally flawed for generic T. 
        // We would need a concrete mock type for ReceiptTokenType in tests.
        abort 999 // Abort to indicate this is a non-functional stub for generic T
    }

    /// (STUB) Withdraws SUI from a third-party yield generator using the partner's YieldEscrowTicket.
    /// The reclaimed SUI is returned to the PartnerCapFlex's CollateralVault.
    /// The provided YieldEscrowTicket is consumed.
    #[allow(unused_type_parameter)]
    public entry fun withdraw_vault_sui_from_yield_generator<ReceiptTokenType: store + key + drop>(
        cap: &mut PartnerCapFlex,
        ticket: YieldEscrowTicket<ReceiptTokenType>, // Partner provides their ticket object, consumed by this function
        vault: &mut CollateralVault,           // Vault where SUI should be returned
        // ... any other parameters specific to the yield generator's withdraw function ...
        ctx: &mut tx_context::TxContext
    ) {
        let _partner_address = tx_context::sender(ctx);
        // 0. Authorization and Sanity Checks
        assert!(option::is_some(&cap.yield_escrow_ticket_id) && 
                *option::borrow(&cap.yield_escrow_ticket_id) == object::uid_to_inner(&vault.id), 
                E_INVALID_VAULT_PROVIDED);
        assert!(vault.partner_cap_flex_id == object::uid_to_inner(&cap.id), E_INVALID_VAULT_PROVIDED);
        assert!(ticket.partner_cap_flex_id == object::uid_to_inner(&cap.id), E_YIELD_TICKET_MISMATCH);

        // 1. Manage YieldOptInState
        let yield_state = ensure_yield_opt_in_state_mut(&mut cap.id, ctx);
        assert!(yield_state.is_collateral_deployed_to_yield, E_YIELD_NOT_ACTIVE);
        assert!(option::is_some(&yield_state.active_escrow_ticket_id) && 
                *option::borrow(&yield_state.active_escrow_ticket_id) == object::uid_to_inner(&ticket.id), 
                E_YIELD_TICKET_MISMATCH);
        assert!(option::is_some(&yield_state.yield_generator_address) && 
                *option::borrow(&yield_state.yield_generator_address) == ticket.yield_generator_address, 
                E_YIELD_TICKET_MISMATCH);

        // 2. Extract necessary fields from the ticket. The ticket itself is consumed by value.
        let ticket_id_for_event = object::uid_to_inner(&ticket.id); // Borrow for the event
        let gen_addr = ticket.yield_generator_address;               // Copy address
        let original_deposited_sui_amount = ticket.deposited_sui_amount; // Copy amount
        
        // Deconstruct the ticket to move out the receipt_token. The rest of ticket's fields are implicitly handled
        // because 'ticket' (which has key ability) is consumed by being passed by value.
        let YieldEscrowTicket {
            id: ticket_uid, // Move the UID into a variable
            partner_cap_flex_id: _, 
            yield_generator_address: _, 
            deposited_sui_amount: _, 
            receipt_token: _receipt_token // Prefix with underscore to indicate intentionally unused
        } = ticket; 

        // Use ticket_uid in object::delete to properly consume it
        object::delete(ticket_uid);

        // 3. STUB: Call external gen_addr::withdraw(receipt_token, ...) function.
        //    This function would consume `receipt_token`.
        //    It is expected to return `reclaimed_sui_coin: Coin<SUI>`.
        //    Example: 
        //    let reclaimed_sui_coin = yield_protocol::withdraw(
        //        gen_addr, 
        //        receipt_token, 
        //        original_deposited_sui_amount, // often needed by protocols
        //        // ... any other args ...
        //    );
        // For this stub, we'll create a zero balance as a placeholder. The actual value is in original_deposited_sui_amount.
        let reclaimed_sui_balance = balance::zero<SUI>();
        // The actual receipt_token is consumed by the external call. Here, it's consumed when `ticket` is deconstructed.

        // 4. Add reclaimed SUI back to the vault's balance
        balance::join(&mut vault.locked_sui_balance, reclaimed_sui_balance);

        // 5. Update YieldOptInState
        yield_state.is_collateral_deployed_to_yield = false;
        yield_state.active_escrow_ticket_id = option::none();
        yield_state.yield_generator_address = option::none();
        yield_state.amount_sui_deployed_to_yield = option::none();
        // (No need to df::add again for yield_state)

        // 6. Emit Event
        event::emit(SuiWithdrawnFromYieldProtocol {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            collateral_vault_id: object::uid_to_inner(&vault.id),
            consumed_escrow_ticket_id: ticket_id_for_event, // Use the ID obtained before deconstruction
            yield_generator_address: gen_addr, // Use the copied address
            sui_amount_withdrawn: original_deposited_sui_amount // Use the copied amount
        });

        // 7. The `ticket` object was consumed by deconstruction and its value being passed to the function.
        //    The `receipt_token` was moved out and is handled (e.g., by having drop or being consumed by an external call stub).
        //    The UID field (ticket.id) within the original `ticket` struct is handled because `ticket` itself is consumed.
    }

    /// Disables the yield feature for a PartnerCapFlex.
    /// Requires that no SUI is currently deployed in a yield protocol (i.e., no active YieldEscrowTicket).
    public entry fun disable_yield_feature_flex(
        cap: &mut PartnerCapFlex,
        ctx: &mut tx_context::TxContext
    ) {
        let _partner_address = tx_context::sender(ctx);
        // Removed problematic object::owner check

        let df_key = yield_opt_in_state_df_key();
        if (!df::exists_with_type<vector<u8>, YieldOptInState>(&cap.id, df_key)) {
            // Feature was never enabled or already disabled, nothing to do.
            // Optionally emit an event or return a status.
            return
        };

        let removed_yield_state_option: option::Option<YieldOptInState> = df::remove(&mut cap.id, df_key);
        assert!(option::is_some(&removed_yield_state_option), E_YIELD_INVALID_STATE_FOR_OPERATION); // Should always be Some if exists check passed

        let yield_state = option::destroy_some(removed_yield_state_option); // Unwrap the Option

        assert!(!yield_state.is_collateral_deployed_to_yield, E_YIELD_INVALID_STATE_FOR_OPERATION); // Cannot disable if funds are actively deployed
        
        event::emit(YieldOptInDisabled {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            was_collateral_deployed: yield_state.is_collateral_deployed_to_yield // Will be false due to assert
        });
        let _ = ctx;
    }

    public entry fun set_partner_flex_paused(
        _admin_cap: &AdminCap,
        cap: &mut PartnerCapFlex,
        paused_status: bool,
        _ctx: &mut tx_context::TxContext // For event emission
    ) {
        cap.is_yield_opted_in = paused_status;
        event::emit(PartnerCapFlexPaused {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            paused_status: cap.is_yield_opted_in
        });
    }

    // New function to update perk control settings - changed from entry to public
    public fun update_perk_control_settings(
        cap: &mut PartnerCapFlex,
        new_settings: PerkControlSettings,
        ctx: &mut tx_context::TxContext
    ) {
        let updater = tx_context::sender(ctx);
        assert!(updater == cap.partner_address, E_NOT_OWNER);
        
        cap.perk_control_settings = new_settings;

        event::emit(PerkControlSettingsUpdated {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            updated_by: updater,
            new_settings: cap.perk_control_settings
        });
    }

    // Add entry function for frontend to call
    /// @deprecated This function has a bug where it overwrites existing allowed/blacklisted vectors with empty ones.
    /// Use update_perk_control_settings_v2_entry instead.
    public entry fun update_perk_control_settings_entry(
        cap: &mut PartnerCapFlex,
        max_perks_per_partner: u64,
        max_claims_per_perk: u64,
        max_cost_per_perk: u64,
        min_partner_share_percentage: u8,
        max_partner_share_percentage: u8,
        allow_consumable_perks: bool,
        allow_expiring_perks: bool,
        allow_unique_metadata: bool,
        ctx: &mut tx_context::TxContext
    ) {
        let new_settings = PerkControlSettings {
            max_perks_per_partner,
            max_claims_per_perk,
            max_cost_per_perk,
            allowed_perk_types: vector::empty(), // Keep existing for now
            blacklisted_perk_types: vector::empty(), // Keep existing for now  
            min_partner_share_percentage,
            max_partner_share_percentage,
            allow_consumable_perks,
            allow_expiring_perks,
            allow_unique_metadata,
            allowed_tags: vector::empty(), // Keep existing for now
            blacklisted_tags: vector::empty() // Keep existing for now
        };
        
        update_perk_control_settings(cap, new_settings, ctx);
    }

    /// Fixed version that properly preserves existing allowed/blacklisted vectors
    public entry fun update_perk_control_settings_v2_entry(
        cap: &mut PartnerCapFlex,
        max_perks_per_partner: u64,
        max_claims_per_perk: u64,
        max_cost_per_perk: u64,
        min_partner_share_percentage: u8,
        max_partner_share_percentage: u8,
        allow_consumable_perks: bool,
        allow_expiring_perks: bool,
        allow_unique_metadata: bool,
        ctx: &mut tx_context::TxContext
    ) {
        // Preserve existing values for fields not being updated
        let current_settings = &cap.perk_control_settings;
        
        let new_settings = PerkControlSettings {
            max_perks_per_partner,
            max_claims_per_perk,
            max_cost_per_perk,
            allowed_perk_types: current_settings.allowed_perk_types, // Preserve existing
            blacklisted_perk_types: current_settings.blacklisted_perk_types, // Preserve existing
            min_partner_share_percentage,
            max_partner_share_percentage,
            allow_consumable_perks,
            allow_expiring_perks,
            allow_unique_metadata,
            allowed_tags: current_settings.allowed_tags, // Preserve existing
            blacklisted_tags: current_settings.blacklisted_tags // Preserve existing
        };
        
        update_perk_control_settings(cap, new_settings, ctx);
    }

    /// Entry function to update perk type allowlists/blocklists
    public entry fun update_perk_type_lists_entry(
        cap: &mut PartnerCapFlex,
        allowed_perk_types: vector<String>,
        blacklisted_perk_types: vector<String>,
        ctx: &mut tx_context::TxContext
    ) {
        // Preserve all other existing values
        let current_settings = &cap.perk_control_settings;
        
        let new_settings = PerkControlSettings {
            max_perks_per_partner: current_settings.max_perks_per_partner,
            max_claims_per_perk: current_settings.max_claims_per_perk,
            max_cost_per_perk: current_settings.max_cost_per_perk,
            allowed_perk_types, // Update these
            blacklisted_perk_types, // Update these
            min_partner_share_percentage: current_settings.min_partner_share_percentage,
            max_partner_share_percentage: current_settings.max_partner_share_percentage,
            allow_consumable_perks: current_settings.allow_consumable_perks,
            allow_expiring_perks: current_settings.allow_expiring_perks,
            allow_unique_metadata: current_settings.allow_unique_metadata,
            allowed_tags: current_settings.allowed_tags, // Preserve existing
            blacklisted_tags: current_settings.blacklisted_tags // Preserve existing
        };
        
        update_perk_control_settings(cap, new_settings, ctx);
    }

    /// Entry function to update tag allowlists/blocklists
    public entry fun update_perk_tag_lists_entry(
        cap: &mut PartnerCapFlex,
        allowed_tags: vector<String>,
        blacklisted_tags: vector<String>,
        ctx: &mut tx_context::TxContext
    ) {
        // Preserve all other existing values
        let current_settings = &cap.perk_control_settings;
        
        let new_settings = PerkControlSettings {
            max_perks_per_partner: current_settings.max_perks_per_partner,
            max_claims_per_perk: current_settings.max_claims_per_perk,
            max_cost_per_perk: current_settings.max_cost_per_perk,
            allowed_perk_types: current_settings.allowed_perk_types, // Preserve existing
            blacklisted_perk_types: current_settings.blacklisted_perk_types, // Preserve existing
            min_partner_share_percentage: current_settings.min_partner_share_percentage,
            max_partner_share_percentage: current_settings.max_partner_share_percentage,
            allow_consumable_perks: current_settings.allow_consumable_perks,
            allow_expiring_perks: current_settings.allow_expiring_perks,
            allow_unique_metadata: current_settings.allow_unique_metadata,
            allowed_tags, // Update these
            blacklisted_tags // Update these
        };
        
        update_perk_control_settings(cap, new_settings, ctx);
    }

    // Add public getters for fields that need to be accessed by other modules
    public fun get_is_yield_opted_in(cap: &PartnerCapFlex): bool { cap.is_yield_opted_in }
    public fun get_yield_generator_address(cap: &PartnerCapFlex): option::Option<address> { cap.yield_generator_address }
    public fun get_yield_escrow_ticket_id(cap: &PartnerCapFlex): option::Option<object::ID> { cap.yield_escrow_ticket_id }
    public fun get_perk_control_settings(cap: &PartnerCapFlex): &PerkControlSettings { &cap.perk_control_settings }
    public fun get_total_perks_created(cap: &PartnerCapFlex): u64 { cap.total_perks_created }

    // Add public getters for PerkControlSettings fields
    public fun get_max_perks_per_partner(settings: &PerkControlSettings): u64 { settings.max_perks_per_partner }
    public fun get_max_claims_per_perk(settings: &PerkControlSettings): u64 { settings.max_claims_per_perk }
    public fun get_max_cost_per_perk(settings: &PerkControlSettings): u64 { settings.max_cost_per_perk }
    public fun get_allowed_perk_types(settings: &PerkControlSettings): &vector<String> { &settings.allowed_perk_types }
    public fun get_blacklisted_perk_types(settings: &PerkControlSettings): &vector<String> { &settings.blacklisted_perk_types }
    public fun get_min_partner_share_percentage(settings: &PerkControlSettings): u8 { settings.min_partner_share_percentage }
    public fun get_max_partner_share_percentage(settings: &PerkControlSettings): u8 { settings.max_partner_share_percentage }
    public fun get_allow_consumable_perks(settings: &PerkControlSettings): bool { settings.allow_consumable_perks }
    public fun get_allow_expiring_perks(settings: &PerkControlSettings): bool { settings.allow_expiring_perks }
    public fun get_allow_unique_metadata(settings: &PerkControlSettings): bool { settings.allow_unique_metadata }
    public fun get_allowed_tags(settings: &PerkControlSettings): &vector<String> { &settings.allowed_tags }
    public fun get_blacklisted_tags(settings: &PerkControlSettings): &vector<String> { &settings.blacklisted_tags }

    /// Records that a perk has been created by this partner.
    /// This is separate from point minting and tracks the actual number of perks.
    public fun record_perk_created(cap: &mut PartnerCapFlex, _ctx: &mut tx_context::TxContext) {
        cap.total_perks_created = cap.total_perks_created + 1;
    }

    /// Validates that a partner can mint the requested points without exceeding quotas.
    /// This function checks both daily throttle and lifetime quota limits.
    public fun validate_mint_quota(
        cap: &PartnerCapFlex, 
        points_to_mint: u64, 
        _current_epoch: u64, 
        _ctx: &mut tx_context::TxContext
    ) {
        assert!(!cap.is_yield_opted_in, E_CAP_IS_PAUSED);
        
        // Check daily throttle - ensure we don't exceed the daily limit
        // daily_throttle_points is the max we can mint per day
        // points_minted_today tracks how much we've already minted today (resets daily)
        let remaining_daily_quota = if (cap.daily_throttle_points > cap.points_minted_today) {
            cap.daily_throttle_points - cap.points_minted_today
        } else {
            0
        };
        assert!(remaining_daily_quota >= points_to_mint, E_INSUFFICIENT_MINT_QUOTA_TODAY);
        
        // Check lifetime quota
        let new_total_points_minted = cap.total_points_minted_lifetime + points_to_mint;
        assert!(new_total_points_minted <= cap.total_lifetime_quota_points, E_TOTAL_LIFETIME_QUOTA_REACHED);
    }

    /// Returns the current available mint quota for today
    public fun get_available_mint_quota_today(cap: &PartnerCapFlex): u64 {
        if (cap.daily_throttle_points > cap.points_minted_today) {
            cap.daily_throttle_points - cap.points_minted_today
        } else {
            0
        }
    }

    /// Returns the remaining lifetime quota
    public fun get_remaining_lifetime_quota(cap: &PartnerCapFlex): u64 {
        if (cap.total_lifetime_quota_points > cap.total_points_minted_lifetime) {
            cap.total_lifetime_quota_points - cap.total_points_minted_lifetime
        } else {
            0
        }
    }

    /// Returns the TVL-backed exchange rate: 1 USDC = 10,000 Alpha Points
    public fun get_usdc_to_alpha_points_rate(): u64 {
        10000 // 1 USDC = 10,000 Alpha Points
    }

    /// Calculates how many Alpha Points a partner can mint based on their current TVL
    public fun calculate_max_mintable_points_from_tvl(cap: &PartnerCapFlex): (u64, u64) {
        let lifetime_quota = cap.current_effective_usdc_value * POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT;
        let daily_quota = (cap.current_effective_usdc_value * DAILY_MINT_THROTTLE_PERCENT_BASIS_POINTS * POINTS_QUOTA_PER_USDC_COLLATERAL_UNIT) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        (lifetime_quota, daily_quota)
    }

    // === Multi-Collateral Management Functions ===

    /// Adds additional SUI collateral to an existing PartnerCapFlex
    public entry fun add_sui_collateral(
        cap: &mut PartnerCapFlex,
        vault: &mut CollateralVault,
        additional_sui_coin: Coin<SUI>,
        rate_oracle: &RateOracle,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);
        
        // Verify vault belongs to this cap
        assert!(option::is_some(&cap.locked_sui_coin_id), E_VAULT_NOT_FOUND_FOR_CAP);
        let vault_id_from_cap = option::borrow(&cap.locked_sui_coin_id);
        assert!(object::uid_to_inner(&vault.id) == *vault_id_from_cap, E_INVALID_VAULT_PROVIDED);
        assert!(vault.partner_cap_flex_id == object::uid_to_inner(&cap.id), E_INVALID_VAULT_PROVIDED);

        let additional_sui_amount = coin::value(&additional_sui_coin);
        assert!(additional_sui_amount > 0, E_ZERO_COLLATERAL_AMOUNT);

        // Add SUI to vault
        balance::join(&mut vault.locked_sui_balance, coin::into_balance(additional_sui_coin));

        // Calculate additional effective value
        let additional_usdc_value = oracle::price_in_usdc(rate_oracle, additional_sui_amount);
        
        // Update cap's effective value and quotas
        cap.current_effective_usdc_value = cap.current_effective_usdc_value + additional_usdc_value;
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        event::emit(CollateralWithdrawn {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            collateral_type: std::string::utf8(b"SUI"),
            withdrawn_effective_value: additional_usdc_value, // Reusing event for additions
            new_total_effective_value: cap.current_effective_usdc_value,
            new_lifetime_quota: new_lifetime_quota,
            new_daily_quota: new_daily_throttle
        });
    }

    /// Adds USDC collateral to an existing PartnerCapFlex
    public entry fun add_usdc_collateral<USDCType>(
        cap: &mut PartnerCapFlex,
        additional_usdc_coin: Coin<USDCType>,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);

        let additional_usdc_amount = coin::value(&additional_usdc_coin);
        assert!(additional_usdc_amount > 0, E_ZERO_COLLATERAL_AMOUNT);

        let df_key = usdc_collateral_df_key<USDCType>();
        
        if (df::exists_with_type<vector<u8>, UsdcCollateralInfo<USDCType>>(&cap.id, df_key)) {
            // Add to existing USDC collateral
            let usdc_info = df::borrow_mut<vector<u8>, UsdcCollateralInfo<USDCType>>(&mut cap.id, df_key);
            balance::join(&mut usdc_info.coin_balance, coin::into_balance(additional_usdc_coin));
            usdc_info.usdc_amount = usdc_info.usdc_amount + additional_usdc_amount;
            
            // Calculate additional effective value (100% LTV for USDC)
            let additional_effective_value = (additional_usdc_amount * USDC_LTV_RATIO_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
            usdc_info.effective_usdc_value = usdc_info.effective_usdc_value + additional_effective_value;
            
            // Update cap's total effective value
            cap.current_effective_usdc_value = cap.current_effective_usdc_value + additional_effective_value;
        } else {
            // Create new USDC collateral entry
            let effective_value = (additional_usdc_amount * USDC_LTV_RATIO_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
            let usdc_info = UsdcCollateralInfo<USDCType> {
                coin_balance: coin::into_balance(additional_usdc_coin),
                usdc_amount: additional_usdc_amount,
                effective_usdc_value: effective_value,
            };
            df::add(&mut cap.id, df_key, usdc_info);
            cap.current_effective_usdc_value = cap.current_effective_usdc_value + effective_value;
        };

        // Recalculate quotas
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        let additional_effective_value = (additional_usdc_amount * USDC_LTV_RATIO_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        
        event::emit(UsdcCollateralAdded {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            usdc_amount: additional_usdc_amount,
            effective_usdc_value: additional_effective_value,
            new_total_effective_value: cap.current_effective_usdc_value,
            new_lifetime_quota: new_lifetime_quota,
            new_daily_quota: new_daily_throttle
        });
    }

    /// Adds NFT collateral to an existing PartnerCapFlex
    public entry fun add_nft_collateral<NFTType>(
        cap: &mut PartnerCapFlex,
        nft_kiosk_id: object::ID,
        estimated_floor_value_usdc: u64,
        collection_info: String,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);
        assert!(estimated_floor_value_usdc > 0, E_INVALID_FLOOR_VALUE);

        let df_key = nft_collateral_df_key<NFTType>();
        
        // Check if NFT collateral already exists for this type
        assert!(!df::exists_with_type<vector<u8>, NftCollateralInfo<NFTType>>(&cap.id, df_key), E_NFT_COLLATERAL_ALREADY_EXISTS);

        // Calculate effective value (70% LTV for NFTs)
        let effective_value = (estimated_floor_value_usdc * NFT_LTV_RATIO_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        
        // Create NFT collateral entry
        let nft_info = NftCollateralInfo<NFTType> {
            nft_kiosk_id: nft_kiosk_id,
            estimated_floor_value_usdc: estimated_floor_value_usdc,
            effective_usdc_value: effective_value,
            collection_info: collection_info,
        };
        df::add(&mut cap.id, df_key, nft_info);
        
        // Update cap's total effective value
        cap.current_effective_usdc_value = cap.current_effective_usdc_value + effective_value;

        // Recalculate quotas
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        event::emit(NftCollateralAdded {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            nft_kiosk_id: nft_kiosk_id,
            estimated_floor_value_usdc: estimated_floor_value_usdc,
            effective_usdc_value: effective_value,
            collection_info: collection_info,
            new_total_effective_value: cap.current_effective_usdc_value,
            new_lifetime_quota: new_lifetime_quota,
            new_daily_quota: new_daily_throttle
        });
    }

    /// Withdraws USDC collateral from a PartnerCapFlex
    public entry fun withdraw_usdc_collateral<USDCType>(
        cap: &mut PartnerCapFlex,
        amount_to_withdraw: u64,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);

        let df_key = usdc_collateral_df_key<USDCType>();
        assert!(df::exists_with_type<vector<u8>, UsdcCollateralInfo<USDCType>>(&cap.id, df_key), E_INSUFFICIENT_COLLATERAL_FOR_WITHDRAWAL);

        let usdc_info = df::borrow_mut<vector<u8>, UsdcCollateralInfo<USDCType>>(&mut cap.id, df_key);
        assert!(balance::value(&usdc_info.coin_balance) >= amount_to_withdraw, E_INSUFFICIENT_COLLATERAL_FOR_WITHDRAWAL);

        // Calculate effective value reduction
        let effective_value_reduction = (amount_to_withdraw * USDC_LTV_RATIO_BASIS_POINTS) / ONE_HUNDRED_PERCENT_BASIS_POINTS;
        
        // Update collateral info
        let withdrawn_coin = coin::take(&mut usdc_info.coin_balance, amount_to_withdraw, ctx);
        usdc_info.usdc_amount = usdc_info.usdc_amount - amount_to_withdraw;
        usdc_info.effective_usdc_value = usdc_info.effective_usdc_value - effective_value_reduction;

        // Update cap's effective value
        cap.current_effective_usdc_value = cap.current_effective_usdc_value - effective_value_reduction;

        // Recalculate quotas
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        // If minted today exceeds new daily cap, adjust it
        if (cap.points_minted_today > cap.daily_throttle_points) {
            cap.points_minted_today = cap.daily_throttle_points;
        };

        // Transfer withdrawn USDC to partner
        sui::transfer::public_transfer(withdrawn_coin, partner_address);

        event::emit(CollateralWithdrawn {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            collateral_type: std::string::utf8(b"USDC"),
            withdrawn_effective_value: effective_value_reduction,
            new_total_effective_value: cap.current_effective_usdc_value,
            new_lifetime_quota: new_lifetime_quota,
            new_daily_quota: new_daily_throttle
        });
    }

    /// Removes NFT collateral from a PartnerCapFlex
    public entry fun withdraw_nft_collateral<NFTType>(
        cap: &mut PartnerCapFlex,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);

        let df_key = nft_collateral_df_key<NFTType>();
        assert!(df::exists_with_type<vector<u8>, NftCollateralInfo<NFTType>>(&cap.id, df_key), E_INSUFFICIENT_COLLATERAL_FOR_WITHDRAWAL);

        // Remove NFT collateral info
        let nft_info = df::remove<vector<u8>, NftCollateralInfo<NFTType>>(&mut cap.id, df_key);
        let effective_value_reduction = nft_info.effective_usdc_value;

        // Update cap's effective value
        cap.current_effective_usdc_value = cap.current_effective_usdc_value - effective_value_reduction;

        // Recalculate quotas
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        // If minted today exceeds new daily cap, adjust it
        if (cap.points_minted_today > cap.daily_throttle_points) {
            cap.points_minted_today = cap.daily_throttle_points;
        };

        event::emit(CollateralWithdrawn {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            collateral_type: std::string::utf8(b"NFT"),
            withdrawn_effective_value: effective_value_reduction,
            new_total_effective_value: cap.current_effective_usdc_value,
            new_lifetime_quota: new_lifetime_quota,
            new_daily_quota: new_daily_throttle
        });

        // Note: The actual NFT remains in the kiosk - this function only removes
        // the collateral backing. Partner should handle NFT separately.
        // Removed the problematic line that was causing the drop ability error
    }

    /// Creates an initial SUI vault for an existing PartnerCapFlex that doesn't have one
    /// This allows partners who were created without SUI collateral (e.g., admin-granted, USDC-only, NFT-only)
    /// to add their first SUI collateral and vault
    public entry fun create_initial_sui_vault(
        cap: &mut PartnerCapFlex,
        initial_sui_coin: Coin<SUI>,
        rate_oracle: &RateOracle,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);
        
        // Verify this partner doesn't already have a SUI vault
        assert!(option::is_none(&cap.locked_sui_coin_id), E_YIELD_ALREADY_ACTIVE); // Reusing error constant
        
        let initial_sui_amount = coin::value(&initial_sui_coin);
        assert!(initial_sui_amount > 0, E_ZERO_COLLATERAL_AMOUNT);

        // Create the new SUI vault
        let vault = CollateralVault {
            id: object::new(ctx),
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            locked_sui_balance: coin::into_balance(initial_sui_coin)
        };
        
        let vault_id = object::uid_to_inner(&vault.id);
        
        // Update the PartnerCap to reference this new vault
        cap.locked_sui_coin_id = option::some(vault_id);

        // Calculate additional effective value from the SUI
        let additional_usdc_value = oracle::price_in_usdc(rate_oracle, initial_sui_amount);
        
        // Update cap's effective value and quotas
        cap.current_effective_usdc_value = cap.current_effective_usdc_value + additional_usdc_value;
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        // Emit events
        event::emit(CollateralVaultCreated {
            collateral_vault_id: vault_id,
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            initial_locked_sui_amount: initial_sui_amount
        });

        event::emit(CollateralWithdrawn {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            collateral_type: std::string::utf8(b"SUI_INITIAL"),
            withdrawn_effective_value: additional_usdc_value, // Reusing event for additions
            new_total_effective_value: cap.current_effective_usdc_value,
            new_lifetime_quota: new_lifetime_quota,
            new_daily_quota: new_daily_throttle
        });

        // Share the vault as a shared object
        transfer::share_object(vault);
    }

    // === SECURE WITHDRAWAL SYSTEM (Package Upgrade v2) ===
    
    /// Withdrawal control struct to track withdrawal history and prevent flash loan attacks
    /// This is a Dynamic Field attached to PartnerCapFlex to avoid changing existing struct
    public struct WithdrawalControl has store {
        // Security: Track withdrawal history to prevent flash loan attacks
        total_sui_withdrawn_lifetime: u64,
        last_withdrawal_epoch: u64,
        withdrawals_this_epoch: u64,
        // Security: Time-based restrictions
        first_mint_epoch: u64,           // When first Alpha Points were minted (prevents immediate withdrawal)
        minimum_aging_epochs: u64,       // Minimum epochs points must "age" before withdrawal allowed
        // Security: Economic protection
        max_withdrawal_per_epoch: u64,   // Maximum SUI that can be withdrawn per epoch
        emergency_pause: bool,           // Admin can pause withdrawals for security
    }

    /// Event for partial SUI withdrawal
    public struct PartialSuiWithdrawn has copy, drop {
        partner_cap_flex_id: object::ID,
        vault_id: object::ID,
        withdrawn_sui_amount: u64,
        required_backing_points: u64,    // Points that required backing
        points_backed_after_withdrawal: u64,
        new_vault_balance: u64,
        new_effective_usdc_value: u64,
        withdrawal_epoch: u64
    }

    /// Event for withdrawal control initialization
    public struct WithdrawalControlInitialized has copy, drop {
        partner_cap_flex_id: object::ID,
        current_epoch: u64,
        minimum_aging_epochs: u64,
        max_withdrawal_per_epoch: u64
    }

    // === Constants for Withdrawal Security ===
    
    /// Minimum epochs that minted points must age before allowing withdrawal (3 days assuming 24h epochs)
    const MINIMUM_AGING_EPOCHS: u64 = 3;
    
    /// Maximum percentage of vault that can be withdrawn per epoch (10% = 1000 basis points)
    const MAX_WITHDRAWAL_PER_EPOCH_BASIS_POINTS: u64 = 1000;
    
    /// Error codes for withdrawal system
    const E_WITHDRAWAL_WOULD_UNDERBACK_POINTS: u64 = 300;
    const E_INSUFFICIENT_AGED_POINTS: u64 = 301;
    const E_WITHDRAWAL_EXCEEDS_EPOCH_LIMIT: u64 = 302;
    const E_WITHDRAWAL_PAUSED: u64 = 303;
    const E_NO_SUI_VAULT: u64 = 304;
    const E_POINTS_TOO_YOUNG: u64 = 305;

    /// Dynamic field key for withdrawal control
    fun withdrawal_control_df_key(): vector<u8> {
        b"withdrawal_control_v1"
    }

    /// Initialize withdrawal control for a PartnerCapFlex (called automatically on first withdrawal attempt)
    fun init_withdrawal_control(cap: &mut PartnerCapFlex, ctx: &mut tx_context::TxContext) {
        let df_key = withdrawal_control_df_key();
        
        // Only initialize if it doesn't exist
        if (!df::exists_with_type<vector<u8>, WithdrawalControl>(&cap.id, df_key)) {
            let current_epoch = tx_context::epoch(ctx);
            
            // Calculate max withdrawal per epoch based on current vault size
            let max_withdrawal_per_epoch = if (option::is_some(&cap.locked_sui_coin_id)) {
                // This would need to be calculated based on actual vault balance
                // For now, using a conservative approach
                1000000000u64 // 1 SUI maximum per epoch initially
            } else {
                0u64
            };

            let withdrawal_control = WithdrawalControl {
                total_sui_withdrawn_lifetime: 0,
                last_withdrawal_epoch: 0,
                withdrawals_this_epoch: 0,
                first_mint_epoch: current_epoch, // Conservative: assume they just started minting
                minimum_aging_epochs: MINIMUM_AGING_EPOCHS,
                max_withdrawal_per_epoch: max_withdrawal_per_epoch,
                emergency_pause: false,
            };

            df::add(&mut cap.id, df_key, withdrawal_control);

            event::emit(WithdrawalControlInitialized {
                partner_cap_flex_id: object::uid_to_inner(&cap.id),
                current_epoch: current_epoch,
                minimum_aging_epochs: MINIMUM_AGING_EPOCHS,
                max_withdrawal_per_epoch: max_withdrawal_per_epoch
            });
        }
    }

    /// Calculate maximum withdrawable SUI amount with security constraints
    fun calculate_max_withdrawable_sui(
        cap: &PartnerCapFlex,
        vault: &CollateralVault,
        withdrawal_control: &WithdrawalControl,
        rate_oracle: &RateOracle,
        current_epoch: u64
    ): u64 {
        // Security check: Ensure points have aged sufficiently
        let epochs_since_first_mint = current_epoch - withdrawal_control.first_mint_epoch;
        if (epochs_since_first_mint < withdrawal_control.minimum_aging_epochs) {
            return 0u64 // No withdrawal allowed until points have aged
        };

        // Calculate backing requirement: points minted * $1 per 1000 points
        let points_minted = cap.total_points_minted_lifetime;
        let required_backing_usd = points_minted / 1000; // Each 1000 points requires $1 backing
        
        // Current vault value in USD
        let vault_balance_sui = balance::value(&vault.locked_sui_balance);
        let vault_value_usd = oracle::price_in_usdc(rate_oracle, vault_balance_sui);
        
        // Available for withdrawal (vault value - required backing)
        let withdrawable_usd = if (vault_value_usd > required_backing_usd) {
            vault_value_usd - required_backing_usd
        } else {
            0u64
        };
        
        // Convert back to SUI
        let withdrawable_sui = if (withdrawable_usd > 0) {
            oracle::usdc_to_sui_amount(rate_oracle, withdrawable_usd)
        } else {
            0u64
        };

        // Apply epoch withdrawal limit
        let epoch_limit_remaining = if (withdrawal_control.last_withdrawal_epoch == current_epoch) {
            if (withdrawal_control.withdrawals_this_epoch >= withdrawal_control.max_withdrawal_per_epoch) {
                0u64
            } else {
                withdrawal_control.max_withdrawal_per_epoch - withdrawal_control.withdrawals_this_epoch
            }
        } else {
            withdrawal_control.max_withdrawal_per_epoch
        };

        // Return the minimum of economic limit and epoch limit
        if (withdrawable_sui < epoch_limit_remaining) {
            withdrawable_sui
        } else {
            epoch_limit_remaining
        }
    }

    /// Withdraw partial SUI collateral with security protections
    public entry fun withdraw_partial_sui_collateral(
        cap: &mut PartnerCapFlex,
        vault: &mut CollateralVault,
        withdrawal_amount_sui: u64,
        rate_oracle: &RateOracle,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        
        // Verify ownership and basic constraints
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);
        assert!(withdrawal_amount_sui > 0, E_ZERO_COLLATERAL_AMOUNT);
        assert!(option::is_some(&cap.locked_sui_coin_id), E_NO_SUI_VAULT);
        assert!(vault.partner_cap_flex_id == object::uid_to_inner(&cap.id), E_MISMATCHED_VAULT);

        // Initialize withdrawal control if needed
        init_withdrawal_control(cap, ctx);
        
        // Get withdrawal control
        let df_key = withdrawal_control_df_key();
        let withdrawal_control = df::borrow_mut<vector<u8>, WithdrawalControl>(&mut cap.id, df_key);
        
        // Security check: Emergency pause
        assert!(!withdrawal_control.emergency_pause, E_WITHDRAWAL_PAUSED);

        // Calculate maximum allowed withdrawal with all security constraints
        let max_withdrawable = calculate_max_withdrawable_sui(
            cap, vault, withdrawal_control, rate_oracle, current_epoch
        );
        
        assert!(withdrawal_amount_sui <= max_withdrawable, E_WITHDRAWAL_EXCEEDS_EPOCH_LIMIT);
        assert!(max_withdrawable > 0, E_POINTS_TOO_YOUNG);

        // Verify vault has sufficient balance
        let vault_balance = balance::value(&vault.locked_sui_balance);
        assert!(vault_balance >= withdrawal_amount_sui, E_INSUFFICIENT_COLLATERAL_FOR_WITHDRAWAL);

        // Perform the withdrawal
        let withdrawn_coin = coin::take(&mut vault.locked_sui_balance, withdrawal_amount_sui, ctx);
        
        // Update withdrawal tracking
        withdrawal_control.total_sui_withdrawn_lifetime = withdrawal_control.total_sui_withdrawn_lifetime + withdrawal_amount_sui;
        
        if (withdrawal_control.last_withdrawal_epoch == current_epoch) {
            withdrawal_control.withdrawals_this_epoch = withdrawal_control.withdrawals_this_epoch + withdrawal_amount_sui;
        } else {
            withdrawal_control.last_withdrawal_epoch = current_epoch;
            withdrawal_control.withdrawals_this_epoch = withdrawal_amount_sui;
        };

        // Update PartnerCap effective value
        let withdrawn_usd_value = oracle::price_in_usdc(rate_oracle, withdrawal_amount_sui);
        cap.current_effective_usdc_value = cap.current_effective_usdc_value - withdrawn_usd_value;
        
        // Recalculate quotas
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        // Transfer SUI to partner
        sui::transfer::public_transfer(withdrawn_coin, partner_address);

        // Emit event
        event::emit(PartialSuiWithdrawn {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            vault_id: object::uid_to_inner(&vault.id),
            withdrawn_sui_amount: withdrawal_amount_sui,
            required_backing_points: cap.total_points_minted_lifetime,
            points_backed_after_withdrawal: cap.total_points_minted_lifetime, // Still same points, less backing
            new_vault_balance: balance::value(&vault.locked_sui_balance),
            new_effective_usdc_value: cap.current_effective_usdc_value,
            withdrawal_epoch: current_epoch
        });
    }

    /// Admin function to pause/unpause withdrawals in case of security concerns
    public entry fun set_emergency_withdrawal_pause(
        _admin_cap: &AdminCap,  // Only admin can call this
        cap: &mut PartnerCapFlex,
        pause_status: bool,
        ctx: &mut tx_context::TxContext
    ) {
        // Initialize withdrawal control if needed
        init_withdrawal_control(cap, ctx);
        
        let df_key = withdrawal_control_df_key();
        let withdrawal_control = df::borrow_mut<vector<u8>, WithdrawalControl>(&mut cap.id, df_key);
        
        withdrawal_control.emergency_pause = pause_status;
    }

    /// View function to get withdrawal info for a partner
    public fun get_withdrawal_info(
        cap: &PartnerCapFlex,
        vault: &CollateralVault,
        rate_oracle: &RateOracle,
        ctx: &tx_context::TxContext
    ): (u64, u64, u64, bool) {
        let current_epoch = tx_context::epoch(ctx);
        let df_key = withdrawal_control_df_key();
        
        if (!df::exists_with_type<vector<u8>, WithdrawalControl>(&cap.id, df_key)) {
            // No withdrawal control yet - return conservative values
            return (0u64, 0u64, 0u64, false)
        };

        let withdrawal_control = df::borrow<vector<u8>, WithdrawalControl>(&cap.id, df_key);
        let max_withdrawable = calculate_max_withdrawable_sui(cap, vault, withdrawal_control, rate_oracle, current_epoch);
        
        (
            max_withdrawable,                                    // max withdrawable amount
            withdrawal_control.total_sui_withdrawn_lifetime,     // total withdrawn lifetime
            withdrawal_control.withdrawals_this_epoch,           // withdrawn this epoch
            withdrawal_control.emergency_pause                   // is paused
        )
    }

    // === SECURE WITHDRAWAL SYSTEM (Package Upgrade v2) ===
    
    /// Withdrawal control struct to track withdrawal history and prevent flash loan attacks
    /// This is a Dynamic Field attached to PartnerCapFlex to avoid changing existing struct
    public struct WithdrawalControl has store {
        // Security: Track withdrawal history to prevent flash loan attacks
        total_sui_withdrawn_lifetime: u64,
        last_withdrawal_epoch: u64,
        withdrawals_this_epoch: u64,
        // Security: Time-based restrictions
        first_mint_epoch: u64,           // When first Alpha Points were minted (prevents immediate withdrawal)
        minimum_aging_epochs: u64,       // Minimum epochs points must "age" before withdrawal allowed
        // Security: Economic protection
        max_withdrawal_per_epoch: u64,   // Maximum SUI that can be withdrawn per epoch
        emergency_pause: bool,           // Admin can pause withdrawals for security
    }

    /// Event for partial SUI withdrawal
    public struct PartialSuiWithdrawn has copy, drop {
        partner_cap_flex_id: object::ID,
        vault_id: object::ID,
        withdrawn_sui_amount: u64,
        required_backing_points: u64,    // Points that required backing
        points_backed_after_withdrawal: u64,
        new_vault_balance: u64,
        new_effective_usdc_value: u64,
        withdrawal_epoch: u64
    }

    /// Event for withdrawal control initialization
    public struct WithdrawalControlInitialized has copy, drop {
        partner_cap_flex_id: object::ID,
        current_epoch: u64,
        minimum_aging_epochs: u64,
        max_withdrawal_per_epoch: u64
    }

    // === Constants for Withdrawal Security ===
    
    /// Minimum epochs that minted points must age before allowing withdrawal (3 days assuming 24h epochs)
    const MINIMUM_AGING_EPOCHS: u64 = 3;
    
    /// Maximum percentage of vault that can be withdrawn per epoch (10% = 1000 basis points)
    const MAX_WITHDRAWAL_PER_EPOCH_BASIS_POINTS: u64 = 1000;
    
    /// Error codes for withdrawal system
    const E_WITHDRAWAL_WOULD_UNDERBACK_POINTS: u64 = 300;
    const E_INSUFFICIENT_AGED_POINTS: u64 = 301;
    const E_WITHDRAWAL_EXCEEDS_EPOCH_LIMIT: u64 = 302;
    const E_WITHDRAWAL_PAUSED: u64 = 303;
    const E_NO_SUI_VAULT: u64 = 304;
    const E_POINTS_TOO_YOUNG: u64 = 305;

    /// Dynamic field key for withdrawal control
    fun withdrawal_control_df_key(): vector<u8> {
        b"withdrawal_control_v1"
    }

    /// Initialize withdrawal control for a PartnerCapFlex (called automatically on first withdrawal attempt)
    fun init_withdrawal_control(cap: &mut PartnerCapFlex, ctx: &mut tx_context::TxContext) {
        let df_key = withdrawal_control_df_key();
        
        // Only initialize if it doesn't exist
        if (!df::exists_with_type<vector<u8>, WithdrawalControl>(&cap.id, df_key)) {
            let current_epoch = tx_context::epoch(ctx);
            
            // Calculate max withdrawal per epoch based on current vault size
            let max_withdrawal_per_epoch = if (option::is_some(&cap.locked_sui_coin_id)) {
                // This would need to be calculated based on actual vault balance
                // For now, using a conservative approach
                1000000000u64 // 1 SUI maximum per epoch initially
            } else {
                0u64
            };

            let withdrawal_control = WithdrawalControl {
                total_sui_withdrawn_lifetime: 0,
                last_withdrawal_epoch: 0,
                withdrawals_this_epoch: 0,
                first_mint_epoch: current_epoch, // Conservative: assume they just started minting
                minimum_aging_epochs: MINIMUM_AGING_EPOCHS,
                max_withdrawal_per_epoch: max_withdrawal_per_epoch,
                emergency_pause: false,
            };

            df::add(&mut cap.id, df_key, withdrawal_control);

            event::emit(WithdrawalControlInitialized {
                partner_cap_flex_id: object::uid_to_inner(&cap.id),
                current_epoch: current_epoch,
                minimum_aging_epochs: MINIMUM_AGING_EPOCHS,
                max_withdrawal_per_epoch: max_withdrawal_per_epoch
            });
        }
    }

    /// Calculate maximum withdrawable SUI amount with security constraints
    fun calculate_max_withdrawable_sui(
        cap: &PartnerCapFlex,
        vault: &CollateralVault,
        withdrawal_control: &WithdrawalControl,
        rate_oracle: &RateOracle,
        current_epoch: u64
    ): u64 {
        // Security check: Ensure points have aged sufficiently
        let epochs_since_first_mint = current_epoch - withdrawal_control.first_mint_epoch;
        if (epochs_since_first_mint < withdrawal_control.minimum_aging_epochs) {
            return 0u64 // No withdrawal allowed until points have aged
        };

        // Calculate backing requirement: points minted * $1 per 1000 points
        let points_minted = cap.total_points_minted_lifetime;
        let required_backing_usd = points_minted / 1000; // Each 1000 points requires $1 backing
        
        // Current vault value in USD
        let vault_balance_sui = balance::value(&vault.locked_sui_balance);
        let vault_value_usd = oracle::price_in_usdc(rate_oracle, vault_balance_sui);
        
        // Available for withdrawal (vault value - required backing)
        let withdrawable_usd = if (vault_value_usd > required_backing_usd) {
            vault_value_usd - required_backing_usd
        } else {
            0u64
        };
        
        // Convert back to SUI
        let withdrawable_sui = if (withdrawable_usd > 0) {
            oracle::usdc_to_sui_amount(rate_oracle, withdrawable_usd)
        } else {
            0u64
        };

        // Apply epoch withdrawal limit
        let epoch_limit_remaining = if (withdrawal_control.last_withdrawal_epoch == current_epoch) {
            if (withdrawal_control.withdrawals_this_epoch >= withdrawal_control.max_withdrawal_per_epoch) {
                0u64
            } else {
                withdrawal_control.max_withdrawal_per_epoch - withdrawal_control.withdrawals_this_epoch
            }
        } else {
            withdrawal_control.max_withdrawal_per_epoch
        };

        // Return the minimum of economic limit and epoch limit
        if (withdrawable_sui < epoch_limit_remaining) {
            withdrawable_sui
        } else {
            epoch_limit_remaining
        }
    }

    /// Withdraw partial SUI collateral with security protections
    public entry fun withdraw_partial_sui_collateral(
        cap: &mut PartnerCapFlex,
        vault: &mut CollateralVault,
        withdrawal_amount_sui: u64,
        rate_oracle: &RateOracle,
        ctx: &mut tx_context::TxContext
    ) {
        let partner_address = tx_context::sender(ctx);
        let current_epoch = tx_context::epoch(ctx);
        
        // Verify ownership and basic constraints
        assert!(partner_address == cap.partner_address, E_NOT_OWNER);
        assert!(withdrawal_amount_sui > 0, E_ZERO_COLLATERAL_AMOUNT);
        assert!(option::is_some(&cap.locked_sui_coin_id), E_NO_SUI_VAULT);
        assert!(vault.partner_cap_flex_id == object::uid_to_inner(&cap.id), E_MISMATCHED_VAULT);

        // Initialize withdrawal control if needed
        init_withdrawal_control(cap, ctx);
        
        // Get withdrawal control
        let df_key = withdrawal_control_df_key();
        let withdrawal_control = df::borrow_mut<vector<u8>, WithdrawalControl>(&mut cap.id, df_key);
        
        // Security check: Emergency pause
        assert!(!withdrawal_control.emergency_pause, E_WITHDRAWAL_PAUSED);

        // Calculate maximum allowed withdrawal with all security constraints
        let max_withdrawable = calculate_max_withdrawable_sui(
            cap, vault, withdrawal_control, rate_oracle, current_epoch
        );
        
        assert!(withdrawal_amount_sui <= max_withdrawable, E_WITHDRAWAL_EXCEEDS_EPOCH_LIMIT);
        assert!(max_withdrawable > 0, E_POINTS_TOO_YOUNG);

        // Verify vault has sufficient balance
        let vault_balance = balance::value(&vault.locked_sui_balance);
        assert!(vault_balance >= withdrawal_amount_sui, E_INSUFFICIENT_COLLATERAL_FOR_WITHDRAWAL);

        // Perform the withdrawal
        let withdrawn_coin = coin::take(&mut vault.locked_sui_balance, withdrawal_amount_sui, ctx);
        
        // Update withdrawal tracking
        withdrawal_control.total_sui_withdrawn_lifetime = withdrawal_control.total_sui_withdrawn_lifetime + withdrawal_amount_sui;
        
        if (withdrawal_control.last_withdrawal_epoch == current_epoch) {
            withdrawal_control.withdrawals_this_epoch = withdrawal_control.withdrawals_this_epoch + withdrawal_amount_sui;
        } else {
            withdrawal_control.last_withdrawal_epoch = current_epoch;
            withdrawal_control.withdrawals_this_epoch = withdrawal_amount_sui;
        };

        // Update PartnerCap effective value
        let withdrawn_usd_value = oracle::price_in_usdc(rate_oracle, withdrawal_amount_sui);
        cap.current_effective_usdc_value = cap.current_effective_usdc_value - withdrawn_usd_value;
        
        // Recalculate quotas
        let (new_lifetime_quota, new_daily_throttle) = calculate_quota_and_throttle(cap.current_effective_usdc_value);
        cap.total_lifetime_quota_points = new_lifetime_quota;
        cap.daily_throttle_points = new_daily_throttle;

        // Transfer SUI to partner
        sui::transfer::public_transfer(withdrawn_coin, partner_address);

        // Emit event
        event::emit(PartialSuiWithdrawn {
            partner_cap_flex_id: object::uid_to_inner(&cap.id),
            vault_id: object::uid_to_inner(&vault.id),
            withdrawn_sui_amount: withdrawal_amount_sui,
            required_backing_points: cap.total_points_minted_lifetime,
            points_backed_after_withdrawal: cap.total_points_minted_lifetime, // Still same points, less backing
            new_vault_balance: balance::value(&vault.locked_sui_balance),
            new_effective_usdc_value: cap.current_effective_usdc_value,
            withdrawal_epoch: current_epoch
        });
    }

    /// Admin function to pause/unpause withdrawals in case of security concerns
    public entry fun set_emergency_withdrawal_pause(
        _admin_cap: &AdminCap,  // Only admin can call this
        cap: &mut PartnerCapFlex,
        pause_status: bool,
        ctx: &mut tx_context::TxContext
    ) {
        // Initialize withdrawal control if needed
        init_withdrawal_control(cap, ctx);
        
        let df_key = withdrawal_control_df_key();
        let withdrawal_control = df::borrow_mut<vector<u8>, WithdrawalControl>(&mut cap.id, df_key);
        
        withdrawal_control.emergency_pause = pause_status;
    }

    /// View function to get withdrawal info for a partner
    public fun get_withdrawal_info(
        cap: &PartnerCapFlex,
        vault: &CollateralVault,
        rate_oracle: &RateOracle,
        ctx: &tx_context::TxContext
    ): (u64, u64, u64, bool) {
        let current_epoch = tx_context::epoch(ctx);
        let df_key = withdrawal_control_df_key();
        
        if (!df::exists_with_type<vector<u8>, WithdrawalControl>(&cap.id, df_key)) {
            // No withdrawal control yet - return conservative values
            return (0u64, 0u64, 0u64, false)
        };

        let withdrawal_control = df::borrow<vector<u8>, WithdrawalControl>(&cap.id, df_key);
        let max_withdrawable = calculate_max_withdrawable_sui(cap, vault, withdrawal_control, rate_oracle, current_epoch);
        
        (
            max_withdrawable,                                    // max withdrawable amount
            withdrawal_control.total_sui_withdrawn_lifetime,     // total withdrawn lifetime
            withdrawal_control.withdrawals_this_epoch,           // withdrawn this epoch
            withdrawal_control.emergency_pause                   // is paused
        )
    }
}