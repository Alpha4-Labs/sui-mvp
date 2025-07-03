import React, { useState, useEffect } from 'react';
import { 
  validateMetadataValue, 
  getMetadataLabel, 
  getMetadataPlaceholder,
  shouldHashMetadata,
  hashMetadata
} from '../utils/privacy';

interface MetadataField {
  key: string;
  type: string;
  required: boolean;
  description?: string;
}

interface MetadataCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (metadata: Record<string, string>) => Promise<void>;
  fields: MetadataField[];
  perkName: string;
  perkCost: string;
  isLoading: boolean;
  partnerSalt?: string;
  title?: string;
  description?: string;
}

export const MetadataCollectionModal: React.FC<MetadataCollectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  fields,
  perkName,
  perkCost,
  isLoading,
  partnerSalt,
  title = "Complete Perk Purchase",
  description = "Please provide the required information to complete your perk purchase."
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({});
      setErrors({});
    }
  }, [isOpen]);

  const handleInputChange = (fieldKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
    
    // Clear error when user starts typing
    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      const value = formData[field.key]?.trim() || '';
      
      if (field.required && !value) {
        newErrors[field.key] = `${getMetadataLabel(field.type)} is required`;
        return;
      }
      
      if (value) {
        const validation = validateMetadataValue(value, field.type);
        if (!validation.isValid && validation.error) {
          newErrors[field.key] = validation.error;
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    // Process metadata with hashing if needed
    const processedMetadata: Record<string, string> = {};
    
    fields.forEach(field => {
      const value = formData[field.key]?.trim();
      if (value) {
        if (shouldHashMetadata(field.type) && partnerSalt) {
          // Hash sensitive data using partner's salt
          const hashedValue = hashMetadata(value, partnerSalt);
          processedMetadata[`${field.key}_hash`] = hashedValue;
          console.log(`🔐 Privacy: ${field.type} hashed for partner`);
        } else {
          // Store as-is for non-sensitive data
          processedMetadata[field.key] = value;
        }
      }
    });
    
    await onSubmit(processedMetadata);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-background-card rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700 disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-300 mb-1">
            {description}
          </p>
          <p className="text-gray-300 mb-1">
            Perk: <strong className="text-white">{perkName}</strong>
          </p>
          <p className="text-gray-300 mb-4">
            Cost: <strong className="text-secondary">{perkCost}</strong>
          </p>
        </div>
        
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-sm font-medium text-gray-300 mb-1">
                {getMetadataLabel(field.type)}
                {field.required && <span className="text-red-400 ml-1">*</span>}
                {field.description && (
                  <span className="text-xs text-gray-500 block mt-0.5">
                    {field.description}
                  </span>
                )}
              </label>
              <input
                type={field.type === 'email' ? 'email' : 'text'}
                id={field.key}
                value={formData[field.key] || ''}
                onChange={(e) => handleInputChange(field.key, e.target.value)}
                placeholder={getMetadataPlaceholder(field.type)}
                className="w-full bg-background rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
                disabled={isLoading}
              />
              {errors[field.key] && (
                <p className="text-red-400 text-xs mt-1">{errors[field.key]}</p>
              )}
              {shouldHashMetadata(field.type) && partnerSalt && (
                <p className="text-xs text-gray-500 mt-1">
                  🔐 This information will be hashed for privacy protection
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || fields.some(f => f.required && !formData[f.key]?.trim())}
            className="px-4 py-2 text-sm rounded-md text-white bg-primary hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative min-w-[120px]"
          >
            {isLoading ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            ) : (
              'Complete Purchase'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}; 