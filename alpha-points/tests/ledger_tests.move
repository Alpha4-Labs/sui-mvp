#[test_only]
module alpha_points::ledger_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::{assert_eq};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    use alpha_points::ledger::{Self, Ledger, EInsufficientBalance, EInsufficientLockedBalance};
    use alpha_points::admin::{Self, GovernCap};

    const USER_ADDR: address = @0xA;
    const ADMIN_ADDR: address = @0xB;
    const POINTS_AMOUNT: u64 = 1000;

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(ADMIN_ADDR);
        {
            let ctx = ts::ctx(&mut scenario);
            admin::init_for_testing(ctx);
        };
        {
            let ctx = ts::ctx(&mut scenario);
            ledger::init_for_testing(ctx);
        };
        scenario
    }

    #[test]
    fun test_ledger_init() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let ledger = ts::take_shared<Ledger>(&scenario);
            assert_eq(ledger::get_total_supply(&ledger), 0);
            ts::return_shared(ledger);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_earn_points() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), 0);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_spend_points() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let spend_amount = POINTS_AMOUNT / 2;
            ledger::test_spend(&mut ledger, &gov_cap, USER_ADDR, spend_amount, ctx);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT - spend_amount);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT - spend_amount);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EInsufficientBalance)]
    fun test_spend_points_insufficient_balance() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            ledger::test_spend(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT + 1, ctx); // Should abort here
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::end(scenario);
    }

     #[test]
    fun test_lock_points() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let lock_amount = POINTS_AMOUNT / 2;
            ledger::test_lock(&mut ledger, &gov_cap, USER_ADDR, lock_amount, ctx);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), POINTS_AMOUNT - lock_amount);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), lock_amount);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            assert_eq(ledger::get_total_supply(&ledger), POINTS_AMOUNT);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::end(scenario);
    }

     #[test]
    fun test_unlock_points() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            ledger::test_lock(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            let unlock_amount = POINTS_AMOUNT / 2;
            ledger::test_unlock(&mut ledger, &gov_cap, USER_ADDR, unlock_amount, ctx);
            assert_eq(ledger::get_available_balance(&ledger, USER_ADDR), unlock_amount);
            assert_eq(ledger::get_locked_balance(&ledger, USER_ADDR), POINTS_AMOUNT - unlock_amount);
            assert_eq(ledger::get_total_balance(&ledger, USER_ADDR), POINTS_AMOUNT);
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EInsufficientLockedBalance)]
    fun test_unlock_points_insufficient_locked() {
        let mut scenario = setup_test();
        ts::next_tx(&mut scenario, ADMIN_ADDR);
        {
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            transfer::public_transfer(gov_cap, USER_ADDR);
        };
        ts::next_tx(&mut scenario, USER_ADDR);
        {
            let mut ledger = ts::take_shared<Ledger>(&scenario);
            let gov_cap = ts::take_from_sender<GovernCap>(&scenario);
            let ctx = ts::ctx(&mut scenario);
            ledger::test_earn(&mut ledger, &gov_cap, USER_ADDR, POINTS_AMOUNT, ctx);
            let lock_amount = POINTS_AMOUNT / 2;
            ledger::test_lock(&mut ledger, &gov_cap, USER_ADDR, lock_amount, ctx);
            ledger::test_unlock(&mut ledger, &gov_cap, USER_ADDR, lock_amount + 1, ctx); // Should abort
            ts::return_shared(ledger);
            ts::return_to_sender(&scenario, gov_cap);
        };
        ts::end(scenario);
    }

    #[test]
    fun test_calculate_points_to_earn() {
        let scenario = setup_test();
        let amount = 1000;
        let duration_days = 90;
        let participation_level = 2;
        let points = ledger::calculate_points_to_earn(amount, duration_days, participation_level);
        assert!(points > 0, 0);
        assert_eq(points, 2480);
        assert_eq(ledger::calculate_points_to_earn(0, duration_days, participation_level), 0);
        assert_eq(ledger::calculate_points_to_earn(amount, 0, participation_level), 0);
        ts::end(scenario);
    }
}