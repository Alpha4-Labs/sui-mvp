import React, { useState } from 'react';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { toast } from 'react-toastify';
import { useAlphaContext, OrphanedStake } from '../context/AlphaContext';
import { buildUnstakeTransaction, buildRegisterStakeTransaction, buildEarlyUnstakeTransaction, buildSelfServiceMigrateStakeTransaction, buildSelfServiceBatchMigrateStakesTransaction, buildOldPackageUnstakeForSuiTransaction, buildOldPackageBatchUnstakeForSuiTransaction, getOldPackageSharedObjects } from '../utils/transaction';
import {
  getTransactionErrorMessage,
  getTransactionResponseError,
} from '../utils/transaction-adapter';
import { formatSui, formatAddress, formatDuration, formatTimestamp } from '../utils/format';
import { StakePosition } from '../types';

// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules'; // Import Swiper core and required modules

// Import Swiper styles
// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/navigation';
// @ts-ignore
import 'swiper/css/pagination';

// Import SuiClient type for old package detection
import { SuiClient } from '@mysten/sui/client';

// Old package constants for detection and migration
const OLD_PACKAGE_ID = '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf';
const OLD_ADMIN_CAP_ID = '0x27e8bf2681b5b0fc0d497bdf114da1a79cb54944aa0e24867ea8c69307bb024a';

// Additional old package IDs that need migration (discovered from user data)
// NOTE: Only include packages that are UNRELATED to the current package ancestry
// NOTE: Don't duplicate OLD_PACKAGE_ID here since it's already included in ALL_OLD_PACKAGE_IDS
const ADDITIONAL_OLD_PACKAGE_IDS = [
  '0xbae3eef628211af44c386e621142118bdee8825b059e0514bf3729638109cd3a', // Earlier package used by users - UNRELATED to ancestry
  // '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf' // This is already OLD_PACKAGE_ID, don't duplicate
  // '0xfd761a2a5979db53f7f3176c0778695f6abafbb7c0eec8ce03136ae10dc2b47d' // REMOVED: This is in the package ancestry, not an unrelated old package
];

// All old packages to check for migration
const ALL_OLD_PACKAGE_IDS = [OLD_PACKAGE_ID, ...ADDITIONAL_OLD_PACKAGE_IDS];

// --- Icons for Carousel Navigation (simple SVGs) ---
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// --- New imports needed for ZK Login flow in the new handler ---
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair, Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { 
    getZkLoginSignature, 
    ZkLoginSignatureInputs as ActualZkLoginSignatureInputs,
} from '@mysten/sui/zklogin'; 
import { SuiTransactionBlockResponse } from '@mysten/sui/client'; 
// Assuming EnokiZkpResponse and related types are defined as in StakeCard.tsx or a shared util
interface ZkProofPoints { a: string[]; b: string[][]; c: string[]; }
interface IssBase64DetailsClaim { value: string; indexMod4: number; }
interface EnokiZkpData { proofPoints: ZkProofPoints; issBase64Details: IssBase64DetailsClaim; headerBase64: string; addressSeed: string; }
interface EnokiZkpResponse { data: EnokiZkpData; }
// --- End of new imports ---

// --- Define a combined type for Swiper items ---
interface SwiperStakeItem extends Omit<StakePosition, 'id'> { 
  id: string; 
  isOrphaned: false;
}

interface SwiperOrphanedItem extends OrphanedStake {
  id: string; // Use stakedSuiObjectId as id for keying
  isOrphaned: true;
  principal: string; // Derived from OrphanedStake.principalAmount for consistency
  // durationDays is already number in OrphanedStake
  // calculatedUnlockDate?: string; // Will be N/A or calculated differently if needed
  // maturityPercentage?: number; // N/A for orphaned
  // encumbered?: boolean; // Always false for orphaned in this context
  // apy?: number; // N/A for orphaned from protocol POV
}

type CombinedStakeListItem = SwiperStakeItem | SwiperOrphanedItem;
// --- End of combined type ---

export const StakedPositionsList: React.FC = () => {
  const { 
    stakePositions, 
    loans,
    loading, 
    refreshData, 
    refreshLoansData,
    setTransactionLoading,
    orphanedStakes = [], 
    removeOrphanedStake = (id: string) => {},
    address: alphaAddress, 
    isConnected: alphaIsConnected, 
    provider: alphaProvider, 
    suiClient, 
    selectedDuration, 
    version
  } = useAlphaContext();

  const [unstakeInProgress, setUnstakeInProgress] = useState<string | null>(null);
  const [earlyUnstakeInProgress, setEarlyUnstakeInProgress] = useState<string | null>(null);
  const [registrationInProgress, setRegistrationInProgress] = useState<string | null>(null);
  const [migrationInProgress, setMigrationInProgress] = useState<boolean>(false);
  const [oldPackageStakes, setOldPackageStakes] = useState<any[]>([]);
  const [hasOldPackageStakes, setHasOldPackageStakes] = useState<boolean>(false);
  const [checkingOldPackage, setCheckingOldPackage] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [swiperInstance, setSwiperInstance] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Prevent duplicate toasts from React StrictMode
  const [lastToastTime, setLastToastTime] = useState<Record<string, number>>({});

  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Helper function to prevent duplicate toasts (caused by React StrictMode)
  const showToastOnce = (key: string, toastFn: () => void, timeoutMs: number = 3000) => {
    const now = Date.now();
    const lastTime = lastToastTime[key] || 0;
    
    if (now - lastTime > timeoutMs) {
      setLastToastTime(prev => ({ ...prev, [key]: now }));
      toastFn();
    }
  };

  // Helper function to extract original ID from prefixed display ID
  const extractOriginalId = (displayId: string): string => {
    if (displayId.startsWith('orphaned-')) {
      return displayId.replace('orphaned-', '');
    }
    if (displayId.startsWith('stake-')) {
      return displayId.replace('stake-', '');
    }
    return displayId;
  };

  // Helper function to check if an encumbered stake is loan collateral vs early withdrawn
  const hasAssociatedLoan = (stakeId: string): boolean => {
    const originalId = extractOriginalId(stakeId);
    return loans.some(loan => loan.stakeId === originalId);
  };

  // Check for old package stakes on mount and when address changes
  React.useEffect(() => {
    if (alphaIsConnected && alphaAddress && suiClient) {
      console.log('🔍 Wallet connected, checking for old package stakes...');
      checkForOldPackageStakes();
    }
  }, [alphaIsConnected, alphaAddress, suiClient]);

  // Debug current stakes loading
  React.useEffect(() => {
    const currentPackageId = import.meta.env['VITE_PACKAGE_ID'];
    console.log('📊 StakedPositionsList - Data state update:');
    console.log(`   - Connected: ${alphaIsConnected}`);
    console.log(`   - Address: ${alphaAddress}`);
    console.log(`   - Current Package ID: ${currentPackageId}`);
    console.log(`   - Old Package IDs: ${ALL_OLD_PACKAGE_IDS.map(id => id.substring(0, 10) + '...').join(', ')}`);
    console.log(`   - Current stakes: ${stakePositions.length}`);
    console.log(`   - Orphaned stakes: ${orphanedStakes.length}`);
    console.log(`   - Loading: ${JSON.stringify(loading)}`);
    
    if (alphaIsConnected && alphaAddress && stakePositions.length === 0 && !loading.positions) {
      console.log('⚠️ User is connected but has no current stakes and not loading - this might indicate a data fetching issue');
      console.log(`💡 Current package being queried for stakes: ${currentPackageId}`);
      console.log(`💡 Verify this wallet has stakes in the current package, not the old ones`);
    }
  }, [alphaIsConnected, alphaAddress, stakePositions, orphanedStakes, loading]);

  // Load loans data when component mounts to help distinguish loan collateral from early unstake
  React.useEffect(() => {
    if (alphaIsConnected && alphaAddress) {
      refreshLoansData();
    }
  }, [alphaIsConnected, alphaAddress, refreshLoansData]);

  /**
   * Detects if the user has stakes in any of the old packages
   */
  const checkForOldPackageStakes = async () => {
    if (!alphaAddress || !suiClient) return;

    setCheckingOldPackage(true);
    console.log(`🔍 Checking for old package stakes for address: ${alphaAddress}`);
    console.log(`📦 Checking ${ALL_OLD_PACKAGE_IDS.length} old packages:`, ALL_OLD_PACKAGE_IDS);
    
    try {
      let allOldStakes: any[] = [];
      
      // Check each old package for stakes
      for (const packageId of ALL_OLD_PACKAGE_IDS) {
        console.log(`🔍 Checking package: ${packageId}`);
        
        try {
          const response = await (suiClient as SuiClient).getOwnedObjects({
            owner: alphaAddress,
            filter: {
              StructType: `${packageId}::stake_position::StakePosition`
            },
            options: {
              showContent: true,
              showType: true
            }
          });

          console.log(`📋 Package ${packageId.substring(0, 10)}... response:`, {
            total: response.data.length,
            hasMore: response.hasNextPage,
            nextCursor: response.nextCursor
          });

          const packageStakes = response.data.filter(obj => 
            obj.data?.content && 
            'fields' in obj.data.content
          ).map(obj => ({
            objectId: obj.data?.objectId,
            content: obj.data?.content,
            packageId: packageId // Track which package this stake is from
          }));

          if (packageStakes.length > 0) {
            console.log(`✅ Found ${packageStakes.length} stakes in package ${packageId.substring(0, 10)}...`);
            allOldStakes.push(...packageStakes);
          }
        } catch (packageError) {
          console.warn(`⚠️ Error checking package ${packageId}:`, packageError);
          // Continue checking other packages
        }
      }

      console.log(`🎯 Total old stakes found across all packages: ${allOldStakes.length}`);
      
      if (allOldStakes.length > 0) {
        console.log(`🏛️ Old package stakes summary:`, allOldStakes.map(stake => ({
          objectId: stake.objectId,
          packageId: stake.packageId.substring(0, 10) + '...',
          contentType: stake.content && 'type' in stake.content ? stake.content.type : 'unknown',
          fields: stake.content && 'fields' in stake.content ? Object.keys(stake.content.fields) : []
        })));
      }

      setOldPackageStakes(allOldStakes);
      setHasOldPackageStakes(allOldStakes.length > 0);

      if (allOldStakes.length > 0) {
        console.log(`🎯 Found ${allOldStakes.length} total stakes across old packages for migration`);
      } else {
        console.log(`❌ No stakes found in any old packages`);
        console.log(`💡 Checked packages:`, ALL_OLD_PACKAGE_IDS.map(id => id.substring(0, 10) + '...'));
        console.log(`💡 If you expect to have old stakes, verify your wallet address: ${alphaAddress}`);
      }
    } catch (error) {
      console.error('❌ Error checking for old package stakes:', error);
      // Also try to query all objects to see what this user has
      try {
        console.log(`🔍 Attempting to query all owned objects for debugging...`);
        const allObjects = await (suiClient as SuiClient).getOwnedObjects({
          owner: alphaAddress,
          options: {
            showType: true
          }
        });
        console.log(`📊 User owns ${allObjects.data.length} total objects`);
        
        const stakeRelatedObjects = allObjects.data.filter(obj => 
          obj.data?.type?.includes('stake') || 
          obj.data?.type?.includes('Stake')
        );
        console.log(`🎯 Found ${stakeRelatedObjects.length} stake-related objects:`, 
          stakeRelatedObjects.map(obj => ({
            objectId: obj.data?.objectId,
            type: obj.data?.type
          }))
        );
      } catch (debugError) {
        console.error('❌ Debug query also failed:', debugError);
      }
    } finally {
      setCheckingOldPackage(false);
    }
  };

  /**
   * OPTION 1: Handles migration by calling old package's request_unstake_native_sui directly
   * This allows users to get their actual SUI back from validators instead of just Alpha Points
   * Falls back to Option 2 (Alpha Points) if Option 1 fails
   */
  const handleSelfServeMigration = async () => {
    if (!alphaAddress || !suiClient || oldPackageStakes.length === 0) {
      toast.error('No old package stakes found to migrate');
      return;
    }

    setMigrationInProgress(true);
    setTransactionLoading(true);

    try {
      // Group stakes by package ID since migration functions need to be called per package
      const stakesByPackage = oldPackageStakes.reduce((acc, stake) => {
        const packageId = stake.packageId || OLD_PACKAGE_ID; // Fallback to original package
        if (!acc[packageId]) {
          acc[packageId] = [];
        }
        acc[packageId].push(stake);
        return acc;
      }, {} as Record<string, any[]>);

      console.log(`🔄 Migrating stakes from ${Object.keys(stakesByPackage).length} packages:`, 
        Object.keys(stakesByPackage).map(id => `${id.substring(0, 10)}... (${stakesByPackage[id].length} stakes)`));

      let totalMigrated = 0;
      let suiReclaimed = 0;
      let alphaPointsAwarded = 0;
      const results: string[] = [];

      // Process each package separately
      for (const [packageId, stakes] of Object.entries(stakesByPackage)) {
        const packageStakes = stakes as any[]; // Type assertion since we know the structure
        console.log(`🔄 Processing ${packageStakes.length} stakes from package ${packageId.substring(0, 10)}...`);

        // Get old package shared objects
        const oldSharedObjects = getOldPackageSharedObjects(packageId);
        
        try {
          // OPTION 1: Try to call old package's request_unstake_native_sui directly
          console.log(`🎯 OPTION 1: Attempting to reclaim SUI from validators for package ${packageId.substring(0, 10)}...`);
          
          let transaction;
          if (packageStakes.length > 1) {
            // Batch unstake for SUI
            const stakeObjectIds = packageStakes.map(stake => stake.objectId).filter(Boolean);
            
            if (stakeObjectIds.length === 0) {
              console.warn(`⚠️ No valid stake object IDs found for package ${packageId}`);
              continue;
            }

            transaction = buildOldPackageBatchUnstakeForSuiTransaction(
              stakeObjectIds,
              packageId,
              oldSharedObjects
            );
          } else {
            // Single stake unstake for SUI
            const stake = packageStakes[0];
            
            if (!stake.objectId) {
              console.warn(`⚠️ Invalid stake object ID for package ${packageId}`);
              continue;
            }

            transaction = buildOldPackageUnstakeForSuiTransaction(
              stake.objectId,
              packageId,
              oldSharedObjects
            );
          }

          const result = await signAndExecute({ transaction });
          
          if (!result || typeof result !== 'object' || !('digest' in result)) {
            throw new Error(`Transaction returned an unexpected response format for package ${packageId}`);
          }
          
          const responseError = getTransactionResponseError(result);
          if (responseError) {
            throw new Error(`Option 1 failed for package ${packageId}: ${responseError}`);
          }

          console.log(`✅ OPTION 1 SUCCESS: SUI withdrawal initiated for ${packageStakes.length} stakes from package ${packageId.substring(0, 10)}...: ${result.digest}`);
          totalMigrated += packageStakes.length;
          suiReclaimed += packageStakes.length;
          results.push(result.digest);
          
        } catch (option1Error) {
          console.warn(`⚠️ OPTION 1 failed for package ${packageId}:`, option1Error);
          console.log(`🔄 OPTION 2: Falling back to Alpha Points migration for package ${packageId.substring(0, 10)}...`);
          
          try {
            // OPTION 2: Fallback to Alpha Points migration
            let fallbackTransaction;
            if (packageStakes.length > 1) {
              // Batch migration for Alpha Points
              const stakeObjectIds = packageStakes.map(stake => stake.objectId).filter(Boolean);
              
              fallbackTransaction = buildSelfServiceBatchMigrateStakesTransaction(
                stakeObjectIds,
                packageId
              );
            } else {
              // Single stake migration for Alpha Points
              const stake = packageStakes[0];
              
              fallbackTransaction = buildSelfServiceMigrateStakeTransaction(
                stake.objectId,
                packageId
              );
            }

            const fallbackResult = await signAndExecute({ transaction: fallbackTransaction });
            
            if (!fallbackResult || typeof fallbackResult !== 'object' || !('digest' in fallbackResult)) {
              throw new Error(`Fallback transaction returned an unexpected response format for package ${packageId}`);
            }
            
            const fallbackResponseError = getTransactionResponseError(fallbackResult);
            if (fallbackResponseError) {
              throw new Error(`Option 2 fallback failed for package ${packageId}: ${fallbackResponseError}`);
            }

            console.log(`✅ OPTION 2 SUCCESS: Alpha Points awarded for ${packageStakes.length} stakes from package ${packageId.substring(0, 10)}...: ${fallbackResult.digest}`);
            totalMigrated += packageStakes.length;
            alphaPointsAwarded += packageStakes.length;
            results.push(fallbackResult.digest);
            
          } catch (option2Error) {
            console.error(`❌ Both Option 1 and Option 2 failed for package ${packageId}:`, option2Error);
            throw new Error(`All migration options failed for package ${packageId}: ${option2Error}`);
          }
        }
      }

      if (totalMigrated > 0) {
        let successMessage = `Migration successful! ${totalMigrated} stakes migrated from ${Object.keys(stakesByPackage).length} packages. `;
        
        if (suiReclaimed > 0) {
          successMessage += `${suiReclaimed} stakes: SUI withdrawal tickets received (claim from validators). `;
        }
        if (alphaPointsAwarded > 0) {
          successMessage += `${alphaPointsAwarded} stakes: Alpha Points awarded. `;
        }
        
        successMessage += `Digests: ${results.map(d => d.substring(0, 8)).join(', ')}...`;
        
        toast.success(successMessage);
      } else {
        throw new Error('No stakes were successfully migrated');
      }
      
      // Clear old package stakes and refresh data
      setOldPackageStakes([]);
      setHasOldPackageStakes(false);
      
      setTimeout(() => {
        refreshData();
      }, 2000);

    } catch (error) {
      console.error('Error during self-serve migration:', error);
      const friendlyErrorMessage = getTransactionErrorMessage(error);
      
      // Prevent duplicate error toasts
      showToastOnce(`migration-error-${Date.now()}`, () => {
        toast.error(`Migration failed: ${friendlyErrorMessage}`);
      });
    } finally {
      setMigrationInProgress(false);
      setTransactionLoading(false);
    }
  };

  // Consolidate loading state to prevent flickering
  const isLoading = loading.positions || loading.allUserStakes;

  /**
   * Gets a properly formatted unlock date from a stake position
   * Uses the calculatedUnlockDate field which is now derived directly from unlockTimeMs
   */
  const getUnlockDate = (position: any): Date | null => {
    if (position.calculatedUnlockDate) { // This field should now be reliable
      try {
        return new Date(position.calculatedUnlockDate);
      } catch (e) {
        console.warn("Invalid calculatedUnlockDate format:", position.calculatedUnlockDate, e);
      }
    }
    // Removed epoch fallback as it's no longer relevant
    return null;
  };

  /**
   * Handles unstaking a position
   * Updated to use the new Transaction API
   * @param stakeId The ID of the stake position to unstake
   * @param principal The principal amount of the stake (for feedback)
   */
  const handleUnstake = async (stakeId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setUnstakeInProgress(stakeId);
    setTransactionLoading(true);

    try {
      const transaction = buildUnstakeTransaction(stakeId);
      const result = await signAndExecute({ transaction });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      // Prevent duplicate toasts
      showToastOnce(`unstake-${stakeId}-${txDigest}`, () => {
        toast.success(`Successfully unstaked ${formatSui(principal)} SUI! Digest: ${txDigest.substring(0, 10)}...`);
      });
      
      setTimeout(() => {
        refreshData();
      }, 2000);

    } catch (err: any) {
      console.error('Error unstaking position:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      
      // Prevent duplicate error toasts
      showToastOnce(`unstake-error-${stakeId}`, () => {
        toast.error(friendlyErrorMessage);
      });
    } finally {
      setTransactionLoading(false);
      setUnstakeInProgress(null);
    }
  };

  /**
   * Handles early unstaking a position for Alpha Points
   * User receives 100% Alpha Points value (1 SUI = 3,280 αP) immediately
   * Stake remains encumbered until maturity for security
   * @param stakeId The ID of the stake position to early unstake
   * @param principal The principal amount of the stake (for feedback)
   */
  const handleEarlyUnstake = async (stakeId: string, principal: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEarlyUnstakeInProgress(stakeId);
    setTransactionLoading(true);

    try {
      const transaction = buildEarlyUnstakeTransaction(stakeId);
      const result = await signAndExecute({ transaction });
      
      if (!result || typeof result !== 'object' || !('digest' in result)) {
        throw new Error('Transaction returned an unexpected response format');
      }
      
      const txDigest = result.digest;
      const responseError = getTransactionResponseError(result);
      if (responseError) {
        throw new Error(responseError);
      }

      // Calculate expected Alpha Points (1 SUI = 3,280 αP, minus 0.1% fee)
      const principalNum = parseInt(principal, 10);
      const principalSui = principalNum / 1_000_000_000;
      const expectedAlphaPoints = Math.floor(principalSui * 3280 * 0.999); // 99.9% after 0.1% fee

      // Prevent duplicate toasts caused by React StrictMode
      showToastOnce(`early-unstake-${stakeId}-${txDigest}`, () => {
        toast.success(
          `Early unstake successful! Received ~${expectedAlphaPoints.toLocaleString()} Alpha Points. ` +
          `Stake remains locked until maturity. Digest: ${txDigest.substring(0, 10)}...`
        );
      });
      
      setTimeout(() => {
        refreshData();
      }, 2000);

    } catch (err: any) {
      console.error('Error early unstaking position:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      
      // Prevent duplicate error toasts
      showToastOnce(`early-unstake-error-${stakeId}`, () => {
        toast.error(`Early unstake failed: ${friendlyErrorMessage}`);
      });
    } finally {
      setTransactionLoading(false);
      setEarlyUnstakeInProgress(null);
    }
  };

  // Helper for Estimated Rewards Calculation
  // FIXED: Uses correct 1:1000 USD ratio for Alpha Points calculation
  const calculateEstAlphaPointRewards = (principal?: string, durationDaysStr?: string, positionApy?: number): string => {
    if (!principal || !durationDaysStr || typeof positionApy === 'undefined') return '~0 αP (0 αP/epoch)';
    try {
      const principalNum = parseInt(principal, 10); // This is MIST
      const durationDays = parseInt(durationDaysStr, 10);
      const principalSui = principalNum / 1_000_000_000; // Convert MIST to SUI

      if (isNaN(principalSui) || isNaN(durationDays) || durationDays <= 0) return '~0 αP (0 αP/epoch)';

      // FIXED: Use correct 1:1000 ratio (1 USD = 1000 Alpha Points)
      const SUI_PRICE_USD = 3.28; // Current SUI price
      const ALPHA_POINTS_PER_USD = 1000; // Fixed ratio
      const ALPHA_POINTS_PER_SUI = SUI_PRICE_USD * ALPHA_POINTS_PER_USD; // 3,280 AP per SUI
      const DAYS_PER_YEAR = 365;
      const EPOCHS_PER_DAY = 1; // Sui Testnet epochs are 24 hours

      // Calculate daily Alpha Points rewards based on APY
      const dailyAlphaPointsRewards = (principalSui * ALPHA_POINTS_PER_SUI * (positionApy / 100)) / DAYS_PER_YEAR;
      const totalAlphaPointsRewards = dailyAlphaPointsRewards * durationDays;

      const formattedTotalAlphaPoints = totalAlphaPointsRewards.toLocaleString(undefined, {maximumFractionDigits: 0});
      const formattedAlphaPointsPerEpoch = dailyAlphaPointsRewards.toLocaleString(undefined, {maximumFractionDigits: 0});

      return `~${formattedTotalAlphaPoints} αP (${formattedAlphaPointsPerEpoch} αP/epoch)`;
    } catch {
      return '~0 αP (0 αP/epoch)';
    }
  };

  // --- New Handler for Completing Registration of Orphaned Stakes ---
  const handleCompleteRegistration = async (stakedSuiObjectId: string, durationDays: number, principalDisplay?: string) => {
    if (!alphaIsConnected || !alphaAddress) {
      toast.error("Please connect wallet or sign in.");
      return;
    }
    if (registrationInProgress) return; // Prevent multiple simultaneous registrations

    setErrorMessage(null);
    setSuccessMessage(null);
    setRegistrationInProgress(stakedSuiObjectId);
    setTransactionLoading(true);
    let txDigest: string | null = null;

    try {
      const tx = buildRegisterStakeTransaction(stakedSuiObjectId, durationDays);

      if (alphaProvider === 'google') {
        tx.setSender(alphaAddress);
        
        const jwt = localStorage.getItem('zkLogin_jwt');
        const secretKeySeedString = localStorage.getItem('zkLogin_ephemeralSecretKeySeed');
        const maxEpochString = localStorage.getItem('zkLogin_maxEpoch');
        const randomnessString = localStorage.getItem('zkLogin_randomness');
        const publicKeyBytesString = localStorage.getItem('zkLogin_ephemeralPublicKeyBytes');

        if (!jwt || !secretKeySeedString || !maxEpochString || !randomnessString || !publicKeyBytesString) {
          throw new Error("Missing required zkLogin data from localStorage for registration.");
        }

        const secretKeySeed = Uint8Array.from(JSON.parse(secretKeySeedString));
        const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeySeed.slice(0, 32));
        const maxEpoch = parseInt(maxEpochString, 10);
        const randomness = randomnessString;
        const publicKeyBytes = Uint8Array.from(JSON.parse(publicKeyBytesString));
        const ephemeralPublicKey = new Ed25519PublicKey(publicKeyBytes);
        const extendedEphemeralPublicKeyString = ephemeralPublicKey.toSuiPublicKey();
        
        const fullTxBytes = await tx.build({ client: suiClient as unknown as SuiClient });
        const { signature: userSignature } = await ephemeralKeypair.signTransaction(fullTxBytes);

        // Note: Simplified implementation without Enoki ZKP service
        // Using direct zkLogin signature construction
        const zkLoginInputs: ActualZkLoginSignatureInputs = {
           proofPoints: {
             a: ["0", "0", "0"],
             b: [["0", "0"], ["0", "0"], ["0", "0"]],
             c: ["0", "0", "0"]
           },
           issBase64Details: { value: "test", indexMod4: 0 },
           headerBase64: "",
           addressSeed: localStorage.getItem('zkLogin_userSalt_from_enoki') || '',
        };

        const actualZkLoginSignature = getZkLoginSignature({ inputs: zkLoginInputs, maxEpoch, userSignature });

        const result = await suiClient.executeTransactionBlock({ 
          transactionBlock: fullTxBytes,
          signature: actualZkLoginSignature,
          options: { showEffects: true, showObjectChanges: true }
        });
        txDigest = result.digest;

      } else if (alphaProvider === 'dapp-kit') {
        const signResult = await signAndExecute({ transaction: tx });
        
        if (!signResult || typeof signResult !== 'object' || !('digest' in signResult)) {
           throw new Error('Transaction returned an unexpected response format from dapp-kit.');
        }
        txDigest = signResult.digest;

        let confirmedTx: SuiTransactionBlockResponse | null = null;
        let attempts = 0;
        const maxAttempts = 5;
        const delayMs = 1000;

        while (attempts < maxAttempts) {
          try {
            confirmedTx = await suiClient.getTransactionBlock({
                digest: txDigest,
                options: { showEffects: true }
            });
            if (confirmedTx) break; // Exit loop if transaction found
          } catch (e: any) {
            if (e.message && e.message.includes('Could not find the referenced transaction')) {
              attempts++;
              if (attempts >= maxAttempts) {
                console.error(`Failed to confirm transaction ${txDigest} after ${maxAttempts} attempts.`);
                throw e; // Re-throw the error if max attempts reached
              }
              await new Promise(resolve => setTimeout(resolve, delayMs)); // Wait before retrying
            } else {
              throw e; // Re-throw other errors immediately
            }
          }
        }

        if (!confirmedTx) {
          throw new Error(`Transaction ${txDigest} could not be confirmed after ${maxAttempts} attempts.`);
        }
        
        const responseError = getTransactionResponseError(confirmedTx);
        if (responseError) throw new Error(responseError);
      } else {
        throw new Error("Unknown provider for transaction execution.");
      }
      
      toast.success(`Successfully registered stake${principalDisplay ? ' for ' + formatSui(principalDisplay) : ''} SUI! Digest: ${txDigest?.substring(0, 10)}...`);
      removeOrphanedStake(stakedSuiObjectId); // Remove from context/local state
      refreshData(); // Refresh all data, including stakePositions

    } catch (err: any) {
      console.error('Error completing stake registration:', err);
      const friendlyErrorMessage = getTransactionErrorMessage(err);
      toast.error(`Registration failed: ${friendlyErrorMessage}`);
      setErrorMessage(friendlyErrorMessage); // Set local error for display if needed
    } finally {
      setTransactionLoading(false);
      setRegistrationInProgress(null);
    }
  };
  // --- End of New Handler ---

  // --- Prepare combined data for Swiper with better memoization ---
  const combinedListItems = React.useMemo((): CombinedStakeListItem[] => {
    // Only compute if not loading to prevent premature renders
    if (isLoading) return [];

    console.log('🔄 Combining stake data for display:');
    console.log(`   - Current stakes (stakePositions): ${stakePositions.length}`);
    console.log(`   - Orphaned stakes: ${orphanedStakes.length}`);
    console.log(`   - Loading state: ${JSON.stringify(loading)}`);
    
    if (stakePositions.length > 0) {
      console.log('📋 Current stakes details:', stakePositions.map(pos => ({
        id: pos.id,
        principal: pos.principal,
        durationDays: pos.durationDays
      })));
    }
    
    if (orphanedStakes.length > 0) {
      console.log('🏚️ Orphaned stakes details:', orphanedStakes.map(orphan => ({
        stakedSuiObjectId: orphan.stakedSuiObjectId,
        principalAmount: orphan.principalAmount,
        durationDays: orphan.durationDays
      })));
    }

    const orphanedAsSwiperItems: SwiperOrphanedItem[] = orphanedStakes.map((orphan, index) => ({
      ...orphan,
      id: `orphaned-${orphan.stakedSuiObjectId || index}`, // Ensure unique ID
      isOrphaned: true,
      principal: orphan.principalAmount || '0', 
    }));

    const registeredAsSwiperItems: SwiperStakeItem[] = stakePositions.map((pos, index) => ({
      ...pos,
      id: `stake-${pos.id || index}`, // Ensure unique ID
      isOrphaned: false,
    }));
    
    const combined = [...orphanedAsSwiperItems, ...registeredAsSwiperItems];
    console.log(`✅ Combined ${combined.length} total items for display`);
    
    return combined;
  }, [orphanedStakes, stakePositions, isLoading, loading]);
  // --- End Prepare combined data ---

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="card-modern p-6 animate-fade-in">
        {/* Header skeleton - match exact structure */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
              <div className="w-5 h-5 bg-white/30 rounded"></div>
            </div>
            <div>
              <div className="h-5 bg-gray-700/50 rounded w-36 mb-2"></div>
              <div className="h-3 bg-gray-700/30 rounded w-28"></div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="status-indicator-active"></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
        
        <div>
          {/* Content skeleton */}
          <div className="bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-700/50 animate-pulse"></div>
                <div className="h-4 bg-gray-700/50 rounded w-32"></div>
              </div>
              <div className="h-5 bg-gray-700/50 rounded w-20"></div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <div className="h-3 bg-gray-700/50 rounded w-16"></div>
                <div className="h-3 bg-gray-700/50 rounded w-20"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 bg-gray-700/50 rounded w-14"></div>
                <div className="h-3 bg-gray-700/50 rounded w-24"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 bg-gray-700/50 rounded w-20"></div>
                <div className="h-3 bg-gray-700/50 rounded w-28"></div>
              </div>
            </div>
            
            <div className="mt-auto">
              <div className="h-10 bg-gray-700/50 rounded-lg w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Full JSX ---
  return (
    <div className="card-modern p-4 animate-fade-in relative z-[40]">
      {/* Header - modernized */}
              <div className="flex items-center justify-between mb-4 relative z-[41]">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Staked Positions</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">Your active stakes</p>
              {checkingOldPackage && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-yellow-400 font-medium">
                    Checking for legacy stakes...
                  </span>
                </div>
              )}
              {hasOldPackageStakes && !checkingOldPackage && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-400 font-medium">
                    {oldPackageStakes.length} legacy stake{oldPackageStakes.length !== 1 ? 's' : ''} ready
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls Container */}
        <div className="flex items-center gap-3 relative z-[42]">
          {hasOldPackageStakes && (
            <button
              onClick={handleSelfServeMigration}
              disabled={migrationInProgress || loading.transaction || checkingOldPackage}
              className="px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-500 hover:to-purple-600 text-white text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-blue-500/25"
              title={`Migrate ${oldPackageStakes.length} stake${oldPackageStakes.length !== 1 ? 's' : ''} - Get SUI back from validators (preferred) or Alpha Points (fallback)`}
            >
              {migrationInProgress ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Migrating...
                </>
              ) : checkingOldPackage ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                  </svg>
                  Reclaim SUI ({oldPackageStakes.length})
                </>
              )}
            </button>
          )}
          

        </div>

        {/* Inline Navigation */}
        {combinedListItems.length > 1 && (
          <div className="flex items-center gap-1 relative z-[43]">
            <button
              className="p-1.5 rounded-lg bg-black/20 backdrop-blur-lg border border-white/10 hover:bg-black/30 hover:border-white/20 text-white transition-all duration-300 relative z-[44]"
              aria-label="Previous slide"
              onClick={() => swiperInstance?.slidePrev()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            
            <div className="flex gap-1 mx-1 relative z-[44]">
              {(() => {
                const totalPages = combinedListItems.length;
                const maxVisible = 3;
                
                if (totalPages <= maxVisible) {
                  // Show all pages if 3 or fewer
                  return combinedListItems.map((_, idx) => (
                    <button
                      key={idx}
                      className={`w-6 h-6 flex items-center justify-center rounded text-xs font-semibold transition-all duration-300 relative z-[45]
                        ${activeIndex === idx 
                          ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25' 
                          : 'bg-black/20 backdrop-blur-lg border border-white/10 text-gray-300 hover:bg-black/30 hover:border-white/20'
                        }`}
                      onClick={() => {
                        if (swiperInstance) {
                          if (combinedListItems.length >= 3) {
                            swiperInstance.slideToLoop(idx);
                          } else {
                            swiperInstance.slideTo(idx);
                          }
                        }
                      }}
                      aria-label={`Go to slide ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  ));
                } else {
                  // Show truncated pagination for more than 3 pages
                  const pages = [];
                  
                  if (activeIndex === 0) {
                    // Show: [1] 2 3 ...
                    pages.push(0, 1, 2);
                  } else if (activeIndex === totalPages - 1) {
                    // Show: ... n-2 n-1 [n]
                    pages.push(totalPages - 3, totalPages - 2, totalPages - 1);
                  } else {
                    // Show: ... [current-1] current [current+1] ...
                    pages.push(activeIndex - 1, activeIndex, activeIndex + 1);
                  }
                  
                  return (
                    <>
                      {activeIndex > 1 && (
                        <span className="text-xs text-gray-400 px-1">...</span>
                      )}
                      {pages.map(idx => (
                        <button
                          key={idx}
                          className={`w-6 h-6 flex items-center justify-center rounded text-xs font-semibold transition-all duration-300 relative z-[45]
                            ${activeIndex === idx 
                              ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25' 
                              : 'bg-black/20 backdrop-blur-lg border border-white/10 text-gray-300 hover:bg-black/30 hover:border-white/20'
                            }`}
                          onClick={() => {
                            if (swiperInstance) {
                              if (combinedListItems.length >= 3) {
                                swiperInstance.slideToLoop(idx);
                              } else {
                                swiperInstance.slideTo(idx);
                              }
                            }
                          }}
                          aria-label={`Go to slide ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                      {activeIndex < totalPages - 2 && (
                        <span className="text-xs text-gray-400 px-1">...</span>
                      )}
                    </>
                  );
                }
              })()}
            </div>
            
            <button
              className="p-1.5 rounded-lg bg-black/20 backdrop-blur-lg border border-white/10 hover:bg-black/30 hover:border-white/20 text-white transition-all duration-300 relative z-[44]"
              aria-label="Next slide"
              onClick={() => swiperInstance?.slideNext()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div>
        {/* Conditional Rendering: Empty State vs. List */}
        {combinedListItems.length === 0 && !isLoading ? (
          // --- Empty State ---
          <div className="text-center py-8 bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl flex items-center justify-center mb-3 shadow-lg">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <h3 className="text-base font-medium text-white mb-1">No Staked Positions</h3>
            <p className="text-sm text-gray-400 mb-1">Ready to start earning?</p>
            <p className="text-xs text-gray-500">Use the 'Manage Stake' section to create your first position</p>
          </div>
        ) : combinedListItems.length > 0 ? (
          // --- List of Combined Staked Positions (Swiper) ---
          <div className="relative z-[30]">
            <Swiper
              modules={[Navigation, Pagination, A11y]}
              spaceBetween={20}
              slidesPerView={1}
              loop={combinedListItems.length > 1 && combinedListItems.length >= 3}
              onSwiper={setSwiperInstance}
              onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
              pagination={false} 
              navigation={false} 
              className="h-full min-h-0"
            >
              {combinedListItems.map((item) => {
                const isOrphaned = item.isOrphaned;
                const displayId = item.id;

                // Adapt data for rendering based on type
                const principalDisplay = item.principal;
                const durationDaysDisplay = isOrphaned ? (item as SwiperOrphanedItem).durationDays : parseInt((item as SwiperStakeItem).durationDays || '0', 10);
                const unlockDate = !isOrphaned ? getUnlockDate(item as SwiperStakeItem) : null;
                const formattedUnlockDate = unlockDate ? formatTimestamp(unlockDate) : 'N/A';
                
                const maturityPercentage = !isOrphaned ? Math.max(0, Math.min(100, (item as SwiperStakeItem).maturityPercentage || 0)) : 0;
                const isMature = !isOrphaned && maturityPercentage >= 100;
                const isEncumbered = !isOrphaned && (item as SwiperStakeItem).encumbered;
                
                // Check if encumbered stake is loan collateral vs early withdrawn
                const isLoanCollateral = isEncumbered && hasAssociatedLoan(item.id);
                const isEarlyWithdrawn = isEncumbered && !isLoanCollateral;
                
                const canUnstake = isMature && !isEncumbered;

                const cardClass = isOrphaned 
                  ? "bg-red-900/20 backdrop-blur-lg border border-red-500/30 rounded-xl p-4 text-sm h-full flex flex-col justify-between hover:bg-red-900/30 hover:border-red-400/40 transition-all duration-300 cursor-pointer no-underline shadow-xl hover:shadow-red-500/10"
                  : "bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-4 text-sm h-full flex flex-col justify-between hover:bg-black/30 hover:border-white/20 transition-all duration-300 cursor-pointer no-underline shadow-xl hover:shadow-purple-500/10";

                const statusDotClass = isOrphaned
                  ? "status-indicator-warning"
                  : isLoanCollateral
                    ? "status-indicator-warning"
                    : isEarlyWithdrawn
                      ? "status-indicator-info" 
                      : isMature 
                        ? "status-indicator-active" 
                        : "status-indicator-info";

                const statusText = isOrphaned
                  ? "Pending Registration"
                  : isLoanCollateral
                    ? "Collateral"
                    : isEarlyWithdrawn
                      ? "Withdrawn"
                      : isMature 
                        ? "Mature" 
                        : "Staking";
                
                const statusChipClass = isOrphaned
                  ? "bg-red-900/50 text-red-300 border border-red-700/50"
                  : isLoanCollateral
                    ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700/50"
                    : isEarlyWithdrawn
                      ? "bg-blue-900/50 text-blue-300 border border-blue-700/50"
                      : isMature
                        ? "bg-green-900/50 text-green-300 border border-green-700/50"
                        : "bg-blue-900/50 text-blue-300 border border-blue-700/50";

                return (
                  <SwiperSlide key={displayId} className="bg-transparent rounded-lg p-1 self-stretch h-full min-h-0 relative z-[29]">
                    <a 
                      href={`https://suiscan.xyz/testnet/object/${displayId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cardClass}
                      title={isOrphaned ? "View Native Stake on Suiscan" : "View Staked Position on Suiscan"}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center space-x-2">
                            <div className={statusDotClass}></div>
                            <div>
                              <span className="text-gray-300 font-mono text-xs block" title={displayId}>
                                {isOrphaned ? "Native Stake" : "Position"}
                              </span>
                              <span className="text-gray-500 text-xs">
                                {formatAddress(displayId)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Early Unstake button for staking positions (not for encumbered stakes) */}
                            {!isOrphaned && !isEncumbered && !isMature && (
                              <button
                                onClick={e => { e.preventDefault(); e.stopPropagation(); handleEarlyUnstake(extractOriginalId(item.id), item.principal); }}
                                disabled={earlyUnstakeInProgress === extractOriginalId(item.id) || loading.transaction}
                                className="px-2 py-1 bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 text-white text-xs font-medium rounded transition-all duration-300 disabled:opacity-50 relative z-[28]"
                                title="Get Alpha Points immediately"
                              >
                                {earlyUnstakeInProgress === extractOriginalId(item.id) ? (
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  'αP'
                                )}
                              </button>
                            )}
                            
                            <div className={`px-2 py-1 rounded text-xs font-medium ${statusChipClass}`}>
                              {statusText}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Principal</span>
                            <div className="text-right">
                              <span className="text-white font-semibold">{formatSui(principalDisplay)}</span>
                              <span className="text-blue-400 text-sm ml-1">SUI</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Duration</span>
                            <div className="text-right">
                              <span className="text-white">{formatDuration(durationDaysDisplay)}</span>
                              {!isOrphaned && (
                                <div className="text-xs text-gray-500">{formattedUnlockDate}</div>
                              )}
                            </div>
                          </div>
                          
                          {!isOrphaned && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Est. Rewards</span>
                              <span className="text-emerald-400 text-sm font-medium">
                                {calculateEstAlphaPointRewards(principalDisplay, String(durationDaysDisplay), (item as SwiperStakeItem).apy)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {isOrphaned ? null : !isMature && !isEncumbered ? (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>Progress</span>
                              <span>{maturityPercentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                style={{ width: `${maturityPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : null}
                      </div> 

                      {/* Action Button / Status Info - positioned at the bottom */}
                      <div className="mt-auto pt-3">
                        {isOrphaned ? (
                          <button
                            onClick={(e) => { 
                              e.preventDefault(); 
                              e.stopPropagation();
                              if (item.isOrphaned) {
                                handleCompleteRegistration(extractOriginalId(item.id), item.durationDays, item.principalAmount);
                              }
                            }}
                            disabled={!item.isOrphaned || registrationInProgress === (item.isOrphaned ? extractOriginalId(item.id) : null) || loading.transaction}
                            className="w-full btn-modern-secondary relative z-[28]"
                          >
                            {registrationInProgress === (item.isOrphaned ? extractOriginalId(item.id) : null) ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </span>
                            ) : 'Register Stake with Protocol'}
                          </button>
                        ) : canUnstake ? (
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); handleUnstake(extractOriginalId(item.id), item.principal); }}
                            disabled={unstakeInProgress === extractOriginalId(item.id) || loading.transaction}
                            className="w-full btn-modern-primary relative z-[28]"
                          >
                            {unstakeInProgress === extractOriginalId(item.id) ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </span>
                            ) : 'Unstake'}
                          </button>
                        ) : isLoanCollateral ? (
                          <div className="p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-300 text-xs text-center backdrop-blur-sm">
                            This position is collateral. Repay loan to unstake.
                          </div>
                        ) : isEarlyWithdrawn ? (
                          <div className="p-2 bg-blue-900/30 border border-blue-700/50 rounded text-blue-300 text-xs text-center backdrop-blur-sm">
                            Alpha Points received. Stake locked until {formattedUnlockDate}.
                          </div>
                        ) : null}
                      </div>
                    </a>
                  </SwiperSlide>
                );
              })}
            </Swiper>
            

          </div>
        ) : <></>}
      </div>
    </div>
  );
};