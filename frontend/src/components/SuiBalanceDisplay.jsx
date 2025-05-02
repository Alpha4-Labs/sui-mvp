// src/components/SuiBalanceDisplay.jsx
import React from 'react';
import { useSuiContext } from '../context/SuiContext'; // Use Sui Context
import Tooltip from './Tooltip';
import Spinner from './Spinner';
import { formatBalance } from '../utils/formatters'; // Assuming you have this
import { CurrencyDollarIcon, LinkIcon } from '@heroicons/react/24/outline'; // Use outline icons

function SuiBalanceDisplay({ className = '' }) {
    // Get SUI balance from context
    const {
        suiBalance,
        isFetchingSui, // Use the correct loading flag for SUI balance
    } = useSuiContext();

    // --- Balance Formatting ---
    const formattedBalance = formatBalance(suiBalance, 9); // SUI has 9 decimals

    // Faucet URL (Testnet)
    const suiFaucetUrl = "https://faucet.sui.io/?network=testnet";

    return (
        <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-700 transition duration-300 hover:border-cyan-500 hover:shadow-cyan-500/20 h-full flex flex-col justify-between ${className}`}>
            {/* Balance Display */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-gray-200">Your SUI Balance</h2>
                    <Tooltip text="Your available SUI token balance in your connected wallet.">
                        <CurrencyDollarIcon className="h-5 w-5 text-gray-400 hover:text-gray-200 cursor-help" />
                    </Tooltip>
                </div>
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 break-all">
                    {isFetchingSui ? <Spinner /> : formattedBalance}
                </p>
            </div>

            {/* Link to Official Faucet */}
            <div className="mt-4 pt-4 border-t border-gray-600 text-center">
                <p className="text-xs text-gray-400 mb-2">Need SUI for gas or testing?</p>
                <a
                    href={suiFaucetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-x-1.5 px-4 py-2 rounded-lg text-sm font-medium shadow transition duration-300 ease-in-out bg-cyan-600 hover:bg-cyan-700 text-white transform hover:scale-105 active:scale-100"
                >
                    <LinkIcon className="h-4 w-4" />
                    <span>Go to Sui Testnet Faucet</span>
                </a>
            </div>
        </div>
    );
}

export default SuiBalanceDisplay;