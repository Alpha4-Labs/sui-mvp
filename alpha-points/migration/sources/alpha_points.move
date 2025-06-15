module alpha_points::alpha_points {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use std::vector;

    // ===== Error Codes =====
    const EInvalidAmount: u64 = 0;
    const EInsufficientBalance: u64 = 1;
    const EUnauthorized: u64 = 2;
    const EInvalidStake: u64 = 3;
    const EStakeNotFound: u64 = 4;

    // ===== Structs =====
    
    /// Admin capability for the protocol
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Configuration object for the protocol
    public struct Config has key, store {
        id: UID,
        admin: address,
        fee_rate: u64,
        min_stake_amount: u64,
    }

    /// Staking manager that holds custody of stakes
    public struct StakingManager has key, store {
        id: UID,
        total_staked: u64,
        stake_count: u64,
    }

    /// Individual stake position
    public struct StakedSui has key, store {
        id: UID,
        owner: address,
        amount: u64,
        stake_time: u64,
        package_version: address, // Track which package created this stake
    }

    /// Unstake request
    public struct UnstakeRequest has key, store {
        id: UID,
        owner: address,
        stake_id: ID,
        amount: u64,
        request_time: u64,
    }

    // ===== Events =====
    
    public struct StakeEvent has copy, drop {
        user: address,
        amount: u64,
        stake_id: ID,
    }

    public struct UnstakeRequestEvent has copy, drop {
        user: address,
        stake_id: ID,
        amount: u64,
    }

    public struct AdminRescueEvent has copy, drop {
        admin: address,
        stake_id: ID,
        owner: address,
        amount: u64,
    }

    // ===== Init Function =====
    
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        
        let config = Config {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            fee_rate: 100, // 1%
            min_stake_amount: 1000000000, // 1 SUI
        };

        let staking_manager = StakingManager {
            id: object::new(ctx),
            total_staked: 0,
            stake_count: 0,
        };

        transfer::transfer(admin_cap, tx_context::sender(ctx));
        transfer::share_object(config);
        transfer::share_object(staking_manager);
    }

    // ===== Original Functions (from bytecode) =====

    /// Stake SUI tokens
    public entry fun stake_native_sui(
        config: &Config,
        staking_manager: &mut StakingManager,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        assert!(amount >= config.min_stake_amount, EInvalidAmount);

        let stake = StakedSui {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            amount,
            stake_time: tx_context::epoch(ctx),
            package_version: @alpha_points,
        };

        let stake_id = object::id(&stake);
        
        // Update staking manager
        staking_manager.total_staked = staking_manager.total_staked + amount;
        staking_manager.stake_count = staking_manager.stake_count + 1;

        // Transfer payment to staking manager (simplified - in real implementation would be more complex)
        transfer::public_transfer(payment, @alpha_points);
        
        // Transfer stake to user
        transfer::transfer(stake, tx_context::sender(ctx));

        event::emit(StakeEvent {
            user: tx_context::sender(ctx),
            amount,
            stake_id,
        });
    }

    /// Request unstake (original function that requires missing shared objects)
    public entry fun request_unstake_native_sui(
        config: &Config,
        staking_manager: &mut StakingManager,
        stake: StakedSui,
        // These parameters would be required but don't exist in broken package:
        // mint_stats: &MintStats,
        // supply_oracle: &SupplyOracle,
        ctx: &mut TxContext
    ) {
        let stake_id = object::id(&stake);
        let amount = stake.amount;
        let owner = stake.owner;

        assert!(owner == tx_context::sender(ctx), EUnauthorized);

        let unstake_request = UnstakeRequest {
            id: object::new(ctx),
            owner,
            stake_id,
            amount,
            request_time: tx_context::epoch(ctx),
        };

        // Update staking manager
        staking_manager.total_staked = staking_manager.total_staked - amount;
        staking_manager.stake_count = staking_manager.stake_count - 1;

        // Delete the stake
        let StakedSui { id, owner: _, amount: _, stake_time: _, package_version: _ } = stake;
        object::delete(id);

        transfer::transfer(unstake_request, owner);

        event::emit(UnstakeRequestEvent {
            user: owner,
            stake_id,
            amount,
        });
    }

    // Note: admin_claim_forfeited_stake function from bytecode is not included
    // because it requires EscrowVault which doesn't exist for StakedSui objects

    // ===== NEW ADMIN RESCUE FUNCTIONS =====

    /// NEW: Admin function to rescue trapped stakes by transferring them to a recovery address
    public entry fun admin_rescue_trapped_stake(
        admin_cap: &AdminCap,
        config: &Config,
        staking_manager: &mut StakingManager,
        stake: StakedSui,
        recovery_address: address,
        ctx: &mut TxContext
    ) {
        // Verify admin authority
        assert!(tx_context::sender(ctx) == config.admin, EUnauthorized);
        
        let stake_id = object::id(&stake);
        let amount = stake.amount;
        let original_owner = stake.owner;

        // Update staking manager to reflect rescued stake
        staking_manager.total_staked = staking_manager.total_staked - amount;
        staking_manager.stake_count = staking_manager.stake_count - 1;

        // Transfer stake to recovery address
        transfer::transfer(stake, recovery_address);

        event::emit(AdminRescueEvent {
            admin: tx_context::sender(ctx),
            stake_id,
            owner: original_owner,
            amount,
        });
    }

    /// NEW: Admin function to batch rescue multiple trapped stakes
    public entry fun admin_batch_rescue_trapped_stakes(
        admin_cap: &AdminCap,
        config: &Config,
        staking_manager: &mut StakingManager,
        stakes: vector<StakedSui>,
        recovery_address: address,
        ctx: &mut TxContext
    ) {
        // Verify admin authority
        assert!(tx_context::sender(ctx) == config.admin, EUnauthorized);
        
        let i = 0;
        let len = vector::length(&stakes);
        
        while (i < len) {
            let stake = vector::pop_back(&mut stakes);
            let stake_id = object::id(&stake);
            let amount = stake.amount;
            let original_owner = stake.owner;

            // Update staking manager
            staking_manager.total_staked = staking_manager.total_staked - amount;
            staking_manager.stake_count = staking_manager.stake_count - 1;

            // Transfer stake to recovery address
            transfer::transfer(stake, recovery_address);

            event::emit(AdminRescueEvent {
                admin: tx_context::sender(ctx),
                stake_id,
                owner: original_owner,
                amount,
            });

            i = i + 1;
        };

        vector::destroy_empty(stakes);
    }

    /// NEW: Admin function to convert trapped stake to SUI and send to original owner
    public entry fun admin_convert_trapped_stake_to_sui(
        admin_cap: &AdminCap,
        config: &Config,
        staking_manager: &mut StakingManager,
        stake: StakedSui,
        treasury: &mut Coin<SUI>, // Admin provides SUI treasury to pay out
        ctx: &mut TxContext
    ) {
        // Verify admin authority
        assert!(tx_context::sender(ctx) == config.admin, EUnauthorized);
        
        let stake_id = object::id(&stake);
        let amount = stake.amount;
        let original_owner = stake.owner;

        // Verify treasury has enough SUI
        assert!(coin::value(treasury) >= amount, EInsufficientBalance);

        // Update staking manager
        staking_manager.total_staked = staking_manager.total_staked - amount;
        staking_manager.stake_count = staking_manager.stake_count - 1;

        // Extract SUI from treasury and send to original owner
        let payout = coin::split(treasury, amount, ctx);
        transfer::public_transfer(payout, original_owner);

        // Delete the stake
        let StakedSui { id, owner: _, amount: _, stake_time: _, package_version: _ } = stake;
        object::delete(id);

        event::emit(AdminRescueEvent {
            admin: tx_context::sender(ctx),
            stake_id,
            owner: original_owner,
            amount,
        });
    }

    /// NEW: Admin function to unencumber stakes by changing ownership to admin
    public entry fun admin_unencumber_trapped_stake(
        admin_cap: &AdminCap,
        config: &Config,
        staking_manager: &mut StakingManager,
        stake: StakedSui,
        ctx: &mut TxContext
    ) {
        // Verify admin authority
        assert!(tx_context::sender(ctx) == config.admin, EUnauthorized);
        
        let stake_id = object::id(&stake);
        let amount = stake.amount;
        let original_owner = stake.owner;

        // Update staking manager
        staking_manager.total_staked = staking_manager.total_staked - amount;
        staking_manager.stake_count = staking_manager.stake_count - 1;

        // Transfer stake to admin for manual processing
        transfer::transfer(stake, tx_context::sender(ctx));

        event::emit(AdminRescueEvent {
            admin: tx_context::sender(ctx),
            stake_id,
            owner: original_owner,
            amount,
        });
    }

    // ===== View Functions =====

    /// Get stake information
    public fun get_stake_info(stake: &StakedSui): (address, u64, u64, address) {
        (stake.owner, stake.amount, stake.stake_time, stake.package_version)
    }

    /// Get staking manager stats
    public fun get_staking_stats(staking_manager: &StakingManager): (u64, u64) {
        (staking_manager.total_staked, staking_manager.stake_count)
    }

    /// Check if stake is from broken package
    public fun is_trapped_stake(stake: &StakedSui): bool {
        stake.package_version == @alpha_points
    }

    // ===== Test Functions =====
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
} 