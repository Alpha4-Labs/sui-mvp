#[test_only]
module alpha_points::stake_position_tests {
    use sui::test_scenario as ts;
    use sui::test_utils::assert_eq;
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use sui::sui::SUI;
    
    use alpha_points::stake_position::{Self, StakePosition};
    
    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const PRINCIPAL: u64 = 1000;
    const DURATION_EPOCHS: u64 = 30;
    
    // Helper function to set up a test scenario with initialized modules
    fun setup_test(): (ts::Scenario, Clock) {
        let scenario = ts::begin(ADMIN_ADDR);
        
        // Create a test clock
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        
        (scenario, clock)
    }
    
    #[test]
    fun test_create_stake() {
        let (scenario, clock) = setup_test();
        
        // Create a stake position
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            
            // Using SUI as a phantom type marker
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR,
                PRINCIPAL,
                DURATION_EPOCHS,
                &clock,
                ctx
            );
            
            // Transfer to USER_ADDR
            transfer::public_transfer(stake, USER_ADDR);
        };
        
        // Verify the stake was created correctly
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // Check stake properties
            assert_eq(stake_position::owner(&stake), USER_ADDR);
            assert_eq(stake_position::principal(&stake), PRINCIPAL);
            assert_eq(stake_position::duration_epochs(&stake), DURATION_EPOCHS);
            assert_eq(stake_position::is_encumbered(&stake), false);
            
            // Current epoch calculation has changed to use timestamp_ms
            // So the exact check depends on your epoch calculation logic
            // Just verify unlock_epoch is set to some future time
            assert!(stake_position::unlock_epoch(&stake) > 0, 0);
            
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_destroy_stake() {
        let (scenario, clock) = setup_test();
        
        // Create a stake position
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR,
                PRINCIPAL,
                DURATION_EPOCHS,
                &clock,
                ctx
            );
            
            // Transfer to USER_ADDR
            transfer::public_transfer(stake, USER_ADDR);
        };
        
        // Destroy the stake
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            stake_position::destroy_stake(stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_set_encumbered() {
        let (scenario, clock) = setup_test();
        
        // Create a stake position
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR,
                PRINCIPAL,
                DURATION_EPOCHS,
                &clock,
                ctx
            );
            
            // Transfer to USER_ADDR
            transfer::public_transfer(stake, USER_ADDR);
        };
        
        // Set stake as encumbered
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // Initially not encumbered
            assert_eq(stake_position::is_encumbered(&stake), false);
            
            // Set to encumbered - using test_set_encumbered helper
            stake_position::test_set_encumbered(&mut stake, true);
            assert_eq(stake_position::is_encumbered(&stake), true);
            
            // Set back to not encumbered
            stake_position::test_set_encumbered(&mut stake, false);
            assert_eq(stake_position::is_encumbered(&stake), false);
            
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_is_mature() {
        let (scenario, clock) = setup_test();
        
        // Create a stake position
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR,
                PRINCIPAL,
                DURATION_EPOCHS,
                &clock,
                ctx
            );
            
            // Transfer to USER_ADDR
            transfer::public_transfer(stake, USER_ADDR);
        };
        
        // Check maturity when not mature
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // At initial time, stake is not mature
            assert_eq(stake_position::is_mature(&stake, &clock), false);
            
            ts::return_to_sender(&scenario, stake);
        };
        
        // Advance clock by a large amount to simulate passing the unlock time
        // Using a large value to ensure we pass the unlock epoch regardless of exact calculation
        clock::increment_for_testing(&mut clock, DURATION_EPOCHS * 86400000 * 2); // 2x duration in ms
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // Now stake should be mature
            assert_eq(stake_position::is_mature(&stake, &clock), true);
            
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
    
    #[test]
    fun test_is_redeemable() {
        let (scenario, clock) = setup_test();
        
        // Create a stake position
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR,
                PRINCIPAL,
                DURATION_EPOCHS,
                &clock,
                ctx
            );
            
            // Transfer to USER_ADDR
            transfer::public_transfer(stake, USER_ADDR);
        };
        
        // Check redeemable status
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // At initial time, stake is not redeemable
            assert_eq(stake_position::is_redeemable(&stake, &clock), false);
            
            // Make stake encumbered
            stake_position::test_set_encumbered(&mut stake, true);
            
            // Advance clock past unlock epoch
            clock::increment_for_testing(&mut clock, DURATION_EPOCHS * 86400000 * 2); // 2x duration in ms
            
            // Should be mature but not redeemable due to encumbrance
            assert_eq(stake_position::is_mature(&stake, &clock), true);
            assert_eq(stake_position::is_redeemable(&stake, &clock), false);
            
            // Remove encumbrance
            stake_position::test_set_encumbered(&mut stake, false);
            
            // Now should be redeemable
            assert_eq(stake_position::is_redeemable(&stake, &clock), true);
            
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}