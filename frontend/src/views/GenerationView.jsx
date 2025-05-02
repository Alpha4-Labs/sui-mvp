// src/views/GenerationView.jsx
import React from 'react';
import { Disclosure, Transition } from '@headlessui/react'; // Ensure installed: npm install @headlessui/react
import { ChevronUpIcon, CheckCircleIcon, XCircleIcon, CircleStackIcon, SparklesIcon, BeakerIcon, QuestionMarkCircleIcon, ClockIcon, LockClosedIcon } from '@heroicons/react/24/solid'; // Ensure installed: npm install @heroicons/react
import Tooltip from '../components/Tooltip'; // Assuming Tooltip is in ../components/
import Spinner from '../components/Spinner'; // Assuming Spinner is in ../components/
import { useWeb3Context } from '../context/Web3Context'; // *** IMPORT CONTEXT HOOK ***

// --- Icons ---
// (Using function components for icons as provided originally)
const AlphaIcon = () => <span className="font-bold text-purple-400">α</span>;
const StargateIcon = () => <CircleStackIcon className="h-5 w-5 text-blue-400" />;
const UniswapIcon = () => <SparklesIcon className="h-5 w-5 text-pink-400" />; // Example, not used in default sources
const ParticipationIcon = () => <BeakerIcon className="h-5 w-5 text-yellow-400" />;

const iconMap = {
    alpha: AlphaIcon,
    stargate: StargateIcon,
    uniswap: UniswapIcon,
    participation: ParticipationIcon,
    default: CircleStackIcon // Fallback icon
};
// --- End Icons ---

// --- Helper Functions (Complete Implementation) ---
function formatDuration(ms) {
    if (!ms || ms <= 0) return 'N/A';
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const minutes = Math.floor(ms / (1000 * 60));
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    return 'Less than a minute';
}

function formatDate(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        // Check if date is valid
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", isoString, e);
        return 'Invalid Date';
    }
}

function calculateProgress(endDateISOString) {
    // This remains an estimation based on a fixed start assumption
    if (!endDateISOString) return 0;
    try {
        const end = new Date(endDateISOString).getTime();
        const now = Date.now();
        // Assumption: Lock started 60 days before end date. Replace with real start date if available.
        const assumedStart = end - (60 * 24 * 60 * 60 * 1000);
        if (isNaN(end) || isNaN(assumedStart)) return 0; // Check for invalid dates
        if (now >= end) return 100;
        if (now <= assumedStart) return 0;
        const totalDuration = end - assumedStart;
        const elapsedDuration = now - assumedStart;
        if (totalDuration <= 0) return 0; // Avoid division by zero
        return Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));
    } catch(e) {
        console.error("Error calculating progress:", endDateISOString, e);
        return 0;
    }
}
// --- End Helper Functions ---


/**
 * View component for displaying point generation sources.
 * Uses Web3Context for data and actions.
 */
function GenerationView() {
    // *** Get data from context ***
    const {
        generationSources,         // Array of source objects
        handleToggleActivationRequest, // Handler to open activation modal
        stakedAlphaBalance,        // Specific balance for native staking card
        isFetchingStakedAlpha      // Loading state for native stake balance
    } = useWeb3Context();

    // Ensure sources is always an array (context should guarantee this, but safe check)
    const sourcesArray = Array.isArray(generationSources) ? generationSources : [];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-100 mb-2">Earn Alpha Points</h2>
                <p className="text-lg text-gray-400">Explore ways to generate points across the ecosystem.</p>
            </div>

            {/* Generation Sources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sourcesArray.length > 0 ? (
                    sourcesArray.map((source) => (
                        <GenerationCard
                            key={source.id}
                            source={source}
                            // Pass down values obtained from context
                            stakedAlphaBalance={stakedAlphaBalance}
                            isFetchingStakedAlpha={isFetchingStakedAlpha} // Pass fetch state
                            onToggleActivationRequest={handleToggleActivationRequest}
                        />
                    ))
                ) : (
                    // Message shown if the sources array is empty or loading initially
                    <p className="text-gray-500 md:col-span-2 lg:col-span-3 text-center">Loading generation sources...</p>
                )}
            </div>
            <p className="text-center text-gray-500 mt-10">More generation methods coming soon!</p>
        </div>
    );
}

/**
 * Component for a single Generation Source Card with Expansion.
 * Displays details including staked amount for native ALPHA staking.
 */
function GenerationCard({ source, onToggleActivationRequest, stakedAlphaBalance, isFetchingStakedAlpha }) {
    // Basic check for valid source data
    if (!source || typeof source !== 'object' || source.id === undefined) {
        console.warn("GenerationCard received invalid source prop:", source);
        return (
             <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm rounded-xl shadow-lg border border-red-700 p-4 text-red-300">
                 Invalid source data provided.
             </div>
        );
    }

    const IconComponent = iconMap[source.icon] || iconMap.default;
    const handleButtonClick = () => { onToggleActivationRequest(source.id, source.active); };
    const lockProgress = calculateProgress(source.lockEndDate);
    // More specific check for Native Staking source (assuming id 1 is always native stake)
    const isNativeAlphaStake = source.id === 1;

    // Format the specific staked balance for native ALPHA, handling loading/error states
     const formattedStakedAlpha = isFetchingStakedAlpha
        ? <Spinner size="small" color="text-purple-400"/> // Show spinner if fetching
        : (stakedAlphaBalance === '---' || stakedAlphaBalance === 'Error' || isNaN(parseFloat(stakedAlphaBalance)))
            ? <span className={stakedAlphaBalance === 'Error' ? 'text-red-400' : 'text-gray-500'}>{stakedAlphaBalance}</span> // Show '---' or 'Error'
            : parseFloat(stakedAlphaBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    // Format the general staked amount from the source object (for LP, etc.)
    const formattedSourceStakedAmount = (source.stakedAmount === null || source.stakedAmount === undefined)
        ? 'N/A'
        : source.stakedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <Disclosure as="div" className="bg-gray-800 bg-opacity-70 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700 transition duration-300 hover:border-purple-600 flex flex-col">
            {({ open }) => (
                <>
                    {/* Disclosure Button (Card Header) */}
                    <Disclosure.Button className="flex justify-between w-full px-5 py-4 text-left text-sm font-medium text-gray-100 hover:bg-gray-700/50 rounded-t-xl focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75">
                        <div className="flex items-center space-x-3">
                            <IconComponent />
                            <span className="text-lg">{source.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Tooltip text={source.active ? "Currently active" : "Inactive"} as="span">
                                {source.active
                                    ? <CheckCircleIcon className="h-5 w-5 text-green-500 block" />
                                    : <XCircleIcon className="h-5 w-5 text-red-500 block" />
                                }
                            </Tooltip>
                            <ChevronUpIcon className={`${ open ? 'transform rotate-180' : '' } w-5 h-5 text-purple-400 transition-transform duration-200`} />
                        </div>
                    </Disclosure.Button>

                    {/* Expandable Panel */}
                    <Transition
                        enter="transition duration-100 ease-out" enterFrom="transform scale-95 opacity-0" enterTo="transform scale-100 opacity-100"
                        leave="transition duration-75 ease-out" leaveFrom="transform scale-100 opacity-100" leaveTo="transform scale-95 opacity-0"
                        className="flex-grow" // Allow panel to grow if content is long
                    >
                        <Disclosure.Panel className="px-5 pt-3 pb-4 text-sm text-gray-300 border-t border-gray-700 flex flex-col justify-between h-full">
                            {/* Panel Content */}
                            <div className="space-y-3 mb-4">
                                <p><strong className="text-gray-100">Type:</strong> {source.type}</p>
                                <p><strong className="text-gray-100">Rate:</strong> {source.rate}
                                    <Tooltip text="Generation rates are indicative and may change." position="top">
                                        <QuestionMarkCircleIcon className="h-4 w-4 inline-block ml-1 text-gray-400 hover:text-gray-200 cursor-help" />
                                    </Tooltip>
                                </p>
                                <p className="mt-2">{source.details}</p>

                                {/* Staking Details Section */}
                                {/* Show if source is active AND it's either Native Stake OR it's another type with a symbol and amount > 0 */}
                                {source.active && (isNativeAlphaStake || (source.assetSymbol && source.stakedAmount !== null && source.stakedAmount > 0)) && (
                                    <div className="mt-4 pt-3 border-t border-gray-700 space-y-2">
                                        <p className="font-medium text-gray-100">Your Participation:</p>
                                        {/* Display Staked Amount */}
                                        <p>
                                            <strong className="text-gray-400 w-24 inline-block">Amount:</strong>
                                            {isNativeAlphaStake
                                                ? <>{formattedStakedAlpha} {source.assetSymbol}</> // Display formatted value including spinner/error
                                                : `${formattedSourceStakedAmount} ${source.assetSymbol}`
                                            }
                                        </p>
                                        {/* Lock/Unlock Info */}
                                        {source.lockEndDate && (
                                            <>
                                                <div className="flex items-center">
                                                    <strong className="text-gray-400 w-24 inline-block">Locked Until:</strong>
                                                    <span>{formatDate(source.lockEndDate)}</span>
                                                    <Tooltip text={`Assets are locked until this date.`} position="top">
                                                        <LockClosedIcon className="h-4 w-4 inline-block ml-1 text-gray-400 hover:text-gray-200 cursor-help" />
                                                    </Tooltip>
                                                </div>
                                                {/* Progress Bar */}
                                                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1" title={`${lockProgress.toFixed(0)}% of lock duration elapsed (estimated)`}>
                                                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${lockProgress}%` }}></div>
                                                </div>
                                            </>
                                        )}
                                        {source.unlockDuration && (
                                            <div className="flex items-center">
                                                <strong className="text-gray-400 w-24 inline-block">Unlock Period:</strong>
                                                <span>{formatDuration(source.unlockDuration)}</span>
                                                <Tooltip text={`A ${formatDuration(source.unlockDuration)} period is required to unlock assets after staking ends or deactivation.`} position="top">
                                                    <ClockIcon className="h-4 w-4 inline-block ml-1 text-gray-400 hover:text-gray-200 cursor-help" />
                                                </Tooltip>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Show message if active but no staked amount recorded (for non-native types with asset symbol) */}
                                {source.active && !isNativeAlphaStake && source.assetSymbol && (source.stakedAmount === null || source.stakedAmount <= 0) && (
                                    <p className="text-xs text-gray-500 mt-2">No staked amount recorded for this source.</p>
                                )}
                                {/* Show message for participation types with no amount or asset symbol */}
                                 {source.active && !source.assetSymbol && (
                                    <p className="text-xs text-gray-500 mt-2">Participation activity tracked automatically.</p>
                                 )}
                            </div>
                            {/* Activation Button */}
                            <div className="pt-3 text-center mt-auto"> {/* mt-auto pushes button down */}
                                <button
                                    onClick={handleButtonClick}
                                    // Disable button for native staking (should be done via Dashboard ActionsPanel)
                                    disabled={isNativeAlphaStake}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition duration-200 ease-in-out transform hover:scale-105 active:scale-100 ${
                                        isNativeAlphaStake
                                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' // Disabled style for native stake
                                            : source.active
                                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md'
                                                : 'bg-green-600 hover:bg-green-700 text-white shadow-md'
                                    }`}
                                     title={isNativeAlphaStake ? "Manage native ALPHA stake via Dashboard" : (source.active ? 'Deactivate this source (requires modal confirmation)' : 'Activate this source (requires modal confirmation)')}
                                >
                                    {/* Adjust text based on whether it's native staking */}
                                    {isNativeAlphaStake ? 'Manage on Dashboard' : (source.active ? 'Deactivate...' : 'Activate...')}
                                </button>
                            </div>
                        </Disclosure.Panel>
                    </Transition>
                </>
            )}
        </Disclosure>
    );
}

export default GenerationView;