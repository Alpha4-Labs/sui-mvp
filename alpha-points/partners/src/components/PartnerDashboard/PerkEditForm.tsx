import React, { useState, useEffect } from 'react';
import { PerkDefinition } from '../../hooks/usePerkData';
import { PartnerSettings } from '../../hooks/usePartnerSettings';
import { formatUSD, usdToAlphaPointsDisplay } from '../../utils/conversionUtils';

interface PerkEditFormProps {
  perk: PerkDefinition;
  currentSettings: PartnerSettings | null;
  onUpdatePerk: (perkData: any) => Promise<void>;
  onCancel: () => void;
  isUpdating: boolean;
}

export const PerkEditForm: React.FC<PerkEditFormProps> = ({
  perk,
  currentSettings,
  onUpdatePerk,
  onCancel,
  isUpdating
}) => {
  // Form state initialized with perk data
  const [editPerkName, setEditPerkName] = useState(perk.name);
  const [editPerkDescription, setEditPerkDescription] = useState(perk.description);
  const [editPerkTags, setEditPerkTags] = useState<string[]>(perk.tags || []);
  const [editPerkUsdcPrice, setEditPerkUsdcPrice] = useState(perk.usdcPrice.toString());
  const [editPerkType, setEditPerkType] = useState(perk.type);
  const [editPerkReinvestmentPercent, setEditPerkReinvestmentPercent] = useState(perk.reinvestmentPercent || 20);
  const [editPerkIcon, setEditPerkIcon] = useState(perk.icon);

  // Tag management
  const [tagInput, setTagInput] = useState('');

  const addTag = (tag: string) => {
    if (tag.trim() && !editPerkTags.includes(tag.trim())) {
      setEditPerkTags([...editPerkTags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditPerkTags(editPerkTags.filter(tag => tag !== tagToRemove));
  };

  const handleCustomTag = () => {
    if (tagInput.trim()) {
      addTag(tagInput.trim());
      setTagInput('');
    }
  };

  const calculatePartnerShare = (reinvestmentPercent: number): number => {
    return 100 - reinvestmentPercent;
  };

  const handleSubmit = async () => {
    const perkData = {
      id: perk.id,
      name: editPerkName,
      description: editPerkDescription,
      tags: editPerkTags,
      usdcPrice: parseFloat(editPerkUsdcPrice),
      type: editPerkType,
      reinvestmentPercent: editPerkReinvestmentPercent,
      icon: editPerkIcon
    };

    await onUpdatePerk(perkData);
  };

  // Validation functions
  const renderPriceValidation = () => {
    const price = parseFloat(editPerkUsdcPrice);
    if (!editPerkUsdcPrice || isNaN(price)) return null;

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
    const partnerShare = calculatePartnerShare(editPerkReinvestmentPercent);
    return (
      <div className="text-xs text-gray-400 mt-1">
        Split: {editPerkReinvestmentPercent}% reinvestment, {partnerShare}% to partner
      </div>
    );
  };

  const renderTagsValidation = () => {
    const maxTags = 5;
    const isValid = editPerkTags.length <= maxTags;

    return (
      <div className={`text-xs mt-1 ${isValid ? 'text-gray-400' : 'text-red-400'}`}>
        {editPerkTags.length}/{maxTags} tags {!isValid && '(too many)'}
      </div>
    );
  };

  const renderTypeValidation = () => {
    const allowedTypes = currentSettings?.allowedPerkTypes || [];
    const isValid = allowedTypes.includes(editPerkType);

    return (
      <div className={`text-xs mt-1 ${isValid ? 'text-green-400' : 'text-red-400'}`}>
        {isValid ? '✓' : '✗'} Type: {editPerkType}
        {!isValid && ' (not allowed in settings)'}
      </div>
    );
  };

  const renderReadinessValidation = () => {
    const price = parseFloat(editPerkUsdcPrice);
    const maxCost = currentSettings?.maxCostPerPerk || 0;
    const allowedTypes = currentSettings?.allowedPerkTypes || [];

    const checks = [
      { name: 'Name', valid: editPerkName.trim().length > 0 },
      { name: 'Description', valid: editPerkDescription.trim().length > 0 },
      { name: 'Price', valid: !isNaN(price) && price > 0 && price <= maxCost },
      { name: 'Type', valid: allowedTypes.includes(editPerkType) },
      { name: 'Tags', valid: editPerkTags.length <= 5 }
    ];

    const passedChecks = checks.filter(check => check.valid).length;
    const totalChecks = checks.length;
    const allPassed = passedChecks === totalChecks;

    return (
      <div className={`border rounded-lg p-3 ${allPassed ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">
            {allPassed ? '✅ Ready to Update' : '❌ Issues Found'}
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
        <h3 className="text-xl font-semibold text-white">Edit Perk</h3>
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
              value={editPerkName}
              onChange={(e) => setEditPerkName(e.target.value)}
              placeholder="Enter perk name"
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              value={editPerkDescription}
              onChange={(e) => setEditPerkDescription(e.target.value)}
              placeholder="Describe what this perk offers"
              rows={3}
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white resize-none"
              disabled={isUpdating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Icon
            </label>
            <input
              type="text"
              value={editPerkIcon}
              onChange={(e) => setEditPerkIcon(e.target.value)}
              placeholder="🎁"
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isUpdating}
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
              value={editPerkUsdcPrice}
              onChange={(e) => setEditPerkUsdcPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isUpdating}
            />
            {renderPriceValidation()}
            {editPerkUsdcPrice && (
              <div className="text-xs text-blue-400 mt-1">
                ≈ {usdToAlphaPointsDisplay(parseFloat(editPerkUsdcPrice))} Alpha Points
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Perk Type *
            </label>
            <select
              value={editPerkType}
              onChange={(e) => setEditPerkType(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={isUpdating}
            >
              {['Access', 'Discount', 'Experience', 'Content', 'Service'].map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {renderTypeValidation()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reinvestment Percentage: {editPerkReinvestmentPercent}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={editPerkReinvestmentPercent}
              onChange={(e) => setEditPerkReinvestmentPercent(parseInt(e.target.value))}
              className="w-full"
              disabled={isUpdating}
            />
            {renderSplitValidation()}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-6">
        <h4 className="text-lg font-medium text-white mb-4">Tags</h4>
        
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            {editPerkTags.map((tag, index) => (
              <span
                key={index}
                className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-sm flex items-center space-x-1"
              >
                <span>{tag}</span>
                <button
                  onClick={() => removeTag(tag)}
                  className="text-blue-300 hover:text-blue-100"
                  disabled={isUpdating}
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
              disabled={isUpdating}
              onKeyPress={(e) => e.key === 'Enter' && handleCustomTag()}
            />
            <button
              onClick={handleCustomTag}
              disabled={isUpdating || !tagInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded transition-colors"
            >
              Add
            </button>
          </div>
          {renderTagsValidation()}
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
          disabled={isUpdating}
          className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isUpdating || !editPerkName.trim() || !editPerkDescription.trim() || !editPerkUsdcPrice}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
        >
          {isUpdating ? 'Updating...' : 'Update Perk'}
        </button>
      </div>
    </div>
  );
}; 