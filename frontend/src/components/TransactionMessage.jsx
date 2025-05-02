// src/components/TransactionMessage.jsx
import React from 'react';
import Spinner from './Spinner';

/**
 * Component for displaying transaction messages, errors, and status updates
 */
function TransactionMessage({ 
  message, 
  isWrongNetwork, 
  isLoading, 
  onSwitchNetwork,
  networkName
}) {
  // Determine message style based on content
  const getMessageStyle = () => {
    if (isWrongNetwork) {
      return 'bg-yellow-900/80 text-yellow-200';
    } else if (message.toLowerCase().includes('failed') || 
              message.toLowerCase().includes('error') || 
              message.startsWith('❌')) {
      return 'bg-red-900/80 text-red-200';
    } else if (message.startsWith('✅')) {
      return 'bg-green-900/80 text-green-200';
    } else {
      return 'bg-blue-900/80 text-blue-200';
    }
  };

  return (
    <div className={`p-3 rounded-lg mb-4 text-center text-sm ${getMessageStyle()} 
                    flex items-center justify-center gap-x-3 transition-all duration-300`}>
      {isLoading && <Spinner size="small" color="text-white" />}
      <span>{message}</span>
      
      {isWrongNetwork && (
        <button 
          onClick={onSwitchNetwork} 
          className="ml-3 px-3 py-1 border border-yellow-400 text-yellow-300 rounded hover:bg-yellow-800/50 text-xs"
        >
          Switch to {networkName}
        </button>
      )}
    </div>
  );
}

export default TransactionMessage;