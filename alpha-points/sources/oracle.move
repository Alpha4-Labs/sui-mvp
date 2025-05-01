/// Module that provides asset price/rate information for Alpha Points against 
/// other assets or a base currency like USDC.
module alpha_points::oracle {
    use sui::object;
    use sui::transfer;
    use sui::tx_context;
    use sui::event;
    use sui::clock::Clock;
    
    use alpha_points::admin::OracleCap;
    
    // Error constants
    const EInvalidRate: u64 = 1;
    const EInvalidDecimals: u64 = 2;
    const EOracleStale: u64 = 3;
    
    /// Shared object holding rate information
    public struct RateOracle has key {
        id: object::UID,
        base_rate: u128,          // Fixed-point representation
        decimals: u8,             // Number of decimal places in base_rate
        last_update_epoch: u64,   // When rate was last updated
        staleness_threshold: u64  // Max epochs before oracle is considered stale
    }
    
    // Events
    public struct OracleCreated has copy, drop {
        id: object::ID,
        initial_rate: u128,
        decimals: u8,
        threshold: u64
    }
    
    public struct RateUpdated has copy, drop {
        id: object::ID,
        old_rate: u128,
        new_rate: u128,
        update_epoch: u64
    }
    
    public struct StalenessThresholdUpdated has copy, drop {
        id: object::ID,
        old_threshold: u64,
        new_threshold: u64
    }
    
    // === Test-only functions ===
    #[test_only]
    /// Initialize oracle with a GovernCap for testing purposes
    public fun create_oracle_for_testing(
        _gov_cap: &OracleCap,  // Using OracleCap type for testing
        initial_rate: u128,
        decimals: u8,
        threshold: u64,
        ctx: &mut tx_context::TxContext
    ) {
        create_oracle(_gov_cap, initial_rate, decimals, threshold, ctx)
    }
    
    // === Core module functions ===
    
    /// Creates and shares RateOracle
    public entry fun create_oracle(
        _oracle_cap: &OracleCap,
        initial_rate: u128,
        decimals: u8,
        threshold: u64,
        ctx: &mut tx_context::TxContext
    ) {
        // Validate inputs
        assert!(initial_rate > 0, EInvalidRate);
        assert!(decimals <= 18, EInvalidDecimals); // Limit max decimals to prevent overflow
        
        let id = object::new(ctx);
        
        // Create oracle with initial values
        let oracle = RateOracle {
            id,
            base_rate: initial_rate,
            decimals,
            last_update_epoch: 0, // Will be set in first update
            staleness_threshold: threshold
        };
        
        // Emit event
        event::emit(OracleCreated {
            id: object::uid_to_inner(&oracle.id),
            initial_rate,
            decimals,
            threshold
        });
        
        // Share the oracle
        transfer::share_object(oracle);
    }
    
    /// Updates oracle.base_rate and last_update_epoch
    public entry fun update_rate(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap,
        new_rate: u128,
        ctx: &tx_context::TxContext
    ) {
        // Validate inputs
        assert!(new_rate > 0, EInvalidRate);
        
        let old_rate = oracle.base_rate;
        
        // Using tx_context's epoch instead of clock::epoch
        let current_epoch = tx_context::epoch(ctx);
        
        // Update rate and timestamp
        oracle.base_rate = new_rate;
        oracle.last_update_epoch = current_epoch;
        
        // Emit event
        event::emit(RateUpdated {
            id: object::uid_to_inner(&oracle.id),
            old_rate,
            new_rate,
            update_epoch: current_epoch
        });
    }
    
    /// Updates oracle.staleness_threshold
    public entry fun update_staleness_threshold(
        oracle: &mut RateOracle,
        _oracle_cap: &OracleCap,
        new_threshold: u64,
        _ctx: &tx_context::TxContext
    ) {
        let old_threshold = oracle.staleness_threshold;
        
        // Update threshold
        oracle.staleness_threshold = new_threshold;
        
        // Emit event
        event::emit(StalenessThresholdUpdated {
            id: object::uid_to_inner(&oracle.id),
            old_threshold,
            new_threshold
        });
    }
    
    /// Converts Alpha Points to asset amount using the oracle rate
    public fun convert_points_to_asset(
        points: u64,
        rate: u128,
        decimals: u8
    ): u64 {
        if (points == 0 || rate == 0) {
            return 0
        };
        
        // Apply rate to points with fixed-point math
        let scaled_points = (points as u128);
        let result = (scaled_points * rate) / (pow10(decimals));
        
        // Convert back to u64, capping at u64::MAX if necessary
        if (result > (18446744073709551615 as u128)) {
            18446744073709551615
        } else {
            (result as u64)
        }
    }
    
    /// Converts asset amount to Alpha Points using the oracle rate
    public fun convert_asset_to_points(
        asset: u64,
        rate: u128,
        decimals: u8
    ): u64 {
        if (asset == 0 || rate == 0) {
            return 0
        };
        
        // Calculate inverse rate and apply to asset with fixed-point math
        let scaled_asset = (asset as u128);
        let pow_decimals = pow10(decimals);
        
        // points = asset * (10^decimals / rate)
        let result = (scaled_asset * pow_decimals) / rate;
        
        // Convert back to u64, capping at u64::MAX if necessary
        if (result > (18446744073709551615 as u128)) {
            18446744073709551615
        } else {
            (result as u64)
        }
    }
    
    // === View functions ===
    
    /// Returns the oracle rate and decimals
    public fun get_rate(oracle: &RateOracle): (u128, u8) {
        (oracle.base_rate, oracle.decimals)
    }
    
    /// Returns whether the oracle is stale
    public fun is_stale(oracle: &RateOracle, clock: &Clock): bool {
        // Using timestamp_ms for time tracking
        let current_time_ms = sui::clock::timestamp_ms(clock);
        // Convert timestamp to epochs - adjust based on your epoch definition
        let current_epoch = current_time_ms / 86400000; // ms to days as simple epoch
        
        current_epoch > oracle.last_update_epoch + oracle.staleness_threshold
    }
    
    /// Returns the staleness threshold
    public fun get_staleness_threshold(oracle: &RateOracle): u64 {
        oracle.staleness_threshold
    }
    
    /// Asserts that the oracle is not stale
    public fun assert_not_stale(oracle: &RateOracle, clock: &Clock) {
        assert!(!is_stale(oracle, clock), EOracleStale);
    }
    
    // === Helper functions ===
    
    /// Calculate 10^n
    fun pow10(n: u8): u128 {
        let mut i = 0;
        let mut result = 1u128;
        
        while (i < n) {
            result = result * 10;
            i = i + 1;
        };
        
        result
    }
}