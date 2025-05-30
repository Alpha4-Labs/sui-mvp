import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

interface SubnameSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  subnameRegistered: string; // The successfully registered subname/code
  perkName: string;
  parentDomain?: string; // e.g., "alpha4.sui"
}

export const SubnameSuccessModal: React.FC<SubnameSuccessModalProps> = ({
  isOpen,
  onClose,
  subnameRegistered,
  perkName,
  parentDomain = "alpha4.sui", // Default parent domain
}) => {
  const [copied, setCopied] = useState(false);
  const [confirmedCopied, setConfirmedCopied] = useState(false);

  const fullSubname = `${subnameRegistered}.${parentDomain}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullSubname)
      .then(() => {
        setCopied(true);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopied(false), 2000); // Reset copied state after 2s
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        toast.error("Failed to copy to clipboard.");
      });
  };

  useEffect(() => {
    // Reset confirmation when modal reopens with new subname
    if (isOpen) {
      setConfirmedCopied(false);
    }
  }, [isOpen, subnameRegistered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-background-card p-6 rounded-lg shadow-xl w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold text-white mb-2">Subname Registered!</h2>
        <p className="text-gray-300 mb-4">
          Your SuiNS name <span className="font-mono text-secondary">{fullSubname}</span> now resolves to your address.
        </p>

        <div className="bg-background-input p-3 rounded-md text-center mb-4">
          <span
            className="text-lg font-mono text-primary break-all select-all"
            style={{ userSelect: 'all', cursor: 'text' }}
            title="You can select and copy this name"
          >
            {fullSubname}
          </span>
        </div>

        <div className="bg-blue-900/20 border border-blue-700 rounded-md p-3 mb-4">
          <p className="text-xs text-blue-300">
            This is a <b>leaf subname</b>—no NFT is created, but your name is always resolvable to your address via SuiNS.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gray-600 hover:bg-gray-500 text-gray-200 py-2 px-4 rounded-md transition-colors text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}; 