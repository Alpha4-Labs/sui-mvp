// src/components/PointsDisplay.jsx
import React from 'react';
import { useSuiContext } from '../context/SuiContext'; // Use Sui Context
import Tooltip from './Tooltip';
import Spinner from './Spinner';
import { formatPoints } from '../utils/formatters'; // Assuming you have this formatter
import { QuestionMarkCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline'; // Use outline for consistency? Or solid?

function PointsDisplay({ className = '' }) {
    const {
        alphaPoints, // Represents AVAILABLE points from context
        lockedPoints, // Get locked points from context
        isFetchingPoints // Combined loading state for points
    } = useSuiContext();

    // Format points values (ensure formatPoints handles loading/error states like '---', 'Error')
    const formattedAvailablePoints = formatPoints(alphaPoints);
    const formattedLockedPoints = formatPoints(lockedPoints);

    // Removed accrued points, claim logic, and timestamp logic as get_accrued_points is missing

    return (
        <div className={`bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 transition duration-300 hover:border-purple-500 hover:shadow-purple-500/20 h-full flex flex-col justify-between space-y-3 ${className}`}>
            {/* Available Points */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <h2 className="text-base font-semibold text-gray-300">Available Points</h2>
                    <Tooltip text="Your current points balance available for spending or redemption.">
                        <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-200" />
                    </Tooltip>
                </div>
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 break-all">
                    {isFetchingPoints ? <Spinner size="normal" color="text-green-400"/> : formattedAvailablePoints}
                     <span className="text-sm text-gray-400 ml-1 font-normal">αP</span>
                </p>
            </div>

            {/* Locked Points */}
            <div className="border-t border-gray-700 pt-3">
                 <div className="flex items-center mb-1">
                    <LockClosedIcon className="h-4 w-4 mr-1.5 text-gray-400" />
                    <span className="text-sm text-gray-300">Locked Points</span>
                    <Tooltip text="Points locked due to active loans.">
                         <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-200 ml-1" />
                    </Tooltip>
                 </div>
                 <p className="text-lg font-medium text-gray-300">
                    {isFetchingPoints ? <Spinner size="small" /> : formattedLockedPoints}
                    <span className="text-xs text-gray-400 ml-1">αP</span>
                 </p>
            </div>
            {/* Removed Claim Button and Accrued section */}
        </div>
    );
}

export default PointsDisplay;