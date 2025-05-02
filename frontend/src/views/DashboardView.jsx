// src/views/DashboardView.jsx
import React from 'react';
// Remove context import if only sub-components need it
// import { useSuiContext } from '../context/SuiContext';
import PointsDisplay from '../components/PointsDisplay';       // Import updated component
import SuiBalanceDisplay from '../components/SuiBalanceDisplay'; // Import new component
import ActionsPanel from '../components/ActionsPanel';         // Import updated component
import ProjectionChart from '../components/ProjectionChart';   // Import existing component

function DashboardView({
    // Props passed down from AppContent
    stakeAmount, // Local UI state for the input field, managed in AppContent
    onStakeAmountChange, // Handler to update stakeAmount in AppContent
    projectionData,
    assetPriceData,
    sources,
    sourceToggles,
    assetToggles,
    onSourceToggle,
    onAssetToggle
}) {

    // No need for context hook here if only sub-components use it directly

    return (
        <div className="space-y-8 animate-fade-in">
            {/* 3-Column Grid for Top Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Render imported components */}
                <PointsDisplay />
                <SuiBalanceDisplay />
                <ActionsPanel
                    amount={stakeAmount}
                    onAmountChange={onStakeAmountChange}
                 />
            </div>

            {/* Projection Chart Section */}
            <ProjectionChart
                projectionData={projectionData}
                assetPriceData={assetPriceData}
                sources={sources}
                sourceToggles={sourceToggles}
                assetToggles={assetToggles}
                onSourceToggle={onSourceToggle}
                onAssetToggle={onAssetToggle}
            />
        </div>
    );
}

export default DashboardView;