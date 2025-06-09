import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentWallet } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils'; // Assuming SUI_TYPE_ARG is still relevant or adjust if needed
import { PACKAGE_ID, SHARED_OBJECTS } from '../config/contract'; // Removed SPONSOR_CONFIG import
import { toast } from 'react-toastify';
import { 
  buildCreateProxyCapTransaction, 
  buildCreatePartnerCapTransaction,
  buildCreatePartnerCapFlexTransaction,
  buildCreatePartnerCapFlexWithUSDCTransaction,
  buildCreatePartnerCapFlexWithNFTTransaction
} from '../utils/transaction';

/*
 * SPONSORED TRANSACTIONS - FUTURE IMPLEMENTATION
 * 
 * Currently disabled for development. To re-enable sponsored transactions:
 * 
 * 1. Restore SPONSOR_CONFIG import
 * 2. Restore sponsorAddress logic in transaction functions
 * 3. Set up backend sponsor service with deployer keypair
 * 4. Implement two-party signing flow:
 *    - User builds transaction kind with { onlyTransactionKind: true }
 *    - Send to backend sponsor service
 *    - Backend creates sponsored transaction with setSender/setGasOwner/setGasPayment
 *    - Backend signs as sponsor
 *    - Frontend signs as user
 *    - Execute with both signatures
 * 
 * Benefits: Partners get gas-free transactions
 * Requirements: Backend service, security controls, gas management
 * 
 * For now: All transactions are user-paid (normal approach)
 */

const SUI_INPUT_DECIMALS = 9; // For converting human-readable SUI to MIST

export function usePartnerOnboarding() {
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { currentWallet } = useCurrentWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null);

  // ProxyCap creation state
  const [isLoadingProxyCap, setIsLoadingProxyCap] = useState(false);
  const [proxyCapError, setProxyCapError] = useState<string | null>(null);
  const [proxyCapTxDigest, setProxyCapTxDigest] = useState<string | null>(null);

  /**
   * Creates a new TVL-backed PartnerCapFlex (RECOMMENDED)
   * This is the new system with quota validation and revenue recycling
   */
  const createPartnerCapFlex = async (partnerName: string, suiAmountMist: bigint) => {
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
      // Build transaction without sponsorship (user pays gas)
      const transaction = buildCreatePartnerCapFlexTransaction(
        partnerName, 
        suiAmountMist, 
        undefined // No sponsorship - user pays gas
      );

      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {

        setTransactionDigest(result.digest);
        
        const txUrl = `https://suiscan.xyz/testnet/tx/${result.digest}`;
        const shortDigest = result.digest.substring(0, 8);
        
        toast.success(`PartnerCapFlex created successfully! View on Suiscan: ${shortDigest}... (${txUrl})`);
      }

    } catch (error: any) {
      console.error('PartnerCapFlex creation error:', error);
      const errorMessage = error.message || 'Failed to create PartnerCapFlex. Please try again.';
      setError(errorMessage);
      toast.error(`Failed to create PartnerCapFlex: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Creates a legacy PartnerCap (DEPRECATED)
   * @deprecated Use createPartnerCapFlex for TVL-backed quotas and revenue recycling
   */
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
      // Build transaction without sponsorship (user pays gas)
      const transaction = buildCreatePartnerCapTransaction(
        partnerName, 
        suiAmountMist, 
        undefined // No sponsorship - user pays gas
      );

      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {

        setTransactionDigest(result.digest);
        
        const txUrl = `https://suiscan.xyz/testnet/tx/${result.digest}`;
        const shortDigest = result.digest.substring(0, 8);
        
        toast.warn(`Legacy PartnerCap created. Consider upgrading to PartnerCapFlex for enhanced features. View on Suiscan: ${shortDigest}... (${txUrl})`);
      }

    } catch (error: any) {
      console.error('Legacy PartnerCap creation error:', error);
      const errorMessage = error.message || 'Failed to create legacy PartnerCap. Please try again.';
      setError(errorMessage);
      toast.error(`Failed to create legacy PartnerCap: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Create ProxyCap for Partner
  const createProxyCapForPartner = async (
    partnerCapId: string,
    suinsNftId: string,
    suinsNftType: string,
    packageIdToUse?: string // Renamed for clarity, still optional
  ) => {
    if (!currentWallet) {
      setProxyCapError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return;
    }
    
    setIsLoadingProxyCap(true);
    setProxyCapError(null);
    setProxyCapTxDigest(null);
    
    try {
      // Build transaction without sponsorship (user pays gas)
      const transaction = buildCreateProxyCapTransaction(
        partnerCapId, 
        suinsNftId, 
        suinsNftType, 
        packageIdToUse || PACKAGE_ID, 
        undefined // No sponsorship - user pays gas
      );
      
      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        setProxyCapTxDigest(result.digest);
        
        const txUrl = `https://suiscan.xyz/testnet/tx/${result.digest}`;
        const shortDigest = result.digest.substring(0, 8);
        
        toast.success(`ProxyCap created successfully! View on Suiscan: ${shortDigest}... (${txUrl})`);
      }

    } catch (error: any) {
      console.error('ProxyCap creation error:', error);
      const errorMessage = error.message || 'Failed to create ProxyCap. Please try again.';
      setProxyCapError(errorMessage);
      toast.error(`Failed to create ProxyCap: ${errorMessage}`);
    } finally {
      setIsLoadingProxyCap(false);
    }
  };

  /**
   * Creates a PartnerCapFlex with USDC stable collateral (100% LTV)
   * Provides stable collateral backing with full value utilization
   */
  const createPartnerCapFlexWithUSDC = async (partnerName: string, usdcCoinId: string) => {
    if (!currentWallet) {
      setError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return;
    }

    if (!usdcCoinId) {
      setError('USDC coin ID is required.');
      toast.error('Please provide a valid USDC coin ID.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTransactionDigest(null);

    try {
      const transaction = buildCreatePartnerCapFlexWithUSDCTransaction(
        partnerName,
        usdcCoinId,
        undefined // No sponsorship - user pays gas
      );

      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {

        setTransactionDigest(result.digest);
        
        const txUrl = `https://suiscan.xyz/testnet/tx/${result.digest}`;
        const shortDigest = result.digest.substring(0, 8);
        
        toast.success(`PartnerCapFlex with USDC collateral created successfully! View on Suiscan: ${shortDigest}... (${txUrl})`);
      }

    } catch (error: any) {
      console.error('PartnerCapFlex USDC creation error:', error);
      const errorMessage = error.message || 'Failed to create PartnerCapFlex with USDC collateral. Please try again.';
      setError(errorMessage);
      toast.error(`Failed to create PartnerCapFlex with USDC: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Creates a PartnerCapFlex with NFT bundle collateral (70% LTV)
   * Provides NFT collection backing with kiosk owner capabilities
   */
  const createPartnerCapFlexWithNFT = async (
    partnerName: string, 
    kioskId: string, 
    collectionType: string, 
    estimatedFloorValueUsdc: number
  ) => {
    if (!currentWallet) {
      setError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return;
    }

    if (!kioskId || !collectionType) {
      setError('Kiosk ID and collection type are required.');
      toast.error('Please provide valid kiosk ID and NFT collection type.');
      return;
    }

    if (estimatedFloorValueUsdc <= 0) {
      setError('Estimated floor value must be greater than 0.');
      toast.error('Please provide a valid estimated floor value in USDC.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTransactionDigest(null);

    try {
      const transaction = buildCreatePartnerCapFlexWithNFTTransaction(
        partnerName,
        kioskId,
        collectionType,
        estimatedFloorValueUsdc,
        undefined // No sponsorship - user pays gas
      );

      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {

        setTransactionDigest(result.digest);
        
        const txUrl = `https://suiscan.xyz/testnet/tx/${result.digest}`;
        const shortDigest = result.digest.substring(0, 8);
        
        toast.success(`PartnerCapFlex with NFT collateral created successfully! View on Suiscan: ${shortDigest}... (${txUrl})`);
      }

    } catch (error: any) {
      console.error('PartnerCapFlex NFT creation error:', error);
      const errorMessage = error.message || 'Failed to create PartnerCapFlex with NFT collateral. Please try again.';
      setError(errorMessage);
      toast.error(`Failed to create PartnerCapFlex with NFT: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // New TVL-backed system (recommended)
    createPartnerCapFlex,
    createPartnerCapFlexWithUSDC,
    createPartnerCapFlexWithNFT,
    
    // Legacy system (deprecated but functional)
    createPartnerCap,
    
    // Common states
    isLoading,
    error,
    transactionDigest,
    
    // ProxyCap creation
    createProxyCapForPartner,
    isLoadingProxyCap,
    proxyCapError,
    proxyCapTxDigest,
  };
} 