#[test_only]
module alpha_points::stake_position_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use sui::sui::SUI;
    use sui::tx_context::{TxContext};

    use alpha_points::stake_position::{Self, StakePosition, test_set_encumbered};

    const ADMIN_ADDR: address = @0xAD;
    const USER_ADDR: address = @0xA;
    const PRINCIPAL: u64 = 1000;
    const DURATION_EPOCHS: u64 = 30;

    // Helper function to set up the test environment
    fun setup_test(): (Scenario, Clock) {
        let mut scenario = ts::begin(ADMIN_ADDR);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        (scenario, clock)
    }

    #[test]
    fun test_create_stake() {
        let (mut scenario, clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR, PRINCIPAL, DURATION_EPOCHS, &clock, ctx
            );
            transfer::public_transfer(stake, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            assert_eq(stake_position::owner(&stake), USER_ADDR);
            assert_eq(stake_position::principal(&stake), PRINCIPAL);
            assert_eq(stake_position::duration_epochs(&stake), DURATION_EPOCHS);
            assert_eq(stake_position::is_encumbered(&stake), false);
            assert!(stake_position::unlock_epoch(&stake) > 0, 0);
            ts::return_to_sender(&scenario, stake);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_destroy_stake() {
        let (mut scenario, clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR, PRINCIPAL, DURATION_EPOCHS, &clock, ctx
            );
            transfer::public_transfer(stake, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            stake_position::destroy_stake<SUI>(stake);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_toggle_encumbered_status() {
        let (mut scenario, clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR, PRINCIPAL, DURATION_EPOCHS, &clock, ctx
            );
            transfer::public_transfer(stake, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            assert_eq(stake_position::is_encumbered(&stake), false);
            test_set_encumbered<SUI>(&mut stake, true);
            assert_eq(stake_position::is_encumbered(&stake), true);
            test_set_encumbered<SUI>(&mut stake, false);
            assert_eq(stake_position::is_encumbered(&stake), false);
            ts::return_to_sender(&scenario, stake);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_is_mature() {
        let (mut scenario, mut clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR, PRINCIPAL, DURATION_EPOCHS, &clock, ctx
            );
            transfer::public_transfer(stake, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            assert_eq(stake_position::is_mature(&stake, &clock), false);
            ts::return_to_sender(&scenario, stake);
        };
        
        // Advance the clock past the maturity period
        clock::increment_for_testing(&mut clock, DURATION_EPOCHS * 86400000 * 2);
        
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            assert_eq(stake_position::is_mature(&stake, &clock), true);
            ts::return_to_sender(&scenario, stake);
        };
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_is_redeemable() {
        let (mut scenario, mut clock) = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            let stake = stake_position::create_stake<SUI>(
                USER_ADDR, PRINCIPAL, DURATION_EPOCHS, &clock, ctx
            );
            transfer::public_transfer(stake, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut stake = ts::take_from_sender<StakePosition<SUI>>(&scenario);
            
            // Not mature yet, should not be redeemable
            assert_eq(stake_position::is_redeemable(&stake, &clock), false);
            
            // Set as encumbered
            test_set_encumbered<SUI>(&mut stake, true);
            
            // Advance clock to make stake mature
            clock::increment_for_testing(&mut clock, DURATION_EPOCHS * 86400000 * 2);
            
            // Even though mature, still not redeemable since encumbered
            assert_eq(stake_position::is_mature(&stake, &clock), true);
            assert_eq(stake_position::is_redeemable(&stake, &clock), false);
            
            // Remove encumbrance, should now be redeemable
            test_set_encumbered<SUI>(&mut stake, false);
            assert_eq(stake_position::is_redeemable(&stake, &clock), true);
            
            ts::return_to_sender(&scenario, stake);
        };
        
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}