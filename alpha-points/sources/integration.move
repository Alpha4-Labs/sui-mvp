// integration.move - Public entry points for the Alpha Points protocol
module alpha_points::integration {
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext, sender}; // Import sender explicitly
    use sui::coin::{Self, Coin, value as coin_value}; // Alias value
    use sui::transfer::{Self, public_transfer}; // Only public_transfer needed
    use sui::clock::{Self, Clock};
    use sui::event;

    // Import sibling modules
    // Import specific items needed
    use alpha_points::admin::{Self, Config, assert_not_paused, GovernCap}; // Removed PartnerCap from here
    use alpha_points::partner::{PartnerCap}; // Import PartnerCap from partner module
    use alpha_points::ledger::{Self, Ledger, internal_earn, internal_spend, internal_lock, internal_unlock, calculate_points}; // Use calculate_points
    use alpha_points::escrow::{Self, EscrowVault, deposit as escrow_deposit, withdraw as escrow_withdraw}; // Alias deposit/withdraw
    use alpha_points::stake_position::{Self, StakePosition, create_stake, owner as stake_owner, is_redeemable as stake_is_redeemable, chain_id as stake_chain_id, principal as stake_principal, destroy_stake}; // Alias functions
    use alpha_points::oracle::{Self, RateOracle, is_stale as oracle_is_stale, get_rate as oracle_get_rate, convert_points_to_asset}; // Use revised convert function

    // === Events ===
    // Added 'public' visibility
    public struct StakeRouted<phantom T> has copy, drop {
        user: address,
        amount: u64,
        duration_epochs: u64,
        stake_id: ID
    }

    // Added 'public' visibility
    public struct StakeRedeemed<phantom T> has copy, drop {
        user: address,
        amount: u64, // Principal amount redeemed
        stake_id: ID
    }

    // Added 'public' visibility
    public struct PointsRedeemed<phantom T> has copy, drop {
        user: address,
        points_amount: u64,
        asset_amount: u64,
        asset_type: TypeName // Added for clarity
    }

    // === Errors ===
    // Using error codes defined in specific modules where appropriate (e.g., admin::ECONFIG_PAUSED)
    // Define integration-specific errors
    const EINVALID_AMOUNT: u64 = 101; // Generic invalid amount (e.g., zero points/stake)
    const ESTAKE_NOT_OWNED: u64 = 102; // Caller does not own the stake object passed
    const ESTAKE_NOT_REDEEMABLE: u64 = 103; // Stake is encumbered or not mature
    const EORACLE_STALE: u64 = 104; // Oracle data is too old for conversion
    const ECHAIN_ID_MISMATCH: u64 = 105; // Stake originated from a different chain (relevant for redemption)
    const EUNAUTHORIZED_EARN_POINTS: u64 = 106; // Caller lacks PartnerCap/GovernCap for earn_points

    // Removed ECONTRACT_PAUSED (use admin::ECONFIG_PAUSED)
    // Removed EINVALID_STAKE_DURATION (use stake_position::EINVALID_DURATION)

    // Sui-specific chain ID constant (Example, adjust as needed)
    const SUI_CHAIN_ID: u64 = 1; // Placeholder

    // === Entry Functions ===

    /// Entry point for staking assets of type T. Deposits asset, creates StakePosition, awards points.
    public entry fun route_stake<T: store>(
        config: &Config,
        ledger: &mut Ledger,
        escrow_vault: &mut EscrowVault<T>,
        asset_coin: Coin<T>,
        duration_epochs: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config); // Check pause state first

        let sender = sender(ctx);
        let amount = coin_value(&asset_coin);
        assert!(amount > 0, EINVALID_AMOUNT);

        // 1. Deposit assets into Escrow
        escrow_deposit<T>(escrow_vault, asset_coin, ctx);

        // 2. Create StakePosition object (stake_position module handles duration validation)
        let stake = create_stake<T>(
            sender,
            SUI_CHAIN_ID, // Current chain ID
            amount,
            duration_epochs,
            clock,
            ctx
        );
        let stake_id = object::id(&stake);

        // 3. Calculate points based on formula (Using placeholder values - replace with actual logic/config)
        // These parameters should ideally come from governance or oracle config
        let participation_factor = 100_000_000_000_000_000; // Example: 0.1 (1e17)
        let time_weight_factor = duration_epochs * 10_000_000_000_000_000; // Example: Scales 0.01 per epoch
        let liquidity_factor = 1_000_000_000_000_000_000; // Example: 1.0 (no penalty)

        let points = calculate_points(
            amount,
            participation_factor,
            time_weight_factor,
            liquidity_factor
        );

        // Mint points (ledger module emits Earned event)
        if (points > 0) {
            internal_earn(ledger, sender, points, ctx);
        };

        // 4. Transfer StakePosition ownership to sender
        public_transfer(stake, sender);

        // Emit event specific to this integration action
        event::emit(StakeRouted<T> {
            user: sender,
            amount, // Principal staked
            duration_epochs,
            stake_id
        });
    }

    /// Entry point to redeem a completed stake (withdraw principal)
    public entry fun redeem_stake<T: store>(
        config: &Config,
        escrow_vault: &mut EscrowVault<T>,
        stake: StakePosition<T>, // Takes ownership of the stake object
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config); // Check pause state first

        let sender = sender(ctx);

        // Verify ownership and redemption conditions
        assert!(stake_owner(&stake) == sender, ESTAKE_NOT_OWNED);
        assert!(stake_is_redeemable(&stake, clock), ESTAKE_NOT_REDEEMABLE);
        // Optional: Check chain ID if cross-chain stakes are possible and redemption is chain-specific
        // assert!(stake_chain_id(&stake) == SUI_CHAIN_ID, ECHAIN_ID_MISMATCH);

        let principal_amount = stake_principal(&stake);
        let stake_id = object::id(&stake);

        // Withdraw principal from Escrow (escrow module emits EscrowWithdrawn event)
        escrow_withdraw<T>(escrow_vault, principal_amount, sender, ctx);

        // Destroy the stake position (stake_position module emits StakeDestroyed event)
        destroy_stake<T>(stake); // Consumes the stake object

        // Emit event specific to this integration action
        event::emit(StakeRedeemed<T> {
            user: sender,
            amount: principal_amount,
            stake_id
        });
    }

    /// Earn points (e.g., for off-chain activities). Requires PartnerCap or GovernCap authorization.
    public entry fun earn_points(
        config: &Config,
        ledger: &mut Ledger,
        _auth_cap: &PartnerCap, // Authorization: Require PartnerCap
        // Alternatively: _auth_cap: &admin::GovernCap, // Use GovernCap if preferred
        user: address, // The recipient of the points
        points_to_earn: u64,
        ctx: &TxContext
    ) {
        admin::assert_not_paused(config); // Check pause state first
        assert!(points_to_earn > 0, EINVALID_AMOUNT);

        // Authorization is implicitly checked by requiring _auth_cap reference

        // Mint points (ledger module emits Earned event)
        internal_earn(ledger, user, points_to_earn, ctx);
    }

    /// Spend points (sender spends their own points).
    public entry fun spend_points(
        config: &Config,
        ledger: &mut Ledger,
        points_to_spend: u64,
        ctx: &TxContext
    ) {
        admin::assert_not_paused(config); // Check pause state first
        assert!(points_to_spend > 0, EINVALID_AMOUNT);

        let sender = sender(ctx);

        // Burn points (ledger module emits Spent event)
        internal_spend(ledger, sender, points_to_spend, ctx);
    }

    /// Redeem points for underlying assets of type T.
    public entry fun redeem_points<T: store + drop>( // Add drop for TypeName
        config: &Config,
        ledger: &mut Ledger,
        escrow_vault: &mut EscrowVault<T>,
        oracle: &RateOracle,
        points_to_redeem: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config); // Check pause state first
        assert!(points_to_redeem > 0, EINVALID_AMOUNT);

        let sender = sender(ctx);

        // Check oracle staleness BEFORE getting rate
        assert!(!oracle_is_stale(oracle, clock), EORACLE_STALE);

        // Get rate info
        let (rate, decimals) = oracle_get_rate(oracle);

        // Calculate asset amount using the dedicated conversion function
        let asset_amount = convert_points_to_asset(points_to_redeem, rate, decimals);
        assert!(asset_amount > 0, EINVALID_AMOUNT); // Ensure conversion yields non-zero asset amount

        // Deduct points (ledger module emits Spent event)
        internal_spend(ledger, sender, points_to_redeem, ctx);

        // Withdraw assets from escrow (escrow module emits EscrowWithdrawn event)
        escrow_withdraw<T>(escrow_vault, asset_amount, sender, ctx);

        // Emit event specific to this integration action
        event::emit(PointsRedeemed<T> {
            user: sender,
            points_amount: points_to_redeem,
            asset_amount,
            asset_type: type_name::get<T>() // Get the type name string
        });
    }

    /// Lock available points (sender locks their own points).
    public entry fun lock_points(
        config: &Config,
        ledger: &mut Ledger,
        points_to_lock: u64,
        ctx: &TxContext
    ) {
        admin::assert_not_paused(config); // Check pause state first
        assert!(points_to_lock > 0, EINVALID_AMOUNT);

        let sender = sender(ctx);

        // Lock points (ledger module emits Locked event)
        internal_lock(ledger, sender, points_to_lock, ctx);
    }

    /// Unlock locked points (sender unlocks their own points).
    public entry fun unlock_points(
        config: &Config,
        ledger: &mut Ledger,
        points_to_unlock: u64,
        ctx: &TxContext
    ) {
        admin::assert_not_paused(config); // Check pause state first
        assert!(points_to_unlock > 0, EINVALID_AMOUNT);

        let sender = sender(ctx);

        // Unlock points (ledger module emits Unlocked event)
        // Note: Add checks here if unlocking is conditional (e.g., time-based vesting)
        internal_unlock(ledger, sender, points_to_unlock, ctx);
    }

    // === Feature Flagged Function Stub ===

    /// Placeholder function for sending a cross-chain message via LayerZero.
    /// Only compiled if the 'lz_bridge' feature is enabled.
    #[cfg(feature = "lz_bridge")]
    public entry fun send_bridge_message(
        config: &Config,
        // ledger: &mut Ledger, // Might need ledger to burn points
        // lz_bridge_config: &alpha_points::lz_bridge::Config, // Assumes a config object exists
        destination_chain_id: u64,
        message_payload: vector<u8>, // Example payload
        ctx: &mut TxContext
    ) {
         admin::assert_not_paused(config);
         // Placeholder: Implement actual call to lz_bridge module function
         // e.g., alpha_points::lz_bridge::send(lz_bridge_config, destination_chain_id, message_payload, ctx);
         abort(0) // Abort until implemented
    }

}