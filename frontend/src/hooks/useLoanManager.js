// src/hooks/useLoanManager.js
import { useState, useCallback, useEffect } from 'react';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { 
  createLoanTransaction, 
  createRepayLoanTransaction,
  executeTransaction,
  formatErrorMessage,
  extractEvents
} from '../utils/transaction-helpers';
import { toBcsCompatible } from '../utils/bcs-helpers';
import { formatBalance } from '../utils/formatters';
import { PACKAGE_ID, SHARED_OBJECTS } from '../packages/config';

/**
 * Hook for managing loans against staked assets
 */
export function useLoanManager(provider, walletAdapter, userAddress, refreshData) {
  // Active loans
  const [loans, setLoans] = useState([]);
  
  // Selected stake for loan
  const [selectedStakeId, setSelectedStakeId] = useState(null);
  
  // Loan details
  const [loanAmount, setLoanAmount] = useState('');
  const [maxLoanAmount, setMaxLoanAmount] = useState('0');
  const [interestRate, setInterestRate] = useState('0');
  
  // Loading states
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [isCreatingLoan, setIsCreatingLoan] = useState(false);
  const [isRepayingLoan, setIsRepayingLoan] = useState(false);
  
  // Transaction message
  const [txMessage, setTxMessage] = useState('');
  
  // Error state
  const [error, setError] = useState(null);
  
  // Load active loans
  useEffect(() => {
    if (!provider || !userAddress) return;
    
    const fetchLoans = async () => {
      setIsLoadingLoans(true);
      
      try {
        // Query for owned loan objects
        const objects = await provider.getOwnedObjects({
          owner: userAddress,
          filter: {
            StructType: `${PACKAGE_ID}::loan::Loan`,
          },
          options: { showContent: true, showDisplay: true },
        });
        
        if (objects && objects.data) {
          // Process loan objects
          const loanObjects = objects.data.map(obj => {
            const content = obj.data?.content;
            
            // Extract fields from content
            if (content && content.fields) {
              const {
                borrower,
                stake_id,
                principal_points,
                interest_owed_points,
                opened_epoch
              } = content.fields;
              
              // Format values
              const principal = formatBalance(principal_points || '0', 9);
              const interest = formatBalance(interest_owed_points || '0', 9);
              
              return {
                id: obj.data?.objectId,
                borrower,
                stakeId: stake_id,
                principal,
                principalRaw: principal_points,
                interest,
                interestRaw: interest_owed_points,
                openedEpoch: opened_epoch,
                total: formatBalance(
                  (BigInt(principal_points || '0') + BigInt(interest_owed_points || '0')).toString(),
                  9
                ),
                // Add display data if available
                name: obj.data?.display?.name || 'Loan',
                description: obj.data?.display?.description || 'Alpha Points Loan'
              };
            }
            
            return {
              id: obj.data?.objectId,
              borrower: userAddress,
              stakeId: 'Unknown',
              principal: 'Error',
              interest: 'Error',
              total: 'Error',
              name: 'Error',
              description: 'Error parsing loan data'
            };
          });
          
          setLoans(loanObjects);
        } else {
          setLoans([]);
        }
      } catch (err) {
        console.error('Error fetching loans:', err);
        setError('Failed to fetch loans');
        setLoans([]);
      } finally {
        setIsLoadingLoans(false);
      }
    };
    
    fetchLoans();
  }, [provider, userAddress]);
  
  /**
   * Calculate maximum loan amount for a stake
   * @param {string} stakeId - Stake object ID
   * @returns {Promise<string>} - Maximum loan amount
   */
  const calculateMaxLoanAmount = useCallback(async (stakeId) => {
    if (!provider || !stakeId) {
      setMaxLoanAmount('0');
      return '0';
    }
    
    try {
      // Get stake object
      const stakeObject = await provider.getObject({
        id: stakeId,
        options: { showContent: true }
      });
      
      if (!stakeObject?.data?.content?.fields) {
        throw new Error('Invalid stake object');
      }
      
      // Extract principal from stake
      const { principal } = stakeObject.data.content.fields;
      
      // Get loan config for max LTV
      const loanConfig = await provider.getObject({
        id: SHARED_OBJECTS.LOAN_CONFIG,
        options: { showContent: true }
      });
      
      if (!loanConfig?.data?.content?.fields) {
        throw new Error('Invalid loan config');
      }
      
      // Extract max LTV from config (in basis points)
      const { max_ltv_bps } = loanConfig.data.content.fields;
      
      // Calculate max loan amount (principal * max_ltv_bps / 10000)
      const maxAmount = (BigInt(principal) * BigInt(max_ltv_bps)) / BigInt(10000);
      
      // Format for display
      const formattedMaxAmount = formatBalance(maxAmount.toString(), 9);
      setMaxLoanAmount(formattedMaxAmount);
      
      // Get interest rate
      const { interest_rate_bps } = loanConfig.data.content.fields;
      const interestRatePercent = (Number(interest_rate_bps) / 100).toFixed(2);
      setInterestRate(interestRatePercent);
      
      return formattedMaxAmount;
    } catch (err) {
      console.error('Error calculating max loan amount:', err);
      setMaxLoanAmount('0');
      setInterestRate('0');
      return '0';
    }
  }, [provider]);
  
  /**
   * Select a stake for loan
   * @param {string} stakeId - Stake object ID
   */
  const selectStakeForLoan = useCallback(async (stakeId) => {
    setSelectedStakeId(stakeId);
    setLoanAmount('');
    setError(null);
    
    // Calculate max loan amount for this stake
    await calculateMaxLoanAmount(stakeId);
  }, [calculateMaxLoanAmount]);
  
  /**
   * Create a loan against a staked position
   * @param {string} amount - Loan amount
   * @returns {Promise<object>} - Transaction result
   */
  const createLoan = useCallback(async (amount) => {
    if (!provider || !walletAdapter || !userAddress) {
      setError('Wallet not connected');
      return null;
    }
    
    if (!selectedStakeId) {
      setError('No stake selected');
      return null;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Invalid loan amount');
      return null;
    }
    
    const numAmount = parseFloat(amount);
    const numMaxAmount = parseFloat(maxLoanAmount);
    
    if (numAmount > numMaxAmount) {
      setError(`Loan amount exceeds maximum (${maxLoanAmount})`);
      return null;
    }
    
    setError(null);
    setIsCreatingLoan(true);
    setTxMessage('Preparing loan transaction...');
    
    try {
      // Create loan transaction
      const tx = createLoanTransaction({
        packageId: PACKAGE_ID,
        configId: SHARED_OBJECTS.CONFIG,
        loanConfigId: SHARED_OBJECTS.LOAN_CONFIG,
        ledgerId: SHARED_OBJECTS.LEDGER,
        stakeObjectId: selectedStakeId,
        oracleId: SHARED_OBJECTS.RATE_ORACLE,
        amount,
        tokenType: '0x2::sui::SUI', // Default to SUI for now
        decimals: 9
      });
      
      // Execute transaction
      setTxMessage(`Creating loan for ${amount} points...`);
      const result = await executeTransaction({
        walletAdapter,
        transactionBlock: tx
      });
      
      // Extract loan events
      const loanEvents = extractEvents(result, 'LoanOpened');
      
      // Update message
      setTxMessage(`✅ Loan created successfully for ${amount} points!`);
      
      // Refresh data
      await refreshData();
      
      // Clear message after a delay
      setTimeout(() => setTxMessage(''), 3000);
      
      return result;
    } catch (err) {
      console.error('Error creating loan:', err);
      const errorMsg = formatErrorMessage(err, 'Failed to create loan');
      setError(errorMsg);
      setTxMessage(`❌ ${errorMsg}`);
      return null;
    } finally {
      setIsCreatingLoan(false);
    }
  }, [provider, walletAdapter, userAddress, selectedStakeId, maxLoanAmount, refreshData]);
  
  /**
   * Repay a loan
   * @param {string} loanId - Loan object ID
   * @param {string} stakeId - Associated stake object ID
   * @returns {Promise<object>} - Transaction result
   */
  const repayLoan = useCallback(async (loanId, stakeId) => {
    if (!provider || !walletAdapter || !userAddress) {
      setError('Wallet not connected');
      return null;
    }
    
    if (!loanId || !stakeId) {
      setError('Invalid loan or stake ID');
      return null;
    }
    
    setError(null);
    setIsRepayingLoan(true);
    setTxMessage('Preparing loan repayment...');
    
    try {
      // Create repay loan transaction
      const tx = createRepayLoanTransaction({
        packageId: PACKAGE_ID,
        configId: SHARED_OBJECTS.CONFIG,
        ledgerId: SHARED_OBJECTS.LEDGER,
        loanObjectId: loanId,
        stakeObjectId: stakeId,
        tokenType: '0x2::sui::SUI' // Default to SUI for now
      });
      
      // Execute transaction
      setTxMessage('Repaying loan...');
      const result = await executeTransaction({
        walletAdapter,
        transactionBlock: tx
      });
      
      // Update message
      setTxMessage('✅ Loan repaid successfully!');
      
      // Refresh data
      await refreshData();
      
      // Clear message after a delay
      setTimeout(() => setTxMessage(''), 3000);
      
      return result;
    } catch (err) {
      console.error('Error repaying loan:', err);
      const errorMsg = formatErrorMessage(err, 'Failed to repay loan');
      setError(errorMsg);
      setTxMessage(`❌ ${errorMsg}`);
      return null;
    } finally {
      setIsRepayingLoan(false);
    }
  }, [provider, walletAdapter, userAddress, refreshData]);
  
  /**
   * Get loans for a specific stake
   * @param {string} stakeId - Stake object ID
   * @returns {Array} - Array of loans for the stake
   */
  const getLoansForStake = useCallback((stakeId) => {
    if (!stakeId) return [];
    return loans.filter(loan => loan.stakeId === stakeId);
  }, [loans]);
  
  /**
   * Check if a stake has an active loan
   * @param {string} stakeId - Stake object ID
   * @returns {boolean} - True if stake has an active loan
   */
  const isStakeEncumbered = useCallback((stakeId) => {
    if (!stakeId) return false;
    return loans.some(loan => loan.stakeId === stakeId);
  }, [loans]);
  
  /**
   * Calculate current interest for a loan
   * @param {string} loanId - Loan object ID
   * @returns {Promise<string>} - Current interest amount
   */
  const calculateCurrentInterest = useCallback(async (loanId) => {
    if (!provider || !loanId) return '0';
    
    try {
      // Find the loan
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return '0';
      
      // Get current epoch from clock
      const clock = await provider.getObject({
        id: '0x6', // System clock
        options: { showContent: true }
      });
      
      if (!clock?.data?.content?.fields) {
        throw new Error('Invalid clock object');
      }
      
      const { timestamp_ms } = clock.data.content.fields;
      
      // Convert to epoch (assuming 1 epoch = 1 day = 86400000 ms)
      const currentEpoch = Math.floor(parseInt(timestamp_ms) / 86400000);
      
      // Calculate elapsed epochs
      const elapsedEpochs = Math.max(0, currentEpoch - parseInt(loan.openedEpoch));
      
      // Get loan config for interest rate
      const loanConfig = await provider.getObject({
        id: SHARED_OBJECTS.LOAN_CONFIG,
        options: { showContent: true }
      });
      
      if (!loanConfig?.data?.content?.fields) {
        throw new Error('Invalid loan config');
      }
      
      // Extract interest rate from config (in basis points)
      const { interest_rate_bps } = loanConfig.data.content.fields;
      
      // Calculate interest (principal * rate * time / (10000 * 365))
      // This assumes annual interest rate in basis points
      const principal = BigInt(loan.principalRaw || 0);
      const interestAmount = (principal * BigInt(interest_rate_bps) * BigInt(elapsedEpochs)) / BigInt(3650000);
      
      // Format for display
      return formatBalance(interestAmount.toString(), 9);
    } catch (err) {
      console.error('Error calculating current interest:', err);
      return '0';
    }
  }, [provider, loans]);
  
  /**
   * Get total borrowed amount
   * @returns {string} - Total borrowed amount
   */
  const getTotalBorrowedAmount = useCallback(() => {
    try {
      let total = BigInt(0);
      
      // Sum up principal across loans
      for (const loan of loans) {
        if (loan.principalRaw) {
          try {
            total += BigInt(loan.principalRaw);
          } catch (err) {
            console.error(`Error parsing principal for loan ${loan.id}:`, err);
          }
        }
      }
      
      return formatBalance(total.toString(), 9);
    } catch (err) {
      console.error('Error calculating total borrowed amount:', err);
      return '0';
    }
  }, [loans]);
  
  return {
    // Loan state
    loans,
    selectedStakeId,
    loanAmount,
    maxLoanAmount,
    interestRate,
    
    // Actions
    setLoanAmount,
    selectStakeForLoan,
    createLoan,
    repayLoan,
    
    // Helpers
    getLoansForStake,
    isStakeEncumbered,
    calculateCurrentInterest,
    getTotalBorrowedAmount,
    
    // Loading states
    isLoadingLoans,
    isCreatingLoan,
    isRepayingLoan,
    
    // Error and transaction state
    error,
    txMessage,
    setTxMessage
  };
}