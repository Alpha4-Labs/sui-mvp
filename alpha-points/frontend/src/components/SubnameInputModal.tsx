import React, { useState, useEffect, useRef } from 'react';
import { SuinsClient } from '@mysten/suins';
import { useAlphaContext } from '../context/AlphaContext';

interface SubnameInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (subname: string) => Promise<void>;
  perkName: string;
  isLoading: boolean;
  currentPoints: number;
  perkCost: number;
  userHasAlpha4Subleaf: boolean;
}

export const SubnameInputModal: React.FC<SubnameInputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  perkName,
  isLoading,
  currentPoints,
  perkCost,
  userHasAlpha4Subleaf,
}) => {
  const { suiClient, address: userAddress } = useAlphaContext();
  const [subname, setSubname] = useState('');
  const [error, setError] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Setup your SuinsClient instance (adjust as needed for your app)
  // You may want to move this to context or props if you already have one
  const suinsClient = new SuinsClient({
    client: suiClient,
    network: import.meta.env['VITE_SUI_NETWORK'] || 'testnet',
  });
  const parentDomain = 'alpha4.sui';

  // Debounced check for subname availability
  useEffect(() => {
    if (!subname || subname.length < 3 || subname.length > 15 || !/^[a-z0-9]+$/.test(subname)) {
      setIsAvailable(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        // const fullName = `${subname}.${parentDomain}`;
        // Debug logs removed for production
        const record = await suinsClient.getNameRecord(`${subname}.${parentDomain}`);
        if (record) {
          setIsAvailable(false); // Exists
        } else {
          setIsAvailable(true); // Available
        }
      } catch (e: any) {

        if (e.message && e.message.toLowerCase().includes('not found')) {
          setIsAvailable(true); // Available
        } else {
          setIsAvailable(null); // Unknown error
        }
      } finally {
        setChecking(false);
      }
    }, 400);
    // Cleanup on unmount
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [subname]);

  const handleSubmit = async () => {
    setError('');
    if (!subname.trim()) {
      setError('Subname cannot be empty.');
      return;
    }
    if (subname.length < 3 || subname.length > 15) {
      setError('Subname must be between 3 and 15 characters.');
      return;
    }
    if (!/^[a-z0-9]+$/.test(subname)) {
      setError('Subname can only contain lowercase letters and numbers.');
      return;
    }
    if (isAvailable === false) {
      setError('This name is already taken.');
      return;
    }
    try {
      await onSubmit(subname);
    } catch (e: any) {
      setError(e.message || 'Failed to process perk. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-background-card p-6 rounded-lg shadow-xl w-full max-w-md space-y-4">
        {/* Persistent warning icon and tooltip */}
        <div className="flex justify-center mb-2">
          <div className="relative group flex items-center">
            <svg className="w-6 h-6 text-yellow-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l8.66 15H3.34L12 4z" fill="#fbbf24" stroke="#b45309" />
              <circle cx="12" cy="17" r="1" fill="#b45309" />
              <rect x="11.25" y="9" width="1.5" height="5" rx="0.75" fill="#b45309" />
            </svg>
            <span className="text-yellow-300 font-semibold text-sm">Heads up</span>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-yellow-100 border border-yellow-500 text-yellow-900 text-xs rounded shadow-lg px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-normal text-center z-20">
              You only need one Alpha4 SuiNS name for Discord role verification.<br />
              Claiming more than one offers no additional benefits at this time.
            </span>
          </div>
        </div>
        <h2 className="text-xl font-semibold text-white text-center">Claim Perk: {perkName}</h2>
        
        <div className="text-sm text-gray-300 text-center">
          You are claiming the <span className="font-semibold text-secondary">{perkName}</span> for <span className="font-semibold text-secondary">{perkCost.toLocaleString()} αP</span>.
          <br />
          Available points: {currentPoints.toLocaleString()} αP.
        </div>

        {error && (
          <div className="p-2 text-xs bg-red-900/30 border border-red-700 rounded-md text-red-400 break-words">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="subname" className="block text-sm font-medium text-gray-300 mb-1">
            Choose your unique identifier (3-15 chars, a-z, 0-9):
          </label>
          <input
            type="text"
            id="subname"
            value={subname}
            onChange={(e) => setSubname(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            placeholder="e.g. mycoolname"
            className="w-full bg-background rounded p-2 text-white border border-gray-600 focus:border-primary focus:ring-primary text-sm"
            maxLength={15}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-400 mt-1">
            This will be your unique SuiNS name:
            <span
              className="ml-1 text-primary font-mono select-all"
              style={{ userSelect: 'all', cursor: 'text' }}
            >
              {(subname || "yourname") + ".alpha4.sui"}
            </span>
            {subname.length >= 3 && /^[a-z0-9]+$/.test(subname) && (
              <span className="ml-2">
                {checking ? (
                  <span className="text-yellow-400">Checking...</span>
                ) : isAvailable === true ? (
                  <span className="text-green-400">Available!</span>
                ) : isAvailable === false ? (
                  <span className="text-red-400">This name is already taken.</span>
                ) : null}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !subname.trim() || subname.length < 3 || currentPoints < perkCost || isAvailable === false || checking}
            className="flex-1 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium relative"
          >
            {isLoading ? (
              <>
                <span className="opacity-0">Processing...</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              </>
            ) : (
              `Claim with "${subname || '...'}"`
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-gray-200 py-2 px-4 rounded-md transition-colors disabled:opacity-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
        {currentPoints < perkCost && (
            <p className="text-xs text-red-400 text-center mt-2">Insufficient Alpha Points to claim this perk.</p>
        )}
      </div>
    </div>
  );
}; 