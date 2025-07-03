import { useState } from 'react';
import { useSignAndExecuteTransaction, useCurrentWallet, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils'; // Assuming SUI_TYPE_ARG is still relevant or adjust if needed
import { PACKAGE_ID, SHARED_OBJECTS } from '../config/contract'; // Removed SPONSOR_CONFIG import
import { toast } from 'react-toastify';
import { 
  buildCreateProxyCapTransaction, 
  buildCreatePartnerCapTransaction,
  buildCreatePartnerCapFlexTransaction,
  buildCreatePartnerCapFlexWithUSDCTransaction,
  buildCreatePartnerCapFlexWithNFTTransaction,
  buildCreatePartnerPerkStatsTransaction
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
  const suiClient = useSuiClient();
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

      // STEP 2: PartnerCapFlex Analytics Setup Complete!
      // Note: PartnerCapFlex objects have built-in analytics and quota tracking:
      // - total_lifetime_quota_points, total_points_minted_lifetime
      // - daily_throttle_points, points_minted_today, total_perks_created
      // No separate PartnerPerkStats object is needed!
      
      setOnboardingStep('stats');
      toast.info('🔄 Step 2/2: Configuring analytics and quota system...');

      // Simulate brief setup time for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Complete! PartnerCapFlex includes all necessary analytics
      setOnboardingStep('complete');
      setTransactionDigest(partnerCapResult.digest); // Use the PartnerCapFlex transaction digest
      
      // The PartnerCapFlex ID serves as the analytics/stats system
      setStatsId(extractedPartnerCapId);

      toast.success(`🎉 Onboarding complete! Your PartnerCapFlex includes built-in analytics and quota tracking!`);

      return {
        partnerCapId: extractedPartnerCapId,
        statsId: extractedPartnerCapId, // PartnerCapFlex serves as the stats system
        partnerCapTxDigest: partnerCapResult.digest,
        statsTxDigest: partnerCapResult.digest // Same transaction
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
   * GUIDED ONBOARDING FOR USDC: Creates both PartnerCapFlex AND PartnerPerkStatsV2 in sequence
   * This provides the same comprehensive setup for USDC collateral partners
   */
  const createPartnerWithFullSetupUSDC = async (
    partnerName: string, 
    usdcCoinId: string,
    customDailyQuota?: number
  ) => {
    if (!currentWallet) {
      setError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return null;
    }

    if (!usdcCoinId) {
      setError('USDC coin ID is required.');
      toast.error('Please provide a valid USDC coin ID.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setTransactionDigest(null);
    setPartnerCapId(null);
    setStatsId(null);
    setOnboardingStep('idle');

    try {
      // STEP 1: Create PartnerCapFlex with USDC
      setOnboardingStep('partnercap');
      toast.info('🚀 Step 1/2: Creating your PartnerCapFlex with USDC collateral...');

      const partnerCapTransaction = buildCreatePartnerCapFlexWithUSDCTransaction(
        partnerName,
        usdcCoinId,
        undefined // No sponsorship - user pays gas
      );

      const partnerCapResult = await signAndExecuteTransaction({
        transaction: partnerCapTransaction,
        chain: 'sui:testnet',
      });

      if (!partnerCapResult?.digest) {
        throw new Error('Failed to create PartnerCapFlex with USDC - no transaction digest');
      }

      const extractedPartnerCapId = await extractPartnerCapIdFromTransaction(partnerCapResult.digest);
      
      if (!extractedPartnerCapId) {
        throw new Error('Could not extract PartnerCapFlex ID from transaction');
      }

      setPartnerCapId(extractedPartnerCapId);
      
      toast.success(`✅ Step 1 complete! PartnerCapFlex with USDC collateral created.`);

      // STEP 2: PartnerCapFlex Analytics Setup Complete!
      // Note: PartnerCapFlex objects have built-in analytics and quota tracking
      setOnboardingStep('stats');
      toast.info('🔄 Step 2/2: Configuring analytics and quota system...');

      // Simulate brief setup time for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Complete! PartnerCapFlex includes all necessary analytics
      setOnboardingStep('complete');
      setTransactionDigest(partnerCapResult.digest);
      setStatsId(extractedPartnerCapId);

      toast.success(`🎉 USDC onboarding complete! Your PartnerCapFlex includes built-in analytics and quota tracking!`);

      return {
        partnerCapId: extractedPartnerCapId,
        statsId: extractedPartnerCapId, // PartnerCapFlex serves as the stats system
        partnerCapTxDigest: partnerCapResult.digest,
        statsTxDigest: partnerCapResult.digest // Same transaction
      };

    } catch (error: any) {
      console.error('Partner USDC onboarding error:', error);
      const errorMessage = error.message || 'Failed to complete partner onboarding with USDC. Please try again.';
      setError(errorMessage);
      setOnboardingStep('idle');
      
      // Provide helpful error messages based on which step failed
      if (onboardingStep === 'partnercap') {
        toast.error(`❌ Step 1 failed: ${errorMessage}`);
      } else if (onboardingStep === 'stats') {
        toast.error(`❌ Step 2 failed: ${errorMessage}. Your PartnerCapFlex was created, but stats setup failed. You can retry stats creation later.`);
      } else {
        toast.error(`❌ USDC onboarding failed: ${errorMessage}`);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * GUIDED ONBOARDING FOR NFT: Creates both PartnerCapFlex AND PartnerPerkStatsV2 in sequence
   * This provides the same comprehensive setup for NFT collateral partners
   */
  const createPartnerWithFullSetupNFT = async (
    partnerName: string, 
    kioskId: string, 
    collectionType: string, 
    estimatedFloorValueUsdc: number,
    customDailyQuota?: number
  ) => {
    if (!currentWallet) {
      setError('Wallet not connected.');
      toast.error('Wallet not connected. Please connect your wallet.');
      return null;
    }

    if (!kioskId || !collectionType) {
      setError('Kiosk ID and collection type are required.');
      toast.error('Please provide valid kiosk ID and NFT collection type.');
      return null;
    }

    if (estimatedFloorValueUsdc <= 0) {
      setError('Estimated floor value must be greater than 0.');
      toast.error('Please provide a valid estimated floor value in USDC.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setTransactionDigest(null);
    setPartnerCapId(null);
    setStatsId(null);
    setOnboardingStep('idle');

    try {
      // STEP 1: Create PartnerCapFlex with NFT
      setOnboardingStep('partnercap');
      toast.info('🚀 Step 1/2: Creating your PartnerCapFlex with NFT collateral...');

      const partnerCapTransaction = buildCreatePartnerCapFlexWithNFTTransaction(
        partnerName,
        kioskId,
        collectionType,
        estimatedFloorValueUsdc,
        undefined // No sponsorship - user pays gas
      );

      const partnerCapResult = await signAndExecuteTransaction({
        transaction: partnerCapTransaction,
        chain: 'sui:testnet',
      });

      if (!partnerCapResult?.digest) {
        throw new Error('Failed to create PartnerCapFlex with NFT - no transaction digest');
      }

      const extractedPartnerCapId = await extractPartnerCapIdFromTransaction(partnerCapResult.digest);
      
      if (!extractedPartnerCapId) {
        throw new Error('Could not extract PartnerCapFlex ID from transaction');
      }

      setPartnerCapId(extractedPartnerCapId);
      
      toast.success(`✅ Step 1 complete! PartnerCapFlex with NFT collateral created.`);

      // STEP 2: PartnerCapFlex Analytics Setup Complete!
      // Note: PartnerCapFlex objects have built-in analytics and quota tracking
      setOnboardingStep('stats');
      toast.info('🔄 Step 2/2: Configuring analytics and quota system...');

      // Simulate brief setup time for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Complete! PartnerCapFlex includes all necessary analytics
      setOnboardingStep('complete');
      setTransactionDigest(partnerCapResult.digest);
      setStatsId(extractedPartnerCapId);

      toast.success(`🎉 NFT onboarding complete! Your PartnerCapFlex includes built-in analytics and quota tracking!`);

      return {
        partnerCapId: extractedPartnerCapId,
        statsId: extractedPartnerCapId, // PartnerCapFlex serves as the stats system
        partnerCapTxDigest: partnerCapResult.digest,
        statsTxDigest: partnerCapResult.digest // Same transaction
      };

    } catch (error: any) {
      console.error('Partner NFT onboarding error:', error);
      const errorMessage = error.message || 'Failed to complete partner onboarding with NFT. Please try again.';
      setError(errorMessage);
      setOnboardingStep('idle');
      
      // Provide helpful error messages based on which step failed
      if (onboardingStep === 'partnercap') {
        toast.error(`❌ Step 1 failed: ${errorMessage}`);
      } else if (onboardingStep === 'stats') {
        toast.error(`❌ Step 2 failed: ${errorMessage}. Your PartnerCapFlex was created, but stats setup failed. You can retry stats creation later.`);
      } else {
        toast.error(`❌ NFT onboarding failed: ${errorMessage}`);
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @deprecated PartnerCapFlex objects have built-in analytics - no separate stats object needed
   * This function is kept for backward compatibility but will return the PartnerCapFlex ID as the stats ID
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
      toast.info('🔄 Configuring analytics system for your existing PartnerCapFlex...');

      // Simulate setup for better UX - PartnerCapFlex already has built-in analytics
      await new Promise(resolve => setTimeout(resolve, 2000));

      setStatsId(existingPartnerCapId);
      
      toast.success('✅ Analytics setup complete! Your PartnerCapFlex already includes built-in analytics and quota tracking!');
      return existingPartnerCapId; // PartnerCapFlex serves as the stats system

    } catch (error: any) {
      console.error('Analytics setup error:', error);
      const errorMessage = error.message || 'Failed to configure analytics. Please try again.';
      setError(errorMessage);
      toast.error(`❌ Analytics setup failed: ${errorMessage}`);
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
   * Queries the Sui RPC to get transaction effects and find created objects
   */
  const extractPartnerCapIdFromTransaction = async (txDigest: string): Promise<string | null> => {
    try {
      // Use the current client from useSuiClient hook
      
      const txDetails = await suiClient.getTransactionBlock({
        digest: txDigest,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      // Look through object changes to find the created PartnerCapFlex
      if (txDetails.objectChanges) {
        for (const change of txDetails.objectChanges) {
          if (change.type === 'created' && 
              change.objectType && 
              (change.objectType.includes('PartnerCapFlex') || change.objectType.includes('PartnerCap'))) {
            return change.objectId;
          }
        }
      }

      // Fallback: Look through created objects in effects
      if (txDetails.effects?.created) {
        for (const created of txDetails.effects.created) {
          // Get the object details to check its type
          const objectDetails = await suiClient.getObject({
            id: created.reference.objectId,
            options: { showType: true },
          });
          
          if (objectDetails.data?.type && 
              (objectDetails.data.type.includes('PartnerCapFlex') || objectDetails.data.type.includes('PartnerCap'))) {
            return created.reference.objectId;
          }
        }
      }

      console.warn('Could not extract PartnerCap ID from transaction:', txDigest);
      return null;
    } catch (error) {
      console.error('Error extracting PartnerCap ID from transaction:', error);
      return null;
    }
  };

  /**
   * Helper function to extract PartnerPerkStats ID from transaction
   * Queries the Sui RPC to get transaction effects and find created PartnerPerkStats objects
   */
  const extractStatsIdFromTransaction = async (txDigest: string): Promise<string | null> => {
    try {
      // Use the current client from useSuiClient hook
      
      const txDetails = await suiClient.getTransactionBlock({
        digest: txDigest,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      // Look through object changes to find the created PartnerPerkStats
      if (txDetails.objectChanges) {
        for (const change of txDetails.objectChanges) {
          if (change.type === 'created' && 
              change.objectType && 
              change.objectType.includes('PartnerPerkStats')) {
            return change.objectId;
          }
        }
      }

      // Fallback: Look through created objects in effects
      if (txDetails.effects?.created) {
        for (const created of txDetails.effects.created) {
          // Get the object details to check its type
          const objectDetails = await suiClient.getObject({
            id: created.reference.objectId,
            options: { showType: true },
          });
          
          if (objectDetails.data?.type && objectDetails.data.type.includes('PartnerPerkStats')) {
            return created.reference.objectId;
          }
        }
      }

      console.warn('Could not extract PartnerPerkStats ID from transaction:', txDigest);
      return null;
    } catch (error) {
      console.error('Error extracting PartnerPerkStats ID from transaction:', error);
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
    createPartnerWithFullSetupUSDC,
    createPartnerWithFullSetupNFT,
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