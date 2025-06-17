import React, { useState, useRef, useEffect } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { usePartnerSettings } from '../../hooks/usePartnerSettings';
import { toast } from 'react-toastify';

interface SettingsTabProps {
  partnerCap: PartnerCapInfo;
  selectedPartnerCapId: string;
  onUpdatePerkSettings: () => Promise<void>;
  onShowCollateralModal: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  partnerCap,
  selectedPartnerCapId,
  onUpdatePerkSettings,
  onShowCollateralModal
}) => {
  const {
    currentSettings,
    formSettings: perkSettings,
    setFormSettings: setPerkSettings,
    isLoading: isLoadingSettings,
    isUpdating: isUpdatingSettings
  } = usePartnerSettings(selectedPartnerCapId);

  // Salt management state
  const [showSaltModal, setShowSaltModal] = useState(false);
  const [saltRegenConfirm, setSaltRegenConfirm] = useState(false);
  const saltInputRef = useRef<HTMLInputElement>(null);

  // Copy salt to clipboard
  const copySalt = async () => {
    if (partnerCap.salt) {
      try {
        await navigator.clipboard.writeText(partnerCap.salt);
        toast.success('Salt copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy salt to clipboard');
      }
    }
  };

  // Download salt as file
  const downloadSalt = () => {
    if (partnerCap.salt) {
      const blob = new Blob([partnerCap.salt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partner-salt-${partnerCap.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Salt downloaded successfully!');
    }
  };

  // Salt regeneration handlers
  const handleSaltRegeneration = () => {
    setSaltRegenConfirm(true);
  };

  const proceedSaltRegeneration = () => {
    // TODO: Implement salt regeneration logic
    toast.info('Salt regeneration functionality will be implemented soon');
    setSaltRegenConfirm(false);
  };

  const cancelSaltRegeneration = () => {
    setSaltRegenConfirm(false);
  };

  // Handle clicks outside modal to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSaltModal && saltInputRef.current && !saltInputRef.current.contains(event.target as Node)) {
        const modalElement = document.querySelector('.salt-modal');
        if (modalElement && !modalElement.contains(event.target as Node)) {
          setShowSaltModal(false);
        }
      }
    };

    if (showSaltModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSaltModal]);

  if (isLoadingSettings) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Partner Settings */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Partner Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Spending Limits */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white">Spending Limits</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Cost Per Perk (USD)
              </label>
              <input
                type="number"
                value={perkSettings.maxCostPerPerk}
                onChange={(e) => setPerkSettings(prev => ({
                  ...prev,
                  maxCostPerPerk: parseFloat(e.target.value) || 0
                }))}
                min="0"
                step="0.01"
                className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="Enter maximum cost per perk"
              />
              <p className="text-xs text-gray-400 mt-1">
                Maximum amount you're willing to spend per individual perk
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Daily Spend (USD)
              </label>
              <input
                type="number"
                value={perkSettings.maxDailySpend}
                onChange={(e) => setPerkSettings(prev => ({
                  ...prev,
                  maxDailySpend: parseFloat(e.target.value) || 0
                }))}
                min="0"
                step="0.01"
                className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="Enter maximum daily spend"
              />
              <p className="text-xs text-gray-400 mt-1">
                Maximum total amount you're willing to spend per day across all perks
              </p>
            </div>
          </div>

          {/* Perk Configuration */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-white">Perk Configuration</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Allowed Perk Types
              </label>
              <div className="space-y-2">
                {['Access', 'Discount', 'Experience', 'Content', 'Service'].map((type) => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={perkSettings.allowedPerkTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPerkSettings(prev => ({
                            ...prev,
                            allowedPerkTypes: [...prev.allowedPerkTypes, type]
                          }));
                        } else {
                          setPerkSettings(prev => ({
                            ...prev,
                            allowedPerkTypes: prev.allowedPerkTypes.filter(t => t !== type)
                          }));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-white">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="expiring-perks"
                  checked={perkSettings.allowExpiringPerks}
                  onChange={(e) => setPerkSettings(prev => ({
                    ...prev,
                    allowExpiringPerks: e.target.checked
                  }))}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="expiring-perks" className="text-white">
                  Allow Expiring Perks
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="consumable-perks"
                  checked={perkSettings.allowConsumablePerks}
                  onChange={(e) => setPerkSettings(prev => ({
                    ...prev,
                    allowConsumablePerks: e.target.checked
                  }))}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="consumable-perks" className="text-white">
                  Allow Consumable Perks
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={onUpdatePerkSettings}
            disabled={isUpdatingSettings}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
          >
            {isUpdatingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Salt Management */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Salt Management</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Partner Salt
            </label>
            <div className="flex items-center space-x-2">
              <input
                ref={saltInputRef}
                type="password"
                value={partnerCap.salt || ''}
                readOnly
                className="flex-1 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm"
                placeholder="No salt available"
              />
              <button
                onClick={() => setShowSaltModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors"
                title="View salt"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              This salt is used for cryptographic operations. Keep it secure and never share it.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={copySalt}
              disabled={!partnerCap.salt}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
            >
              Copy Salt
            </button>
            <button
              onClick={downloadSalt}
              disabled={!partnerCap.salt}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
            >
              Download Salt
            </button>
            <button
              onClick={handleSaltRegeneration}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
            >
              Regenerate Salt
            </button>
          </div>
        </div>
      </div>

      {/* Collateral Management */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Collateral Management</h3>
        
        <div className="space-y-4">
          <p className="text-gray-300">
            Manage your collateral deposits to ensure you can fulfill perk obligations.
          </p>
          
          <button
            onClick={onShowCollateralModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Manage Collateral
          </button>
        </div>
      </div>

      {/* Salt Modal */}
      {showSaltModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="salt-modal bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Partner Salt</h3>
            <div className="bg-gray-900 rounded p-3 mb-4">
              <p className="text-white font-mono text-sm break-all">
                {partnerCap.salt}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={copySalt}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
              >
                Copy
              </button>
              <button
                onClick={downloadSalt}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
              >
                Download
              </button>
              <button
                onClick={() => setShowSaltModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Salt Regeneration Confirmation */}
      {saltRegenConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">⚠️ Regenerate Salt</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to regenerate your partner salt? This action cannot be undone and will invalidate any existing integrations.
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={proceedSaltRegeneration}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
              >
                Yes, Regenerate
              </button>
              <button
                onClick={cancelSaltRegeneration}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 