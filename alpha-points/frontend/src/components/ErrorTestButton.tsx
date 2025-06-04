import React from 'react';
import { toast } from 'react-toastify';
import { formatErrorForToast, parseErrorCode, debugError112 } from '../utils/errorCodes';

export function ErrorTestButton() {
  const testError112 = () => {
    // Simulate the exact error you encountered
    const mockError = {
      message: "MoveAbort(MoveLocation { module: ModuleId { address: f54bb0934cd6a456166de45cf32e05799f626a2c900a6b1241322b14619a886d, name: Identifier(\"perk_manager\") }, function: 0, instruction: 38, function_name: Some(\"create_perk_definition\") }, 112)"
    };
    
    const { title, message } = formatErrorForToast(mockError);
    const parsedError = parseErrorCode(mockError.message);
    
    // Simulate perk settings for testing
    const mockPerkSettings = {
      maxCostPerPerkUsd: 10.00
    };
    
    const perkPrice = 25.00; // Price that would trigger error 112
    
    if (parsedError?.code === 112) {
      const diagnostic = debugError112(perkPrice, mockPerkSettings);
      
      toast.error(
        `❌ ${title}\n\n` +
        `${message}\n\n` +
        `💡 Your perk costs $${perkPrice.toFixed(2)} but your max cost limit is $${mockPerkSettings.maxCostPerPerkUsd}\n\n` +
        `🔧 ${diagnostic.recommendation}`,
        {
          autoClose: 20000,
          style: { whiteSpace: 'pre-line' }
        }
      );
      
      // Show additional help toast
      setTimeout(() => {
        toast.info(
          `💡 Quick Fix: Go to Settings tab → Increase "Max Cost Per Perk" to at least $${perkPrice.toFixed(2)}`,
          { autoClose: 15000 }
        );
      }, 2000);
    }
  };

  const testGenericError = () => {
    const mockError = {
      message: "MoveAbort(MoveLocation { module: ModuleId { address: f54bb0934cd6a456166de45cf32e05799f626a2c900a6b1241322b14619a886d, name: Identifier(\"perk_manager\") }, function: 0, instruction: 15, function_name: Some(\"create_perk_definition\") }, 108)"
    };
    
    const { title, message } = formatErrorForToast(mockError);
    const parsedError = parseErrorCode(mockError.message);
    
    toast.error(
      `❌ ${title}\n\n${message}${parsedError?.code ? `\n\nError Code: ${parsedError.code}` : ''}`,
      {
        autoClose: 12000,
        style: { whiteSpace: 'pre-line' }
      }
    );
  };

  return (
    <div className="bg-background-card p-4 rounded-lg">
      <h3 className="text-white font-semibold mb-3">🧪 Error Handling Test</h3>
      <div className="space-y-2">
        <button
          onClick={testError112}
          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
        >
          Test Error 112 (Cost Limit Exceeded)
        </button>
        <button
          onClick={testGenericError}
          className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded"
        >
          Test Error 108 (Settings Not Configured)
        </button>
        <div className="text-xs text-gray-400 mt-2">
          These buttons simulate the exact errors you would encounter, showing the new user-friendly messages instead of raw Move abort codes.
        </div>
      </div>
    </div>
  );
} 