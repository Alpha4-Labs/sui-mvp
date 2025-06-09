import React, { useState, useEffect } from 'react';
import { validateDiscordId } from '../utils/privacy';

interface DiscordHandleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (discordHandle: string) => Promise<void>; // onSubmit now only takes discordHandle
  perkName: string;
  perkCost: string;
  isLoading: boolean;
  // New props for displaying the unique code
  purchaseSuccess?: boolean; 
  uniqueCode?: string;
}

export const DiscordHandleModal: React.FC<DiscordHandleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  perkName,
  perkCost,
  isLoading,
  purchaseSuccess,
  uniqueCode,
}) => {
  const [discordId, setDiscordId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setDiscordId('');
      setError('');
      // If opening directly into success state (e.g. if purchase happened outside modal flow initially)
      // this modal is primarily for collecting Discord ID OR showing code, so reset if not success.
      if (!purchaseSuccess) {
        // Potentially clear uniqueCode as well if it shouldn't persist across openings unless it's a success display
      }
    }
  }, [isOpen, purchaseSuccess]);

  const handleSubmit = async () => {
    if (!discordId.trim()) {
      setError('Please enter your Discord User ID (numeric ID).');
      return;
    }
    
    // Validate Discord ID format using the shared validation function
    if (!validateDiscordId(discordId.trim())) {
      setError('Discord User ID should be 17-19 digits long (e.g., 123456789012345678).');
      return;
    }
    
    setError('');
    // onSubmit doesn't need the code directly anymore, 
    // as the code generation and handling will be in the calling component (MarketplacePage)
    await onSubmit(discordId); 
    // Parent will handle closing or moving to success state inside the modal
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-background-card rounded-lg shadow-xl p-6 w-full max-w-md">
        {!purchaseSuccess ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Confirm Perk Purchase</h2>
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
            <p className="text-gray-300 mb-1">You are about to get the <strong className="text-white">{perkName}</strong> perk.</p>
            <p className="text-gray-300 mb-4">Cost: <strong className="text-secondary">{perkCost}</strong></p>
            
            <div className="mb-4">
              <label htmlFor="discordId" className="block text-sm font-medium text-gray-300 mb-1">
                Enter your Discord User ID <span className="text-xs text-gray-500">(for role assignment)</span>
              </label>
              <input
                type="text"
                id="discordId"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="123456789012345678"
                className="w-full bg-background rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                To find your Discord User ID, enable Developer Mode in Discord settings, right-click your name, and select "Copy User ID"
              </p>
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !discordId.trim()}
                className="px-4 py-2 text-sm rounded-md text-white bg-primary hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative min-w-[80px]"
              >
                {isLoading ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                ) : (
                  'Confirm & Get Role'
                )}
              </button>
            </div>
          </>
        ) : (
          // Success state: Display the unique code
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-green-400">Purchase Successful!</h2>
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
            <p className="text-gray-300 mb-2">
              You have successfully acquired the <strong className="text-white">{perkName}</strong> perk.
            </p>
            <p className="text-gray-300 mb-3">
              To claim your Discord role, please use the following unique code with our Discord bot:
            </p>
            <div className="bg-background p-3 rounded-md mb-4 text-center">
              <strong className="text-secondary text-lg font-mono break-all">{uniqueCode || 'Generating code...'}</strong>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Note: Your Discord User ID has been stored with your perk purchase. Your Discord bot can now query this information to assign your role.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm rounded-md text-white bg-primary hover:bg-primary-dark transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}; 