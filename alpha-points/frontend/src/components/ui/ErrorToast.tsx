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
    <div className="space-y-3 bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl p-4">
      {/* Error Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-white text-base">{title}</div>
          {errorCode && (
            <div className="text-xs bg-red-500/20 text-red-300 px-2 py-1 mt-1 rounded-lg border border-red-500/30 inline-block">
              Error Code {errorCode}
            </div>
          )}
        </div>
      </div>
      
      {/* Error Message */}
      <div className="text-sm text-gray-200 leading-relaxed bg-black/20 rounded-lg p-3 border border-white/5">
        {message}
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-blue-500/25 active:scale-95"
            >
              🔄 Retry
            </button>
          )}
          {txHash && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-300 hover:text-blue-200 underline decoration-dotted underline-offset-2 transition-colors duration-300"
            >
              🔗 View Transaction
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
          className="text-sm text-gray-400 hover:text-gray-300 underline decoration-dotted underline-offset-2 transition-colors duration-300"
        >
          💡 Get Help
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
    <div className="space-y-3 bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-xl p-4">
      {/* Success Title */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="font-semibold text-white text-base">{title}</div>
      </div>
      
      {/* Success Message */}
      {message && (
        <div className="text-sm text-gray-200 bg-black/20 rounded-lg p-3 border border-white/5">
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
            className="inline-flex items-center space-x-2 text-sm text-emerald-300 hover:text-emerald-200 underline decoration-dotted underline-offset-2 transition-colors duration-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>View on Suiscan: {txHash.substring(0, 8)}...</span>
          </a>
        </div>
      )}
    </div>
  );
} 