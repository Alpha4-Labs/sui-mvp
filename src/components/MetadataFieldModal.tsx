import React, { useState, useEffect } from 'react';
import { getMetadataLabel, shouldHashMetadata } from '../utils/privacy';
import type { MetadataField } from '../hooks/usePartnerSettings';

interface MetadataFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (field: MetadataField) => void;
  editingField?: MetadataField | null;
  existingKeys: string[];
}

const METADATA_TYPES = [
  'discord_id',
  'email', 
  'username',
  'twitter_handle',
  'telegram_username',
  'wallet_address',
  'phone_number',
  'custom'
];

export const MetadataFieldModal: React.FC<MetadataFieldModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingField,
  existingKeys
}) => {
  const [formData, setFormData] = useState<MetadataField>({
    key: '',
    type: 'username',
    required: true,
    description: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (editingField) {
        setFormData(editingField);
      } else {
        setFormData({
          key: '',
          type: 'username',
          required: true,
          description: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, editingField]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.key.trim()) {
      newErrors.key = 'Field key is required';
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.key)) {
      newErrors.key = 'Key must start with letter/underscore and contain only letters, numbers, underscores';
    } else if (existingKeys.includes(formData.key) && (!editingField || editingField.key !== formData.key)) {
      newErrors.key = 'This key already exists';
    }
    
    if (!formData.type) {
      newErrors.type = 'Field type is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    
    onSubmit(formData);
    onClose();
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      type,
      // Auto-generate key if it's empty or matches the previous type
      key: !prev.key || prev.key === prev.type ? type : prev.key
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-background-card rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            {editingField ? 'Edit Metadata Field' : 'Add Metadata Field'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-300 mb-1">
              Field Type <span className="text-red-400">*</span>
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full bg-background rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
            >
              {METADATA_TYPES.map(type => (
                <option key={type} value={type}>
                  {getMetadataLabel(type)}
                </option>
              ))}
            </select>
            {shouldHashMetadata(formData.type) && (
              <p className="text-xs text-blue-400 mt-1">
                🔐 This field type will be automatically hashed for privacy
              </p>
            )}
          </div>

          <div>
            <label htmlFor="key" className="block text-sm font-medium text-gray-300 mb-1">
              Field Key <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="key"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              placeholder="e.g., discord_id, email, username"
              className="w-full bg-background rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
            />
            {errors.key && (
              <p className="text-red-400 text-xs mt-1">{errors.key}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Used as the metadata key on-chain. Must be unique.
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Help text shown to users"
              className="w-full bg-background rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional help text displayed to users when collecting this field.
            </p>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.required}
                onChange={(e) => setFormData(prev => ({ ...prev, required: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm text-gray-300">Required field</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Users must provide this information to claim perks.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded-md text-white bg-primary hover:bg-primary-dark transition-colors"
          >
            {editingField ? 'Update Field' : 'Add Field'}
          </button>
        </div>
      </div>
    </div>
  );
}; 