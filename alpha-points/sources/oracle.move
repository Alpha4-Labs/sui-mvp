// oracle.move - Manages conversion rates or other external data
module alpha_points::oracle {
    use sui::object;
    use sui::tx_context::{Self, TxContext, epoch};
    use sui::transfer::share_object;
    use sui::event;
    use sui::clock::Clock;

    // Import the capability type from the admin module
    use alpha_points::admin::OracleCap;

    // === Constants ===
    const FIXED_POINT_SCALE_U128: u128 = 1_000_000_000_000_000_000;
    const MAX_U64: u128 = 18_446_744_073_709_551_615;

    // === Structs ===
    public struct RateOracle has key {
        id: object::UID,
        base_rate: u128,
        decimals: u8,
        last_update_epoch: u64,
        staleness_threshold: u64,
    }

    // === Events ===
    public struct OracleCreated has copy, drop {
        oracle_id: object::ID,
        initial_rate: u128,
    }
    public struct RateUpdated has copy, drop {
        oracle_id: object::ID,
        new_rate: u128,
        by: address,
    }
    public struct StalenessThresholdUpdated has copy, drop {
        oracle_id: object::ID,
        old_threshold: u64,
        new_threshold: u64,
        updater: address,
    }

    // === Errors ===
    const EINVALID_RATE: u64 = 1;
    #[allow(unused_const)]
    const EUNAUTHORIZED_ORACLE_UPDATE: u64 = 2;
    const EINVALID_DECIMALS: u64 = 3;
    const EINVALID_STALENESS_THRESHOLD: u64 = 4;
    const ERATE_STALE: u64 = 5;
    const ECONVERSION_OVERFLOW: u64 = 6;

    // === Public Functions ===
    public entry fun create_oracle(
        _oracle_cap: &OracleCap,
        initial_rate: u128,
        decimals: u8,
        staleness_threshold: u64,
        ctx: &mut TxContext
    ) {
        assert!(initial_rate > 0, EINVALID_RATE);
        assert!(decimals <= 18, EINVALID_DECIMALS);
        assert!(staleness_threshold > 0, EINVALID_STALENESS_THRESHOLD);

        let oracle_uid = object::new(ctx);
        // Fixed: using object::uid_to_inner instead of id()
        let oracle_id = object::uid_to_inner(&oracle_uid);
        let oracle = RateOracle {
            id: oracle_uid, 
            base_rate: initial_rate, 
            decimals,
            last_update_epoch: epoch(ctx), // Use tx_context::epoch
            staleness_threshold,
        };
        event::emit(OracleCreated { oracle_id, initial_rate });
        share_object(oracle);
    }

    public entry fun update_rate(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap,
        new_rate: u128,
        ctx: &TxContext
    ) {
        assert!(new_rate > 0, EINVALID_RATE);
        oracle.base_rate = new_rate;
        let current_epoch = epoch(ctx); // Use tx_context::epoch
        oracle.last_update_epoch = current_epoch;
        let updater_address = tx_context::sender(ctx);
        // Fixed: using object::uid_to_inner instead of id()
        let oracle_id = object::uid_to_inner(&oracle.id);
        event::emit(RateUpdated { oracle_id, new_rate, by: updater_address });
    }

    public entry fun update_staleness_threshold(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap,
        new_threshold: u64,
        ctx: &TxContext
    ) {
        assert!(new_threshold > 0, EINVALID_STALENESS_THRESHOLD);
        let old_threshold = oracle.staleness_threshold;
        oracle.staleness_threshold = new_threshold;
        // Fixed: using object::uid_to_inner instead of id()
        let oracle_id = object::uid_to_inner(&oracle.id);
        event::emit(StalenessThresholdUpdated {
            oracle_id, 
            old_threshold, 
            new_threshold, 
            updater: tx_context::sender(ctx)
        });
    }

    // === Public View Functions ===
    public fun get_rate(oracle: &RateOracle): (u128, u8) { 
        (oracle.base_rate, oracle.decimals) 
    }
    
    public fun last_update_epoch(oracle: &RateOracle): u64 { 
        oracle.last_update_epoch 
    }
    
    public fun is_stale(oracle: &RateOracle, _clock: &Clock): bool {
        // In a real implementation, would get epoch from Clock
        // For now, simulate a check using the oracle's last update epoch
        let current_epoch = oracle.last_update_epoch + 1; // Just for simulation
        
        if (current_epoch <= oracle.last_update_epoch) { 
            return false 
        };
        
        (current_epoch - oracle.last_update_epoch) > oracle.staleness_threshold
    }

    // === Package-Protected Conversion Function ===
    public(package) fun convert_points_to_asset(
        points: u64,
        rate: u128,
        _decimals: u8 // Keep param name to document what it represents
    ): u64 {
        assert!(rate > 0, EINVALID_RATE);
        
        if (points == 0) { 
            return 0 
        };
        
        let points_u128 = (points as u128);
        let intermediate_result = points_u128 * rate;
        
        if (rate > 0) { 
            assert!(intermediate_result / rate == points_u128, ECONVERSION_OVERFLOW); 
        };
        
        let denominator = FIXED_POINT_SCALE_U128;
        let rounded_intermediate = intermediate_result + (denominator / 2);
        assert!(rounded_intermediate >= intermediate_result, ECONVERSION_OVERFLOW);
        
        let result_u128 = rounded_intermediate / denominator;
        // Optional decimal adjustment removed for simplicity for now
        assert!(result_u128 <= MAX_U64, ECONVERSION_OVERFLOW);
        
        (result_u128 as u64)
    }
    
    // Provide public getters for constants
    public fun fixed_point_scale(): u128 { FIXED_POINT_SCALE_U128 }
    public fun max_u64_value(): u128 { MAX_U64 }
    public fun invalid_rate_error(): u64 { EINVALID_RATE }
    public fun conversion_overflow_error(): u64 { ECONVERSION_OVERFLOW }
    public fun rate_stale_error(): u64 { ERATE_STALE }
}