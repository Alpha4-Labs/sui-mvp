// src/components/LoanPanel.jsx
import React, { useState, useEffect } from 'react';
import { useLoanManager } from '../hooks/useLoanManager';
import { useStakeProviders } from '../hooks/useStakeProviders';
import { formatBalance } from '../utils/formatters';
import { 
  LockClosedIcon, 
  CurrencyDollarIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  ArrowsRightLeftIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import Tooltip from './Tooltip';
import Spinner from './Spinner';

/**
 * Component for managing loans against staked assets
 */
const LoanPanel = ({ provider, walletAdapter, userAddress, refreshData }) => {
  // Use loan manager hook
  const {
    loans,
    selectedStakeId,
    loanAmount,
    maxLoanAmount,
    interestRate,
    setLoanAmount,
    selectStakeForLoan,
    createLoan,
    repayLoan,
    isStakeEncumbered,
    calculateCurrentInterest,
    getTotalBorrowedAmount,
    isLoadingLoans,
    isCreatingLoan,
    isRepayingLoan,
    error,
    txMessage
  } = useLoanManager(provider, walletAdapter, userAddress, refreshData);

  // Use stake providers hook to get stake objects
  const { getAllStakeObjects } = useStakeProviders(provider, walletAdapter, userAddress, refreshData);

  // Local state
  const [stakeOptions, setStakeOptions] = useState([]);
  const [currentTab, setCurrentTab] = useState('borrow'); // 'borrow' or 'active'
  const [interestAmounts, setInterestAmounts] = useState({});

  // Load stake options
  useEffect(() => {
    const loadStakeOptions = async () => {
      const allStakes = getAllStakeObjects();
      
      // Filter out encumbered stakes
      const availableStakes = allStakes.filter(stake => 
        stake?.data?.content?.fields && !isStakeEncumbered(stake.objectId)
      );
      
      setStakeOptions(availableStakes);
    };
    
    loadStakeOptions();
  }, [getAllStakeObjects, isStakeEncumbered, loans]);

  // Load current interest amounts for active loans
  useEffect(() => {
    const loadInterestAmounts = async () => {
      const amounts = {};
      
      for (const loan of loans) {
        try {
          amounts[loan.id] = await calculateCurrentInterest(loan.id);
        } catch (err) {
          console.error(`Error calculating interest for loan ${loan.id}:`, err);
          amounts[loan.id] = 'Error';
        }
      }
      
      setInterestAmounts(amounts);
    };
    
    if (loans.length > 0) {
      loadInterestAmounts();
      
      // Update interest every 60 seconds
      const intervalId = setInterval(loadInterestAmounts, 60000);
      return () => clearInterval(intervalId);
    }
  }, [loans, calculateCurrentInterest]);

  // Handle stake selection
  const handleStakeSelect = async (stakeId) => {
    if (selectedStakeId === stakeId) return;
    
    setLoanAmount('');
    await selectStakeForLoan(stakeId);
  };

  // Handle loan creation
  const handleCreateLoan = async () => {
    if (!selectedStakeId || !loanAmount) return;
    
    await createLoan(loanAmount);
  };

  // Handle loan repayment
  const handleRepayLoan = async (loanId, stakeId) => {
    if (!loanId || !stakeId) return;
    
    await repayLoan(loanId, stakeId);
  };

  // Format stake details from stake object
  const formatStakeDetails = (stake) => {
    if (!stake?.data?.content?.fields) return { principal: 'N/A', assetType: 'Unknown' };
    
    const { principal, type, owner } = stake.data.content.fields;
    const formattedPrincipal = formatBalance(principal, 9);
    
    // Extract asset type from type info
    const assetType = type || 'ALPHA';
    
    return { principal: formattedPrincipal, assetType, owner };
  };

  // Style for tab buttons
  const tabButtonStyle = (tab) => {
    const baseStyle = "px-4 py-2 rounded-md text-sm font-medium transition duration-200";
    const activeStyle = "bg-purple-600 text-white";
    const inactiveStyle = "text-gray-300 hover:bg-gray-700 hover:text-white";
    return `${baseStyle} ${currentTab === tab ? activeStyle : inactiveStyle}`;
  };

  return (
    <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 transition duration-300">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-xl font-medium text-gray-100">Alpha Points Loans</h3>
        
        {/* Tab Selector */}
        <div className="flex space-x-2 bg-gray-900 p-1 rounded-lg">
          <button 
            onClick={() => setCurrentTab('borrow')} 
            className={tabButtonStyle('borrow')}
          >
            Borrow
          </button>
          <button 
            onClick={() => setCurrentTab('active')} 
            className={tabButtonStyle('active')}
          >
            Active Loans
            {loans.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-purple-700 rounded-full">
                {loans.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Show error message if any */}
      {error && (
        <div className="p-3 rounded-lg mb-4 text-sm bg-red-900/80 text-red-200">
          {error}
        </div>
      )}

      {/* Borrow Tab */}
      {currentTab === 'borrow' && (
        <div className="space-y-4">
          {/* Stake Selection */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Select a Stake Position
              </label>
              <Tooltip text="Choose a staked position to use as collateral for your loan">
                <InformationCircleIcon className="h-5 w-5 text-gray-400" />
              </Tooltip>
            </div>
            
            {stakeOptions.length === 0 ? (
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                {isLoadingLoans ? (
                  <Spinner />
                ) : (
                  <>
                    <p className="text-gray-300 mb-2">No Available Stake Positions</p>
                    <p className="text-gray-500 text-sm">
                      You need to stake ALPHA tokens first before you can take a loan.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stakeOptions.map((stake) => {
                  const { principal, assetType } = formatStakeDetails(stake);
                  return (
                    <button
                      key={stake.objectId}
                      onClick={() => handleStakeSelect(stake.objectId)}
                      className={`p-3 rounded-lg border text-left transition ${
                        selectedStakeId === stake.objectId 
                          ? 'border-purple-500 bg-purple-900/30' 
                          : 'border-gray-600 bg-gray-700/50 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <LockClosedIcon className="h-5 w-5 mr-2 text-purple-400" />
                          <span className="font-medium text-gray-200">
                            {principal} {assetType}
                          </span>
                        </div>
                        {selectedStakeId === stake.objectId && (
                          <div className="h-3 w-3 bg-purple-500 rounded-full"></div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        ID: {stake.objectId.substring(0, 8)}...{stake.objectId.substring(stake.objectId.length - 4)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Loan Amount Input (only if stake is selected) */}
          {selectedStakeId && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="loanAmount" className="block text-sm font-medium text-gray-300">
                  Loan Amount (Alpha Points)
                </label>
                <Tooltip text={`Maximum loan: ${maxLoanAmount} points (based on LTV ratio)`}>
                  <InformationCircleIcon className="h-5 w-5 text-gray-400" />
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="loanAmount"
                  type="text"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder={`Max: ${maxLoanAmount}`}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
                />
                <button
                  onClick={() => setLoanAmount(maxLoanAmount)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-xs text-gray-300"
                >
                  Max
                </button>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Interest Rate: {interestRate}%</span>
                <span>LTV Ratio: {loanAmount && maxLoanAmount ? ((parseFloat(loanAmount) / parseFloat(maxLoanAmount)) * 100).toFixed(2) : '0'}%</span>
              </div>
            </div>
          )}

          {/* Create Loan Button */}
          <div className="flex justify-center mt-6">
            <button
              onClick={handleCreateLoan}
              disabled={!selectedStakeId || !loanAmount || isCreatingLoan || parseFloat(loanAmount) <= 0 || parseFloat(loanAmount) > parseFloat(maxLoanAmount)}
              className={`px-6 py-2 rounded-lg text-white font-medium shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-100 flex items-center gap-2 ${
                !selectedStakeId || !loanAmount || isCreatingLoan || parseFloat(loanAmount) <= 0 || parseFloat(loanAmount) > parseFloat(maxLoanAmount)
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isCreatingLoan ? (
                <><Spinner size="small" /> Creating Loan...</>
              ) : (
                <><ArrowsRightLeftIcon className="h-5 w-5" /> Create Loan</>
              )}
            </button>
          </div>

          {/* Loan Info */}
          <div className="bg-gray-700/50 rounded-lg p-4 mt-4 text-sm">
            <h4 className="text-gray-200 font-medium mb-2 flex items-center">
              <InformationCircleIcon className="h-5 w-5 mr-2 text-blue-400" />
              Loan Information
            </h4>
            <ul className="space-y-2 text-gray-300">
              <li>• Loans are denominated in Alpha Points and use staked assets as collateral.</li>
              <li>• The maximum loan amount is determined by the Loan-to-Value (LTV) ratio.</li>
              <li>• Interest accrues continuously and is paid when you repay the loan.</li>
              <li>• Your staked assets remain locked until the loan is fully repaid.</li>
              <li>• You cannot unstake assets that have outstanding loans against them.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Active Loans Tab */}
      {currentTab === 'active' && (
        <div className="space-y-4">
          {/* Total Borrowed Amount */}
          <div className="bg-gray-700/50 rounded-lg p-4 text-center">
            <h4 className="text-sm text-gray-400 mb-1">Total Borrowed</h4>
            <p className="text-2xl font-bold text-gray-100">{getTotalBorrowedAmount()} <span className="text-sm text-gray-400">αP</span></p>
          </div>

          {/* Active Loans List */}
          {isLoadingLoans ? (
            <div className="text-center py-6">
              <Spinner />
              <p className="text-gray-400 mt-2">Loading your loans...</p>
            </div>
          ) : loans.length === 0 ? (
            <div className="bg-gray-700/40 rounded-lg p-6 text-center">
              <ExclamationCircleIcon className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-300 mb-2">No Active Loans</h4>
              <p className="text-gray-400 text-sm mb-4">
                You don't have any active loans. Switch to the Borrow tab to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {loans.map((loan) => (
                <div 
                  key={loan.id} 
                  className="bg-gray-700/40 border border-gray-600 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center text-gray-200 font-medium">
                        <CurrencyDollarIcon className="h-5 w-5 mr-2 text-yellow-400" />
                        {loan.principal} <span className="text-xs text-gray-400 ml-1">αP</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Opened: {new Date(parseInt(loan.openedEpoch) * 86400000).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-300">
                        Stake ID: {loan.stakeId.substring(0, 6)}...
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Loan ID: {loan.id.substring(0, 6)}...
                      </div>
                    </div>
                  </div>
                  
                  {/* Interest and Repayment */}
                  <div className="bg-gray-800/60 rounded p-3 mb-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center text-gray-300">
                        <ClockIcon className="h-4 w-4 mr-1 text-orange-400" />
                        Current Interest:
                      </div>
                      <div className="font-medium text-orange-400">
                        {interestAmounts[loan.id] || '...'}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-2">
                      <div className="text-gray-300">Total to Repay:</div>
                      <div className="font-bold text-gray-100">
                        {loan.total} <span className="text-xs text-gray-400">αP</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Repay Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleRepayLoan(loan.id, loan.stakeId)}
                      disabled={isRepayingLoan}
                      className={`px-4 py-1.5 rounded-md text-white text-sm font-medium transition duration-200 ${
                        isRepayingLoan
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {isRepayingLoan ? <Spinner size="small" /> : 'Repay Loan'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LoanPanel;