import React, { useState, useEffect } from 'react';

interface DiscordHandleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (discordHandle: string) => Promise<void>; // Make onSubmit async
  perkName: string;
  perkCost: string;
  isLoading: boolean; // To disable form while parent is processing
}

export const DiscordHandleModal: React.FC<DiscordHandleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  perkName,
  perkCost,
  isLoading,
}) => {
  const [discordHandle, setDiscordHandle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset form when modal opens/closes or when parent loading state changes
    if (isOpen) {
      setDiscordHandle('');
      setError(null);
    } else {
      // Clear errors when modal is not open, or if parent stops loading (e.g. after success/fail)
      if (!isLoading) {
        setError(null);
      }
    }
  }, [isOpen, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discordHandle.trim()) {
      setError('Discord handle cannot be empty.');
      return;
    }
    // Basic regex for Discord handle (e.g., username#1234 or new username format)
    // This is a basic check and might need refinement for all valid Discord handles.
    if (!/^.{2,32}#\d{4}$|^[a-z0-9_.]{2,32}$/.test(discordHandle.trim())) {
      setError('Invalid Discord handle format. Use username#1234 or new username format.');
      return;
    }
    setError(null);
    try {
      await onSubmit(discordHandle.trim());
      // Parent component will handle closing the modal on successful submission after its own async ops
    } catch (submissionError: any) {
      // If onSubmit itself throws an error (e.g., transaction failed before bot call)
      setError(submissionError.message || 'Failed to process perk purchase.');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out" onClick={onClose}>
      <div 
        className="bg-background-card p-6 rounded-lg shadow-xl w-full max-w-md relative border border-gray-700 transform transition-all duration-300 ease-in-out scale-100" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          aria-label="Close modal"
          disabled={isLoading}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <h2 className="text-xl font-semibold text-white mb-2 text-center">Claim Perk: {perkName}</h2>
        <p className="text-sm text-gray-300 mb-1 text-center">Cost: <span className="text-secondary font-medium">{perkCost}</span></p>
        <p className="text-xs text-gray-400 mb-4 text-center">Enter your Discord username to receive your role.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="discordHandle" className="block text-sm font-medium text-gray-300 mb-1">
              Discord Username (e.g., username#1234 or new username)
            </label>
            <input
              id="discordHandle"
              type="text"
              value={discordHandle}
              onChange={(e) => setDiscordHandle(e.target.value)}
              className="w-full bg-background-input p-2.5 rounded-md text-white border border-gray-600 focus:border-primary focus:ring-1 focus:ring-primary text-sm"
              placeholder="your_discord_username"
              disabled={isLoading}
              autoFocus
            />
          </div>
          {error && (
            <div className="p-2.5 text-sm bg-red-900/40 border border-red-700 rounded-md text-red-300 break-words text-left">
              {error}
            </div>
          )}
          <button 
            type="submit"
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-4 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed relative flex items-center justify-center"
            disabled={isLoading || !discordHandle.trim()}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              'Confirm and Purchase Perk'
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-4 text-center">
          Ensure your Discord username is correct. Roles are typically assigned within a few minutes after successful purchase.
        </p>
      </div>
    </div>
  );
}; 