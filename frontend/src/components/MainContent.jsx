// src/components/MainContent.jsx
import React from 'react';
import { SwitchTransition, CSSTransition } from 'react-transition-group';

// Import views
import DashboardView from '../views/DashboardView';
import MarketplaceView from '../views/MarketplaceView';
import GenerationView from '../views/GenerationView';

/**
 * Component that handles view switching and transitions
 */
function MainContent({
  currentView,
  isTransitioning,
  stakeAmount,
  onStakeAmountChange,
  projectionData,
  assetPriceData,
  sources,
  sourceToggles,
  assetToggles,
  onSourceToggle,
  onAssetToggle,
  onSimulatedUnlock,
  onSimulatedBuyAsset
}) {
  return (
    <SwitchTransition mode="out-in">
      <CSSTransition
        key={currentView}
        timeout={300}
        classNames={{
          enter: 'view-enter',
          enterActive: 'view-enter-active',
          exit: 'view-exit',
          exitActive: 'view-exit-active'
        }}
        unmountOnExit
      >
        <div className="w-full h-full">
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <DashboardView
              // Pass local UI state
              stakeAmount={stakeAmount}
              onStakeAmountChange={onStakeAmountChange}
              // Pass chart props
              projectionData={projectionData}
              assetPriceData={assetPriceData}
              sources={sources}
              sourceToggles={sourceToggles}
              assetToggles={assetToggles}
              onSourceToggle={onSourceToggle}
              onAssetToggle={onAssetToggle}
            />
          )}

          {/* Marketplace View */}
          {currentView === 'marketplace' && (
            <MarketplaceView
              onSimulatedUnlock={onSimulatedUnlock}
              onSimulatedBuyAsset={onSimulatedBuyAsset}
            />
          )}

          {/* Generation View */}
          {currentView === 'generation' && (
            <GenerationView />
          )}
        </div>
      </CSSTransition>
    </SwitchTransition>
  );
}

export default MainContent;