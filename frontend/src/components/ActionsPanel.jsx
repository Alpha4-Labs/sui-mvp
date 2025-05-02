// src/components/ActionsPanel.jsx
import React from 'react';
import { useSuiContext } from '../context/SuiContext'; // Use Sui Context
import Tooltip from './Tooltip';
import Spinner from './Spinner';
import { formatBalance } from '../utils/formatters';
import { QuestionMarkCircleIcon, ArrowUpCircleIcon, ArrowDownCircleIcon } from '@heroicons/react/24/outline'; // Use outline icons

function ActionsPanel({ amount, onAmountChange, className = '' }) {
    const {
        stakedSuiBalance, // Use renamed state from context
        handleStake,
        handleUnstake,
        isStaking,
        isUnstaking,
        isFetchingStakedSui // Use renamed state from context
        // isApproving might not be needed for native SUI
    } = useSuiContext();

    // Combine loading state for stake/unstake actions
    const isProcessing = isStaking || isUnstaking; // Removed isApproving

    // Parse numeric values for validation
    const amountNum = parseFloat(amount);
    // Ensure stakedSuiBalance is treated as a string before parsing
    const stakedBalanceStr = typeof stakedSuiBalance === 'number' ? String(stakedSuiBalance) : stakedSuiBalance;
    const stakedBalanceNum = parseFloat(stakedBalanceStr);

    const hasAmount = !isNaN(amountNum) && amountNum > 0;
    const hasStakedBalance = !isNaN(stakedBalanceNum) && stakedBalanceNum > 0;
    // Ensure comparison uses parsed numbers
    const canAffordUnstake = hasStakedBalance && hasAmount && amountNum <= stakedBalanceNum;

    // Format staked balance display, including loading state
    const stakedFormatted = formatBalance(stakedSuiBalance, 9); // SUI has 9 decimals

    // Wrapper functions to pass amount to context handlers
    // Ensure amount is passed as a string if required by handlers
    const onStakeSubmit = () => { handleStake(String(amount)); };
    const onUnstakeSubmit = () => { handleUnstake(String(amount)); };

    return (
        <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-700 transition duration-300 hover:border-blue-500 hover:shadow-blue-500/20 h-full flex flex-col space-y-4 ${className}`}>
            {/* Panel Header */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-200">Manage SUI Stake</h3> {/* Updated Title */}
                <Tooltip text={`Stake SUI to earn points over time, or unstake your previously staked SUI. Current staked: ${stakedFormatted} SUI`}>
                    <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400 hover:text-gray-200 cursor-help" />
                </Tooltip>
            </div>

            {/* Single Input Field */}
            <div>
                <label htmlFor="stakeUnstakeAmount" className="sr-only">Amount</label>
                <input
                    id="stakeUnstakeAmount"
                    type="number"
                    value={amount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    placeholder="Amount of SUI" // Updated Placeholder
                    disabled={isProcessing}
                    min="0"
                    step="any" // Allow decimals for SUI
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 transition duration-200 disabled:opacity-50"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">
                    Currently Staked: {isFetchingStakedSui ? <Spinner size="tiny"/> : stakedFormatted} SUI {/* Updated Label */}
                </p>
            </div>

            {/* Buttons Area */}
            <div className="flex justify-center items-center gap-x-4 pt-2">
                {/* Stake Button */}
                <button
                    onClick={onStakeSubmit}
                    disabled={isProcessing || !hasAmount}
                    className={`px-5 py-2 rounded-lg text-white font-medium shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-100 flex-1 flex items-center justify-center gap-x-1.5 min-w-[100px] ${
                        isStaking ? 'bg-gray-500 cursor-wait' :
                        (!hasAmount || isUnstaking) ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
                        'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {isStaking ? <Spinner size="small" color="text-white"/> : <ArrowUpCircleIcon className="h-5 w-5"/>}
                    <span>Stake</span>
                </button>

                {/* Unstake Button */}
                <button
                    onClick={onUnstakeSubmit}
                    disabled={isProcessing || !canAffordUnstake}
                    className={`px-5 py-2 rounded-lg text-white font-medium shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-100 flex-1 flex items-center justify-center gap-x-1.5 min-w-[100px] ${
                        isUnstaking ? 'bg-gray-500 cursor-wait' :
                        (!canAffordUnstake || isStaking) ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
                        'bg-pink-600 hover:bg-pink-700'
                    }`}
                >
                     {isUnstaking ? <Spinner size="small" color="text-white"/> : <ArrowDownCircleIcon className="h-5 w-5"/>}
                     <span>Unstake</span>
                </button>
            </div>
        </div>
    );
}

export default ActionsPanel;