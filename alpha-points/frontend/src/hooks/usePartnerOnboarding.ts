import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentWallet } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils'; // Assuming SUI_TYPE_ARG is still relevant or adjust if needed
import { PACKAGE_ID, SHARED_OBJECTS } from '../config/contract'; // Assuming config is set up
import { toast } from 'react-toastify';

const SUI_INPUT_DECIMALS = 9; // For converting human-readable SUI to MIST

export function usePartnerOnboarding() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { currentWallet } = useCurrentWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null);

  const createPartnerCap = async (partnerName: string, suiAmountMist: bigint) => {
    if (!currentWallet) {
      setError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return;
    }

    if (suiAmountMist <= 0) {
        setError('SUI amount must be greater than 0.');
        toast.error('SUI collateral amount must be greater than 0.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setTransactionDigest(null);

    try {
      const tx = new Transaction();

      // 1. Split SUI from gas coin for collateral
      const [collateralCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiAmountMist.toString())]);

      // 2. Call the create_partner_cap_with_collateral function
      tx.moveCall({
        target: `${PACKAGE_ID}::partner::create_partner_cap_with_collateral`,
        typeArguments: [SUI_TYPE_ARG],
        arguments: [
          tx.object(SHARED_OBJECTS.config),
          tx.object(SHARED_OBJECTS.partnerRegistry),
          tx.object(SHARED_OBJECTS.oracle),
          collateralCoin,
          tx.pure.string(partnerName),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });

      const result = await signAndExecute(
        { transaction: tx },
        { onSuccess: (res) => {
            console.log('Partner cap creation successful:', res);
            setTransactionDigest(res.digest);
            // toast.success(`Partner Cap creation successful! Digest: ${res.digest}`); // Handled in page
          },
          onError: (err) => {
            console.error('Partner cap creation error:', err);
            setError(err.message || 'Failed to create partner cap. Please try again.');
            // toast.error(err.message || 'Failed to create partner cap. Please try again.'); // Handled in page
          }
        }
      );
      // console.log('signAndExecute result', result); // For debugging

    } catch (e: any) {
      console.error('Error constructing transaction for partner cap:', e);
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return { createPartnerCap, isLoading, error, transactionDigest };
} 