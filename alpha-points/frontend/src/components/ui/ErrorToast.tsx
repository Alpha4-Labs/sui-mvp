import React from 'react';

interface ErrorToastProps {
  title: string;
  message: string;
  errorCode?: number;
  txHash?: string;
  onRetry?: () => void;
}

export function ErrorToast({ title, message, errorCode, txHash, onRetry }: ErrorToastProps) {
  return (
    <div className="space-y-2">
      {/* Error Title */}
      <div className="flex items-center space-x-2">
        <div className="text-red-400 text-lg">❌</div>
        <div className="font-semibold text-white">{title}</div>
        {errorCode && (
          <div className="text-xs bg-red-600/20 text-red-300 px-1.5 py-0.5 rounded border border-red-600/30">
            Code {errorCode}
          </div>
        )}
      </div>
      
      {/* Error Message */}
      <div className="text-sm text-gray-200 leading-relaxed">
        {message}
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
            >
              Retry
            </button>
          )}
          {txHash && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-300 hover:text-blue-200 underline"
            >
              View Transaction
            </a>
          )}
        </div>
        
        {/* Help Link */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            // Could open a help modal or documentation
            console.log('Help requested for error:', errorCode);
          }}
          className="text-xs text-gray-400 hover:text-gray-300 underline"
        >
          Get Help
        </a>
      </div>
    </div>
  );
}

interface SuccessToastProps {
  title: string;
  message?: string;
  txHash?: string;
}

export function SuccessToast({ title, message, txHash }: SuccessToastProps) {
  return (
    <div className="space-y-2">
      {/* Success Title */}
      <div className="flex items-center space-x-2">
        <div className="text-green-400 text-lg">✅</div>
        <div className="font-semibold text-white">{title}</div>
      </div>
      
      {/* Success Message */}
      {message && (
        <div className="text-sm text-gray-200">
          {message}
        </div>
      )}
      
      {/* Transaction Link */}
      {txHash && (
        <div className="pt-1">
          <a
            href={`https://suiscan.xyz/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-300 hover:text-blue-200 underline"
          >
            View on Suiscan: {txHash.substring(0, 8)}...
          </a>
        </div>
      )}
    </div>
  );
} 