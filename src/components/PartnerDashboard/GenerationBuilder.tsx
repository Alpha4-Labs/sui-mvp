import React, { useState } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from 'react-toastify';
import { useCurrentWallet, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';

interface GenerationBuilderProps {
  partnerCap: PartnerCapInfo;
  onClose: () => void;
  onSuccess: (generation: any) => void;
}

interface GenerationFormData {
  name: string;
  description: string;
  category: string;
  executionType: 'embedded_code' | 'external_url' | 'hybrid';
  
  // Embedded Code Fields
  walrusBlobId: string;
  codeHash: string;
  templateType: string;
  
  // External URL Fields
  targetUrl: string;
  redirectType: 'iframe' | 'new_tab' | 'popup';
  returnCallbackUrl: string;
  requiresAuthentication: boolean;
  
  // Business Logic
  quotaCostPerExecution: number;
  maxExecutionsPerUser: number | null;
  maxTotalExecutions: number | null;
  expirationDate: string;
  
  // Metadata
  tags: string[];
  icon: string;
  estimatedCompletionMinutes: number | null;
}

const GENERATION_CATEGORIES = [
  'points_campaign',
  'nft_drop', 
  'survey',
  'social_share',
  'referral_program',
  'learn_to_earn',
  'fitness_challenge',
  'dao_participation',
  'proof_of_purchase',
  'geofenced_checkin'
];

const TEMPLATE_TYPES = [
  'daily_checkin',
  'quiz_completion',
  'social_engagement',
  'referral_bonus',
  'nft_mint',
  'survey_response',
  'fitness_tracking',
  'dao_voting',
  'purchase_verification',
  'location_checkin'
];

export const GenerationBuilder: React.FC<GenerationBuilderProps> = ({
  partnerCap,
  onClose,
  onSuccess
}) => {
  const { currentWallet } = useCurrentWallet();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [newTag, setNewTag] = useState('');

  const [formData, setFormData] = useState<GenerationFormData>({
    name: '',
    description: '',
    category: 'points_campaign',
    executionType: 'external_url',
    
    // Embedded Code Fields
    walrusBlobId: '',
    codeHash: '',
    templateType: 'daily_checkin',
    
    // External URL Fields
    targetUrl: '',
    redirectType: 'new_tab',
    returnCallbackUrl: '',
    requiresAuthentication: false,
    
    // Business Logic
    quotaCostPerExecution: 100,
    maxExecutionsPerUser: 1,
    maxTotalExecutions: null,
    expirationDate: '',
    
    // Metadata
    tags: [],
    icon: '',
    estimatedCompletionMinutes: 5,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Name is required';
      if (formData.name.length > 100) newErrors.name = 'Name must be 100 characters or less';
      if (!formData.description.trim()) newErrors.description = 'Description is required';
      if (formData.description.length > 500) newErrors.description = 'Description must be 500 characters or less';
      if (!formData.category) newErrors.category = 'Category is required';
    }

    if (step === 2) {
      if (!formData.executionType) newErrors.executionType = 'Execution type is required';
      
      if (formData.executionType === 'embedded_code') {
        if (!formData.walrusBlobId.trim()) newErrors.walrusBlobId = 'Walrus Blob ID is required';
        if (!formData.codeHash.trim()) newErrors.codeHash = 'Code hash is required';
        if (!formData.templateType) newErrors.templateType = 'Template type is required';
      }
      
      if (formData.executionType === 'external_url' || formData.executionType === 'hybrid') {
        if (!formData.targetUrl.trim()) newErrors.targetUrl = 'Target URL is required';
        if (!isValidUrl(formData.targetUrl)) newErrors.targetUrl = 'Please enter a valid URL';
        if (!formData.redirectType) newErrors.redirectType = 'Redirect type is required';
      }
    }

    if (step === 3) {
      if (formData.quotaCostPerExecution <= 0) newErrors.quotaCostPerExecution = 'Quota cost must be greater than 0';
      if (formData.maxExecutionsPerUser !== null && formData.maxExecutionsPerUser <= 0) {
        newErrors.maxExecutionsPerUser = 'Max executions per user must be greater than 0';
      }
      if (formData.maxTotalExecutions !== null && formData.maxTotalExecutions <= 0) {
        newErrors.maxTotalExecutions = 'Max total executions must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const handleInputChange = (field: keyof GenerationFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim()) && formData.tags.length < 10) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep) || !currentWallet) return;

    setIsLoading(true);
    try {
      const tx = new Transaction();

      // Convert form data for blockchain
      const expirationTimestamp = formData.expirationDate 
        ? new Date(formData.expirationDate).getTime()
        : null;

      if (formData.executionType === 'embedded_code') {
        // Create embedded generation
        tx.moveCall({
          target: `${process.env.REACT_APP_PACKAGE_ID}::generation_manager::create_embedded_generation`,
          arguments: [
            tx.object(partnerCap.id),
            tx.pure.string(formData.name),
            tx.pure.string(formData.description),
            tx.pure.string(formData.category),
            tx.pure.string(formData.walrusBlobId),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(formData.codeHash))),
            tx.pure.string(formData.templateType),
            tx.pure.u64(formData.quotaCostPerExecution),
            formData.maxExecutionsPerUser ? tx.pure.option('u64', formData.maxExecutionsPerUser) : tx.pure.option('u64', null),
            formData.maxTotalExecutions ? tx.pure.option('u64', formData.maxTotalExecutions) : tx.pure.option('u64', null),
            expirationTimestamp ? tx.pure.option('u64', expirationTimestamp) : tx.pure.option('u64', null),
            tx.pure.vector('string', formData.tags),
            formData.icon ? tx.pure.option('string', formData.icon) : tx.pure.option('string', null),
            formData.estimatedCompletionMinutes ? tx.pure.option('u64', formData.estimatedCompletionMinutes) : tx.pure.option('u64', null),
            tx.object(SUI_CLOCK_OBJECT_ID),
          ],
        });
      } else {
        // Create external generation
        tx.moveCall({
          target: `${process.env.REACT_APP_PACKAGE_ID}::generation_manager::create_external_generation`,
          arguments: [
            tx.object(partnerCap.id),
            tx.pure.string(formData.name),
            tx.pure.string(formData.description),
            tx.pure.string(formData.category),
            tx.pure.string(formData.targetUrl),
            tx.pure.string(formData.redirectType),
            formData.returnCallbackUrl ? tx.pure.option('string', formData.returnCallbackUrl) : tx.pure.option('string', null),
            tx.pure.bool(formData.requiresAuthentication),
            tx.pure.u64(formData.quotaCostPerExecution),
            formData.maxExecutionsPerUser ? tx.pure.option('u64', formData.maxExecutionsPerUser) : tx.pure.option('u64', null),
            formData.maxTotalExecutions ? tx.pure.option('u64', formData.maxTotalExecutions) : tx.pure.option('u64', null),
            expirationTimestamp ? tx.pure.option('u64', expirationTimestamp) : tx.pure.option('u64', null),
            tx.pure.vector('string', formData.tags),
            formData.icon ? tx.pure.option('string', formData.icon) : tx.pure.option('string', null),
            formData.estimatedCompletionMinutes ? tx.pure.option('u64', formData.estimatedCompletionMinutes) : tx.pure.option('u64', null),
            tx.object(SUI_CLOCK_OBJECT_ID),
          ],
        });
      }

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: () => {
            const newGeneration = {
              id: Date.now().toString(),
              name: formData.name,
              description: formData.description,
              category: formData.category,
              executionType: formData.executionType,
              targetUrl: formData.targetUrl,
              quotaCostPerExecution: formData.quotaCostPerExecution,
              maxTotalExecutions: formData.maxTotalExecutions,
              maxExecutionsPerUser: formData.maxExecutionsPerUser,
              estimatedCompletionMinutes: formData.estimatedCompletionMinutes,
              expirationTimestamp: expirationTimestamp,
              tags: formData.tags,
              isActive: false,
              approved: formData.executionType !== 'embedded_code',
              totalExecutionsCount: 0,
              createdTimestamp: Date.now(),
              safetyScore: formData.executionType === 'embedded_code' ? Math.floor(Math.random() * 40) + 60 : null
            };
            
            toast.success('Generation created successfully!');
            onSuccess(newGeneration);
            onClose();
          },
          onError: (error) => {
            console.error('Generation creation failed:', error);
            setErrors({ submit: 'Failed to create generation. Please try again.' });
          },
        }
      );
    } catch (error) {
      console.error('Generation creation error:', error);
      setErrors({ submit: 'Failed to create generation. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Basic Information</h3>
        <p className="text-gray-400">Define your generation opportunity</p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Generation Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Daily Check-in Rewards"
          maxLength={100}
        />
        {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Description *
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Describe what users will do and what they'll earn..."
          rows={4}
          maxLength={500}
        />
        <div className="text-right text-xs text-gray-400 mt-1">
          {formData.description.length}/500
        </div>
        {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Category *
        </label>
        <select
          value={formData.category}
          onChange={(e) => handleInputChange('category', e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {GENERATION_CATEGORIES.map(category => (
            <option key={category} value={category}>
              {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
        {errors.category && <p className="text-red-400 text-sm mt-1">{errors.category}</p>}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Execution Configuration</h3>
        <p className="text-gray-400">Choose how users will interact with your generation</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-4">
          Execution Type *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              formData.executionType === 'external_url'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => handleInputChange('executionType', 'external_url')}
          >
            <div className="flex items-center mb-2">
              <input
                type="radio"
                checked={formData.executionType === 'external_url'}
                readOnly
                className="mr-2"
              />
              <span className="font-medium text-white">External URL</span>
            </div>
            <p className="text-sm text-gray-400">
              Redirect users to your website or app. Simpler setup, immediate approval.
            </p>
          </div>

          <div
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              formData.executionType === 'embedded_code'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => handleInputChange('executionType', 'embedded_code')}
          >
            <div className="flex items-center mb-2">
              <input
                type="radio"
                checked={formData.executionType === 'embedded_code'}
                readOnly
                className="mr-2"
              />
              <span className="font-medium text-white">Embedded Code</span>
            </div>
            <p className="text-sm text-gray-400">
              Upload code to run directly in our platform. Requires safety approval.
            </p>
          </div>
        </div>
      </div>

      {formData.executionType === 'embedded_code' && (
        <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="font-medium text-white">Embedded Code Configuration</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Walrus Blob ID *
            </label>
            <input
              type="text"
              value={formData.walrusBlobId}
              onChange={(e) => handleInputChange('walrusBlobId', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Walrus storage blob ID"
            />
            {errors.walrusBlobId && <p className="text-red-400 text-sm mt-1">{errors.walrusBlobId}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Code Hash *
            </label>
            <input
              type="text"
              value={formData.codeHash}
              onChange={(e) => handleInputChange('codeHash', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="SHA-256 hash of your code"
            />
            {errors.codeHash && <p className="text-red-400 text-sm mt-1">{errors.codeHash}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Template Type *
            </label>
            <select
              value={formData.templateType}
              onChange={(e) => handleInputChange('templateType', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TEMPLATE_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
            {errors.templateType && <p className="text-red-400 text-sm mt-1">{errors.templateType}</p>}
          </div>
        </div>
      )}

      {(formData.executionType === 'external_url' || formData.executionType === 'hybrid') && (
        <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="font-medium text-white">External URL Configuration</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target URL *
            </label>
            <input
              type="url"
              value={formData.targetUrl}
              onChange={(e) => handleInputChange('targetUrl', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://your-website.com/generation"
            />
            {errors.targetUrl && <p className="text-red-400 text-sm mt-1">{errors.targetUrl}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Redirect Type *
            </label>
            <select
              value={formData.redirectType}
              onChange={(e) => handleInputChange('redirectType', e.target.value as 'iframe' | 'new_tab' | 'popup')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="new_tab">New Tab</option>
              <option value="iframe">Embedded iFrame</option>
              <option value="popup">Popup Window</option>
            </select>
            {errors.redirectType && <p className="text-red-400 text-sm mt-1">{errors.redirectType}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Return Callback URL (Optional)
            </label>
            <input
              type="url"
              value={formData.returnCallbackUrl}
              onChange={(e) => handleInputChange('returnCallbackUrl', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://your-website.com/callback"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="requiresAuth"
              checked={formData.requiresAuthentication}
              onChange={(e) => handleInputChange('requiresAuthentication', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="requiresAuth" className="text-sm text-gray-300">
              Requires user authentication
            </label>
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Business Logic & Limits</h3>
        <p className="text-gray-400">Configure quotas, limits, and rewards</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Quota Cost Per Execution *
        </label>
        <input
          type="number"
          value={formData.quotaCostPerExecution}
          onChange={(e) => handleInputChange('quotaCostPerExecution', parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="100"
          min="1"
        />
        <p className="text-xs text-gray-400 mt-1">
          Alpha Points deducted from your quota per user interaction
        </p>
        {errors.quotaCostPerExecution && <p className="text-red-400 text-sm mt-1">{errors.quotaCostPerExecution}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Max Executions Per User
          </label>
          <input
            type="number"
            value={formData.maxExecutionsPerUser || ''}
            onChange={(e) => handleInputChange('maxExecutionsPerUser', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="1 (leave empty for unlimited)"
            min="1"
          />
          {errors.maxExecutionsPerUser && <p className="text-red-400 text-sm mt-1">{errors.maxExecutionsPerUser}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Max Total Executions
          </label>
          <input
            type="number"
            value={formData.maxTotalExecutions || ''}
            onChange={(e) => handleInputChange('maxTotalExecutions', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Leave empty for unlimited"
            min="1"
          />
          {errors.maxTotalExecutions && <p className="text-red-400 text-sm mt-1">{errors.maxTotalExecutions}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Expiration Date (Optional)
        </label>
        <input
          type="datetime-local"
          value={formData.expirationDate}
          onChange={(e) => handleInputChange('expirationDate', e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Estimated Completion Time (Minutes)
        </label>
        <input
          type="number"
          value={formData.estimatedCompletionMinutes || ''}
          onChange={(e) => handleInputChange('estimatedCompletionMinutes', e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="5"
          min="1"
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Metadata & Finalization</h3>
        <p className="text-gray-400">Add tags and visual elements</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map((tag, index) => (
            <span
              key={index}
              className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-sm flex items-center"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 text-blue-300 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add a tag..."
            maxLength={20}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!newTag.trim() || formData.tags.includes(newTag.trim()) || formData.tags.length >= 10}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {formData.tags.length}/10 tags
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Icon URL (Optional)
        </label>
        <input
          type="url"
          value={formData.icon}
          onChange={(e) => handleInputChange('icon', e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://example.com/icon.png"
        />
      </div>

      {/* Summary */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="font-medium text-white mb-3">Generation Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Name:</span>
            <span className="text-white">{formData.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white">
              {formData.executionType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Category:</span>
            <span className="text-white">
              {formData.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Quota Cost:</span>
            <span className="text-white">{formData.quotaCostPerExecution} AP</span>
          </div>
          {formData.maxExecutionsPerUser && (
            <div className="flex justify-between">
              <span className="text-gray-400">Max per User:</span>
              <span className="text-white">{formData.maxExecutionsPerUser}</span>
            </div>
          )}
        </div>
      </div>

      {errors.submit && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
          <p className="text-red-400 text-sm">{errors.submit}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Create Generation</h2>
            <p className="text-gray-400 text-sm">Step {currentStep} of 4</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-800/50">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step}
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex gap-3">
            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                )}
                Create Generation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 