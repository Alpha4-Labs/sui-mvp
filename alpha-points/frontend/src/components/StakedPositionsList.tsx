// === StakedPositionsList.tsx (Corrected) ===
import React from 'react';
// Correct the hook import name
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useAlphaContext } from '../context/AlphaContext';
import { formatSui, formatAddress, formatDuration } from '../utils/format';
import { buildUnstakeTransaction } from '../utils/transaction'; // Builds PTB JSON
// Import the corrected adapter function name
import { adaptPtbJsonForSignAndExecute } from '../utils/transaction-adapter';

export const StakedPositionsList: React.FC = () => {
  // Assuming loading from context is an object like { positions: boolean; ... }
  const { stakePositions, loading, refreshData, setTransactionLoading } = useAlphaContext();

  // Correct the hook import name usage here as well
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const handleUnstake = async (stakeId: string) => {
    setTransactionLoading(true);
    try {
      // Build the PTB JSON for unstaking
      const ptbJson = buildUnstakeTransaction(stakeId);

      // Adapt the PTB JSON using the corrected function name
      const executionInput = adaptPtbJsonForSignAndExecute(ptbJson);

      // Sign and execute the transaction
      await signAndExecute(executionInput);

      // Refresh data on success
      refreshData(); // Ensure this refreshes stakePositions list
    } catch (error) {
      console.error('Error unstaking position:', error);
      // Optionally show user feedback
    } finally {
      setTransactionLoading(false);
    }
  };

  // Check the specific loading flag for positions
  // Adjust `loading.positions` if your context provides a different loading structure
  if (loading.positions) {
    return (
      <div className="bg-background-card rounded-lg p-6 shadow-lg animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div> {/* Using gray for pulse */}
        <div className="h-40 bg-gray-700 rounded w-full"></div> {/* Increased height */}
      </div>
    );
  }

  // --- JSX Rendering ---
  return (
    <div className="bg-background-card rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-4">Your Staked Positions</h2>

      {stakePositions.length === 0 ? (
         <p className="text-gray-400">You don't have any staked positions yet.</p>
      ) : (
        <div className="space-y-4">
          {stakePositions.map((position) => (
            <div key={position.id} className="border border-gray-700 rounded-lg p-4 text-sm">
              {/* Display Position Details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                 <span className="text-gray-400">Position ID</span>
                 <span className="text-white font-mono text-right">{formatAddress(position.id)}</span>

                 <span className="text-gray-400">Principal</span>
                 <span className="text-white text-right">{formatSui(position.principal)} SUI</span>

                 <span className="text-gray-400">Duration</span>
                 <span className="text-white text-right">{formatDuration(parseInt(position.durationEpochs || '0', 10))}</span>

                 <span className="text-gray-400">Status</span>
                 <span className={`text-right ${position.encumbered ? "text-yellow-400" : "text-green-400"}`}>
                   {position.encumbered ? "Encumbered (Loan)" : "Active"}
                 </span>
              </div>

              {/* Maturity Progress Bar */}
              <div className="mt-3 mb-3">
                 <div className="text-xs text-gray-400 mb-1 text-right">{position.maturityPercentage}% Complete</div>
                 <div className="w-full bg-gray-700 rounded-full h-2">
                     <div
                         className="bg-blue-600 h-2 rounded-full"
                         style={{ width: `${position.maturityPercentage}%` }}
                     ></div>
                 </div>
              </div>

              {/* Unstake Button (conditional) */}
              {position.maturityPercentage >= 100 && !position.encumbered && (
                <div className="mt-4">
                  <button
                    onClick={() => handleUnstake(position.id)}
                    className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded transition-colors text-sm font-medium"
                  >
                    Unstake
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};