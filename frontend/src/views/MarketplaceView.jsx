// src/views/MarketplaceView.jsx
import React, { useState, useEffect } from 'react';
import { Popover, Transition } from '@headlessui/react'; // Ensure installed: npm install @headlessui/react
import { QuestionMarkCircleIcon, LockClosedIcon, SparklesIcon, CircleStackIcon, CurrencyDollarIcon, BanknotesIcon } from '@heroicons/react/24/solid'; // Ensure installed: npm install @heroicons/react
import Tooltip from '../components/Tooltip'; // Assuming Tooltip is in ../components/
import Spinner from '../components/Spinner'; // Assuming Spinner is in ../components/
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context'; // *** IMPORT CONTEXT HOOK ***

/**
 * Main Marketplace View Component
 * Uses Web3Context for points balance, redemption rate, and redeem action.
 * Accepts simulated handlers via props for non-implemented features.
 */
function MarketplaceView({
    // Simulated handlers passed from App.jsx (or AppContent)
    onSimulatedUnlock = (itemName, cost) => console.log("Simulated Unlock:", itemName, cost),
    onSimulatedBuyAsset = (assetName, cost) => console.log("Simulated Buy:", assetName, cost),
}) {
    const [activeTab, setActiveTab] = useState('redeem');

    // Get data and handlers from Web3Context
    const {
        alphaPoints,
        handleRedeemPoints,
        isRedeeming,
        redemptionRate,
        isFetchingRate,
        isFetchingPoints // To show loading indicator for balance display
    } = useWeb3Context();

    // Style helper for tabs
    const tabButtonStyle = (tabName) => {
        const baseStyle = "px-5 py-2 rounded-t-md text-sm font-medium transition duration-200 ease-in-out border-b-2 flex items-center gap-1"; // Added flex/gap
        const activeStyle = "border-purple-500 text-purple-400";
        const inactiveStyle = "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200";
        return `${baseStyle} ${activeTab === tabName ? activeStyle : inactiveStyle}`;
    };

    // Use points from context, handle loading/error states for display
    const userPointsNum = (alphaPoints === '---' || alphaPoints === '...' || alphaPoints === 'Error' || isNaN(parseFloat(alphaPoints)))
        ? 0 // Default to 0 if loading, error, or NaN
        : parseFloat(alphaPoints);

    const pointsDisplay = isFetchingPoints
        ? <Spinner size="small"/>
        : userPointsNum.toLocaleString(undefined, {maximumFractionDigits: 2});

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-100 mb-2">Marketplace</h2>
                <p className="text-lg text-gray-400">Spend your Alpha Points.</p>
            </div>

            {/* Points Display */}
            <div className="bg-gray-800 bg-opacity-60 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-700 w-fit mx-auto">
                <p className="text-sm text-gray-300 text-center">Your Balance: <span className="font-bold text-lg text-green-400">{pointsDisplay} αP</span></p>
            </div>

            {/* Tabs for Sub-views */}
            <div className="border-b border-gray-700 flex justify-center space-x-4">
                <button onClick={() => setActiveTab('redeem')} className={tabButtonStyle('redeem')}>
                    <BanknotesIcon className="h-4 w-4" /> Redeem for ETH
                </button>
                <button onClick={() => setActiveTab('perks')} className={tabButtonStyle('perks')}>
                    <SparklesIcon className="h-4 w-4" /> Alpha Perks (Simulated)
                </button>
                 {/* Example for another tab (can be uncommented if needed) */}
                 {/* <button onClick={() => setActiveTab('assets')} className={tabButtonStyle('assets')}>
                    <CircleStackIcon className="h-4 w-4" /> Other Assets (Simulated)
                 </button> */}
            </div>

            {/* Conditional Rendering of Sub-views */}
            <div className="pt-6">
                {activeTab === 'redeem' && (
                    <RedeemEthView
                        onRedeemPoints={handleRedeemPoints} // From context
                        userPoints={userPointsNum}
                        redemptionRate={redemptionRate}   // From context
                        isFetchingRate={isFetchingRate}   // From context
                        isRedeeming={isRedeeming}       // From context
                    />
                )}
                {activeTab === 'perks' && <AlphaPerksView onSimulatedUnlock={onSimulatedUnlock} userPoints={userPointsNum} />}
                 {/* {activeTab === 'assets' && <BuyAssetsView onSimulatedBuyAsset={onSimulatedBuyAsset} userPoints={userPointsNum} />} */}
            </div>
        </div>
    );
}


// --- Sub-view Component: Redeem ETH ---
function RedeemEthView({
    onRedeemPoints,
    userPoints,
    redemptionRate,
    isFetchingRate,
    isRedeeming // Use prop from context
}) {
    const [pointsToSpend, setPointsToSpend] = useState('');
    const [ethToReceive, setEthToReceive] = useState('');

    // Check if redemption is actually possible (handler exists in context)
    const canRedeem = typeof onRedeemPoints === 'function';

    // Calculate ETH to receive based on input and rate
    useEffect(() => {
        const pointsNum = parseFloat(pointsToSpend);
        // Clean rate string (remove commas) before parsing
        const rateCleaned = typeof redemptionRate === 'string' ? redemptionRate.replace(/,/g, '') : redemptionRate;
        const rateNum = parseFloat(rateCleaned);

        if (!isNaN(pointsNum) && pointsNum > 0 && !isNaN(rateNum) && rateNum > 0) {
            const ethValue = pointsNum / rateNum;
            setEthToReceive(ethValue.toFixed(6)); // Show reasonable precision
        } else {
            setEthToReceive(''); // Clear if input/rate is invalid
        }
    }, [pointsToSpend, redemptionRate]);

    // Handler for the redeem button click
    const handleRedeem = async () => {
        if (!canRedeem || isRedeeming) return; // Prevent action if impossible or already running

        const pointsNum = parseFloat(pointsToSpend);
        // Basic validation (alert is simple, could use inline messages)
        if (isNaN(pointsNum) || pointsNum <= 0) {
            alert("Please enter a valid positive amount of points to spend.");
            return;
        }
        if (userPoints < pointsNum) {
            alert(`Insufficient Alpha Points balance. You need ${pointsNum.toLocaleString()} αP.`);
            return;
        }

        // Call the handler from the context
        const success = await onRedeemPoints(pointsToSpend); // Pass amount string

        if (success) {
            // Clear the input field on success
            setPointsToSpend('');
            setEthToReceive('');
            // Global message is handled by Web3Context/App.jsx
        }
        // Error messages are also handled globally via txMessage
    };

    // Determine display strings/states for rate and button
    const rateDisplay = isFetchingRate
        ? <Spinner size="small"/>
        : (redemptionRate === 'Error' || redemptionRate === 'N/A' || typeof redemptionRate !== 'string')
            ? <span className="text-red-400">{redemptionRate || 'N/A'}</span> // Show error/NA state clearly
            : `${redemptionRate} αP / ETH`;

    const redeemButtonText = !canRedeem
        ? "Unavailable"
        : (isRedeeming ? <Spinner size="small" color="text-white"/> : 'Redeem Points');

    const isButtonDisabled = isRedeeming || !canRedeem || !pointsToSpend || parseFloat(pointsToSpend) <= 0 || userPoints < parseFloat(pointsToSpend);


    return (
        <div className="max-w-md mx-auto bg-gray-800 bg-opacity-70 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-700 space-y-4 animate-fade-in">
            <h3 className="text-xl font-semibold text-center text-gray-100">Redeem Alpha Points for ETH</h3>
            <p className="text-sm text-center text-gray-400">
                Current Rate: {rateDisplay}
            </p>
            <div>
                <label htmlFor="pointsToSpend" className="block text-sm font-medium text-gray-300 mb-1">
                    Points to Spend (αP)
                </label>
                <input
                    type="number" id="pointsToSpend" value={pointsToSpend}
                    onChange={(e) => setPointsToSpend(e.target.value)}
                    placeholder={canRedeem ? "e.g., 10000" : "Redemption Unavailable"}
                    disabled={isRedeeming || !canRedeem} // Use isRedeeming prop from context
                    min="0" step="any"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 transition duration-200 disabled:opacity-50"
                />
            </div>
            {ethToReceive && canRedeem && ( // Show estimate only if possible
                <p className="text-sm text-center text-gray-300">
                    You will receive approx: <span className="font-semibold text-purple-400">{ethToReceive} ETH</span>
                </p>
            )}
            <div className="flex justify-center">
                <button
                    onClick={handleRedeem}
                    disabled={isButtonDisabled}
                    className={`px-6 py-2 rounded-lg text-white font-medium shadow-md transition duration-300 ease-in-out transform hover:scale-105 active:scale-100 min-w-[140px] flex items-center justify-center ${ // Added flex for spinner centering
                        isRedeeming ? 'bg-gray-500 cursor-wait' : // Use isRedeeming prop
                        isButtonDisabled ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
                        'bg-purple-600 hover:bg-purple-700'
                    }`}
                >
                    {redeemButtonText}
                </button>
            </div>
            {/* Removed local redeemMessage display - rely on global txMessage in App.jsx */}
            <p className="text-xs text-center text-gray-500 pt-2">
                Requires the redemption contract to hold sufficient ETH. Network fees apply.
            </p>
        </div>
    );
}


// --- Sub-view Component: Alpha Perks (Simulated) ---
// This component remains unchanged as it only uses props for simulated actions
function AlphaPerksView({ onSimulatedUnlock, userPoints }) {
    const items = [
        { id: 1, name: "Premium dApp Access", description: "Unlock advanced features in partnered dApps.", cost: 500, icon: SparklesIcon },
        { id: 2, name: "Exclusive Content Pass", description: "Get early access to reports and analysis.", cost: 1000, icon: LockClosedIcon },
        { id: 3, name: "Governance Vote Boost", description: "Increase your voting power in polls (Future Feature).", cost: 2500, icon: SparklesIcon },
    ];
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {items.map((item) => (
                <MarketplaceItem
                    key={item.id}
                    item={item}
                    userPoints={userPoints}
                    onAction={onSimulatedUnlock} // Pass simulation handler
                    buttonText="Unlock"
                    actionType="unlock" // Distinguish simulation type
                />
            ))}
             <div className="md:col-span-2 lg:col-span-3 text-center text-gray-500 pt-4">
                More Perks Coming Soon...
            </div>
        </div>
    );
}


// --- Generic Marketplace Item Component (for Simulated Items) ---
// This component remains unchanged as it only uses props for simulated actions
function MarketplaceItem({ item, userPoints, onAction, buttonText, actionType }) {
    const [isLoading, setIsLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState('');

    // Basic validation and formatting
    const canAfford = userPoints >= item.cost;
    const IconComponent = item.icon; // Assuming item.icon is the component itself

    // Handler for simulated actions
    const handleAction = () => {
        if (!canAfford || isLoading) return;
        setIsLoading(true);
        setActionMessage('');

        // Call the appropriate simulation handler passed via props
        if (actionType === 'unlock') {
            onAction(item.name, item.cost); // Expects (itemName, cost)
        } else if (actionType === 'buy') {
             onAction(item.ticker || item.name, item.cost); // Expects (assetName, cost)
        } else {
            console.warn("Unknown actionType in MarketplaceItem:", actionType);
            onAction(item.name, item.cost); // Default fallback
        }

        setActionMessage("Action Simulated."); // Give feedback
        // Simulate action duration
        setTimeout(() => {
            setActionMessage('');
            setIsLoading(false);
        }, 1500);
    }

    return (
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-gray-700 flex flex-col justify-between transition duration-300 hover:shadow-purple-500/20 hover:border-purple-600 min-h-[220px]"> {/* Added min-height */}
            {/* Item Details */}
            <div>
                <div className="flex items-center mb-3">
                    {IconComponent && <IconComponent className="h-6 w-6 mr-3 text-purple-400 flex-shrink-0" />}
                    <h3 className="text-lg font-semibold text-gray-100">{item.name}</h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">{item.description}</p>
            </div>
            {/* Action Area */}
            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col space-y-2">
                <div className="flex justify-between items-center">
                    <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
                        {item.cost.toLocaleString()} αP
                    </p>
                    <button
                        onClick={handleAction}
                        disabled={!canAfford || isLoading}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition duration-200 ease-in-out transform hover:scale-105 active:scale-100 flex items-center justify-center min-w-[110px] ${ // Ensure consistent size
                            isLoading ? 'bg-gray-500 cursor-wait' :
                            canAfford
                                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {isLoading ? <Spinner size="small" color="text-white"/> : (canAfford ? `${buttonText} (Simulated)` : 'Need More αP')}
                    </button>
                </div>
                {/* Action feedback message */}
                {actionMessage && (
                    <p className="text-xs text-center text-green-400">
                        {actionMessage}
                    </p>
                )}
            </div>
        </div>
    );
}


export default MarketplaceView;