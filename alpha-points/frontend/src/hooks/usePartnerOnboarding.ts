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

  // New guided onboarding state
  const [onboardingStep, setOnboardingStep] = useState<'idle' | 'partnercap' | 'stats' | 'complete'>('idle');
  const [partnerCapId, setPartnerCapId] = useState<string | null>(null);
  const [statsId, setStatsId] = useState<string | null>(null);

  /**
   * GUIDED ONBOARDING: Creates both PartnerCapFlex AND PartnerPerkStatsV2 in sequence
   * This is the RECOMMENDED way for new partners to onboard with full V2 system support
   */
  const createPartnerWithFullSetup = async (
    partnerName: string, 
    suiAmountMist: bigint,
    customDailyQuota?: number
  ) => {
    if (!currentWallet) {
      setError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return null;
    }

    if (suiAmountMist <= 0) {
      setError('SUI amount must be greater than 0.');
      toast.error('SUI collateral amount must be greater than 0.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setTransactionDigest(null);
    setPartnerCapId(null);
    setStatsId(null);
    setOnboardingStep('idle');

    try {
      // STEP 1: Create PartnerCapFlex
      setOnboardingStep('partnercap');
      toast.info('🚀 Step 1/2: Creating your PartnerCapFlex...');

      const partnerCapTransaction = buildCreatePartnerCapFlexTransaction(
        partnerName, 
        suiAmountMist, 
        undefined // No sponsorship - user pays gas
      );

      const partnerCapResult = await signAndExecuteTransaction({
        transaction: partnerCapTransaction,
        chain: 'sui:testnet',
      });

      if (!partnerCapResult?.digest) {
        throw new Error('Failed to create PartnerCapFlex - no transaction digest');
      }

      // Extract PartnerCapFlex ID from transaction result
      // Note: In a real implementation, you'd parse the transaction effects to get the object ID
      // For now, we'll use the transaction digest as a placeholder approach
      const extractedPartnerCapId = await extractPartnerCapIdFromTransaction(partnerCapResult.digest);
      
      if (!extractedPartnerCapId) {
        throw new Error('Could not extract PartnerCapFlex ID from transaction');
      }

      setPartnerCapId(extractedPartnerCapId);
      
      toast.success(`✅ Step 1 complete! PartnerCapFlex created.`);

      // Calculate appropriate daily quota based on collateral
      const defaultDailyQuota = calculateRecommendedDailyQuota(suiAmountMist);
      const dailyQuotaToUse = customDailyQuota || defaultDailyQuota;

      // STEP 2: Create PartnerPerkStatsV2
      setOnboardingStep('stats');
      toast.info('🔄 Step 2/2: Creating your stats tracking system...');

      const statsTransaction = buildCreatePartnerPerkStatsTransaction(
        extractedPartnerCapId,
        dailyQuotaToUse,
        undefined // No sponsorship - user pays gas
      );

      const statsResult = await signAndExecuteTransaction({
        transaction: statsTransaction,
        chain: 'sui:testnet',
      });

      if (!statsResult?.digest) {
        throw new Error('Failed to create PartnerPerkStatsV2 - no transaction digest');
      }

      const extractedStatsId = await extractStatsIdFromTransaction(statsResult.digest);
      setStatsId(extractedStatsId);

      // Complete!
      setOnboardingStep('complete');
      setTransactionDigest(statsResult.digest); // Use the final transaction digest

      toast.success(`🎉 Onboarding complete! You now have full V2 system access with advanced analytics!`);

      return {
        partnerCapId: extractedPartnerCapId,
        statsId: extractedStatsId,
        partnerCapTxDigest: partnerCapResult.digest,
        statsTxDigest: statsResult.digest
      };

    } catch (error: any) {
      console.error('Partner onboarding error:', error);
      const errorMessage = error.message || 'Failed to complete partner onboarding. Please try again.';
      setError(errorMessage);
      setOnboardingStep('idle');
      
      // Provide helpful error messages based on which step failed
      if (onboardingStep === 'partnercap') {
        toast.error(`❌ Step 1 failed: ${errorMessage}`);
      } else if (onboardingStep === 'stats') {
        toast.error(`❌ Step 2 failed: ${errorMessage}. Your PartnerCapFlex was created, but stats setup failed. You can retry stats creation later.`);
      } else {
        toast.error(`❌ Onboarding failed: ${errorMessage}`);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Creates ONLY PartnerPerkStatsV2 for existing PartnerCapFlex owners
   * Used for partners who created PartnerCapFlex before V2 system existed
   */
  const createStatsForExistingPartner = async (
    existingPartnerCapId: string,
    dailyQuotaLimit: number
  ) => {
    if (!currentWallet) {
      setError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      toast.info('🔄 Creating your stats tracking system...');

      const transaction = buildCreatePartnerPerkStatsTransaction(
        existingPartnerCapId,
        dailyQuotaLimit,
        undefined
      );

      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        const extractedStatsId = await extractStatsIdFromTransaction(result.digest);
        setStatsId(extractedStatsId);
        setTransactionDigest(result.digest);
        
        toast.success('✅ Stats tracking created! You can now use the full V2 system.');
        return extractedStatsId;
      }

    } catch (error: any) {
      console.error('Stats creation error:', error);
      const errorMessage = error.message || 'Failed to create stats tracking. Please try again.';
      setError(errorMessage);
      toast.error(`❌ Stats creation failed: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Creates a new TVL-backed PartnerCapFlex (LEGACY - for backwards compatibility)
   * This is the old system without stats - only use if you don't want V2 features
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

  /**
   * Helper function to extract PartnerCapFlex ID from transaction
   * In a production app, this would parse transaction effects properly
   */
  const extractPartnerCapIdFromTransaction = async (txDigest: string): Promise<string | null> => {
    try {
      // TODO: Implement proper transaction effects parsing
      // For now, return a placeholder that would be replaced with actual parsing
      console.log('Extracting PartnerCapFlex ID from transaction:', txDigest);
      
      // In a real implementation, you would:
      // 1. Query the transaction effects
      // 2. Find the created PartnerCapFlex object
      // 3. Return its object ID
      
      // Placeholder approach - in reality you'd parse the transaction effects
      return `partnercap_${txDigest.substring(0, 8)}`;
    } catch (error) {
      console.error('Failed to extract PartnerCapFlex ID:', error);
      return null;
    }
  };

  /**
   * Helper function to extract Stats ID from transaction
   */
  const extractStatsIdFromTransaction = async (txDigest: string): Promise<string | null> => {
    try {
      console.log('Extracting Stats ID from transaction:', txDigest);
      return `stats_${txDigest.substring(0, 8)}`;
    } catch (error) {
      console.error('Failed to extract Stats ID:', error);
      return null;
    }
  };

  /**
   * Calculate recommended daily quota based on SUI collateral amount
   */
  const calculateRecommendedDailyQuota = (suiAmountMist: bigint): number => {
    // Convert MIST to SUI (divide by 10^9)
    const suiAmount = Number(suiAmountMist) / 1_000_000_000;
    
    // Example calculation: 1000 points per 1 SUI collateral
    // This should match the quota calculation logic in the Move contract
    const baseQuota = Math.floor(suiAmount * 1000);
    
    // Ensure minimum quota
    return Math.max(baseQuota, 100);
  };

  return {
    // NEW: Guided onboarding functions (RECOMMENDED)
    createPartnerWithFullSetup,
    createStatsForExistingPartner,
    
    // Legacy functions (maintained for backwards compatibility)
    createPartnerCapFlex,
    createPartnerCapFlexWithUSDC,
    createPartnerCapFlexWithNFT,
    
    // ProxyCap functions
    createProxyCap: createProxyCapForPartner,
    isLoadingProxyCap,
    proxyCapError,
    proxyCapTxDigest,
    
    // State
    isLoading,
    error,
    transactionDigest,
    onboardingStep,
    partnerCapId,
    statsId,
    
    // Utilities
    calculateRecommendedDailyQuota,
  };
} 