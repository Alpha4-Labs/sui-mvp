import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import Spinner from './Spinner'; // Assuming Spinner is in components/

// Composable Modal for Activation/Deactivation
function ActivationModal({ isOpen, onClose, context, onConfirm }) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For simulated async actions
  const [error, setError] = useState('');

  // Reset state when modal opens or context changes
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setIsLoading(false);
      setError('');
    }
  }, [isOpen, context]);

  if (!context) return null; // Don't render if no context

  const { action, source } = context;
  const isActivation = action === 'activate';

  // Determine input requirements based on source type (example logic)
  const requiresAmountInput = isActivation && (source.type === 'LP Staking' || source.type === 'Native Staking');
  const inputLabel = source.type === 'Native Staking' ? 'Amount of ALPHA' : 'Amount (e.g., USDT LP Value)'; // Dynamic label

  const handleConfirmClick = async () => {
    setError('');
    if (requiresAmountInput) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        setError('Please enter a valid positive amount.');
        return;
      }
    }

    setIsLoading(true);
    try {
      // Simulate API call or contract interaction
      await onConfirm(source.id, action, amount); // Pass amount back
      // Close after successful confirmation (onConfirm might handle this too)
       onClose(); // Keep this to ensure closure
    } catch (err) {
      setError(err.message || 'An error occurred.');
      setIsLoading(false); // Stop loading on error
    }
    // setIsLoading(false); // Already handled in try/catch or by onClose
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal Content */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-800 border border-gray-700 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-white mb-4"
                >
                  {isActivation ? `Activate: ${source.name}` : `Deactivate: ${source.name}`}
                </Dialog.Title>

                {/* Dynamic Content Area */}
                <div className="mt-2 space-y-4">
                  {isActivation ? (
                    requiresAmountInput ? (
                      <>
                        <p className="text-sm text-gray-400">
                          Enter the amount you wish to commit to this generation source.
                        </p>
                        <div>
                          <label htmlFor="activationAmount" className="block text-sm font-medium text-gray-300 mb-1">
                            {inputLabel}
                          </label>
                          <input
                            type="number"
                            id="activationAmount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g., 100"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Confirm activation for {source.name}. This may involve a transaction.
                      </p>
                    )
                  ) : (
                    // Deactivation confirmation
                    <p className="text-sm text-gray-400">
                      Are you sure you want to deactivate point generation from {source.name}? This may involve a transaction.
                    </p>
                  )}

                  {/* Error Message */}
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition duration-150"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`inline-flex justify-center items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition duration-150 ${
                      isActivation
                        ? 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500'
                        : 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleConfirmClick}
                    disabled={isLoading}
                  >
                    {isLoading ? <Spinner size="small" color="text-white" /> : 'Confirm'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default ActivationModal;
