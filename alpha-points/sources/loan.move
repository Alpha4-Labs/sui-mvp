/// Module that handles the logic for borrowing Alpha Points against staked assets.
module alpha_points::loan {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};
    
    use alpha_points::admin::{Self, Config, GovernCap};
    use alpha_points::ledger::{Self, Ledger};
    use alpha_points::stake_position::{Self, StakePosition};
    use alpha_points::oracle::{Self, RateOracle};
    
    // Error constants
    const EInvalidLoanAmount: u64 = 1;
    const EExceedsLTV: u64 = 2;
    const EStakeAlreadyEncumbered: u64 = 3;
    const EWrongStake: u64 = 4;
    const EInsufficientPoints: u64 = 5;
    const EUnauthorized: u64 = 6;
    const EFeeCalculationError: u64 = 7; // Added for fee errors

    // Time Constants
    const MS_PER_DAY: u64 = 24 * 60 * 60 * 1000;
    
    /// Shared object for loan parameters
    public struct LoanConfig has key {
        id: UID,
        max_ltv_bps: u64,         // Maximum loan-to-value ratio in basis points (e.g., 7000 = 70%)
        interest_rate_bps: u64    // Annual interest rate in basis points (e.g., 500 = 5%)
    }
    
    /// Owned object representing an active loan tied to a StakePosition
    public struct Loan has key, store {
        id: UID,
        borrower: address,
        stake_id: ID,
        principal_points: u64,
        interest_owed_points: u64, // Note: Currently unused/not accrued
        opened_time_ms: u64       // Changed from opened_epoch
    }
    
    // Events
    public struct LoanConfigInitialized has copy, drop {
        id: ID,
        max_ltv_bps: u64,
        interest_rate_bps: u64
    }
    
    public struct LoanOpened<phantom T> has copy, drop {
        id: ID,
        borrower: address,
        stake_id: ID,
        principal_points: u64,
        opened_time_ms: u64     // Changed from opened_epoch
    }
    
    public struct LoanRepaid<phantom T> has copy, drop {
        id: ID,
        borrower: address,
        stake_id: ID,
        principal_points: u64,
        interest_paid_points: u64,
        total_paid_points: u64
    }
    
    // === Core module functions ===
    
    /// Creates and shares LoanConfig
    public entry fun init_loan_config(
        _gov_cap: &GovernCap,
        max_ltv_bps: u64,
        interest_rate_bps: u64,
        ctx: &mut TxContext
    ) {
        // Validate inputs
        assert!(max_ltv_bps <= 9000, 0); // Max 90% LTV
        assert!(interest_rate_bps <= 10000, 0); // Max 100% interest
        
        let id = object::new(ctx);
        
        // Create loan config
        let loan_config = LoanConfig {
            id,
            max_ltv_bps,
            interest_rate_bps
        };
        
        // Emit event
        event::emit(LoanConfigInitialized {
            id: object::uid_to_inner(&loan_config.id),
            max_ltv_bps,
            interest_rate_bps
        });
        
        // Share the config
        transfer::share_object(loan_config);
    }
    
    /// Opens a loan against a stake position
    public entry fun open_loan<T: store>(
        config: &Config,
        loan_config: &LoanConfig,
        ledger: &mut Ledger,
        stake: &mut StakePosition<T>,
        oracle: &RateOracle,
        amount_points: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        admin::assert_not_paused(config);
        assert!(amount_points > 0, EInvalidLoanAmount);
        let borrower = tx_context::sender(ctx);
        assert!(stake_position::owner_view(stake) == borrower, EUnauthorized);
        assert!(!stake_position::is_encumbered_view(stake), EStakeAlreadyEncumbered);

        let stake_principal = stake_position::principal_view(stake);
        let (rate, decimals) = oracle::get_rate(oracle);
        let stake_value_in_points = oracle::convert_asset_to_points(
            stake_principal,
            rate,
            decimals
        );
        let max_loanable_points = (stake_value_in_points * loan_config.max_ltv_bps) / 10000;
        assert!(amount_points <= max_loanable_points, EExceedsLTV);
        stake_position::set_encumbered(stake, true);
        let stake_id = stake_position::get_id_view(stake);
        let opened_time_ms = clock::timestamp_ms(clock);

        let fee_points = amount_points / 1000; 
        let borrower_points = amount_points - fee_points;
        if (fee_points > amount_points) { abort EFeeCalculationError };

        let loan = Loan {
            id: object::new(ctx),
            borrower,
            stake_id,
            principal_points: amount_points, 
            interest_owed_points: 0, 
            opened_time_ms
        };
        
        if (borrower_points > 0) {
            ledger::internal_earn(ledger, borrower, borrower_points, ctx);
        };

        if (fee_points > 0) {
            ledger::internal_earn(ledger, admin::deployer_address(config), fee_points, ctx);
        };
        
        event::emit(LoanOpened<T> {
            id: object::uid_to_inner(&loan.id),
            borrower,
            stake_id,
            principal_points: amount_points, 
            opened_time_ms
        });
        
        transfer::public_transfer(loan, borrower);
    }
    
    /// Repays a loan and releases the stake
    public entry fun repay_loan<T_stake: store>(
        config: &Config,
        ledger: &mut Ledger,
        loan: Loan,
        stake: &mut StakePosition<T_stake>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Check protocol is not paused
        admin::assert_not_paused(config);
        
        let borrower = tx_context::sender(ctx);
        
        // Check loan owner
        assert!(loan.borrower == borrower, EUnauthorized);
        
        // Check stake ID matches loan
        assert!(stake_position::get_id_view(stake) == loan.stake_id, EWrongStake);
        
        // Get total repayment amount (principal + accrued interest)
        // NOTE: Interest calculation here is currently a placeholder (returns 0)
        let (total_repayment, accrued_interest) = get_current_repayment_amount(&loan, clock);
        
        // Check if borrower has enough points
        let available_points = ledger::get_available_balance(ledger, borrower);
        assert!(available_points >= total_repayment, EInsufficientPoints);
        
        // Deduct points from borrower
        ledger::internal_spend(ledger, borrower, total_repayment, ctx);
        
        // Mark stake as unencumbered
        stake_position::set_encumbered(stake, false);
        
        // Emit event using T_stake from the StakePosition
        event::emit(LoanRepaid<T_stake> {
            id: object::uid_to_inner(&loan.id),
            borrower,
            stake_id: loan.stake_id,
            principal_points: loan.principal_points,
            interest_paid_points: accrued_interest,
            total_paid_points: total_repayment
        });
        
        // Destroy loan object (non-generic)
        let Loan { id, borrower: _, stake_id: _, principal_points: _, interest_owed_points: _, opened_time_ms: _ } = loan;
        object::delete(id);
    }
    
    /* Removed internal calculate_interest function as it requires LoanConfig access
    /// Calculate interest based on principal, elapsed time (ms), and annual rate (bps)
    public fun calculate_interest(
        loan_config: &LoanConfig,
        principal: u64,
        elapsed_ms: u64
    ): u64 {
        if (principal == 0 || elapsed_ms == 0) {
            return 0
        };
        
        // Calculate interest: principal * rate_bps * elapsed_ms / (10000 * MS_PER_YEAR)
        // Use safe math for multiplication to prevent overflow
        let numerator1 = math::safe_mul(principal, loan_config.interest_rate_bps);
        let numerator2 = math::safe_mul(numerator1, elapsed_ms);
        let denominator = math::safe_mul(10000, MS_PER_YEAR);
        let interest = numerator2 / denominator; // Integer division
        
        interest
    }
    */

    // === View functions ===
    
    /// Get loan details (principal, interest owed (currently always 0), opened time ms)
    public fun get_loan_details(loan: &Loan): (u64, u64, u64) {
        (loan.principal_points, loan.interest_owed_points, loan.opened_time_ms)
    }
    
    /// Get current repayment amount including accrued interest.
    /// WARNING: Accrued interest calculation is currently a placeholder and returns 0.
    /// A proper implementation requires access to LoanConfig or calculation during repayment.
    public fun get_current_repayment_amount(
        loan: &Loan,
        clock: &Clock
    ): (u64, u64) { 
        let current_time_ms = clock::timestamp_ms(clock);
        
        // Ensure current time is after loan opened time
        if (current_time_ms < loan.opened_time_ms) {
            // Should not happen in normal flow, but handle defensively
            return (loan.principal_points, 0) 
        };
        
        let elapsed_ms = current_time_ms - loan.opened_time_ms;
        
        // Placeholder for accrued interest calculation
        // TODO: Implement proper interest calculation, likely needing LoanConfig access
        // Or perform calculation within the repay_loan function itself.
        let accrued_interest = 0; // Placeholder - returning 0 for now
        
        let total_repayment = loan.principal_points + accrued_interest;
        
        (total_repayment, accrued_interest)
    }
    
    /// Get the borrower of a loan
    public fun get_borrower(loan: &Loan): address {
        loan.borrower
    }
    
    /// Get the stake ID associated with a loan
    public fun get_stake_id(loan: &Loan): ID {
        loan.stake_id
    }
}