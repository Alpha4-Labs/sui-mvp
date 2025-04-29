// loan.move - Loan against staked positions (Phase 2)
module alpha_points::loan {
    use sui::object::{Self, ID, UID, new, id, uid_to_inner, delete};
    use sui::tx_context::{Self, TxContext, sender};
    use sui::transfer::{Self, public_transfer, share_object};
    use sui::clock::{Self, Clock, epoch};
    use sui::event;

    // Import sibling modules and specific functions/structs
    use alpha_points::admin::{Config, GovernCap, assert_not_paused};
    use alpha_points::ledger::{Ledger, internal_earn, internal_spend, get_available_balance};
    use alpha_points::stake_position::{
        StakePosition,
        owner as stake_owner,
        is_encumbered as stake_is_encumbered,
        principal as stake_principal,
        encumber as stake_encumber, // Use specific encumber/unencumber
        unencumber as stake_unencumber
    };

    // === Constants ===
    const BASIS_POINTS_DENOMINATOR: u128 = 10000; // For converting BPS to a rate
    const FIXED_POINT_SCALE_U128: u128 = 1_000_000_000_000_000_000; // 10^18 as u128
    const MAX_U64: u128 = 18_446_744_073_709_551_615; // (2^64 - 1) as u128
    // Example: Approximate epochs per year (adjust based on actual Sui epoch duration if critical)
    const APPROX_EPOCHS_PER_YEAR: u128 = 365; // Assuming 1 epoch ~= 1 day for interest calc

    // === Structs ===
    // Added 'public' visibility
    public struct Loan<phantom T> has key {
        id: UID,
        borrower: address,
        stake_id: ID, // ID of the staked position used as collateral
        principal_points: u64, // Amount of points borrowed
        interest_rate_bps: u64, // Annual interest rate in basis points (1 bp = 0.01%)
        opened_epoch: u64, // Epoch when loan was opened
        // duration_epochs removed - loan is open until repaid or liquidated (liquidation not implemented here)
        // repaid: bool // Removed - object deletion signifies repayment
    }

    // Added 'public' visibility
    public struct LoanConfig has key {
        id: UID,
        max_ltv_bps: u64, // Maximum loan-to-value ratio in basis points (e.g., 7000 = 70%)
        min_interest_rate_bps: u64, // Minimum allowed interest rate
        max_interest_rate_bps: u64, // Maximum allowed interest rate
        // max_duration_epochs removed - loans are open-term in this design
        // Add liquidation parameters if needed (e.g., liquidation_threshold_bps, liquidation_penalty_bps)
    }

    // === Events ===
    // Added 'public' visibility
    public struct LoanOpened<phantom T> has copy, drop {
        loan_id: ID,
        borrower: address,
        stake_id: ID,
        principal_points: u64,
        interest_rate_bps: u64,
        opened_epoch: u64,
        // duration_epochs removed
    }

    // Added 'public' visibility
    public struct LoanRepaid has copy, drop { // Removed phantom T - not needed if amount is points
        loan_id: ID,
        borrower: address,
        principal_points: u64, // Principal amount repaid
        interest_points: u64, // Interest amount repaid
        repayment_amount: u64, // Total points repaid (principal + interest)
        repayment_epoch: u64
    }

    // Added 'public' visibility
    public struct LoanConfigCreated has copy, drop {
        config_id: ID,
        max_ltv_bps: u64,
        min_interest_rate_bps: u64,
        max_interest_rate_bps: u64,
        // max_duration_epochs removed
    }

    // Added 'public' visibility
    public struct LoanConfigUpdated has copy, drop {
        config_id: ID,
        max_ltv_bps: u64,
        min_interest_rate_bps: u64,
        max_interest_rate_bps: u64,
        // max_duration_epochs removed
    }

    // === Errors ===
    // Standardized error codes
    const ESTAKE_NOT_OWNED: u64 = 1;        // Caller does not own the stake provided
    const ESTAKE_ALREADY_ENCUMBERED: u64 = 2;// Stake is already backing another loan
    const EINVALID_LOAN_AMOUNT: u64 = 3;    // Loan amount must be greater than zero
    // const EINVALID_LOAN_DURATION: u64 = 4; // Removed - loans are open term
    const ELOAN_NOT_OWNED: u64 = 5;         // Caller does not own the loan object being repaid
    // const ELOAN_ALREADY_REPAID: u64 = 6; // Removed - loan object deletion handles this
    const EINSUFFICIENT_POINTS: u64 = 7;    // Borrower lacks sufficient points for repayment
    // const ELOAN_EXPIRED: u64 = 8;        // Removed - loans are open term
    const EEXCEEDS_MAX_LTV: u64 = 9;        // Requested loan amount exceeds max Loan-To-Value ratio
    const EINVALID_INTEREST_RATE: u64 = 10; // Interest rate is outside the configured min/max bounds
    const EINVALID_CONFIG_PARAMS: u64 = 11; // Invalid parameters provided when creating/updating LoanConfig
    const ESTAKE_ID_MISMATCH: u64 = 12;     // Stake provided for repayment does not match the loan's collateral ID
    const EINTEREST_CALC_OVERFLOW: u64 = 13;// Overflow during interest calculation

    // === Init Function ===

    /// Initializes the shared LoanConfig object. Requires GovernCap.
    public entry fun init_loan_config(
        _govern_cap: &GovernCap, // Authorization
        max_ltv_bps: u64,
        min_interest_rate_bps: u64,
        max_interest_rate_bps: u64,
        // max_duration_epochs removed
        ctx: &mut TxContext
    ) {
        // Validate parameters
        assert!(max_ltv_bps > 0 && max_ltv_bps <= BASIS_POINTS_DENOMINATOR, EINVALID_CONFIG_PARAMS); // Max 100%
        assert!(min_interest_rate_bps <= max_interest_rate_bps, EINVALID_CONFIG_PARAMS); // Min <= Max
        assert!(max_interest_rate_bps <= BASIS_POINTS_DENOMINATOR * 10, EINVALID_CONFIG_PARAMS); // Example: Max 1000% APR limit? Adjust as needed
        // assert!(max_duration_epochs > 0, EINVALID_CONFIG_PARAMS); // Removed

        let config_uid = new(ctx);
        let config_id = uid_to_inner(&config_uid);

        let config = LoanConfig {
            id: config_uid,
            max_ltv_bps,
            min_interest_rate_bps,
            max_interest_rate_bps,
            // max_duration_epochs, // Removed
        };

        event::emit(LoanConfigCreated {
            config_id,
            max_ltv_bps,
            min_interest_rate_bps,
            max_interest_rate_bps,
            // max_duration_epochs // Removed
        });

        share_object(config);
    }

    // === Entry Functions ===

    /// Opens a loan, borrowing Alpha Points against a staked position as collateral.
    public entry fun open_loan<T: store>(
        admin_config: &Config, // Read-only access to check pause state
        loan_config: &LoanConfig, // Read-only access to loan parameters
        ledger: &mut Ledger, // Mutable access to mint points
        stake: &mut StakePosition<T>, // Mutable access to encumber the stake
        principal_points_to_borrow: u64, // Amount of points requested
        interest_rate_bps: u64, // Proposed interest rate (must be within config bounds)
        // duration_epochs removed
        clock: &Clock, // Read-only access for current epoch
        ctx: &mut TxContext
    ) {
        assert_not_paused(admin_config); // Check global pause state

        let borrower = sender(ctx);

        // --- Validation Checks ---
        // 1. Stake Ownership: Verify the sender owns the stake object
        assert!(stake_owner(stake) == borrower, ESTAKE_NOT_OWNED);

        // 2. Stake Encumbrance: Verify the stake is not already backing a loan
        assert!(!stake_is_encumbered(stake), ESTAKE_ALREADY_ENCUMBERED);

        // 3. Loan Amount: Verify requested amount is positive
        assert!(principal_points_to_borrow > 0, EINVALID_LOAN_AMOUNT);

        // 4. Interest Rate: Verify rate is within configured bounds
        assert!(
            interest_rate_bps >= loan_config.min_interest_rate_bps &&
            interest_rate_bps <= loan_config.max_interest_rate_bps,
            EINVALID_INTEREST_RATE
        );

        // 5. Loan-To-Value (LTV): Verify requested amount doesn't exceed max LTV
        //    LTV = (principal_points_to_borrow / stake_principal_value)
        //    Assume 1 point = 1 unit of stake principal for LTV calculation (adjust if oracle needed)
        let stake_principal_value = stake_principal(stake);
        // Use u128 for calculation to prevent overflow
        let max_loan_points = (stake_principal_value as u128)
                                * (loan_config.max_ltv_bps as u128)
                                / BASIS_POINTS_DENOMINATOR;
        assert!((principal_points_to_borrow as u128) <= max_loan_points, EEXCEEDS_MAX_LTV);

        // --- State Changes ---
        // 1. Encumber Stake: Mark the stake object as encumbered
        stake_encumber(stake); // stake_position module emits StakeEncumbered event

        // 2. Credit Points: Mint points to the borrower's ledger balance
        internal_earn(ledger, borrower, principal_points_to_borrow, ctx); // ledger module emits Earned event

        // 3. Create Loan Object: Mint the Loan object representing the debt
        let current_epoch = epoch(clock);
        let loan_uid = new(ctx);
        let loan_id = uid_to_inner(&loan_uid);
        let stake_id = id(stake); // Get the ID of the collateral stake

        let loan = Loan<T> {
            id: loan_uid,
            borrower,
            stake_id,
            principal_points: principal_points_to_borrow,
            interest_rate_bps,
            opened_epoch: current_epoch,
            // duration_epochs, // Removed
            // repaid: false // Removed
        };

        // --- Event Emission ---
        event::emit(LoanOpened<T> {
            loan_id,
            borrower,
            stake_id,
            principal_points: principal_points_to_borrow,
            interest_rate_bps,
            opened_epoch: current_epoch,
            // duration_epochs // Removed
        });

        // --- Transfer Loan Object ---
        // Transfer the Loan object to the borrower; they are responsible for repaying it
        public_transfer(loan, borrower);
    }


    /// Repays an open loan, burning the principal + accrued interest and unencumbering the collateral stake.
    public entry fun repay_loan<T: store>(
        admin_config: &Config, // Read-only access to check pause state
        ledger: &mut Ledger, // Mutable access to burn points
        loan: Loan<T>, // Takes ownership of the Loan object to consume/delete it
        stake: &mut StakePosition<T>, // Mutable access to unencumber the stake
        clock: &Clock, // Read-only access for current epoch
        ctx: &mut TxContext
    ) {
        assert_not_paused(admin_config); // Check global pause state

        let borrower = sender(ctx);
        let loan_id = id(&loan); // Get ID before consuming loan

        // --- Validation Checks ---
        // 1. Loan Ownership: Verify the sender owns the loan object
        assert!(loan.borrower == borrower, ELOAN_NOT_OWNED);

        // 2. Stake Match: Verify the provided stake object matches the loan's collateral ID
        assert!(id(stake) == loan.stake_id, ESTAKE_ID_MISMATCH);

        // 3. Stake Ownership (redundant but safe): Verify sender also owns the stake
        assert!(stake_owner(stake) == borrower, ESTAKE_NOT_OWNED);

        // --- Calculation ---
        // Calculate total repayment amount (principal + interest)
        let current_epoch = epoch(clock);
        let (principal_repayment, interest_repayment, total_repayment) =
            calculate_current_repayment_amount(&loan, current_epoch);

        // --- State Changes ---
        // 1. Check & Burn Points: Verify borrower has enough points and burn them
        assert!(get_available_balance(ledger, borrower) >= total_repayment, EINSUFFICIENT_POINTS);
        internal_spend(ledger, borrower, total_repayment, ctx); // ledger module emits Spent event

        // 2. Unencumber Stake: Mark the stake object as unencumbered
        stake_unencumber(stake); // stake_position module emits StakeEncumbered event (with false)

        // 3. Delete Loan Object: The loan is repaid, consume the object
        let Loan { id: loan_uid, borrower: _, stake_id: _, principal_points: _, interest_rate_bps: _, opened_epoch: _, /*duration_epochs: _, repaid: _ */} = loan;
        delete(loan_uid);

        // --- Event Emission ---
        event::emit(LoanRepaid {
            loan_id,
            borrower,
            principal_points: principal_repayment,
            interest_points: interest_repayment,
            repayment_amount: total_repayment,
            repayment_epoch: current_epoch
        });

        // The stake object (now unencumbered) remains with the sender.
    }

    /// Updates the LoanConfig object. Requires GovernCap.
    public entry fun update_loan_config(
        loan_config: &mut LoanConfig,
        _govern_cap: &GovernCap, // Authorization
        max_ltv_bps: u64,
        min_interest_rate_bps: u64,
        max_interest_rate_bps: u64,
        // max_duration_epochs removed
        ctx: &mut TxContext
    ) {
        // Validate parameters
        assert!(max_ltv_bps > 0 && max_ltv_bps <= BASIS_POINTS_DENOMINATOR, EINVALID_CONFIG_PARAMS);
        assert!(min_interest_rate_bps <= max_interest_rate_bps, EINVALID_CONFIG_PARAMS);
        assert!(max_interest_rate_bps <= BASIS_POINTS_DENOMINATOR * 10, EINVALID_CONFIG_PARAMS);
        // assert!(max_duration_epochs > 0, EINVALID_CONFIG_PARAMS); // Removed

        // Update configuration
        loan_config.max_ltv_bps = max_ltv_bps;
        loan_config.min_interest_rate_bps = min_interest_rate_bps;
        loan_config.max_interest_rate_bps = max_interest_rate_bps;
        // loan_config.max_duration_epochs = max_duration_epochs; // Removed

        event::emit(LoanConfigUpdated {
            config_id: id(loan_config),
            max_ltv_bps,
            min_interest_rate_bps,
            max_interest_rate_bps,
            // max_duration_epochs // Removed
        });
    }

    // === Helper Functions ===

    /// Calculates the interest accrued and total repayment amount for a loan.
    fun calculate_current_repayment_amount<T>(
        loan: &Loan<T>,
        current_epoch: u64
    ): (u64, u64, u64) { // (principal, interest, total)
        // Calculate elapsed time since loan opened
        // Prevent underflow if clock somehow went backwards or loan opened in future
        let elapsed_epochs = if (current_epoch > loan.opened_epoch) {
            current_epoch - loan.opened_epoch
        } else {
            0 // No time elapsed, no interest
        };

        if (elapsed_epochs == 0) {
            return (loan.principal_points, 0, loan.principal_points)
        };

        // Simple interest calculation: Interest = Principal * Rate * Time
        // Use u128 for intermediate calculations to prevent overflow.

        let principal_u128 = (loan.principal_points as u128);
        let rate_bps_u128 = (loan.interest_rate_bps as u128);
        let elapsed_epochs_u128 = (elapsed_epochs as u128);

        // Calculate annual rate as a fraction (rate_bps / 10000)
        // Calculate time in years (adjust APPROX_EPOCHS_PER_YEAR if needed)
        // Interest = P * (rate_bps / 10000) * (elapsed_epochs / EPOCHS_PER_YEAR)
        // Interest = (P * rate_bps * elapsed_epochs) / (10000 * EPOCHS_PER_YEAR)

        let numerator = principal_u128 * rate_bps_u128 * elapsed_epochs_u128;
        let denominator = BASIS_POINTS_DENOMINATOR * APPROX_EPOCHS_PER_YEAR;

        // Check for potential overflow before division if denominator is 0 (shouldn't happen with constants)
        assert!(denominator > 0, EINTEREST_CALC_OVERFLOW); // Should be impossible

        let interest_u128 = numerator / denominator;

        // Ensure interest fits within u64
        assert!(interest_u128 <= MAX_U64, EINTEREST_CALC_OVERFLOW);
        let interest_u64 = (interest_u128 as u64);

        // Calculate total repayment
        let total_repayment_u128 = principal_u128 + interest_u128;
        assert!(total_repayment_u128 <= MAX_U64, EINTEREST_CALC_OVERFLOW);
        let total_repayment_u64 = (total_repayment_u128 as u64);

        (loan.principal_points, interest_u64, total_repayment_u64)
    }


    // === View Functions ===

    /// Returns the details of a loan.
    public fun get_loan_details<T>(loan: &Loan<T>): (address, ID, u64, u64, u64) {
        (
            loan.borrower,
            loan.stake_id,
            loan.principal_points,
            loan.interest_rate_bps,
            loan.opened_epoch
            // duration_epochs, repaid removed
        )
    }

    /// Calculates the current total repayment amount (principal + interest) for a loan.
    public fun get_current_repayment_amount<T>(loan: &Loan<T>, clock: &Clock): u64 {
        let (_, _, total_repayment) = calculate_current_repayment_amount(loan, epoch(clock));
        total_repayment
    }

    // Function 'is_expired' removed as loans are now open-term until repaid.
    // Liquidation logic would be added separately if needed.
}


// === Test Submodule ===
#[test_only]
module alpha_points::loan_tests {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx, take_shared, return_shared, take_from_sender, return_to_sender, end as end_scenario, begin, inventory_contains};
    use sui::object::{Self, ID, id as object_id};
    use sui::clock::{Self, Clock, create_for_testing, destroy, increment_for_testing};

    // Import modules under test and dependencies
    use alpha_points::admin::{Self as admin, Config, GovernCap};
    use alpha_points::ledger::{Self as ledger, Ledger};
    use alpha_points::stake_position::{Self as sp, StakePosition};
    use alpha_points::loan::{
        Self, Loan, LoanConfig,
        init_loan_config, open_loan, repay_loan, update_loan_config,
        get_loan_details, get_current_repayment_amount,
        EEXCEEDS_MAX_LTV, EINSUFFICIENT_POINTS, ESTAKE_ALREADY_ENCUMBERED, ELOAN_NOT_OWNED, ESTAKE_ID_MISMATCH
    };

    // Test addresses
    const ADMIN_ADDR: address = @0xA1;
    const BORROWER: address = @0xB1;
    const OTHER_USER: address = @0xB2;

    // Test asset type (can be anything with store)
    struct TEST_ASSET has store {}

    // Helper: Initialize admin, ledger, loan_config
    fun setup(scenario: &mut Scenario): (Config, Ledger, LoanConfig, GovernCap) {
        next_tx(scenario, ADMIN_ADDR);
        admin::init(ctx(scenario));
        ledger::init(ctx(scenario));
        let gov_cap = take_from_sender<GovernCap>(scenario);
        let _ = take_from_sender<admin::OracleCap>(scenario); // discard oracle cap

        // Init loan config
        loan::init_loan_config(
            &gov_cap, 7000, 500, 2000, // 70% LTV, 5-20% rate
            ctx(scenario)
        );

        let admin_config = take_shared<Config>(scenario);
        let ledger_obj = take_shared<Ledger>(scenario);
        let loan_config_obj = take_shared<LoanConfig>(scenario);

        (admin_config, ledger_obj, loan_config_obj, gov_cap)
    }

     // Helper: Create a dummy stake for the borrower
    fun create_dummy_stake(scenario: &mut Scenario, clock: &Clock): StakePosition<TEST_ASSET> {
         next_tx(scenario, BORROWER);
         // Need principal > 0, duration > 0
         sp::create_stake<TEST_ASSET>(
             BORROWER, 1, 1000, 100, clock, ctx(scenario) // chain 1, 1000 principal, 100 duration
         )
         // Note: Stake is owned by BORROWER after this tx
    }


    #[test]
    fun test_open_loan_success() {
        let scenario = begin(BORROWER); // Start as borrower for stake creation
        let clock = create_for_testing(ctx(&mut scenario));
        let mut stake = create_dummy_stake(&mut scenario, &clock);

        // Setup admin, ledger, loan_config
        let (admin_config, mut ledger_obj, loan_config_obj, gov_cap) = setup(&mut scenario);

        // Give borrower some initial points to make test simpler later if needed
        next_tx(&mut scenario, ADMIN_ADDR); // Admin needs gov cap to grant partner cap if using that
        // Simplification: Directly earn points using ledger internal (requires test_only friend or alternative)
        // For now, assume borrower gets points elsewhere or test repayment separately.

        // Borrower opens loan
        next_tx(&mut scenario, BORROWER);
        let principal_to_borrow = 500; // Borrow 500 points (LTV = 500/1000 = 50% < 70%)
        let interest_rate = 1000; // 10%
        open_loan<TEST_ASSET>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake,
            principal_to_borrow, interest_rate, &clock, ctx(&mut scenario)
        );

        // Assertions
        assert!(sp::is_encumbered(&stake), 0); // Stake should be encumbered
        assert!(ledger::get_available_balance(&ledger_obj, BORROWER) >= principal_to_borrow, 1); // Borrower received points
        assert!(inventory_contains<Loan<TEST_ASSET>>(&scenario, BORROWER), 2); // Borrower received Loan object

        // Cleanup
        return_shared(admin_config);
        return_shared(ledger_obj);
        return_shared(loan_config_obj);
        return_to_sender(&mut scenario, gov_cap); // To ADMIN_ADDR
        return_to_sender(&mut scenario, stake); // To BORROWER
        // Loan object owned by BORROWER, cleaned up by end_scenario
        destroy(clock);
        end_scenario(scenario);
    }

     #[test]
     #[expected_failure(abort_code = EEXCEEDS_MAX_LTV)]
    fun test_open_loan_fail_ltv() {
        let scenario = begin(BORROWER);
        let clock = create_for_testing(ctx(&mut scenario));
        let mut stake = create_dummy_stake(&mut scenario, &clock); // Principal 1000
        let (admin_config, mut ledger_obj, loan_config_obj, gov_cap) = setup(&mut scenario); // Max LTV 70%

        // Borrower tries to borrow 800 points (80% LTV > 70%)
        next_tx(&mut scenario, BORROWER);
        open_loan<TEST_ASSET>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake,
            800, 1000, &clock, ctx(&mut scenario)
        );

        // Cleanup (won't reach)
        // ...
        destroy(clock);
        end_scenario(scenario);
    }

     #[test]
     #[expected_failure(abort_code = ESTAKE_ALREADY_ENCUMBERED)]
    fun test_open_loan_fail_already_encumbered() {
        let scenario = begin(BORROWER);
        let clock = create_for_testing(ctx(&mut scenario));
        let mut stake = create_dummy_stake(&mut scenario, &clock);
        let (admin_config, mut ledger_obj, loan_config_obj, gov_cap) = setup(&mut scenario);

        // Open first loan successfully
        next_tx(&mut scenario, BORROWER);
        open_loan<TEST_ASSET>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake,
            100, 1000, &clock, ctx(&mut scenario)
        );
        let _loan1 = take_from_sender<Loan<TEST_ASSET>>(&mut scenario); // Take the loan object

        // Try to open second loan with same stake (fails)
        next_tx(&mut scenario, BORROWER);
         open_loan<TEST_ASSET>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake, // stake is already encumbered
            100, 1000, &clock, ctx(&mut scenario)
        );

        // Cleanup (won't reach)
        // ...
        destroy(clock);
        end_scenario(scenario);
    }

    #[test]
    fun test_repay_loan_success() {
         let scenario = begin(BORROWER);
        let clock = create_for_testing(ctx(&mut scenario));
        let mut stake = create_dummy_stake(&mut scenario, &clock); // Principal 1000
        let (admin_config, mut ledger_obj, loan_config_obj, gov_cap) = setup(&mut scenario); // Max LTV 70%

        // Open loan
        next_tx(&mut scenario, BORROWER);
        let principal_borrowed = 500;
        open_loan<TEST_ASSET>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake,
            principal_borrowed, 1000, &clock, ctx(&mut scenario) // 10% rate
        );
        let loan = take_from_sender<Loan<TEST_ASSET>>(&mut scenario);
        let initial_points = ledger::get_available_balance(&ledger_obj, BORROWER);

        // Advance time (e.g., half a year approx)
        increment_for_testing(&mut clock, 182); // Approx half year

        // Calculate expected repayment
        let expected_repayment = get_current_repayment_amount(&loan, &clock);
        assert!(expected_repayment > principal_borrowed, 0); // Interest should have accrued

        // Add enough points to repay (initial points + expected repayment)
        // Requires internal_earn or similar - skipping this step assumes borrower has enough points
        // For a real test, ensure borrower has >= expected_repayment points
         next_tx(&mut scenario, ADMIN_ADDR); // Use admin context for direct mint if needed
         // ledger::internal_earn(&mut ledger_obj, BORROWER, expected_repayment * 2, ctx(&mut scenario)); // Give extra points

        // Repay loan
        next_tx(&mut scenario, BORROWER);
        // Need to ensure borrower has enough points BEFORE this call
         ledger::internal_earn(&mut ledger_obj, BORROWER, expected_repayment * 2, ctx(&mut scenario)); // Give extra points for test

        repay_loan<TEST_ASSET>(
            &admin_config, &mut ledger_obj, loan, &mut stake, &clock, ctx(&mut scenario)
        );

        // Assertions
        assert!(!sp::is_encumbered(&stake), 1); // Stake should be unencumbered
        assert!(!inventory_contains<Loan<TEST_ASSET>>(&scenario, BORROWER), 2); // Loan object deleted
        // Check points decreased (difficult to check exact amount without knowing initial points precisely)
        assert!(ledger::get_available_balance(&ledger_obj, BORROWER) < initial_points + (expected_repayment*2), 3);


        // Cleanup
        return_shared(admin_config);
        return_shared(ledger_obj);
        return_shared(loan_config_obj);
        return_to_sender(&mut scenario, gov_cap); // To ADMIN_ADDR
        return_to_sender(&mut scenario, stake); // To BORROWER
        destroy(clock);
        end_scenario(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EINSUFFICIENT_POINTS)]
    fun test_repay_loan_fail_insufficient_points() {
        let scenario = begin(BORROWER);
        let clock = create_for_testing(ctx(&mut scenario));
        let mut stake = create_dummy_stake(&mut scenario, &clock);
        let (admin_config, mut ledger_obj, loan_config_obj, gov_cap) = setup(&mut scenario);

        // Open loan
        next_tx(&mut scenario, BORROWER);
        open_loan<TEST_ASSET>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake,
            500, 1000, &clock, ctx(&mut scenario)
        );
        let loan = take_from_sender<Loan<TEST_ASSET>>(&mut scenario);

        // Burn almost all points
        let current_points = ledger::get_available_balance(&ledger_obj, BORROWER);
        if (current_points > 0) {
             ledger::internal_spend(&mut ledger_obj, BORROWER, current_points -1 , ctx(&mut scenario)); // Leave 1 point
        };


        // Try repay loan (fails)
        next_tx(&mut scenario, BORROWER);
        repay_loan<TEST_ASSET>(
             &admin_config, &mut ledger_obj, loan, &mut stake, &clock, ctx(&mut scenario)
        );

        // Cleanup (won't reach)
        // ...
        destroy(clock);
        end_scenario(scenario);
    }

     #[test]
     #[expected_failure(abort_code = ESTAKE_ID_MISMATCH)]
    fun test_repay_loan_fail_stake_mismatch() {
        let scenario = begin(BORROWER);
        let clock = create_for_testing(ctx(&mut scenario));
        let mut stake1 = create_dummy_stake(&mut scenario, &clock);
        let mut stake2 = create_dummy_stake(&mut scenario, &clock); // Create a second stake
        let (admin_config, mut ledger_obj, loan_config_obj, gov_cap) = setup(&mut scenario);

        // Open loan against stake1
        next_tx(&mut scenario, BORROWER);
        open_loan<TEST_ASSET>(
            &admin_config, &loan_config_obj, &mut ledger_obj, &mut stake1,
            500, 1000, &clock, ctx(&mut scenario)
        );
        let loan = take_from_sender<Loan<TEST_ASSET>>(&mut scenario);
         ledger::internal_earn(&mut ledger_obj, BORROWER, 10000, ctx(&mut scenario)); // Add points for repayment


        // Try repay loan using stake2 (fails)
        next_tx(&mut scenario, BORROWER);
        repay_loan<TEST_ASSET>(
             &admin_config, &mut ledger_obj, loan, &mut stake2, &clock, ctx(&mut scenario) // Pass wrong stake
        );

        // Cleanup (won't reach)
        // ...
        destroy(clock);
        end_scenario(scenario);
    }

}
