import React, { useState } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { PartnerSettings } from '../../hooks/usePartnerSettings';
import { formatUSD, usdToAlphaPointsDisplay } from '../../utils/conversionUtils';
import { hashMetadata } from '../../utils/privacy';
import { toast } from 'react-hot-toast';
import { Transaction } from '@mysten/sui/transactions';

interface PerkCreationFormProps {
  partnerCap: PartnerCapInfo;
  currentSettings: PartnerSettings | null;
  onCreatePerk: (perkData: any) => Promise<void>;
  onCancel: () => void;
  isCreating: boolean;
  hasPartnerStats?: boolean;
  onSuccess?: () => void;
  onClose: () => void;
  suiClient: any;
  currentAccount: any;
  PACKAGE_ID: string;
  CONFIG_ID: string;
  CLOCK_ID: string;
}

interface MetadataField {
  key: string;
  value: string;
  shouldHash: boolean;
}

interface PerkFormData {
  name: string;
  description: string;
  type: string;
  usdPrice: number;
  partnerShare: number;
  maxUsesPerClaim?: number;
  expirationDate?: string;
  generateUniqueMetadata: boolean;
  tags: string[];
  maxClaims?: number;
  customMetadata: MetadataField[];
}

export const PerkCreationForm: React.FC<PerkCreationFormProps> = ({
  partnerCap,
  currentSettings,
  onCreatePerk,
  onCancel,
  isCreating,
  hasPartnerStats = true,
  onSuccess,
  onClose,
  suiClient,
  currentAccount,
  PACKAGE_ID,
  CONFIG_ID,
  CLOCK_ID
}) => {
  // Form state
  const [formData, setFormData] = useState<PerkFormData>({
    name: '',
    description: '',
    type: 'Digital Product',
    usdPrice: 1,
    partnerShare: 70,
    generateUniqueMetadata: false,
    tags: [],
    customMetadata: []
  });

  const [tagInput, setTagInput] = useState('');
  
  // Metadata modal state
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [metadataField, setMetadataField] = useState<MetadataField>({
    key: '',
    value: '',
    shouldHash: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation for settings issues
    if (!currentSettings) {
      alert('Partner settings not loaded. Please try again.');
      return;
    }

    // Check perk control settings that might cause errors
    if (currentSettings.maxCostPerPerk === 0) {
      alert('Error: Your perk control settings have max cost set to 0. Please update your settings first to allow perk creation.');
      return;
    }

    if (currentSettings.maxPerksPerPartner === 0) {
      alert('Error: Your perk control settings have max perks limit set to 0. Please update your settings first to allow perk creation.');
      return;
    }

    if (currentSettings.maxPartnerSharePercentage === 0 && formData.partnerShare > 0) {
      alert('Error: Your perk control settings don\'t allow any partner revenue share. Please update your settings first.');
      return;
    }

    // Check if custom metadata requires partner salt
    if (formData.customMetadata.length > 0 && !currentSettings?.partnerSalt) {
      alert('Error: Custom metadata requires a partner salt to be generated. Please generate a partner salt in your settings first.');
      return;
    }

    // REMOVED: PartnerPerkStats requirement check
    // The Move package has been optimized to remove the stats object requirement

    try {
      // Process custom metadata if any exists and partner salt is available
      let processedFormData = { ...formData };
      
      if (formData.customMetadata.length > 0 && currentSettings?.partnerSalt) {
        const processedMetadata = processMetadataForSubmission(currentSettings.partnerSalt);
        processedFormData = {
          ...formData,
          processedMetadata // Add the hashed metadata to form data
        };
      }
      
      await onCreatePerk(processedFormData);
    } catch (error: any) {
      console.error('Error in form submission:', error);
      
      // Enhanced error handling for common Move errors
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      
      if (errorMessage.includes('122') || errorMessage.includes('E_MAX_PERKS_REACHED')) {
        alert('Cannot create perk: You have reached the maximum number of perks allowed. Please update your perk control settings to increase the limit.');
      } else if (errorMessage.includes('114') || errorMessage.includes('E_COST_EXCEEDS_LIMIT')) {
        alert('Cannot create perk: The perk cost exceeds your maximum allowed cost. Please update your perk control settings to allow higher costs.');
      } else if (errorMessage.includes('115') || errorMessage.includes('E_INVALID_REVENUE_SHARE')) {
        alert('Cannot create perk: The revenue share percentage is not allowed by your current settings. Please update your perk control settings.');
      } else {
        alert(`Failed to create perk: ${errorMessage}`);
      }
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Metadata management functions
  const addMetadataField = () => {
    if (!metadataField.key.trim() || !metadataField.value.trim()) {
      toast.error('Both key and value are required');
      return;
    }

    // Check for duplicate keys
    if (formData.customMetadata.some(field => field.key === metadataField.key.trim())) {
      toast.error('Metadata key already exists');
      return;
    }

    setFormData(prev => ({
      ...prev,
      customMetadata: [...prev.customMetadata, {
        key: metadataField.key.trim(),
        value: metadataField.value.trim(),
        shouldHash: metadataField.shouldHash
      }]
    }));

    // Reset modal state
    setMetadataField({ key: '', value: '', shouldHash: true });
    setShowMetadataModal(false);
    toast.success('Metadata field added');
  };

  const removeMetadataField = (keyToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      customMetadata: prev.customMetadata.filter(field => field.key !== keyToRemove)
    }));
    toast.success('Metadata field removed');
  };

  // Process metadata for submission (hash where needed)
  const processMetadataForSubmission = (partnerSalt: string) => {
    return formData.customMetadata.map(field => ({
      key: field.key,
      value: field.shouldHash ? hashMetadata(field.value, partnerSalt) : field.value,
      isHashed: field.shouldHash
    }));
  };

  const isFormValid = () => {
    return formData.name.trim() !== '' && 
           formData.description.trim() !== '' && 
           formData.usdPrice > 0 &&
           currentSettings?.maxCostPerPerk !== 0 &&
           currentSettings?.maxPerksPerPartner !== 0;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Create New Perk</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          {/* Settings Warning */}
          {(currentSettings?.maxCostPerPerk === 0 || currentSettings?.maxPerksPerPartner === 0) && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="text-red-400 text-xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-red-400 font-semibold mb-2">Setup Required</h3>
                  <p className="text-red-300 text-sm mb-3">
                    Before creating perks, you need to fix these issues:
                  </p>
                  <ul className="text-red-300 text-sm space-y-1 mb-3">
                    {currentSettings?.maxCostPerPerk === 0 && (
                      <li>• Update max cost per perk setting (currently 0)</li>
                    )}
                    {currentSettings?.maxPerksPerPartner === 0 && (
                      <li>• Update max perks per partner setting (currently 0)</li>
                    )}
                    {currentSettings?.maxPartnerSharePercentage === 0 && (
                      <li>• Update partner revenue share settings (currently 0%)</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Create New Perk</h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Perk Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Premium Discord Access"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Perk Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Digital Product">Digital Product</option>
                  <option value="Service">Service</option>
                  <option value="Access">Access</option>
                  <option value="Merchandise">Merchandise</option>
                  <option value="Subscription">Subscription</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what users get with this perk..."
                required
              />
              
              {/* Metadata Button - positioned between description and Create Perk button */}
              <div className="flex justify-between items-center mt-4">
                <div className="flex-1"></div>
                <button
                  type="button"
                  onClick={() => setShowMetadataModal(true)}
                  disabled={!currentSettings?.partnerSalt}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center space-x-2"
                  title={!currentSettings?.partnerSalt ? "Partner salt required - generate in settings" : "Add custom metadata fields"}
                >
                  <span>🏷️</span>
                  <span>Add Metadata</span>
                </button>
              </div>
              
              {/* Show metadata fields if any exist */}
              {formData.customMetadata.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-400">Custom Metadata:</p>
                  {formData.customMetadata.map((field, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-700/30 rounded text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-white">{field.key}:</span>
                        <span className="text-gray-400">
                          {field.shouldHash ? '••••••••••••••••' : field.value}
                        </span>
                        {field.shouldHash && (
                          <span className="px-1 py-0.5 bg-green-600/20 text-green-300 text-xs rounded">🔒</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMetadataField(field.key)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Price (USD) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.usdPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, usdPrice: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  ≈ {usdToAlphaPointsDisplay(formData.usdPrice)} Alpha Points
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Partner Revenue Share (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.partnerShare}
                  onChange={(e) => setFormData(prev => ({ ...prev, partnerShare: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  You get: {formatUSD((formData.usdPrice * formData.partnerShare) / 100)} per purchase
                </p>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="border-t border-gray-600 pt-6">
              <h4 className="text-md font-medium text-white mb-4">Advanced Options</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Uses Per Claim (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxUsesPerClaim || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      maxUsesPerClaim: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Unlimited"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Total Claims (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxClaims || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      maxClaims: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expirationDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, expirationDate: e.target.value || undefined }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.generateUniqueMetadata}
                    onChange={(e) => setFormData(prev => ({ ...prev, generateUniqueMetadata: e.target.checked }))}
                    className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">Generate unique metadata for each claim</span>
                </label>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a tag..."
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
              
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-blue-300 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>



            {/* Action Buttons */}
            <div className="flex space-x-4 pt-6 border-t border-gray-600">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !isFormValid()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isCreating ? 'Creating...' : 
                 currentSettings?.maxCostPerPerk === 0 ? 'Settings Required' :
                 currentSettings?.maxPerksPerPartner === 0 ? 'Settings Required' :
                 'Create Perk'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Metadata Input Modal */}
      {showMetadataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 rounded-lg max-w-md w-full border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Add Custom Metadata</h3>
                <button
                  onClick={() => {
                    setShowMetadataModal(false);
                    setMetadataField({ key: '', value: '', shouldHash: true });
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Key *
                </label>
                <input
                  type="text"
                  value={metadataField.key}
                  onChange={(e) => setMetadataField(prev => ({ ...prev, key: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., discord_id, email, custom_field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Value *
                </label>
                <input
                  type="text"
                  value={metadataField.value}
                  onChange={(e) => setMetadataField(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="The metadata value"
                />
              </div>
              
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={metadataField.shouldHash}
                    onChange={(e) => setMetadataField(prev => ({ ...prev, shouldHash: e.target.checked }))}
                    className="rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">Hash with partner salt (recommended for sensitive data)</span>
                </label>
                <p className="text-xs text-gray-400 mt-1 ml-6">
                  Hashing protects sensitive information while allowing verification
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-700 flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowMetadataModal(false);
                  setMetadataField({ key: '', value: '', shouldHash: true });
                }}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addMetadataField}
                disabled={!metadataField.key.trim() || !metadataField.value.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Add Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 