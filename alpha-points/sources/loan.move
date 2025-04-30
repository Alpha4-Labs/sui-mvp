// loan.move - Loan against staked positions (Phase 2)
module alpha_points::loan {
    use sui::object::{UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer::share_object;
    use sui::clock::Clock;
    use sui::event;

    use alpha_points::admin::{Config, GovernCap, assert_not_paused};
    use alpha_points::ledger::{Ledger, internal_earn, internal_spend};
    use alpha_points::stake_position::{
        StakePosition, owner as stake_owner, is_encumbered,
        principal, encumber, unencumber, get_id as stake_get_id
    };

    // === Constants ===
    const BASIS_POINTS_DENOMINATOR: u128 = 10000;
    const MAX_U64: u128 = 18_446_744_073_709_551_615;
    const APPROX_EPOCHS_PER_YEAR: u128 = 365;

    // === Structs ===
    public struct Loan<phantom T> has key, store { 
        id: UID, 
        borrower: address, 
        stake_id: ID, 
        principal_points: u64, 
        interest_rate_bps: u64, 
        opened_epoch: u64 
    }
    
    public struct LoanConfig has key { 
        id: UID, 
        max_ltv_bps: u64, 
        min_interest_rate_bps: u64, 
        max_interest_rate_bps: u64 
    }

    // === Events ===
    public struct LoanOpened<phantom T> has copy, drop { 
        loan_id: ID, 
        borrower: address, 
        stake_id: ID, 
        principal_points: u64, 
        interest_rate_bps: u64, 
        opened_epoch: u64 
    }
    
    public struct LoanRepaid has copy, drop { 
        loan_id: ID, 
        borrower: address, 
        principal_points: u64, 
        interest_points: u64, 
        repayment_amount: u64, 
        repayment_epoch: u64 
    }
    
    public struct LoanConfigCreated has copy, drop { 
        config_id: ID, 
        max_ltv_bps: u64, 
        min_interest_rate_bps: u64, 
        max_interest_rate_bps: u64 
    }
    
    public struct LoanConfigUpdated has copy, drop { 
        config_id: ID, 
        max_ltv_bps: u64, 
        min_interest_rate_bps: u64, 
        max_interest_rate_bps: u64 
    }

    // === Errors ===
    const ESTAKE_NOT_OWNED: u64 = 1;
    const ESTAKE_ALREADY_ENCUMBERED: u64 = 2;
    const EINVALID_LOAN_AMOUNT: u64 = 3;
    const ELOAN_NOT_OWNED: u64 = 5;
    const EINSUFFICIENT_POINTS: u64 = 7;
    const EEXCEEDS_MAX_LTV: u64 = 9;
    const EINVALID_INTEREST_RATE: u64 = 10;
    const EINVALID_CONFIG_PARAMS: u64 = 11;
    const ESTAKE_ID_MISMATCH: u64 = 12;
    const EINTEREST_CALC_OVERFLOW: u64 = 13;

    // === Init Function ===
    public entry fun init_loan_config(
        _gov_cap: &GovernCap, 
        max_ltv_bps: u64, 
        min_interest_rate_bps: u64, 
        max_interest_rate_bps: u64, 
        ctx: &mut TxContext
    ) {
        // Validate parameters
        assert!(
            max_ltv_bps > 0 && max_ltv_bps <= 10000 && 
            min_interest_rate_bps > 0 && min_interest_rate_bps <= max_interest_rate_bps && 
            max_interest_rate_bps <= 10000,
            EINVALID_CONFIG_PARAMS
        );
        
        let config_id = object::new(ctx);
        // Fixed: using object::uid_to_inner instead of id()
        let config_id_copy = object::uid_to_inner(&config_id);
        
        let loan_config = LoanConfig {
            id: config_id,
            max_ltv_bps,
            min_interest_rate_bps,
            max_interest_rate_bps
        };
        
        event::emit(LoanConfigCreated {
            config_id: config_id_copy,
            max_ltv_bps,
            min_interest_rate_bps,
            max_interest_rate_bps
        });
        
        share_object(loan_config);
    }

    // === Entry Functions ===
    // Added missing function for opening a loan
    public entry fun open_loan<T: store>(
        admin_config: &Config,
        loan_config: &LoanConfig,
        ledger: &mut Ledger,
        stake: &mut StakePosition<T>,
        loan_amount: u64,
        interest_rate_bps: u64,
        _clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(admin_config);
        
        // Validate ownership of stake
        let borrower = tx_context::sender(ctx);
        assert!(stake_owner(stake) == borrower, ESTAKE_NOT_OWNED);
        
        // Validate stake is not already encumbered
        assert!(!is_encumbered(stake), ESTAKE_ALREADY_ENCUMBERED);
        
        // Validate loan amount and LTV ratio
        assert!(loan_amount > 0, EINVALID_LOAN_AMOUNT);
        let stake_value = principal(stake);
        assert!(loan_amount <= (stake_value * loan_config.max_ltv_bps / 10000), EEXCEEDS_MAX_LTV);
        
        // Validate interest rate
        assert!(
            interest_rate_bps >= loan_config.min_interest_rate_bps && 
            interest_rate_bps <= loan_config.max_interest_rate_bps,
            EINVALID_INTEREST_RATE
        );
        
        // Encumber the stake
        encumber(stake);
        
        // Create the loan
        let loan_id = object::new(ctx);
        // Get stake ID using the proper accessor function
        let stake_id = stake_get_id(stake);
        let current_epoch = tx_context::epoch(ctx);
        
        // Create loan object
        let loan = Loan<T> {
            id: loan_id,
            borrower,
            stake_id,
            principal_points: loan_amount,
            interest_rate_bps,
            opened_epoch: current_epoch
        };
        
        // Issue points to borrower
        internal_earn(ledger, borrower, loan_amount, ctx);
        
        // Emit event
        let loan_id_copy = object::uid_to_inner(&loan.id);
        event::emit(LoanOpened<T> {
            loan_id: loan_id_copy,
            borrower,
            stake_id,
            principal_points: loan_amount,
            interest_rate_bps,
            opened_epoch: current_epoch
        });
        
        // Transfer loan to borrower
        sui::transfer::public_transfer(loan, borrower);
    }

    public entry fun repay_loan<T: store>(
        admin_config: &Config, 
        ledger: &mut Ledger, 
        loan: Loan<T>, 
        stake: &mut StakePosition<T>, 
        _clock: &Clock, 
        ctx: &mut TxContext
    ) {
        // Check protocol not paused
        assert_not_paused(admin_config);
        
        // Validate ownership of loan
        let borrower = tx_context::sender(ctx);
        assert!(loan.borrower == borrower, ELOAN_NOT_OWNED);
        
        // Validate stake matches loan
        // Fixed: using stake_get_id instead of direct access
        let stake_id = stake_get_id(stake);
        assert!(loan.stake_id == stake_id, ESTAKE_ID_MISMATCH);
        
        // Calculate repayment amount
        let (principal, interest, total) = calculate_current_repayment_amount(&loan, tx_context::epoch(ctx));
        
        // Check user has enough points
        let available = alpha_points::ledger::get_available_balance(ledger, borrower);
        assert!(available >= total, EINSUFFICIENT_POINTS);
        
        // Spend points
        internal_spend(ledger, borrower, total, ctx);
        
        // Release the stake
        unencumber(stake);
        
        // Emit event
        // Fixed: using object::uid_to_inner instead of id()
        let loan_id = object::uid_to_inner(&loan.id);
        event::emit(LoanRepaid {
            loan_id,
            borrower,
            principal_points: principal,
            interest_points: interest,
            repayment_amount: total,
            repayment_epoch: tx_context::epoch(ctx),
        });
        
        // Destroy the loan
        let Loan { id, borrower: _, stake_id: _, principal_points: _, interest_rate_bps: _, opened_epoch: _ } = loan;
        object::delete(id);
    }
    
    public entry fun update_loan_config(
        loan_config: &mut LoanConfig, 
        _gov_cap: &GovernCap, 
        max_ltv_bps: u64, 
        min_interest_rate_bps: u64, 
        max_interest_rate_bps: u64, 
        ctx: &TxContext
    ) {
        // Validate parameters
        assert!(
            max_ltv_bps > 0 && max_ltv_bps <= 10000 && 
            min_interest_rate_bps > 0 && min_interest_rate_bps <= max_interest_rate_bps && 
            max_interest_rate_bps <= 10000,
            EINVALID_CONFIG_PARAMS
        );
        
        // Update config
        loan_config.max_ltv_bps = max_ltv_bps;
        loan_config.min_interest_rate_bps = min_interest_rate_bps;
        loan_config.max_interest_rate_bps = max_interest_rate_bps;
        
        // Emit event
        // Fixed: using object::uid_to_inner instead of id()
        let config_id = object::uid_to_inner(&loan_config.id);
        event::emit(LoanConfigUpdated {
            config_id,
            max_ltv_bps,
            min_interest_rate_bps,
            max_interest_rate_bps
        });
    }

    // === Helper / Package Visible Function ===
    // Public getter function for loan details - added to fix test errors
    public fun get_loan_details<T>(loan: &Loan<T>): (address, ID, u64, u64, u64) {
        (loan.borrower, loan.stake_id, loan.principal_points, loan.interest_rate_bps, loan.opened_epoch)
    }

    public(package) fun calculate_current_repayment_amount<T>(
        loan: &Loan<T>, 
        current_epoch: u64
    ): (u64, u64, u64) {
        let principal = loan.principal_points;
        
        // Calculate time passed
        let epochs_passed = if (current_epoch > loan.opened_epoch) {
            current_epoch - loan.opened_epoch
        } else {
            0 // Same epoch or error case, no interest
        };
        
        // Calculate interest (simple interest for now)
        // interest = principal * interest_rate_bps / 10000 * epochs_passed / epochs_per_year
        let principal_u128 = (principal as u128);
        let rate_u128 = (loan.interest_rate_bps as u128);
        let epochs_passed_u128 = (epochs_passed as u128);
        
        let numerator = principal_u128 * rate_u128 * epochs_passed_u128;
        let denominator = BASIS_POINTS_DENOMINATOR * APPROX_EPOCHS_PER_YEAR;
        
        // Check for overflow in calculation
        assert!(numerator / (principal_u128 * rate_u128) == epochs_passed_u128, EINTEREST_CALC_OVERFLOW);
        
        let interest_u128 = numerator / denominator;
        assert!(interest_u128 <= MAX_U64, EINTEREST_CALC_OVERFLOW);
        
        let interest = (interest_u128 as u64);
        let total = principal + interest;
        
        (principal, interest, total)
    }
}