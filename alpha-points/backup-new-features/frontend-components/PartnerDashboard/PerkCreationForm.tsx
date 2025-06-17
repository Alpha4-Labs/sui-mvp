import React, { useState } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { PartnerSettings } from '../../hooks/usePartnerSettings';
import { formatUSD, usdToAlphaPointsDisplay } from '../../utils/conversionUtils';

interface PerkCreationFormProps {
  partnerCap: PartnerCapInfo;
  currentSettings: PartnerSettings | null;
  onCreatePerk: (perkData: any) => Promise<void>;
  onCancel: () => void;
  isCreating: boolean;
}

export const PerkCreationForm: React.FC<PerkCreationFormProps> = ({
  partnerCap,
  currentSettings,
  onCreatePerk,
  onCancel,
  isCreating
}) => {
  // Form state
  const [newPerkName, setNewPerkName] = useState('');
  const [newPerkDescription, setNewPerkDescription] = useState('');
  const [newPerkTags, setNewPerkTags] = useState<string[]>([]);
  const [newPerkUsdcPrice, setNewPerkUsdcPrice] = useState('');
  const [newPerkType, setNewPerkType] = useState('Access');
  const [newPerkReinvestmentPercent, setNewPerkReinvestmentPercent] = useState(20);
  const [newPerkIcon, setNewPerkIcon] = useState('🎁');
  
  // Expiry functionality
  const [newPerkExpiryType, setNewPerkExpiryType] = useState<'none' | 'days' | 'date'>('none');
  const [newPerkExpiryDays, setNewPerkExpiryDays] = useState('30');
  const [newPerkExpiryDate, setNewPerkExpiryDate] = useState('');
  
  // Consumable functionality
  const [newPerkIsConsumable, setNewPerkIsConsumable] = useState(false);
  const [newPerkCharges, setNewPerkCharges] = useState('1');

  // Tag management
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const addTag = (tag: string) => {
    if (tag.trim() && !newPerkTags.includes(tag.trim())) {
      setNewPerkTags([...newPerkTags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewPerkTags(newPerkTags.filter(tag => tag !== tagToRemove));
  };

  const handleCustomTag = () => {
    if (tagInput.trim()) {
      addTag(tagInput.trim());
      setTagInput('');
      setShowTagDropdown(false);
    }
  };

  const calculatePartnerShare = (reinvestmentPercent: number): number => {
    return 100 - reinvestmentPercent;
  };

  const calculateExpiryTimestamp = (): number | undefined => {
    if (newPerkExpiryType === 'days') {
      const days = parseInt(newPerkExpiryDays);
      if (days > 0) {
        return Date.now() + (days * 24 * 60 * 60 * 1000);
      }
    } else if (newPerkExpiryType === 'date' && newPerkExpiryDate) {
      return new Date(newPerkExpiryDate).getTime();
    }
    return undefined;
  };

  const getMaxUsesPerClaim = (): number | undefined => {
    if (newPerkIsConsumable) {
      const charges = parseInt(newPerkCharges);
      return charges > 0 ? charges : 1;
    }
    return undefined;
  };

  const handleSubmit = async () => {
    const perkData = {
      name: newPerkName,
      description: newPerkDescription,
      tags: newPerkTags,
      usdcPrice: parseFloat(newPerkUsdcPrice),
      type: newPerkType,
      reinvestmentPercent: newPerkReinvestmentPercent,
      icon: newPerkIcon,
      expiryTimestamp: calculateExpiryTimestamp(),
      maxUsesPerClaim: getMaxUsesPerClaim()
    };

    await onCreatePerk(perkData);
  };

  // Validation functions
  const renderPriceValidation = () => {
    const price = parseFloat(newPerkUsdcPrice);
    if (!newPerkUsdcPrice || isNaN(price)) return null;

    const maxCost = currentSettings?.maxCostPerPerk || 0;
    const isValid = price <= maxCost;

    return (
      <div className={`text-xs mt-1 ${isValid ? 'text-green-400' : 'text-red-400'}`}>
        {isValid ? '✓' : '✗'} Price: {formatUSD(price)} 
        {!isValid && ` (max: ${formatUSD(maxCost)})`}
      </div>
    );
  };

  const renderSplitValidation = () => {
    const partnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
    return (
      <div className="text-xs text-gray-400 mt-1">
        Split: {newPerkReinvestmentPercent}% reinvestment, {partnerShare}% to partner
      </div>
    );
  };

  const renderTagsValidation = () => {
    const maxTags = 5;
    const isValid = newPerkTags.length <= maxTags;

    return (
      <div className={`text-xs mt-1 ${isValid ? 'text-gray-400' : 'text-red-400'}`}>
        {newPerkTags.length}/{maxTags} tags {!isValid && '(too many)'}
      </div>
    );
  };

  const renderTypeValidation = () => {
    const allowedTypes = currentSettings?.allowedPerkTypes || [];
    const isValid = allowedTypes.includes(newPerkType);

    return (
      <div className={`text-xs mt-1 ${isValid ? 'text-green-400' : 'text-red-400'}`}>
        {isValid ? '✓' : '✗'} Type: {newPerkType}
        {!isValid && ' (not allowed in settings)'}
      </div>
    );
  };

  const renderReadinessValidation = () => {
    const price = parseFloat(newPerkUsdcPrice);
    const maxCost = currentSettings?.maxCostPerPerk || 0;
    const allowedTypes = currentSettings?.allowedPerkTypes || [];

    const checks = [
      { name: 'Name', valid: newPerkName.trim().length > 0 },
      { name: 'Description', valid: newPerkDescription.trim().length > 0 },
      { name: 'Price', valid: !isNaN(price) && price > 0 && price <= maxCost },
      { name: 'Type', valid: allowedTypes.includes(newPerkType) },
      { name: 'Tags', valid: newPerkTags.length <= 5 }
    ];

    if (newPerkExpiryType !== 'none') {
      if (!currentSettings?.allowExpiringPerks) {
        checks.push({ name: 'Expiry', valid: false });
      } else if (newPerkExpiryType === 'days') {
        checks.push({ name: 'Expiry', valid: parseInt(newPerkExpiryDays) > 0 });
      } else if (newPerkExpiryType === 'date') {
        checks.push({ name: 'Expiry', valid: !!newPerkExpiryDate });
      }
    }

    if (newPerkIsConsumable) {
      if (!currentSettings?.allowConsumablePerks) {
        checks.push({ name: 'Consumable', valid: false });
      } else {
        checks.push({ name: 'Consumable', valid: parseInt(newPerkCharges) > 0 });
      }
    }

    const passedChecks = checks.filter(check => check.valid).length;
    const totalChecks = checks.length;
    const allPassed = passedChecks === totalChecks;

    return (
      <div className={`border rounded-lg p-3 ${allPassed ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">
            {allPassed ? '✅ Ready to Create' : '❌ Issues Found'}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${allPassed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {passedChecks}/{totalChecks}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {checks.map((check, index) => (
            <span key={index} className={check.valid ? 'text-green-300' : 'text-red-300'}>
              {check.valid ? '✓' : '✗'} {check.name}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-white">Basic Information</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Perk Name *
            </label>
            <input
              type="text"
              value={newPerkName}
              onChange={(e) => setNewPerkName(e.target.value)}
              placeholder="Enter perk name"
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              value={newPerkDescription}
              onChange={(e) => setNewPerkDescription(e.target.value)}
              placeholder="Describe what this perk offers"
              rows={3}
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white resize-none"
              disabled={isCreating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Icon
            </label>
            <input
              type="text"
              value={newPerkIcon}
              onChange={(e) => setNewPerkIcon(e.target.value)}
              placeholder="🎁"
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isCreating}
            />
          </div>
        </div>

        {/* Pricing & Configuration */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-white">Pricing & Configuration</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Price (USD) *
            </label>
            <input
              type="number"
              value={newPerkUsdcPrice}
              onChange={(e) => setNewPerkUsdcPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isCreating}
            />
            {renderPriceValidation()}
            {newPerkUsdcPrice && (
              <div className="text-xs text-blue-400 mt-1">
                ≈ {usdToAlphaPointsDisplay(parseFloat(newPerkUsdcPrice))} Alpha Points
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Perk Type *
            </label>
            <select
              value={newPerkType}
              onChange={(e) => setNewPerkType(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isCreating}
            >
              {['Access', 'Discount', 'Experience', 'Content', 'Service'].map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {renderTypeValidation()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reinvestment Percentage: {newPerkReinvestmentPercent}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={newPerkReinvestmentPercent}
              onChange={(e) => setNewPerkReinvestmentPercent(parseInt(e.target.value))}
              className="w-full"
              disabled={isCreating}
            />
            {renderSplitValidation()}
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="mt-6 space-y-4">
        <h4 className="text-lg font-medium text-white">Advanced Options</h4>
        
        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {newPerkTags.map((tag, index) => (
              <span
                key={index}
                className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-sm flex items-center space-x-1"
              >
                <span>{tag}</span>
                <button
                  onClick={() => removeTag(tag)}
                  className="text-blue-300 hover:text-blue-100"
                  disabled={isCreating}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag"
              className="flex-1 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isCreating}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomTag()}
            />
            <button
              onClick={handleCustomTag}
              disabled={isCreating || !tagInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded transition-colors"
            >
              Add
            </button>
          </div>
          {renderTagsValidation()}
        </div>

        {/* Expiry Options */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Expiry Settings
          </label>
          <select
            value={newPerkExpiryType}
            onChange={(e) => setNewPerkExpiryType(e.target.value as 'none' | 'days' | 'date')}
            disabled={isCreating || !currentSettings?.allowExpiringPerks}
            className="w-full h-10 bg-gray-900/50 border border-gray-600 rounded px-3 text-white cursor-pointer hover:border-gray-500 disabled:opacity-50"
            title={!currentSettings?.allowExpiringPerks ? "Enable expiring perks in settings first" : "Set when this perk expires"}
          >
            <option value="none">No Expiry</option>
            <option value="days">Expires in X days</option>
            <option value="date">Expires on specific date</option>
          </select>

          {newPerkExpiryType === 'days' && (
            <input
              type="number"
              value={newPerkExpiryDays}
              onChange={(e) => setNewPerkExpiryDays(e.target.value)}
              placeholder="30"
              min="1"
              className="w-full mt-2 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isCreating}
            />
          )}

          {newPerkExpiryType === 'date' && (
            <input
              type="datetime-local"
              value={newPerkExpiryDate}
              onChange={(e) => setNewPerkExpiryDate(e.target.value)}
              className="w-full mt-2 bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isCreating}
            />
          )}
        </div>

        {/* Consumable Options */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="consumable-toggle-main"
            checked={newPerkIsConsumable}
            onChange={(e) => setNewPerkIsConsumable(e.target.checked)}
            disabled={isCreating || !currentSettings?.allowConsumablePerks}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label 
            htmlFor="consumable-toggle-main" 
            className={`text-sm ${!currentSettings?.allowConsumablePerks ? 'text-gray-500' : 'text-white cursor-pointer'}`}
            title={!currentSettings?.allowConsumablePerks ? "Enable consumable perks in settings first" : "Make this perk consumable with limited uses"}
          >
            Consumable
          </label>
          {newPerkIsConsumable && (
            <input
              type="number"
              value={newPerkCharges}
              onChange={(e) => setNewPerkCharges(e.target.value)}
              placeholder="1"
              min="1"
              className="w-20 bg-gray-900/50 border border-gray-600 rounded px-2 py-1 text-white text-sm"
              disabled={isCreating}
              title="Number of times this perk can be used"
            />
          )}
        </div>
      </div>

      {/* Validation Summary */}
      <div className="mt-6">
        {renderReadinessValidation()}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-4 mt-6">
        <button
          onClick={onCancel}
          disabled={isCreating}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isCreating || !newPerkName.trim() || !newPerkDescription.trim() || !newPerkUsdcPrice}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create Perk'}
        </button>
      </div>
    </div>
  );
}; 