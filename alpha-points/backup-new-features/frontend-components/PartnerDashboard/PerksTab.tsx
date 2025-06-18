import React, { useState } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { usePerkData, PerkDefinition } from '../../hooks/usePerkData';
import { usePartnerSettings } from '../../hooks/usePartnerSettings';
import { toast } from 'react-toastify';
import { formatUSD, formatAlphaPoints, usdToAlphaPointsDisplay } from '../../utils/conversionUtils';
import { PerkCreationForm } from './PerkCreationForm';
import { PerkEditForm } from './PerkEditForm';

interface PerksTabProps {
  partnerCap: PartnerCapInfo;
  selectedPartnerCapId: string;
  onCreatePerk: (perkData: any) => Promise<void>;
  onTogglePerkStatus: (perk: PerkDefinition) => Promise<void>;
  onUpdatePerk: (perkData: any) => Promise<void>;
  onUpdatePerkSettings: () => Promise<void>;
  isCreatingPerk: boolean;
}

export const PerksTab: React.FC<PerksTabProps> = ({
  partnerCap,
  selectedPartnerCapId,
  onCreatePerk,
  onTogglePerkStatus,
  onUpdatePerk,
  onUpdatePerkSettings,
  isCreatingPerk
}) => {
  const { perks, isLoading: isLoadingPerks, refreshPerks } = usePerkData(selectedPartnerCapId);
  const { currentSettings, isLoading: isLoadingSettings } = usePartnerSettings(selectedPartnerCapId);

  // Edit state
  const [editingPerk, setEditingPerk] = useState<PerkDefinition | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleEditPerk = (perk: PerkDefinition) => {
    setEditingPerk(perk);
    setShowCreateForm(false);
  };

  const handleCancelEdit = () => {
    setEditingPerk(null);
  };

  const handleCreatePerkClick = () => {
    setShowCreateForm(true);
    setEditingPerk(null);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
  };

  // Compliance check functions
  const renderComplianceCheck = () => {
    if (!currentSettings) {
      return (
        <div className="bg-gray-500/20 border border-gray-500/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2">⏳ Loading Compliance Status</h4>
          <p className="text-gray-400 text-sm">Checking partner settings...</p>
        </div>
      );
    }

    const checks = [
      {
        name: 'Max Cost Per Perk',
        current: currentSettings.maxCostPerPerk,
        required: 1,
        unit: 'USD',
        status: currentSettings.maxCostPerPerk >= 1 ? 'pass' : 'fail',
        description: 'Minimum spending limit to create perks'
      },
      {
        name: 'Max Daily Spend',
        current: currentSettings.maxDailySpend,
        required: 10,
        unit: 'USD',
        status: currentSettings.maxDailySpend >= 10 ? 'pass' : 'fail',
        description: 'Daily spending limit for all perks'
      },
      {
        name: 'Allowed Perk Types',
        current: currentSettings.allowedPerkTypes?.length || 0,
        required: 1,
        unit: 'types',
        status: (currentSettings.allowedPerkTypes?.length || 0) >= 1 ? 'pass' : 'fail',
        description: 'At least one perk type must be enabled'
      }
    ];

    const passedChecks = checks.filter(check => check.status === 'pass').length;
    const totalChecks = checks.length;
    const allPassed = passedChecks === totalChecks;

    return (
      <div className={`border rounded-lg p-4 ${allPassed ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">
            {allPassed ? '✅ Compliance Check Passed' : '❌ Compliance Issues Found'}
          </h4>
          <span className={`text-sm px-2 py-1 rounded ${allPassed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {passedChecks}/{totalChecks}
          </span>
        </div>
        
        <div className="space-y-2">
          {checks.map((check, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className={check.status === 'pass' ? 'text-green-300' : 'text-red-300'}>
                {check.status === 'pass' ? '✓' : '✗'} {check.name}
              </span>
              <span className="text-gray-400">
                {check.current} {check.unit} {check.status === 'fail' && `(need ${check.required}+)`}
              </span>
            </div>
          ))}
        </div>
        
        {!allPassed && (
          <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded">
            <p className="text-yellow-300 text-sm">
              ⚠️ Please update your settings in the Settings tab to meet compliance requirements before creating perks.
            </p>
          </div>
        )}
      </div>
    );
  };

  if (isLoadingPerks || isLoadingSettings) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading perks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compliance Check */}
      {renderComplianceCheck()}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Manage Perks</h3>
        <button
          onClick={handleCreatePerkClick}
          disabled={isCreatingPerk || !currentSettings}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
        >
          {isCreatingPerk ? 'Creating...' : 'Create New Perk'}
        </button>
      </div>

      {/* Create/Edit Forms */}
      {showCreateForm && (
        <PerkCreationForm
          partnerCap={partnerCap}
          currentSettings={currentSettings}
          onCreatePerk={onCreatePerk}
          onCancel={handleCancelCreate}
          isCreating={isCreatingPerk}
        />
      )}

      {editingPerk && (
        <PerkEditForm
          perk={editingPerk}
          currentSettings={currentSettings}
          onUpdatePerk={onUpdatePerk}
          onCancel={handleCancelEdit}
          isUpdating={isCreatingPerk}
        />
      )}

      {/* Perks List */}
      <div className="space-y-4">
        {perks && perks.length > 0 ? (
          perks.map((perk) => (
            <div key={perk.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{perk.icon}</span>
                    <div>
                      <h4 className="text-lg font-medium text-white">{perk.name}</h4>
                      <p className="text-gray-400 text-sm">{perk.description}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-gray-400">Price</p>
                      <p className="text-white font-medium">{formatUSD(perk.usdcPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Type</p>
                      <p className="text-white font-medium">{perk.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Alpha Points</p>
                      <p className="text-white font-medium">{usdToAlphaPointsDisplay(perk.usdcPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Status</p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        perk.isActive 
                          ? 'bg-green-500/20 text-green-300' 
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {perk.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {perk.tags && perk.tags.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {perk.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleEditPerk(perk)}
                    className="text-blue-400 hover:text-blue-300 p-2 rounded-lg hover:bg-blue-500/20 transition-colors"
                    title="Edit perk"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={() => onTogglePerkStatus(perk)}
                    className={`p-2 rounded-lg transition-colors ${
                      perk.isActive 
                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' 
                        : 'text-green-400 hover:text-green-300 hover:bg-green-500/20'
                    }`}
                    title={perk.isActive ? 'Deactivate perk' : 'Activate perk'}
                  >
                    {perk.isActive ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">No Perks Created</h3>
            <p className="text-gray-400 mb-4">Create your first perk to start offering rewards to users.</p>
            <button
              onClick={handleCreatePerkClick}
              disabled={isCreatingPerk || !currentSettings}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors"
            >
              Create Your First Perk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}; 