import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PartnerCapInfo } from '../hooks/usePartnerDetection';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ErrorToast, SuccessToast } from './ui/ErrorToast';
import { toast } from 'react-toastify';
import { useAlphaContext } from '../context/AlphaContext';
import { usePerkData, PerkDefinition } from '../hooks/usePerkData';
import { usePartnerSettings } from '../hooks/usePartnerSettings';
import { usePartnerAnalytics } from '../hooks/usePartnerAnalytics';

import { usePartnerDetection } from '../hooks/usePartnerDetection';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentWallet } from '@mysten/dapp-kit';
import { 
  buildCreatePerkDefinitionTransaction, 
  buildSetPerkActiveStatusTransaction, 
  buildUpdatePerkControlSettingsTransaction, 
  buildUpdatePerkTypeListsTransaction, 
  buildUpdatePerkTagListsTransaction,
  buildUpdateAllPerkSettingsTransaction,
  buildAddSuiCollateralTransaction,
  buildCreateInitialSuiVaultTransaction,
  buildAddUsdcCollateralTransaction,
  buildAddNftCollateralTransaction,
  buildCreatePartnerPerkStatsTransaction,
  findPartnerStatsId,
  buildCreatePartnerStatsIfNotExistsTransaction,
  buildWithdrawCollateralTransaction,
} from '../utils/transaction';


// import { SPONSOR_CONFIG } from '../config/contract'; // Commented out - will re-enable for sponsored transactions later
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS } from '../config/contract';
import { CURRENT_NETWORK } from '../config/network';
import { formatErrorForToast, parseErrorCode, debugError114 } from '../utils/errorCodes';
import { simulateTransaction, executeWithSimulation } from '../utils/transactionSimulation';
import { 
  predictSmartContractValidation, 
  logConversionDebug,
  formatUSD,
  formatAlphaPoints,
  usdToAlphaPointsDisplay,
  formatAlphaPoints as formatAP
} from '../utils/conversionUtils';
import { hashMetadata } from '../utils/privacy';
import { formatSui } from '../utils/format';
import suiLogo from '../assets/sui-logo.jpg';
import { GenerationsTab } from './GenerationsTab';
import { SDKConfigurationDashboard } from './SDKConfigurationDashboard';

// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';

// Import Recharts components
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

// Import Swiper styles
// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/navigation';
// @ts-ignore
import 'swiper/css/pagination';

// Global singleton to prevent multiple simultaneous stats checks for the same partner cap
const globalStatsCheckTracker = new Map<string, Promise<void>>();

// Helper function to get or create a stats check promise for a partner cap
const getOrCreateStatsCheck = (partnerCapId: string, checkFunction: () => Promise<void>): Promise<void> => {
  if (globalStatsCheckTracker.has(partnerCapId)) {
    return globalStatsCheckTracker.get(partnerCapId)!;
  }
  
  const checkPromise = checkFunction().finally(() => {
    globalStatsCheckTracker.delete(partnerCapId);
  });
  
  globalStatsCheckTracker.set(partnerCapId, checkPromise);
  return checkPromise;
};

/*
 * SPONSORED TRANSACTIONS - FUTURE IMPLEMENTATION
 * 
 * Currently commented out for development. To re-enable sponsored transactions:
 * 
 * 1. Uncomment SPONSOR_CONFIG import
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

/*
 * ENHANCED ERROR HANDLING SYSTEM
 * 
 * This component now includes a comprehensive error handling system for smart contract errors:
 * 
 * 1. Error Code Mapping: Maps Move abort error codes to user-friendly messages (utils/errorCodes.ts)
 * 2. Structured Error Toasts: Rich error displays with error codes, retry buttons, and help links
 * 3. Special Error 112 Handling: Detailed diagnostics for "Cost Limit Exceeded" with actionable solutions
 * 4. Success Toasts: Consistent success messaging with transaction links
 * 
 * Key Features:
 * - Error 112 shows current vs. required cost limits with specific instructions
 * - All errors include retry functionality and Suiscan transaction links
 * - Extended display times for complex error messages
 * - Console debugging for error 112 with diagnostic information
 * 
 * Example: If user gets error 112, they'll see:
 * "Your perk costs $25.00 but your max cost limit is $10.00"
 * "Go to Settings tab → Increase 'Max Cost Per Perk' to at least $25.00"
 */

interface PartnerDashboardProps {
  partnerCap: PartnerCapInfo;
  onRefresh: () => void;
  currentTab?: 'overview' | 'perks' | 'analytics' | 'settings' | 'generations';
  onPartnerCreated?: () => void;
}

export function PartnerDashboard({ partnerCap: initialPartnerCap, onRefresh, currentTab = 'overview', onPartnerCreated }: PartnerDashboardProps) {
  const { partnerCaps, refreshData, setPartnerCaps, suiBalance, loading } = useAlphaContext();
  const { currentWallet } = useCurrentWallet();
  const { detectPartnerCaps } = usePartnerDetection();
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransactionMain } = useSignAndExecuteTransaction();
  
  // Component initialization (debug logging removed to prevent spam)
  
  // Portal Tooltip Component
  const PortalTooltip: React.FC<{ children: React.ReactNode; show: boolean; position: { x: number; y: number } }> = ({ children, show, position }) => {
    if (!show) return null;
    
    return createPortal(
      <div 
        className="fixed bg-gray-900 border rounded-lg shadow-lg p-3 text-sm"
        style={{ 
          left: position.x,
          top: position.y,
          transform: 'translate(-100%, -100%)', // Bottom right corner at cursor
          zIndex: 2147483647, // Maximum possible z-index
        }}
      >
        {children}
      </div>,
      document.body
    );
  };

  const [selectedPartnerCapId, setSelectedPartnerCapId] = useState(initialPartnerCap.id);
  const [newPerkName, setNewPerkName] = useState('');
  const [newPerkDescription, setNewPerkDescription] = useState('');
  const [newPerkTags, setNewPerkTags] = useState<string[]>([]);
  const [newPerkUsdcPrice, setNewPerkUsdcPrice] = useState('');
  const [newPerkType, setNewPerkType] = useState('Access'); // Add perk type state
  const [newPerkReinvestmentPercent, setNewPerkReinvestmentPercent] = useState(20); // Default 20% reinvestment
  const [newPerkIcon, setNewPerkIcon] = useState('🎁'); // Default icon
  const [isCreatingPerk, setIsCreatingPerk] = useState(false);
  
  // Metadata state
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [customMetadata, setCustomMetadata] = useState<Array<{key: string; value: string; shouldHash: boolean}>>([]);
  const [metadataField, setMetadataField] = useState({key: '', value: '', shouldHash: true});
  
  // Expiry functionality
  const [newPerkExpiryType, setNewPerkExpiryType] = useState<'none' | 'days' | 'date'>('none');
  const [newPerkExpiryDays, setNewPerkExpiryDays] = useState('30');
  const [newPerkExpiryDate, setNewPerkExpiryDate] = useState('');
  
  // Consumable functionality
  const [newPerkIsConsumable, setNewPerkIsConsumable] = useState(false);
  const [newPerkCharges, setNewPerkCharges] = useState('1');
  
  // Tooltip state
  const [showBlueTooltip, setShowBlueTooltip] = useState(false);
  const [showYellowTooltip, setShowYellowTooltip] = useState(false);
  const [showGreenTooltip, setShowGreenTooltip] = useState(false);
  const [showInsightTooltip, setShowInsightTooltip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Tag selector state
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Perk control settings using dedicated hook
  const {
    currentSettings,
    formSettings: perkSettings,
    setFormSettings: setPerkSettings,
    isLoading: isLoadingSettings,
    error: settingsError,
    refreshSettings,
    fetchSettings,
    resetFormToCurrentSettings,
    generateNewSalt,

  } = usePartnerSettings(selectedPartnerCapId);
  
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  
  // Partner stats state
  const [hasPartnerStats, setHasPartnerStats] = useState<boolean | null>(null);
  const [isCheckingStats, setIsCheckingStats] = useState(false);
  const [isCreatingStats, setIsCreatingStats] = useState(false);

  // Check if partner has stats object (deprecated - now always returns true since stats objects are no longer required)
  const checkPartnerStats = useCallback(async (forceRefresh: boolean = false, partnerCapIdOverride?: string) => {
    const partnerCapIdToCheck = partnerCapIdOverride || selectedPartnerCapId;
    
    if (!partnerCapIdToCheck || !suiClient) {
      console.log('⚠️ Cannot check stats: missing partnerCapId or suiClient');
      return;
    }
    
    // NOTE: PartnerPerkStatsV2 objects are no longer required by the current contract version
    // Always set hasPartnerStats to true
    console.log('ℹ️ PartnerPerkStatsV2 objects are no longer required - marking partner as ready');
    setHasPartnerStats(true);
    setIsCheckingStats(false);
    
    // Get the current partner name for better logging
    const currentPartner = partnerCaps.find(cap => cap.id === partnerCapIdToCheck);
    const partnerName = currentPartner?.partnerName || 'Unknown Partner';
    
    // Show success toast only on perks tab for better UX
    if (currentTab === 'perks' && !globalStatsCheckTracker.has(partnerCapIdToCheck)) {
      toast.success(`✅ Partner ready for perk creation: ${partnerName}`, { autoClose: 2000 });
    }
    
    // Mark this partner as checked to prevent duplicate toasts
    globalStatsCheckTracker.set(partnerCapIdToCheck, Promise.resolve());
    
    // Commented out deprecated stats checking logic:
    /*
    // Use global singleton to prevent multiple simultaneous checks for the same partner cap
    const actualCheckFunction = async () => {
      try {
        setIsCheckingStats(true);
        
        // Checking stats for partner (logging reduced for cleaner console)
        
        // Add a small delay to ensure client is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        const statsId = await findPartnerStatsId(suiClient, partnerCapIdToCheck);
        
        // Stats found successfully
        setHasPartnerStats(true);
        
        // Show success toast only on perks tab for better UX - and only once per check
        if (currentTab === 'perks' && !globalStatsCheckTracker.has(partnerCapIdToCheck)) {
          toast.success(`✅ Stats object verified for ${partnerName}`, { autoClose: 2000 });
        }
      } catch (error) {
        // No stats object found for this partner
        setHasPartnerStats(false);
        
        // Show error toast only on perks tab for better UX - and only once per check
        if (currentTab === 'perks' && !globalStatsCheckTracker.has(partnerCapIdToCheck)) {
          toast.error(`❌ No stats object found for ${partnerName}`, { autoClose: 3000 });
        }
      } finally {
        setIsCheckingStats(false);
      }
    };
    
    // Use the global singleton pattern to prevent duplicate checks
    return getOrCreateStatsCheck(partnerCapIdToCheck, actualCheckFunction);
    */
  }, [suiClient, selectedPartnerCapId, partnerCaps, currentTab, setIsCheckingStats]);

  // Create partner stats object (deprecated - no longer needed since contract was updated)
  const createPartnerStats = async () => {
    console.warn('⚠️ createPartnerStats called but PartnerPerkStatsV2 objects are no longer required');
    toast.success('Partner stats objects are no longer required! Your partner is ready to create perks.');
    setHasPartnerStats(true);
    setIsCreatingStats(false);
    return;
    
    // Commented out deprecated stats creation logic:
    /*
    if (!selectedPartnerCapId || !suiClient) {
      toast.error('Client not ready. Please try again in a moment.');
      return;
    }
    
    try {
      setIsCreatingStats(true);
      
      const dailyQuotaLimit = 10000; // Default quota limit
      
      // Use the safer creation function that checks for existing stats first
      const result = await buildCreatePartnerStatsIfNotExistsTransaction(
        suiClient, 
        selectedPartnerCapId, 
        dailyQuotaLimit
      );
      
      if (result.alreadyExists) {
        console.log('✅ PartnerPerkStatsV2 already exists:', result.existingStatsId);
        toast.success('Partner stats object already exists! No need to create another one.');
        setHasPartnerStats(true);
        // Force refresh to update UI
        setTimeout(() => {
          checkPartnerStats(true);
        }, 1000);
        return;
      }
      
      if (!result.transaction) {
        toast.error('Failed to create transaction. Please try again.');
        return;
      }
      
      signAndExecuteTransactionMain(
        { transaction: result.transaction },
        {
          onSuccess: (txResult: any) => {
            console.log('✅ Partner stats created successfully:', txResult.digest);
            toast.success('Partner stats object created successfully! Users can now purchase your perks.');
            setHasPartnerStats(true);
            onRefresh?.();
            // Force refresh stats detection after successful creation
            setTimeout(() => {
              checkPartnerStats(true);
            }, 2000);
          },
          onError: (error: any) => {
            console.error('❌ Failed to create partner stats:', error);
            toast.error(`Failed to create partner stats: ${error.message || 'Unknown error'}`);
          },
        }
      );
    } catch (error) {
      console.error('Error creating partner stats:', error);
      toast.error(`Error creating partner stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingStats(false);
    }
    */
  };



  // NO AUTOMATIC CHECKING - Only manual checks via buttons or partner cap changes
  useEffect(() => {
    // Only reset state when no partner cap is selected
    if (!selectedPartnerCapId || !suiClient) {
      setHasPartnerStats(null);
    }
  }, [selectedPartnerCapId, suiClient]);

  // Tooltip helper functions
  const handleTooltipEnter = (event: React.MouseEvent, tooltipType: 'blue' | 'yellow' | 'green') => {
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY
    });
    
    if (tooltipType === 'blue') {
      setShowBlueTooltip(true);
    } else if (tooltipType === 'yellow') {
      setShowYellowTooltip(true);
    } else if (tooltipType === 'green') {
      setShowGreenTooltip(true);
    }
  };

  const handleTooltipMove = (event: React.MouseEvent) => {
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleTooltipLeave = (tooltipType: 'blue' | 'yellow' | 'green') => {
    if (tooltipType === 'blue') {
      setShowBlueTooltip(false);
    } else if (tooltipType === 'yellow') {
      setShowYellowTooltip(false);
    } else if (tooltipType === 'green') {
      setShowGreenTooltip(false);
    }
  };

  const handleInsightTooltipEnter = (event: React.MouseEvent, tooltipType: string) => {
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY
    });
    setShowInsightTooltip(tooltipType);
  };

  const handleInsightTooltipLeave = () => {
    setShowInsightTooltip(null);
  };

  // Predefined tag options
  const availableTags = [
    // Core types
    'Access', 'Service', 'Digital Asset', 'Physical', 'Event',
    'VIP', 'Premium', 'Exclusive', 'Limited', 'Beta',
    'NFT', 'Discord', 'Support', 'Merch', 'Ticket',
    
    // DeFi & Finance
    'DeFi', 'Insurance', 'Protection', 'Cashback', 'Analytics',
    
    // Retail & Commerce
    'Retail', 'Early Access', 'Sales', 'Shipping',
    
    // Professional & Business
    'Professional', 'Data', 'Tools', 'Education', 'Certification',
    'Mentorship', 'Career',
    
    // Entertainment & Events
    'Events', 'Season Pass', 'Gaming', 'Tournament', 'Competition',
    
    // Hospitality & Travel
    'Hospitality', 'Priority', 'Travel', 'Luxury',
    
    // Content & Creator
    'Creator', 'Collaboration', 'Content', 'Monetization', 'Digital',
    
    // Health & Fitness
    'Fitness', 'Training', 'Nutrition', 'Coaching', 'Health'
  ];

  // Blockchain integration hooks
  const { 
    partnerPerks, 
    isLoading: isLoadingPerks, 
    error: perkError, 
    fetchPartnerPerks, 
    refreshPerkData,
    preloadPartnerPerks,
    getPartnerPerkMetrics,
    getPerformanceMetrics 
  } = usePerkData();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  
  // Partner analytics hook
  const {
    dailyData,
    isLoading: isLoadingAnalytics,
    timeRange: analyticsTimeRange,
    fetchAnalyticsData,
    refreshAnalytics
  } = usePartnerAnalytics(initialPartnerCap);

  // Analytics metric toggles (moved to top level to fix hooks rule violation)
  const [analyticsToggles, setAnalyticsToggles] = useState<Record<string, boolean>>({
    tvlBacking: true,
    dailyQuotaUsage: false,
    pointsMinted: false,
    perkRevenue: false,
    lifetimeQuota: false,
  });

  // Analytics time range is now managed by the analytics hook

  // Example set navigation for perks tab
  const [currentExampleSet, setCurrentExampleSet] = useState(0);

  // Expanded perk state for collapsible cards
  const [expandedPerk, setExpandedPerk] = useState<string | null>(null);

  // Swiper state for perk cards
  const [perkSwiperInstance, setPerkSwiperInstance] = useState<any>(null);
  const [perkActiveIndex, setPerkActiveIndex] = useState(0);

  // Edit perk state
  const [editingPerk, setEditingPerk] = useState<PerkDefinition | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    usdcPrice: '',
    isActive: true,
    icon: '🎁',
  });
  const [isUpdatingPerk, setIsUpdatingPerk] = useState(false);

  // Edit metadata state
  const [editMetadata, setEditMetadata] = useState<{[key: string]: string}>({});
  const [editMetadataField, setEditMetadataField] = useState({key: '', value: '', shouldHash: true});
  const [showEditMetadataModal, setShowEditMetadataModal] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Collateral management modal state
  const [showCollateralModal, setShowCollateralModal] = useState<{
    type: 'topup' | 'add' | null;
    isOpen: boolean;
  }>({ type: null, isOpen: false });

  // TVL withdrawal modal state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState(false);

  // Metadata field modal state

  
  // Salt visibility state
  const [showSalt, setShowSalt] = useState(false);
  
  // Enhanced salt regeneration state
  const [saltRegenerationFlow, setSaltRegenerationFlow] = useState({
    step: 0, // 0: closed, 1: warning, 2: confirmation, 3: typing verification
    confirmationText: '',
    showModal: false
  });



  // Field Guide swiper state
  const [fieldGuideSwiperInstance, setFieldGuideSwiperInstance] = useState<any>(null);
  const [fieldGuideActiveIndex, setFieldGuideActiveIndex] = useState(0);

  // Copy partner salt to clipboard
  const copySalt = async () => {
    if (!perkSettings.partnerSalt) {
      toast.error('No salt to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(perkSettings.partnerSalt);
      toast.success('Partner salt copied to clipboard!', { autoClose: 2000 });
    } catch (error) {
      console.error('Failed to copy salt:', error);
      toast.error('Failed to copy salt to clipboard');
    }
  };

  // Download salt as backup file
  const downloadSalt = () => {
    if (!perkSettings.partnerSalt) {
      toast.error('No salt to download');
      return;
    }

    try {
      const saltData = {
        partnerId: partnerCap.id,
        partnerName: partnerCap.partnerName,
        salt: perkSettings.partnerSalt,
        createdAt: new Date().toISOString(),
        version: '1.0',
        description: 'Alpha4 Partner Salt Backup - Keep this file secure and private!'
      };

      const blob = new Blob([JSON.stringify(saltData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `alpha4-salt-backup-${partnerCap.partnerName.replace(/\s+/g, '-')}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Salt backup downloaded successfully!', { autoClose: 3000 });
    } catch (error) {
      console.error('Failed to download salt:', error);
      toast.error('Failed to download salt backup');
    }
  };

  // Enhanced salt regeneration with multiple confirmations
  const handleSaltRegeneration = () => {
    setSaltRegenerationFlow({
      step: 1,
      confirmationText: '',
      showModal: true
    });
  };

  const proceedSaltRegeneration = () => {
    if (saltRegenerationFlow.step === 1) {
      // Move to typing confirmation
      setSaltRegenerationFlow(prev => ({
        ...prev,
        step: 2,
        confirmationText: ''
      }));
    } else if (saltRegenerationFlow.step === 2) {
      // Check if they typed the confirmation correctly
      const expectedText = 'REGENERATE MY SALT';
      if (saltRegenerationFlow.confirmationText.trim().toUpperCase() === expectedText) {
        // Actually regenerate the salt
        generateNewSalt();
        setSaltRegenerationFlow({ step: 0, confirmationText: '', showModal: false });
        toast.success('🔑 New salt generated! Please update all your integrations.', { autoClose: 5000 });
      } else {
        toast.error(`Please type exactly: "${expectedText}"`, { autoClose: 3000 });
      }
    }
  };

  const cancelSaltRegeneration = () => {
    setSaltRegenerationFlow({ step: 0, confirmationText: '', showModal: false });
  };

  // Get the currently selected partner cap
  const partnerCap = partnerCaps.find(cap => cap.id === selectedPartnerCapId) || initialPartnerCap;

  // Load partner perks when component mounts or partner changes
  useEffect(() => {
    if (partnerCap.id && currentTab === 'perks') {
      fetchPartnerPerks(partnerCap.id);
    }
  }, [partnerCap.id, currentTab, fetchPartnerPerks]);

  // OPTIMIZATION: Preload perks on partner selection change
  useEffect(() => {
    if (partnerCap.id) {
      // Start preloading immediately when partner is selected
      preloadPartnerPerks(partnerCap.id);
    }
  }, [partnerCap.id, preloadPartnerPerks]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showTagDropdown && !target.closest('.tag-selector')) {
        setShowTagDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTagDropdown]);

  // Clear form when switching tabs
  useEffect(() => {
    if (currentTab !== 'perks') {
      setNewPerkName('');
      setNewPerkDescription('');
      setNewPerkType('Access'); // Reset perk type
      setNewPerkTags([]);
      setNewPerkUsdcPrice('');
      setNewPerkReinvestmentPercent(20);
      setNewPerkIcon('🎁');
      setShowTagDropdown(false);
      setTagInput('');
      // Reset expiry fields
      setNewPerkExpiryType('none');
      setNewPerkExpiryDays('30');
      setNewPerkExpiryDate('');
      // Reset consumable fields
      setNewPerkIsConsumable(false);
      setNewPerkCharges('1');
    }
  }, [currentTab]);

  // Refresh partner caps when component mounts or wallet changes
  useEffect(() => {
    const refreshPartnerCaps = async () => {
      try {
        const detectedCaps = await detectPartnerCaps();
        if (detectedCaps.length > 0) {
          setPartnerCaps(detectedCaps);
        }
      } catch (error) {
        console.error('Failed to detect partner caps:', error);
      }
    };
    
    if (currentWallet?.accounts?.[0]?.address) {
      refreshPartnerCaps();
    }
  }, [currentWallet?.accounts?.[0]?.address, detectPartnerCaps, setPartnerCaps]);

  // Ensure we have a valid selected partner cap when partnerCaps changes
  useEffect(() => {
    if (partnerCaps.length > 0) {
      // If current selection is not in the list, select the first one
      const currentExists = partnerCaps.some(cap => cap.id === selectedPartnerCapId);
      if (!currentExists) {
        setSelectedPartnerCapId(partnerCaps[0].id);
      }
    }
  }, [partnerCaps, selectedPartnerCapId]);



  // Tag handling functions
  const addTag = (tag: string) => {
    if (newPerkTags.length < 5 && !newPerkTags.includes(tag)) {
      setNewPerkTags([...newPerkTags, tag]);
    }
    setTagInput('');
    setShowTagDropdown(false);
  };

  const removeTag = (tagToRemove: string) => {
    setNewPerkTags(newPerkTags.filter(tag => tag !== tagToRemove));
  };

  const handleCustomTag = () => {
    const customTag = tagInput.trim();
    if (customTag && newPerkTags.length < 5 && !newPerkTags.includes(customTag)) {
      setNewPerkTags([...newPerkTags, customTag]);
    }
    setTagInput('');
    setShowTagDropdown(false);
  };

  // Metadata management functions
  const addMetadataField = () => {
    if (!metadataField.key.trim() || !metadataField.value.trim()) {
      toast.error('Both key and value are required');
      return;
    }

    // Parse comma-separated keys and values
    const keys = metadataField.key.split(',').map(k => k.trim()).filter(k => k.length > 0);
    const values = metadataField.value.split(',').map(v => v.trim()).filter(v => v.length > 0);

    // Validate that keys and values match
    if (keys.length !== values.length) {
      toast.error(`Mismatch: ${keys.length} keys but ${values.length} values. Please ensure equal counts.`);
      return;
    }

    // Check for duplicate keys (both existing and within new batch)
    const existingKeys = customMetadata.map(field => field.key);
    const duplicateKeys = keys.filter(key => existingKeys.includes(key));
    const internalDuplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    
    if (duplicateKeys.length > 0) {
      toast.error(`Duplicate keys already exist: ${duplicateKeys.join(', ')}`);
      return;
    }
    
    if (internalDuplicates.length > 0) {
      toast.error(`Duplicate keys in input: ${[...new Set(internalDuplicates)].join(', ')}`);
      return;
    }

    // Create new metadata fields
    const newFields = keys.map((key, index) => ({
      key: key,
      value: values[index],
      shouldHash: metadataField.shouldHash
    }));

    setCustomMetadata(prev => [...prev, ...newFields]);

    // Reset modal state
    setMetadataField({key: '', value: '', shouldHash: true});
    setShowMetadataModal(false);
    toast.success(`${newFields.length} metadata field(s) added`);
  };

  // Generate JSON preview for metadata
  const generateMetadataPreview = () => {
    if (!metadataField.key.trim() || !metadataField.value.trim()) {
      return null;
    }

    const keys = metadataField.key.split(',').map(k => k.trim()).filter(k => k.length > 0);
    const values = metadataField.value.split(',').map(v => v.trim()).filter(v => v.length > 0);

    if (keys.length !== values.length) {
      return { error: `Mismatch: ${keys.length} keys, ${values.length} values` };
    }

    const preview: Record<string, string> = {};
    keys.forEach((key, index) => {
      preview[key] = metadataField.shouldHash ? 
        `<hashed: ${values[index].substring(0, 10)}...>` : 
        values[index];
    });

    return { data: preview };
  };

  const removeMetadataField = (keyToRemove: string) => {
    setCustomMetadata(prev => prev.filter(field => field.key !== keyToRemove));
    toast.success('Metadata field removed');
  };

  // Process metadata for submission (hash where needed)
  const processMetadataForSubmission = (partnerSalt: string) => {
    return customMetadata.map(field => ({
      key: field.key,
      value: field.shouldHash ? hashMetadata(field.value, partnerSalt) : field.value,
      isHashed: field.shouldHash
    }));
  };

  // Fetch metadata for a perk
  const fetchPerkMetadata = async (perk: PerkDefinition): Promise<{[key: string]: string}> => {
    if (!perk.definition_metadata_id) {
      return {};
    }

    try {
      const metadata: {[key: string]: string} = {};

      // Fetch the metadata object from Sui
      const result = await suiClient.getObject({
        id: perk.definition_metadata_id,
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
          showPreviousTransaction: true,
          showStorageRebate: true,
          showDisplay: true,
        },
      });

      if (!result?.data?.content || result.data.content.dataType !== 'moveObject') {
        console.warn('Perk metadata object not found or invalid:', perk.definition_metadata_id);
        return {};
      }
      
      // Extract dynamic fields from the metadata store
      const dynamicFields = await suiClient.getDynamicFields({
        parentId: perk.definition_metadata_id,
      });

      // Process each dynamic field
      for (const field of dynamicFields.data) {
        try {
          const fieldData = await suiClient.getDynamicFieldObject({
            parentId: perk.definition_metadata_id,
            name: field.name,
          });
          
          if (fieldData?.data?.content && fieldData.data.content.dataType === 'moveObject') {
            const fieldContent = fieldData.data.content as any;
            if (fieldContent.fields?.value && field.name?.value) {
              metadata[field.name.value] = fieldContent.fields.value;
            }
          }
        } catch (error) {
          console.warn('Failed to fetch dynamic field:', field.name, error);
          // Continue processing other fields even if one fails
        }
      }

      console.log(`✅ Successfully fetched ${Object.keys(metadata).length} metadata fields for perk:`, perk.name);
      return metadata;
    } catch (error) {
      console.error('Failed to fetch perk metadata:', error);
      return {};
    }
  };

  const filteredTags = availableTags.filter(tag => 
    !newPerkTags.includes(tag) && 
    tag.toLowerCase().includes(tagInput.toLowerCase())
  );

  // Calculate partner share percentage based on reinvestment slider
  // Revenue Split: 70% Revenue / 20% Reinvestment / 10% Platform (default)
  // Slider controls split between Revenue and Reinvestment within the 90% partner pool
  // 0% reinvestment = 70% direct revenue, 20% reinvestment (default)  
  // 50% reinvestment = 35% direct revenue, 55% reinvestment
  // 90% reinvestment = 7% direct revenue, 83% reinvestment
  const calculatePartnerShare = (reinvestmentPercent: number): number => {
    // With new 0-90 slider: Revenue = 90 - reinvestmentPercent
    // Platform is always 10% (fixed)
    return 90 - reinvestmentPercent;
  };

  // Helper function to calculate expiry timestamp
  const calculateExpiryTimestamp = (): number | undefined => {
    if (newPerkExpiryType === 'none') {
      return undefined;
    } else if (newPerkExpiryType === 'days') {
      const days = parseInt(newPerkExpiryDays);
      if (isNaN(days) || days <= 0) return undefined;
      return Date.now() + (days * 24 * 60 * 60 * 1000);
    } else if (newPerkExpiryType === 'date') {
      if (!newPerkExpiryDate) return undefined;
      const date = new Date(newPerkExpiryDate);
      if (isNaN(date.getTime())) return undefined;
      return date.getTime();
    }
    return undefined;
  };

  // Helper function to get max uses per claim (consumable charges)
  const getMaxUsesPerClaim = (): number | undefined => {
    if (!newPerkIsConsumable) return undefined;
    const charges = parseInt(newPerkCharges);
    if (isNaN(charges) || charges <= 0) return 1;
    return charges;
  };

  // 🔍 Helper function to validate partner cap ID format
  const validatePartnerCapId = (id: string): { isValid: boolean; format: string; details: string } => {
    if (!id || id.length < 10) {
      return { isValid: false, format: 'invalid', details: 'ID too short or empty' };
    }
    
    if (id.startsWith('0x')) {
      // Hex format: should be 0x + 64 hex characters (66 total)
      const isValidHex = /^0x[0-9a-fA-F]{64}$/.test(id);
      return { 
        isValid: isValidHex, 
        format: 'hex', 
        details: `Length: ${id.length}, Expected: 66, Valid hex: ${isValidHex}` 
      };
    } else {
      // Base58 format: should be between 43-44 characters typically
      const isValidBase58 = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(id);
      return { 
        isValid: isValidBase58, 
        format: 'base58', 
        details: `Length: ${id.length}, Expected: 43-44, Valid base58: ${isValidBase58}` 
      };
    }
  };

  const handleCreatePerk = async () => {
    if (!newPerkName.trim() || !newPerkDescription.trim() || !newPerkTags.length || !newPerkUsdcPrice.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate expiry settings
    if (newPerkExpiryType === 'days') {
      const days = parseInt(newPerkExpiryDays);
      if (isNaN(days) || days <= 0) {
        toast.error('Please enter a valid number of days for expiry (minimum 1 day)');
        return;
      }
    } else if (newPerkExpiryType === 'date') {
      if (!newPerkExpiryDate) {
        toast.error('Please select an expiry date');
        return;
      }
      const expiryDate = new Date(newPerkExpiryDate);
      if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
        toast.error('Please select a valid future date for expiry');
        return;
      }
    }

    // Validate consumable settings
    if (newPerkIsConsumable) {
              if (!currentSettings?.allowConsumablePerks) {
          toast.error('Consumable perks are not enabled in your settings. Please enable them first.');
          return;
        }
      const charges = parseInt(newPerkCharges);
      if (isNaN(charges) || charges <= 0) {
        toast.error('Please enter a valid number of charges (minimum 1)');
        return;
      }
    }

    // Safety check: Ensure we have a valid partner cap
    if (!partnerCap || !partnerCap.id) {
      toast.error('❌ No partner cap selected. Please refresh the page and select a business.');
      console.error('❌ partnerCap is undefined:', { partnerCap, selectedPartnerCapId, partnerCapsCount: partnerCaps.length });
      return;
    }

    // REMOVED: PartnerPerkStats requirement validation
    // The Move package has been optimized to remove the stats object requirement
    // Partners can now create perks without needing PartnerPerkStatsV2 objects

    // Check if custom metadata requires partner salt
    if (customMetadata.length > 0 && !perkSettings?.partnerSalt) {
      toast.error('Error: Custom metadata requires a partner salt to be generated. Please generate a partner salt in your settings first.');
      return;
    }

    const usdcPrice = parseFloat(newPerkUsdcPrice);

    if (isNaN(usdcPrice) || usdcPrice <= 0) {
      toast.error('Please enter a valid USDC price');
      return;
    }

    // 🔍 VALIDATE REVENUE SPLIT BEFORE BLOCKCHAIN SUBMISSION
    const partnerSharePercent = calculatePartnerShare(newPerkReinvestmentPercent);
    
    // Check if partner share is within valid ranges (based on typical blockchain validation)
    if (partnerSharePercent < 10 || partnerSharePercent > 90) {
      toast.error(
        `❌ Invalid Revenue Split\n\n` +
        `Your current settings result in ${partnerSharePercent}% partner revenue share.\n\n` +
        `Valid range: 10% - 90% partner share\n\n` +
        `Current split: ${partnerSharePercent}% Revenue / ${newPerkReinvestmentPercent}% Reinvestment / 10% Platform\n\n` +
        `💡 Adjust the slider to keep partner revenue between 10-90%`,
        {
          autoClose: 15000,
          style: { whiteSpace: 'pre-line' }
        }
      );
      return;
    }

    // Check reinvestment percentage limits
    if (newPerkReinvestmentPercent < 0 || newPerkReinvestmentPercent > 80) {
      toast.error(
        `❌ Invalid Reinvestment Percentage\n\n` +
        `Reinvestment percentage must be between 0% and 80%.\n\n` +
        `Current: ${newPerkReinvestmentPercent}%\n\n` +
        `💡 Use the slider to set a value within the valid range`,
        {
          autoClose: 12000,
          style: { whiteSpace: 'pre-line' }
        }
      );
      return;
    }

    // Get current wallet address for simulation
    const senderAddress = currentWallet?.accounts?.[0]?.address;
    
    if (!senderAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsCreatingPerk(true);
    
    try {
      // 🔄 REFRESH SETTINGS BEFORE VALIDATION - Ensure we have latest blockchain data
      await refreshSettings();
      
      // 🔄 REDUCED DELAY: Wait for blockchain state to settle after settings update (reduced to prevent 429 errors)
      await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 3 seconds
      
      // 🔄 FORCE SECOND REFRESH: Ensure we have the absolute latest data
      await refreshSettings();
      
      // Build the blockchain transaction

      
      // Validate partner cap ID format
      const validationResult = validatePartnerCapId(partnerCap.id);
      if (!validationResult.isValid) {
        toast.error(
          `❌ Invalid partner cap ID: ${partnerCap.id}\n\n` +
          `The partner cap ID ${partnerCap.id} is ${validationResult.format} format.\n\n` +
          `Details: ${validationResult.details}\n\n` +
          `Please refresh the page and try again.`,
          {
            style: { whiteSpace: 'pre-line' }
          }
        );
        return;
      }
      

      
      // 🔍 VERIFY PARTNER CAP EXISTS ON-CHAIN
      toast.info('🔍 Verifying partner cap exists on blockchain...');
      
      try {
        const partnerCapObject = await client.getObject({
          id: partnerCap.id,
          options: {
            showContent: true,
            showType: true,
          }
        });
        

        
        if (!partnerCapObject.data) {
          toast.error(
            `❌ Partner Cap Not Found on Blockchain\n\n` +
            `The partner cap ID ${partnerCap.id} was found in frontend state but doesn't exist on-chain.\n\n` +
            `This suggests stale data. Refreshing partner data...`,
            {
              autoClose: 15000,
              style: { whiteSpace: 'pre-line' }
            }
          );
          
          // Force refresh partner data
          setTimeout(() => {
            refreshData();
            window.location.reload(); // Force complete refresh
          }, 2000);
          
          return;
        }
        
        if (partnerCapObject.data.content?.dataType !== 'moveObject') {
          toast.error(
            `❌ Invalid Partner Cap Object\n\n` +
            `Object ${partnerCap.id} exists but is not a valid Move object.\n\n` +
            `Object type: ${partnerCapObject.data.content?.dataType || 'unknown'}`,
            {
              autoClose: 15000,
              style: { whiteSpace: 'pre-line' }
            }
          );
          return;
        }
        
        const onChainFields = (partnerCapObject.data.content as any).fields;

        
        toast.success('✅ Partner cap verified on blockchain');
        
      } catch (verifyError: any) {
        console.error('❌ Failed to verify partner cap on-chain:', verifyError);
        toast.error(
          `❌ Blockchain Verification Failed\n\n` +
          `Could not verify partner cap ${partnerCap.id} exists on-chain.\n\n` +
          `Error: ${verifyError.message || 'Network error'}\n\n` +
          `Try refreshing the page or check your network connection.`,
          {
            autoClose: 15000,
            style: { whiteSpace: 'pre-line' }
          }
        );
        return;
      }
      
      // Calculate partner share percentage for the transaction
      const newPerkPartnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
      
      // Process custom metadata if any exists
      let metadataKeys: string[] = [];
      let metadataValues: string[] = [];
      
      if (customMetadata.length > 0 && perkSettings?.partnerSalt) {
        const processedMetadata = processMetadataForSubmission(perkSettings.partnerSalt);
        metadataKeys = processedMetadata.map(field => field.key);
        metadataValues = processedMetadata.map(field => field.value);
      }
      
      const transaction = buildCreatePerkDefinitionTransaction(
        partnerCap.id,
        {
          name: newPerkName.trim(),
          description: newPerkDescription.trim(),
          perkType: newPerkType,
          usdcPrice: usdcPrice,
          partnerSharePercentage: newPerkPartnerShare,
          maxUsesPerClaim: getMaxUsesPerClaim(),
          expirationTimestampMs: calculateExpiryTimestamp(),
          generatesUniqueClaimMetadata: false,
          tags: newPerkTags,
          maxClaims: undefined,
          initialDefinitionMetadataKeys: metadataKeys,
          initialDefinitionMetadataValues: metadataValues,
          isActive: true
        }
      );



      // 🔍 PRE-SIMULATION: Check transaction before signature
      toast.info('🔍 Validating transaction...');
      

      
      const simulation = await simulateTransaction(client, transaction, senderAddress);
      
      if (!simulation.success && simulation.error) {
        // Handle specific error 114 with enhanced diagnostics (not 112!)
        if (simulation.error.code === 114) {
          const diagnostic = debugError114(usdcPrice, currentSettings || perkSettings);
          
          // Use the most current settings for display - prefer currentSettings if available
          const currentMaxCost = currentSettings?.maxCostPerPerkUsd || perkSettings.maxCostPerPerkUsd || 'not set';
          
          // Use centralized prediction logic for smart contract validation
          const currentMaxCostNum = typeof currentMaxCost === 'number' ? currentMaxCost : parseFloat(currentMaxCost.toString());
          const prediction = predictSmartContractValidation(
            usdcPrice, 
            currentMaxCostNum,
            currentSettings?.maxCostPerPerk || 0
          );
          
          logConversionDebug('SMART CONTRACT COMPARISON', prediction);
          
          // Enhanced error message with workaround suggestion
          const suggestionText = prediction.shouldPass 
            ? `💡 ORACLE MISCONFIGURATION: The oracle rate appears to be wrong. Expected: ~1 billion, Actual: ~328 million. This makes Alpha Points 3000x more expensive than intended.`
            : diagnostic.recommendation;
          
          // Show detailed error 114 message
          toast.error(
            `❌ ${simulation.error.title}\\n\\n` +
            `${simulation.error.message}\\n\\n` +
            `💡 Expected: ${formatAlphaPoints(prediction.estimatedAlphaPoints)} but oracle may calculate differently\\n\\n` +
            `💰 In USD: ${formatUSD(usdcPrice)} vs ${formatUSD(currentMaxCostNum)} limit\\n\\n` +
            `🔧 ${suggestionText}\\n\\n` +
            `⚠️ SOLUTION: Contact admin to fix oracle rate OR try much lower price (e.g. $0.33)`,
            { 
              autoClose: 20000,
              style: { whiteSpace: 'pre-line' }
            }
          );
          return;
        } else if (simulation.error.code === 115) {
          // Enhanced error 115 handling with revenue split specifics
          const partnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
          
          toast.error(
            `❌ ${simulation.error.title}\n\n` +
            `${simulation.error.message}\n\n` +
            `💡 Current Split: ${partnerShare}% Revenue / ${newPerkReinvestmentPercent}% Reinvestment / 10% Platform\n\n` +
            `🔧 Your revenue/investment ratio may be misaligned with your current settings.\n\n` +
            `Try adjusting the slider to a different split or check Settings tab for your min/max limits.`,
            {
              autoClose: 18000,
              style: { whiteSpace: 'pre-line' }
            }
          );
          
          // Show debugging info for developers
          console.error('🔍 Error 115 Debug Info:', {
            partnerShare: partnerShare,
            reinvestmentPercent: newPerkReinvestmentPercent,
            settingsMinMax: `${perkSettings.minPartnerSharePercentage || 'unknown'}-${perkSettings.maxPartnerSharePercentage || 'unknown'}%`,
            possibleCause: partnerShare < (perkSettings.minPartnerSharePercentage || 0) || partnerShare > (perkSettings.maxPartnerSharePercentage || 100) ? 'Partner share outside settings range' : 'Other validation rule'
          });
        } else {
          // Handle all other simulation errors using the error code system
          // Let each error (114, etc.) show its specific message
          toast.error(
            `❌ ${simulation.error.title}\n\n${simulation.error.message}${simulation.error.code ? `\n\nError Code: ${simulation.error.code}` : ''}`,
            {
              autoClose: 12000,
              style: { whiteSpace: 'pre-line' }
            }
          );
        }
        
        // Don't proceed to signature - user gets immediate feedback
        return;
      }

      // ✅ Simulation passed - now execute with signature
      toast.success(`✅ Transaction validated! Estimated gas: ${simulation.gasUsed || 'Unknown'}`);
      
      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        // Success
        toast.success(
          `✅ Perk "${newPerkName}" created successfully!\n\n🔗 Transaction: ${result.digest.substring(0, 8)}...`,
          {
            onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, '_blank'),
            style: { whiteSpace: 'pre-line', cursor: 'pointer' }
          }
        );
            
            // Clear form on success
            setNewPerkName('');
            setNewPerkDescription('');
            setNewPerkType('Access'); // Reset perk type
            setNewPerkTags([]);
            setNewPerkUsdcPrice('');
        setNewPerkReinvestmentPercent(20);
        setNewPerkIcon('🎁');
            setShowTagDropdown(false);
            setTagInput('');
            // Reset expiry fields
            setNewPerkExpiryType('none');
            setNewPerkExpiryDays('30');
            setNewPerkExpiryDate('');
            // Reset consumable fields
            setNewPerkIsConsumable(false);
            setNewPerkCharges('1');
            // Reset metadata fields
            setCustomMetadata([]);
            setMetadataField({key: '', value: '', shouldHash: true});
            
            // Refresh perk data
            setTimeout(() => {
              refreshPerkData();
              fetchPartnerPerks(partnerCap.id);
        }, 2000);
      }
    } catch (error: any) {
            console.error('Perk creation failed:', error);
      
      // Handle execution errors (after simulation passed)
      const { title, message } = formatErrorForToast(error);
      const parsedError = parseErrorCode(error?.message || error?.toString() || '');
      
      toast.error(
        `❌ ${title}\n\n${message}${parsedError?.code ? `\n\nError Code: ${parsedError.code}` : ''}`,
        {
          autoClose: 12000,
          style: { whiteSpace: 'pre-line' }
        }
      );
    } finally {
      setIsCreatingPerk(false);
    }
  };

  const handleTogglePerkStatus = async (perk: PerkDefinition) => {
    const senderAddress = currentWallet?.accounts?.[0]?.address;
    
    if (!senderAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const newStatus = !perk.is_active;

      const transaction = buildSetPerkActiveStatusTransaction(
        partnerCap.id,
        perk.id,
        newStatus,
        undefined // deployer sponsored transaction
      );

      // 🔍 PRE-SIMULATION: Check transaction before signature
      toast.info(`🔍 Validating ${newStatus ? 'activation' : 'pause'}...`);
      
      const simulation = await simulateTransaction(client, transaction, senderAddress);
      
      if (!simulation.success && simulation.error) {
        toast.error(
          `❌ ${simulation.error.title}\n\n${simulation.error.message}${simulation.error.code ? `\n\nError Code: ${simulation.error.code}` : ''}`,
          {
            autoClose: 12000,
            style: { whiteSpace: 'pre-line' }
          }
        );
        return;
      }

      // ✅ Simulation passed - proceed with execution
      const result = await signAndExecuteTransaction({
        transaction,
        chain: 'sui:testnet',
      });

      if (result?.digest) {
        toast.success(
          `✅ Perk ${newStatus ? 'activated' : 'paused'} successfully!\n\n🔗 Transaction: ${result.digest.substring(0, 8)}...`,
          {
            onClick: () => window.open(`https://suiscan.xyz/testnet/tx/${result.digest}`, '_blank'),
            style: { whiteSpace: 'pre-line', cursor: 'pointer' }
          }
        );
            
            // Refresh perk data
            setTimeout(() => {
              refreshPerkData();
              fetchPartnerPerks(partnerCap.id);
            }, 2000);
      }
    } catch (error: any) {
            console.error('Perk status update failed:', error);
      
      const { title, message } = formatErrorForToast(error);
      const parsedError = parseErrorCode(error?.message || error?.toString() || '');
      
      toast.error(
        `❌ ${title}\n\n${message}${parsedError?.code ? `\n\nError Code: ${parsedError.code}` : ''}`,
        {
          autoClose: 10000,
          style: { whiteSpace: 'pre-line' }
        }
      );
    }
  };

  const handleEditPerk = async (perk: PerkDefinition) => {
    setEditingPerk(perk);
    setEditForm({
      name: perk.name,
      description: perk.description,
      tags: [...perk.tags],
      usdcPrice: perk.usdc_price.toString(),
      isActive: perk.is_active,
      icon: perk.icon || '🎁',
    });

    // Load existing metadata
    setIsLoadingMetadata(true);
    try {
      const metadata = await fetchPerkMetadata(perk);
      setEditMetadata(metadata);
    } catch (error) {
      console.error('Failed to load perk metadata:', error);
      setEditMetadata({});
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingPerk(null);
    setEditForm({
      name: '',
      description: '',
      tags: [],
      usdcPrice: '',
      isActive: true,
      icon: '🎁',
    });
    setEditMetadata({});
    setEditMetadataField({key: '', value: '', shouldHash: true});
    setShowEditMetadataModal(false);
  };

  // Edit metadata functions
  const addEditMetadataField = () => {
    if (!editMetadataField.key.trim() || !editMetadataField.value.trim()) {
      toast.error('Please fill in both key and value fields');
      return;
    }

    // Handle comma-separated inputs
    const keys = editMetadataField.key.split(',').map(k => k.trim()).filter(k => k.length > 0);
    const values = editMetadataField.value.split(',').map(v => v.trim()).filter(v => v.length > 0);

    if (keys.length !== values.length) {
      toast.error('Number of keys must match number of values');
      return;
    }

    // Check for duplicates
    const duplicateKeys = keys.filter(key => key in editMetadata);
    if (duplicateKeys.length > 0) {
      toast.error(`Duplicate keys found: ${duplicateKeys.join(', ')}`);
      return;
    }

    // Process fields
    if (!perkSettings?.partnerSalt && editMetadataField.shouldHash) {
      toast.error('Partner salt required for hashing. Please generate a salt in settings first.');
      return;
    }

    const newFields: {[key: string]: string} = {};
    keys.forEach((key, index) => {
      const value = values[index];
      newFields[key] = editMetadataField.shouldHash && perkSettings?.partnerSalt
        ? hashMetadata(value, perkSettings.partnerSalt)
        : value;
    });

    setEditMetadata(prev => ({ ...prev, ...newFields }));
    setEditMetadataField({key: '', value: '', shouldHash: true});
    setShowEditMetadataModal(false);

    toast.success(`Added ${keys.length} metadata field(s)!`);
  };

  const removeEditMetadataField = (keyToRemove: string) => {
    setEditMetadata(prev => {
      const newMetadata = { ...prev };
      delete newMetadata[keyToRemove];
      return newMetadata;
    });
    toast.success('Metadata field removed');
  };

  // Test RPC connectivity
  const testRpcConnection = async () => {
    try {
      console.log('🔧 Testing RPC connectivity...');
      console.log('Current network:', CURRENT_NETWORK);
      
      // Simple connectivity test
      const startTime = Date.now();
      await suiClient.getLatestSuiSystemState();
      const duration = Date.now() - startTime;
      
      console.log(`✅ RPC connection successful (${duration}ms)`);
      toast.success(`RPC connection successful (${duration}ms)`);
    } catch (error) {
      console.error('RPC test failed:', error);
      toast.error('RPC connectivity test failed');
    }
  };

  const handleUpdatePerk = async () => {
    if (!editingPerk) return;

    setIsUpdatingPerk(true);
    try {
      // Check for metadata changes first
      const originalMetadata = await fetchPerkMetadata(editingPerk);
      const hasMetadataChanges = JSON.stringify(editMetadata) !== JSON.stringify(originalMetadata);
      
      if (hasMetadataChanges) {
        // NOTE: Currently, the smart contract doesn't support updating metadata after perk creation
        // This would require adding a new function like update_perk_definition_metadata
        toast.warning(
          '⚠️ Metadata changes detected but cannot be updated on-chain yet. ' +
          'Currently, perk metadata is immutable after creation. ' +
          'This feature will be available in a future smart contract update.',
          { autoClose: 8000 }
        );
      }

      // 1. Update tags if they changed
      if (JSON.stringify(editForm.tags) !== JSON.stringify(editingPerk.tags)) {
        const updateTagsTransaction = new Transaction();
        updateTagsTransaction.moveCall({
          target: `${editingPerk.packageId}::perk_manager::update_perk_tags`,
          arguments: [
            updateTagsTransaction.object(partnerCap.id),
            updateTagsTransaction.object(editingPerk.id),
            updateTagsTransaction.pure(bcs.vector(bcs.string()).serialize(editForm.tags)),
          ],
        });

        const tagsResult = await signAndExecuteTransaction({
          transaction: updateTagsTransaction,
          chain: 'sui:testnet',
        });

        if (tagsResult?.digest) {
          toast.success(
            <SuccessToast
              title="Perk tags updated successfully!"
              txHash={tagsResult.digest}
            />
          );
        }
      }

      // 2. Update active status if it changed
      if (editForm.isActive !== editingPerk.is_active) {
        await handleTogglePerkStatus(editingPerk);
      }

      // Show summary of what was updated
      if (!hasMetadataChanges) {
        toast.success('✅ Perk updated successfully!');
      }

      // Close edit modal
      handleCancelEdit();
      
      // Refresh perk data
      setTimeout(() => {
        refreshPerkData();
        fetchPartnerPerks(partnerCap.id);
      }, 2000);

    } catch (error: any) {
      console.error('Perk update failed:', error);
      
      const { title, message } = formatErrorForToast(error);
      const parsedError = parseErrorCode(error?.message || error?.toString() || '');
      
      toast.error(
        <ErrorToast
          title={title}
          message={message}
          errorCode={parsedError?.code}
          onRetry={() => handleUpdatePerk()}
        />,
        {
          autoClose: 10000,
        }
      );
    } finally {
      setIsUpdatingPerk(false);
    }
  };

  const handleUpdatePerkSettings = async () => {
    if (!partnerCap?.id) return;

    setIsUpdatingSettings(true);
    try {
      // Define allowed arrays - use all available tags from frontend to make system unrestricted
      const allowedPerkTypes = ['Access', 'Service', 'Digital Asset', 'Physical', 'Event', 'VIP', 'Premium', 'Exclusive', 'Limited', 'Beta', 'Financial', 'Education', 'Digital'];
      const allowedTags = availableTags; // Use all tags from the frontend availableTags array

      // MERGED TRANSACTION: Update all settings in a single transaction for better reliability
      toast.info('🔧 Updating all perk settings in a single transaction...');
      
      // Use the consolidated transaction builder function
      const settingsTx = buildUpdateAllPerkSettingsTransaction(
        partnerCap.id,
        {
          maxPerksPerPartner: perkSettings.maxPerksPerPartner || 100,
          maxClaimsPerPerk: perkSettings.maxClaimsPerPerk || 1000,
          maxCostPerPerkUsd: perkSettings.maxCostPerPerkUsd || 100,
          minPartnerSharePercentage: perkSettings.minPartnerSharePercentage || 50,
          maxPartnerSharePercentage: perkSettings.maxPartnerSharePercentage || 90,
          allowConsumablePerks: perkSettings.allowConsumablePerks || true,
          allowExpiringPerks: perkSettings.allowExpiringPerks || true,
          allowUniqueMetadata: perkSettings.allowUniqueMetadata || true
        },
        allowedPerkTypes,
        allowedTags
      );

      const settingsResult = await signAndExecuteTransaction({
        transaction: settingsTx,
        chain: 'sui:testnet',
      });

      if (settingsResult?.digest) {
        toast.success(
          <SuccessToast
            title="🎉 All perk settings updated successfully!"
            message="✅ Control Settings • ✅ Perk Types • ✅ Tags - All updated in one transaction!"
            txHash={settingsResult.digest}
          />
        );
      }
        
      // Comprehensive refresh after transaction completes
      toast.info('🔄 Refreshing partner data...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Refresh both local state and parent component data
      if (onRefresh) {
        onRefresh();
      }
      refreshData();
      
      // Refresh settings using the new hook
      await refreshSettings();
      
      toast.success('✅ Settings updated and data refreshed!');

    } catch (error: any) {
      console.error('Failed to update perk settings:', error);
      
      const { title, message } = formatErrorForToast(error);
      const parsedError = parseErrorCode(error?.message || error?.toString() || '');
      
      toast.error(
        <ErrorToast
          title={title}
          message={message}
          errorCode={parsedError?.code}
          onRetry={() => handleUpdatePerkSettings()}
        />,
        {
          autoClose: 15000, // Keep settings error messages visible even longer
        }
      );
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // Initialize settings from blockchain data when partner cap changes
  useEffect(() => {
    if (partnerCap?.id) {
      // Settings will be loaded by usePartnerSettings hook
    }
  }, [partnerCap?.id]);



  const renderOverviewTab = () => {
    // Calculate comprehensive business metrics
    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
    const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
    const dailyQuota = Math.floor(lifetimeQuota * 0.03);
    const pointsMintedToday = partnerCap.pointsMintedToday || 0;
    const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
    const availableDaily = Math.max(0, dailyQuota - pointsMintedToday);
    const remainingLifetime = Math.max(0, lifetimeQuota - lifetimeMinted);
    const dailyUsedPercent = dailyQuota > 0 ? (pointsMintedToday / dailyQuota) * 100 : 0;
    const lifetimeUsedPercent = lifetimeQuota > 0 ? (lifetimeMinted / lifetimeQuota) * 100 : 0;
    const withdrawable = calculateWithdrawableAmount();
    const metrics = getPartnerPerkMetrics(partnerCap.id);
    const totalPerks = metrics.totalPerks || partnerCap.totalPerksCreated || 0;
    
    // Business intelligence calculations
    const capitalEfficiency = tvlBackingUsd > 0 ? (lifetimeMinted / (tvlBackingUsd * 1000)) * 100 : 0;
    const dailyBurnRate = dailyQuota > 0 ? (pointsMintedToday / dailyQuota) * 100 : 0;
    const projectedDaysToCapacity = remainingLifetime > 0 && pointsMintedToday > 0 ? Math.floor(remainingLifetime / (pointsMintedToday || 1)) : Infinity;
    const revenueProjection = lifetimeMinted * 0.001; // Assuming $0.001 per point average
    
    // Risk assessment
    const getRiskLevel = () => {
      if (lifetimeUsedPercent > 90) return { level: 'High', color: 'text-red-400', bg: 'bg-red-500/10' };
      if (lifetimeUsedPercent > 70) return { level: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
      return { level: 'Low', color: 'text-green-400', bg: 'bg-green-500/10' };
    };
    const risk = getRiskLevel();

    return (
      <div className="space-y-6">
        {/* Executive Summary Header */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 backdrop-blur-lg border border-blue-700/30 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div>
                <h2 className="text-lg font-bold text-white">{partnerCap.partnerName}</h2>
                <p className="text-xs text-blue-200">Complete operational dashboard</p>
              </div>
              
              <div className="hidden lg:flex items-center space-x-8">
                <div className="text-center py-1">
                  <div className="text-xl font-bold text-blue-300 mb-1">${tvlBackingUsd.toLocaleString()}</div>
                  <div className="text-xs text-blue-200">Capital Deployed</div>
                </div>
                <div className="text-center py-1">
                  <div className="text-xl font-bold text-green-300 mb-1">{lifetimeMinted.toLocaleString()}</div>
                  <div className="text-xs text-green-200">Points Distributed</div>
                </div>
                <div className="text-center py-1">
                  <div className="text-xl font-bold text-purple-300 mb-1">{totalPerks}</div>
                  <div className="text-xs text-purple-200">Active Perks</div>
                </div>
                <div className="text-center py-1">
                  <div className="text-xl font-bold text-yellow-300 mb-1">{capitalEfficiency.toFixed(1)}%</div>
                  <div className="text-xs text-yellow-200">Efficiency</div>
                </div>
              </div>
              
              <div className="hidden xl:flex items-center space-x-8 border-l border-blue-400/30 pl-8">
                <div className="text-center py-1">
                  <div className="text-xl font-bold text-cyan-300 mb-1">{dailyUsedPercent.toFixed(1)}%</div>
                  <div className="text-xs text-cyan-200">Daily Used</div>
                </div>
                <div className="text-center py-1">
                  <div className="text-xl font-bold text-indigo-300 mb-1">{lifetimeUsedPercent.toFixed(1)}%</div>
                  <div className="text-xs text-indigo-200">Lifetime Used</div>
                </div>
                <div className="text-center py-1">
                  <div className="text-xl font-bold text-orange-300 mb-1">
                    {projectedDaysToCapacity === Infinity ? '∞' : projectedDaysToCapacity > 999 ? '999+' : projectedDaysToCapacity}
                  </div>
                  <div className="text-xs text-orange-200">Days Runway</div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="hidden lg:flex items-center space-x-2">
                <Button 
                  className="text-xs btn-modern-primary px-3 py-1.5"
                  onClick={() => setShowCollateralModal({ type: 'topup', isOpen: true })}
                >
                  <span className="mr-1">⬆️</span>
                  Increase
                </Button>
                <Button 
                  className="text-xs bg-green-600 hover:bg-green-700 px-3 py-1.5"
                  onClick={() => setShowCollateralModal({ type: 'add', isOpen: true })}
                >
                  <span className="mr-1">➕</span>
                  Add
                </Button>
                {withdrawable > 0 && (
                  <Button 
                    className="text-xs bg-orange-600 hover:bg-orange-700 px-3 py-1.5"
                    onClick={() => setShowWithdrawalModal(true)}
                  >
                    <span className="mr-1">⬇️</span>
                    Extract
                  </Button>
                )}
              </div>
              
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${risk.bg} ${risk.color}`}>
                Risk: {risk.level}
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Quota Progress Bar */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8 flex-1">
              {/* Daily Progress - Expanded */}
              <div className="flex items-center space-x-4 flex-1">
                <span className="text-sm text-blue-300 w-12 font-medium">Daily</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 min-w-0 relative">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                    style={{ width: `${Math.min(dailyUsedPercent, 100)}%` }}
                  >
                    {/* Subtle animated shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                  </div>
                  {/* Usage indicator line */}
                  {dailyUsedPercent > 5 && (
                    <div className="absolute top-0 bottom-0 flex items-center text-xs font-medium text-white/90" style={{ left: `${Math.min(dailyUsedPercent, 95)}%`, transform: 'translateX(-50%)' }}>
                      <span className="bg-blue-600/80 px-1 py-0.5 rounded text-xs">{dailyUsedPercent.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-right min-w-[80px]">
                  <div className="text-sm font-semibold text-white">{pointsMintedToday.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">of {dailyQuota.toLocaleString()}</div>
                </div>
              </div>
            </div>
            
            <div className="w-px h-8 bg-gray-600 mx-6"></div>
            
            <div className="flex items-center space-x-8 flex-1">
              {/* Lifetime Progress - Expanded */}
              <div className="flex items-center space-x-4 flex-1">
                <span className="text-sm text-purple-300 w-16 font-medium">Lifetime</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 min-w-0 relative">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-purple-400 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                    style={{ width: `${Math.min(lifetimeUsedPercent, 100)}%` }}
                  >
                    {/* Subtle animated shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                  </div>
                  {/* Usage indicator line */}
                  {lifetimeUsedPercent > 5 && (
                    <div className="absolute top-0 bottom-0 flex items-center text-xs font-medium text-white/90" style={{ left: `${Math.min(lifetimeUsedPercent, 95)}%`, transform: 'translateX(-50%)' }}>
                      <span className="bg-purple-600/80 px-1 py-0.5 rounded text-xs">{lifetimeUsedPercent.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
                <div className="text-right min-w-[100px]">
                  <div className="text-sm font-semibold text-white">{lifetimeMinted.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">of {lifetimeQuota.toLocaleString()}</div>
                </div>
              </div>
              
              {/* Action Button */}
              <div className="flex items-center space-x-3">
                {(lifetimeUsedPercent >= 70 || dailyUsedPercent >= 80) && (
                  <Button 
                    className="text-sm btn-modern-primary px-4 py-2 whitespace-nowrap"
                    onClick={() => setShowCollateralModal({ type: 'add', isOpen: true })}
                  >
                    <span className="mr-2">⬆️</span>
                    Scale Up
                  </Button>
                )}
                <Button 
                  className="text-sm bg-gray-600 hover:bg-gray-700 px-3 py-2 whitespace-nowrap"
                  onClick={onRefresh}

                >
                  <span className="mr-1">🔄</span>
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Business Intelligence Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Strategic Actions */}
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">🎯</span>
              Strategic Actions
            </h3>
            
            <div className="space-y-4">
              {/* Perk Management */}
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-300">Marketplace Presence</span>
                    <span className="text-lg font-bold text-white">{totalPerks}</span>
                    <span className="text-xs text-gray-400">Active Perks</span>
                  </div>
                </div>
                <Link to="/partners/perks" className="block">
                  <Button className="w-full text-xs">
                    <span className="mr-2">🎁</span>
                    Manage Perks
                  </Button>
                </Link>
              </div>

              {/* Analytics Access */}
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-sm text-gray-300 mb-2">Performance Insights</div>
                <div className="text-xs text-gray-400 mb-2">Deep dive into your metrics</div>
                <Link to="/partners/analytics" className="block">
                  <Button className="w-full text-xs btn-modern-secondary">
                    <span className="mr-2">📈</span>
                    View Analytics
                  </Button>
                </Link>
              </div>

              {/* System Actions */}
              <div className="space-y-2">
                <Button 
                  className="w-full text-xs btn-modern-secondary"
                  onClick={onRefresh}
                >
                  <span className="mr-2">🔄</span>
                  Refresh Data
                </Button>
                <Button 
                  className="w-full text-xs bg-purple-700 hover:bg-purple-600"
                  onClick={() => setShowSDKConfigDashboard(true)}
                >
                  <span className="mr-2">🔗</span>
                  Zero-Dev SDK
                </Button>
                <Link to="/partners/create" className="block">
                  <Button className="w-full text-xs bg-green-700 hover:bg-green-600">
                    <span className="mr-2">➕</span>
                    New Partner Cap
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Smart Recommendations */}
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">🧠</span>
              Smart Recommendations
            </h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {/* Strategic Business Recommendations */}
              {(() => {
                const recommendations = [];
                
                // Capital Optimization Strategies
                if (lifetimeUsedPercent > 80) {
                  recommendations.push(
                    <div key="capacity" className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-red-400 mb-1">⚠️ Scale Capital Infrastructure</div>
                      <div className="text-xs text-red-300 mb-2">At {lifetimeUsedPercent.toFixed(1)}% capacity utilization - approaching operational limits.</div>
                      <div className="text-xs text-red-200">💡 Strategy: Add ${Math.ceil(tvlBackingUsd * 0.5).toLocaleString()} collateral to unlock {Math.ceil(tvlBackingUsd * 500).toLocaleString()} more Alpha Points capacity.</div>
                    </div>
                  );
                } else if (lifetimeUsedPercent > 60) {
                  recommendations.push(
                    <div key="growth-prep" className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-orange-400 mb-1">📈 Prepare for Growth</div>
                      <div className="text-xs text-orange-300 mb-2">At {lifetimeUsedPercent.toFixed(1)}% capacity - good time to plan expansion.</div>
                      <div className="text-xs text-orange-200">💡 Strategy: Consider adding collateral before hitting 80% to avoid service disruption during peak demand.</div>
                    </div>
                  );
                }

                // Revenue Optimization
                if (totalPerks === 0) {
                  recommendations.push(
                    <div key="first-perk" className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-blue-400 mb-1">🚀 Launch Revenue Stream</div>
                      <div className="text-xs text-blue-300 mb-2">You have ${tvlBackingUsd.toLocaleString()} in capital but no active perks.</div>
                      <div className="text-xs text-blue-200">💡 Strategy: Start with 3-5 perks at different price points ($5-50) to test market demand and optimize pricing.</div>
                    </div>
                  );
                } else if (totalPerks < 3) {
                  recommendations.push(
                    <div key="diversify" className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-cyan-400 mb-1">🎯 Diversify Offerings</div>
                      <div className="text-xs text-cyan-300 mb-2">Only {totalPerks} active perk{totalPerks === 1 ? '' : 's'} - limited market coverage.</div>
                      <div className="text-xs text-cyan-200">💡 Strategy: Add perks in different categories (Digital Assets, Access, Physical) to capture broader audience segments.</div>
                    </div>
                  );
                }

                // Efficiency & Performance Insights
                if (capitalEfficiency < 30 && lifetimeMinted > 1000) {
                  recommendations.push(
                    <div key="efficiency" className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-purple-400 mb-1">⚡ Optimize Capital Efficiency</div>
                      <div className="text-xs text-purple-300 mb-2">Current efficiency: {capitalEfficiency.toFixed(1)}% - room for improvement.</div>
                      <div className="text-xs text-purple-200">💡 Strategy: Focus on higher-margin digital perks or increase perk pricing to maximize Alpha Points per dollar invested.</div>
                    </div>
                  );
                }

                // Market Timing & Demand
                if (dailyUsedPercent < 10 && pointsMintedToday === 0 && totalPerks > 0) {
                  recommendations.push(
                    <div key="marketing" className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-yellow-400 mb-1">📢 Boost Market Presence</div>
                      <div className="text-xs text-yellow-300 mb-2">Daily quota unused despite having {totalPerks} active perks.</div>
                      <div className="text-xs text-yellow-200">💡 Strategy: Launch marketing campaign, partner with influencers, or create limited-time offers to drive demand.</div>
                    </div>
                  );
                } else if (dailyUsedPercent > 70) {
                  recommendations.push(
                    <div key="demand" className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-green-400 mb-1">🔥 High Demand Detected</div>
                      <div className="text-xs text-green-300 mb-2">Using {dailyUsedPercent.toFixed(1)}% of daily quota - strong market traction.</div>
                      <div className="text-xs text-green-200">💡 Strategy: Consider premium pricing tiers or exclusive perks to capture additional value from high demand.</div>
                    </div>
                  );
                }

                // Financial Management
                if (withdrawable > tvlBackingUsd * 0.3) {
                  recommendations.push(
                    <div key="capital-mgmt" className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-indigo-400 mb-1">💼 Capital Management</div>
                      <div className="text-xs text-indigo-300 mb-2">${withdrawable.toFixed(0)} available for withdrawal ({((withdrawable/tvlBackingUsd)*100).toFixed(0)}% of capital).</div>
                      <div className="text-xs text-indigo-200">💡 Strategy: Consider reinvesting excess capital into new perks or withdraw for other business opportunities.</div>
                    </div>
                  );
                }

                // Long-term Strategic Planning
                if (projectedDaysToCapacity < 30 && projectedDaysToCapacity !== Infinity) {
                  recommendations.push(
                    <div key="runway" className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-pink-400 mb-1">⏰ Capacity Planning</div>
                      <div className="text-xs text-pink-300 mb-2">Only {projectedDaysToCapacity} days until capacity limit at current usage rate.</div>
                      <div className="text-xs text-pink-200">💡 Strategy: Plan capital injection now or implement demand management (higher pricing, limited quantities).</div>
                    </div>
                  );
                } else if (projectedDaysToCapacity > 365) {
                  recommendations.push(
                    <div key="expansion" className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-teal-400 mb-1">🌟 Expansion Opportunity</div>
                      <div className="text-xs text-teal-300 mb-2">Current capacity will last {projectedDaysToCapacity > 999 ? '999+' : projectedDaysToCapacity} days - excellent runway.</div>
                      <div className="text-xs text-teal-200">💡 Strategy: Focus on aggressive growth - launch new perk categories, partner integrations, or geographic expansion.</div>
                    </div>
                  );
                }

                // Default recommendation if no specific conditions met
                if (recommendations.length === 0) {
                  recommendations.push(
                    <div key="optimize" className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-400 mb-1">📊 Business Optimization</div>
                      <div className="text-xs text-gray-300 mb-2">Your operations are stable. Focus on optimization and growth.</div>
                      <div className="text-xs text-gray-200">💡 Strategy: Analyze perk performance data, A/B test pricing, and explore new market segments for expansion.</div>
                    </div>
                  );
                }

                return recommendations.slice(0, 4); // Show max 4 recommendations
              })()}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span className="mr-2">⚙️</span>
              System Status
            </h3>
            
            <div className="space-y-3">
              {/* Wallet Status */}
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">SUI Balance</span>
                  <div className="flex items-center">
                    {loading.suiBalance ? (
                      <div className="w-4 h-4 bg-gray-700 rounded animate-pulse mr-2"></div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-white mr-1">{formatSui(suiBalance)}</span>
                        <img src={suiLogo} alt="Sui Logo" className="w-4 h-4 rounded-full object-cover" />
                      </>
                    )}
                  </div>
                </div>
                <a
                  href="https://faucet.testnet.sui.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-cyan-500 hover:bg-cyan-600 text-white py-1 px-2 rounded text-xs font-medium transition-colors"
                >
                  Get Testnet SUI
                </a>
              </div>

              {/* Enhanced Partner Analytics */}
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-sm text-gray-300 mb-3 flex items-center">
                  <span className="mr-2">📊</span>
                  Performance Metrics
                </div>
                
                {/* Key Performance Indicators */}
                <div className="space-y-3">
                  {/* Perk Performance */}
                  <div className="bg-gray-800/50 rounded-md p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-green-300 font-medium">Perk Claims</span>
                      <span className="text-xs text-gray-400">Total</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-white">{metrics.totalClaims.toLocaleString()}</div>
                      <div className={`text-xs px-2 py-0.5 rounded-full ${
                        metrics.totalClaims > 100 ? 'bg-green-500/20 text-green-400' :
                        metrics.totalClaims > 10 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {metrics.totalClaims > 100 ? 'High' : metrics.totalClaims > 10 ? 'Active' : 'Starting'}
                      </div>
                    </div>
                  </div>

                  {/* Revenue Performance */}
                  <div className="bg-gray-800/50 rounded-md p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-purple-300 font-medium">Revenue</span>
                      <span className="text-xs text-gray-400">Generated</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-white">{metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} AP</div>
                      <div className={`text-xs px-2 py-0.5 rounded-full ${
                        metrics.totalRevenue > 1000 ? 'bg-green-500/20 text-green-400' :
                        metrics.totalRevenue > 100 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {metrics.totalRevenue > 1000 ? 'Strong' : metrics.totalRevenue > 100 ? 'Growing' : 'Early'}
                      </div>
                    </div>
                    <div className="text-center mt-1">
                      <div className="text-xs text-gray-400">≈ ${(metrics.totalRevenue / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</div>
                    </div>
                  </div>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Active Perks</div>
                      <div className="text-sm font-bold text-green-300">{metrics.activePerks.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400">Total Perks</div>
                      <div className="text-sm font-bold text-cyan-300">{metrics.totalPerks.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPerksTab = () => {
    const exampleSets = [
      {
        title: "Access & Services",
        tooltip: "Focus on exclusive access and premium services. These perks typically have high perceived value and can command premium pricing.",
        cards: [
          {
            title: "VIP Discord Access",
            type: "Access",
            price: "15.00",
            share: "75",
            description: "Exclusive Discord channel with direct developer access"
          },
          {
            title: "Priority Support",
            type: "Service", 
            price: "25.00",
            share: "70",
            description: "24/7 priority customer support with guaranteed response times"
          },
          {
            title: "Beta Access",
            type: "Access",
            price: "10.00",
            share: "80",
            description: "Early access to new features and beta releases"
          }
        ]
      },
      {
        title: "Digital Assets",
        tooltip: "Digital rewards and collectibles. Lower fulfillment costs mean higher profit margins, but ensure real utility value.",
        cards: [
          {
            title: "Exclusive NFT",
            type: "Digital Asset",
            price: "50.00", 
            share: "80",
            description: "Limited edition commemorative NFT with special traits"
          },
          {
            title: "Premium Avatar",
            type: "Digital Asset",
            price: "12.50",
            share: "85",
            description: "Exclusive avatar frames and badges for your profile"
          },
          {
            title: "Digital Wallpapers",
            type: "Digital Asset",
            price: "5.00",
            share: "90",
            description: "High-quality branded wallpaper collection"
          }
        ]
      },
      {
        title: "Physical & Events", 
        tooltip: "Physical items and events require careful cost calculation. Factor in shipping, manufacturing, and logistics when setting prices.",
        cards: [
          {
            title: "Branded Merchandise",
            type: "Physical",
            price: "35.00",
            share: "60", 
            description: "Premium branded hoodie shipped worldwide"
          },
          {
            title: "Meet & Greet",
            type: "Event",
            price: "100.00",
            share: "65",
            description: "Virtual meet and greet session with the team"
          },
          {
            title: "Conference Ticket",
            type: "Event",
            price: "200.00",
            share: "55",
            description: "VIP conference pass with networking access"
          }
        ]
      }
    ];

    // Extract compliance checking logic
    const renderComplianceCheck = () => {
      // REMOVED: PartnerPerkStats requirement checks
      // The Move package has been optimized to remove the stats object requirement
      
      // CRITICAL: Detect fresh partner caps without settings 
      // If currentSettings is null, this partner cap has NEVER been configured
      if (!currentSettings && !isLoadingSettings) {
        return (
          <div className="flex items-center space-x-2 bg-orange-500/10 border border-orange-500/20 rounded-md px-3 py-2 min-h-[40px]">
            <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"></div>
            <span className="text-orange-400 text-xs font-medium flex-1">Settings Required</span>
            <button
              onClick={() => navigate('/partners/settings')}
              className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors flex-shrink-0"
              title="Configure blockchain settings"
            >
              Configure
            </button>
          </div>
        );
      }
      
      // Show loading state while fetching settings
      if (isLoadingSettings) {
        return (
          <div className="flex items-center space-x-2 bg-gray-500/10 border border-gray-500/20 rounded-md px-3 py-2 min-h-[40px]">
            <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse flex-shrink-0"></div>
            <span className="text-gray-400 text-xs font-medium flex-1">Loading Settings...</span>
          </div>
        );
      }
      
      // At this point we know currentSettings exists, so we can safely use it
      const maxCost = currentSettings!.maxCostPerPerkUsd;
      const minShare = currentSettings!.minPartnerSharePercentage;
      const maxShare = currentSettings!.maxPartnerSharePercentage;
      const allowedTypes = currentSettings!.allowedPerkTypes;
      const allowedTags = currentSettings!.allowedTags;
      const maxPerks = currentSettings!.maxPerksPerPartner;
      

      
      // Check if the settings are configured but have invalid/zero values
      // FIXED: Only consider settings invalid if maxCost is 0 AND no range is set
      // If minShare and maxShare are both 0, that could be valid (no restrictions)
      const hasInvalidSettings = maxCost === 0 && maxPerks === 0;
      
      if (hasInvalidSettings) {
        return (
          <div className="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2 min-h-[40px]">
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
            <span className="text-blue-400 text-xs font-medium flex-1">Invalid Settings</span>
            <button
              onClick={() => navigate('/partners/settings')}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex-shrink-0"
              title="Fix invalid settings values"
            >
              Fix
            </button>
          </div>
        );
      }
      
      // Enhanced check: settings are unconfigured if they're zero OR if this specific partner cap hasn't been set up
      const isUnconfigured = maxCost === 0 || (minShare === 0 && maxShare === 0) || !currentSettings;
      
      // Show loading state while fetching settings
      if (isLoadingSettings) {
        return (
          <div className="flex items-center space-x-2 bg-gray-500/10 border border-gray-500/20 rounded-md px-3 py-2 min-h-[40px]">
            <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse flex-shrink-0"></div>
            <span className="text-gray-400 text-xs font-medium flex-1">Loading Settings...</span>
          </div>
        );
      }
      
      if (isUnconfigured) {
        return (
          <div className="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2 min-h-[40px]">
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
            <span className="text-blue-400 text-xs font-medium flex-1">Settings Required</span>
            <button
              onClick={() => navigate('/partners/settings')}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex-shrink-0"
              title="Configure settings to enable perk validation"
            >
              Configure
            </button>
          </div>
        );
      }
      
      // Helper functions for individual validations (now using validated currentSettings)
      const renderPriceValidation = () => {
        const price = parseFloat(newPerkUsdcPrice) || 0;
        const isValid = price > 0 && price <= maxCost;
        const isEmpty = !newPerkUsdcPrice.trim();
        
        if (isEmpty) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span className="text-gray-400">Price: Not set</span>
            </>
          );
        } else if (isValid) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-400">Price: ${price.toFixed(2)} ✓</span>
            </>
          );
        } else {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-400">Price: Exceeds ${maxCost} limit</span>
            </>
          );
        }
      };

      const renderSplitValidation = () => {
        const partnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
        const isValid = partnerShare >= minShare && partnerShare <= maxShare;
        
        if (isValid) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-400">Split: {partnerShare}% ✓</span>
            </>
          );
        } else {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-400">Split: {partnerShare}% (Range: {minShare}-{maxShare}%)</span>
            </>
          );
        }
      };

      const renderTagsValidation = () => {
        const hasEnoughTags = newPerkTags.length >= 1;
        const notTooManyTags = newPerkTags.length <= 5;
        
        // Enhanced: Check against on-chain allowed tags
        const allTagsAllowed = allowedTags.length === 0 || newPerkTags.every(tag => allowedTags.includes(tag));
        const isValid = hasEnoughTags && notTooManyTags && allTagsAllowed;
        
        if (isValid) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-400">Tags: {newPerkTags.length}/5 ✓</span>
            </>
          );
        } else if (!hasEnoughTags) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-400">Tags: Need at least 1</span>
            </>
          );
        } else if (!allTagsAllowed) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-400">Tags: Contains disallowed tags</span>
              <button
                onClick={() => {
                  if (currentTab !== 'settings') {
                    // Navigate to settings tab if not already there
                    window.location.hash = '#settings';
                  }
                  toast.info('💡 Go to Settings tab and click "Save Settings" to allow all tags', { autoClose: 5000 });
                }}
                className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                title="Update settings to allow all tags"
              >
                Fix
              </button>
            </>
          );
        } else {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-yellow-400">Tags: {newPerkTags.length}/5 (Max reached)</span>
            </>
          );
        }
      };

      const renderTypeValidation = () => {
        // Enhanced: Check against on-chain allowed perk types
        const isTypeAllowed = allowedTypes.length === 0 || allowedTypes.includes(newPerkType);
        
        if (isTypeAllowed) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-400">Type: {newPerkType} ✓</span>
            </>
          );
        } else {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-red-400">Type: Not allowed</span>
            </>
          );
        }
      };

      const renderReadinessValidation = () => {
        const hasName = newPerkName.trim().length > 0;
        const hasDescription = newPerkDescription.trim().length > 0;
        const hasValidPrice = parseFloat(newPerkUsdcPrice) > 0 && parseFloat(newPerkUsdcPrice) <= maxCost;
        const hasValidSplit = (() => {
          const partnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
          return partnerShare >= minShare && partnerShare <= maxShare;
        })();
        const hasTags = newPerkTags.length >= 1;
        
        // Enhanced: Include on-chain validations
        const allTagsAllowed = allowedTags.length === 0 || newPerkTags.every(tag => allowedTags.includes(tag));
        const isTypeAllowed = allowedTypes.length === 0 || allowedTypes.includes(newPerkType);
        
        // CRITICAL: Include PartnerPerkStats requirement
        const hasStatsObject = hasPartnerStats === true;
        
        const isReady = hasName && hasDescription && hasValidPrice && hasValidSplit && hasTags && allTagsAllowed && isTypeAllowed && hasStatsObject;
        
        if (isReady) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-400 font-medium">Ready to Create ✓</span>
            </>
          );
        } else {
          const missing = [];
          if (!hasStatsObject) missing.push('stats object');
          if (!hasName) missing.push('name');
          if (!hasDescription) missing.push('description');
          if (!hasValidPrice) missing.push('valid price');
          if (!hasValidSplit) missing.push('valid split');
          if (!hasTags) missing.push('tags');
          if (!allTagsAllowed) missing.push('valid tags');
          if (!isTypeAllowed) missing.push('valid type');
          
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-yellow-400">Missing: {missing.slice(0, 2).join(', ')}{missing.length > 2 ? '...' : ''}</span>
            </>
          );
        }
      };
      
      // If we have stats and settings, only show validation grid (no "Ready to Create" banner)
      if (hasPartnerStats === true && currentSettings) {
        return (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {/* Left Column - Validation Status */}
            <div className="space-y-2">
              {/* Price Validation */}
              <div className="flex items-center space-x-2">
                {renderPriceValidation()}
              </div>
              
              {/* Revenue Split Validation */}
              <div className="flex items-center space-x-2">
                {renderSplitValidation()}
              </div>
            </div>
            
            {/* Right Column - Requirements */}
            <div className="space-y-2">
              {/* Tags Validation */}
              <div className="flex items-center space-x-2">
                {renderTagsValidation()}
              </div>
              
              {/* Type Validation */}
              <div className="flex items-center space-x-2">
                {renderTypeValidation()}
              </div>
            </div>
          </div>
        );
      }
      
      // Fallback - should not reach here if logic is correct
      return (
        <div className="flex items-center space-x-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2 min-h-[40px]">
          <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"></div>
          <span className="text-yellow-400 text-xs font-medium flex-1">Unexpected State</span>
          <button
            onClick={() => checkPartnerStats(true)}
            className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors flex-shrink-0"
            title="Refresh detection"
          >
            🔄
          </button>
        </div>
      );
    };

    return (
      <div>
        {/* Create New Perk Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
          {/* Extended Perk Creation Form - Takes 2 columns */}
          <div className="lg:col-span-2 bg-background-card rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-white">Create New Perk</h4>
              <div className="flex items-center space-x-1">
                {/* Best Practices Icons */}
                <div className="flex items-center space-x-1 mr-2">
                  {/* Pricing Strategy */}
                  <span 
                    className="text-lg cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'pricing')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    💰
                  </span>
                  
                  {/* Revenue Split Strategy */}
                  <span 
                    className="text-lg cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'revenue')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    ⚖️
                  </span>
                  
                  {/* Tag Optimization */}
                  <span 
                    className="text-lg cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'tags')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    🏷️
                  </span>
                  
                  {/* Success Metrics */}
                  <span 
                    className="text-lg cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'metrics')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    📊
                  </span>
                  
                  {/* Pro Strategies */}
                  <span 
                    className="text-lg cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'strategies')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    🔄
                  </span>
                  
                  {/* Value Stacking */}
                  <span 
                    className="text-lg cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'value')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    💎
                  </span>
                </div>
                
                {/* Field Guide Pro Tips Tooltip */}
                <div className="flex items-center space-x-1 mr-2">
                  <svg 
                    className="w-4 h-4 text-green-400 cursor-help" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    onMouseEnter={(e) => handleTooltipEnter(e, 'green')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={() => handleTooltipLeave('green')}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                </div>
                
                <div className="flex items-center space-x-1">
                  <svg 
                    className="w-4 h-4 text-blue-400 cursor-help" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    onMouseEnter={(e) => handleTooltipEnter(e, 'blue')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={() => handleTooltipLeave('blue')}
                  >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                </div>
                
                <div className="flex items-center space-x-1">
                  <span 
                    className="text-yellow-400 cursor-help text-sm"
                    onMouseEnter={(e) => handleTooltipEnter(e, 'yellow')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={() => handleTooltipLeave('yellow')}
                  >
                    🎨
                  </span>
                </div>
              </div>
            </div>
            
            {/* Portal Tooltips */}
            <PortalTooltip show={showBlueTooltip} position={tooltipPosition}>
              <div className="text-blue-300 w-72 border-blue-700">
                <strong>Ready for Implementation:</strong> Perk creation will integrate with the on-chain perk_manager contract. 
                Revenue splits: {calculatePartnerShare(newPerkReinvestmentPercent)}% revenue to you, {newPerkReinvestmentPercent}% reinvested in your TVL, 10% to platform.
              </div>
            </PortalTooltip>
            
            <PortalTooltip show={showYellowTooltip} position={tooltipPosition}>
              <div className="text-yellow-300 w-80 border-yellow-700">
                <strong>🎨 Icon Legend:</strong><br/>
                Perk icons are currently type-based:<br/>
                • Event → 🎫 (ticket)<br/>
                • Access → 🔑 (key)<br/>  
                • Service → 🎧 (headphones)<br/>
                • Digital Asset → 🖼️ (picture)<br/>
                • Physical → 📦 (package)<br/>
                • Default → 🎁 (gift)
              </div>
            </PortalTooltip>

            <PortalTooltip show={showGreenTooltip} position={tooltipPosition}>
              <div className="text-green-300 w-80 border-green-700">
                <div className="text-green-400 font-medium text-sm mb-2">💡 Pro Tips</div>
                <div className="text-xs text-gray-300 space-y-1">
                  <div><strong>Revenue Split:</strong> The slider controls your revenue split. More reinvestment grows your TVL (increasing future quotas), while more direct revenue gives immediate profit.</div>
                  <div><strong>Default Split:</strong> 70% revenue, 20% reinvestment, 10% platform</div>
                  <div><strong>Strategy:</strong> Use templates in Field Guide to auto-fill optimal settings for different perk types.</div>
                </div>
              </div>
            </PortalTooltip>

            {/* Insight Tooltips */}
            <PortalTooltip show={showInsightTooltip === 'pricing'} position={tooltipPosition}>
              <div className="text-green-300 w-64 border-green-700">
                <div className="text-green-400 font-medium text-xs mb-1">Pricing Sweet Spot: $5-50</div>
                <div className="text-gray-300 text-xs">Most successful perks fall in this range. Start conservative, adjust based on demand.</div>
              </div>
            </PortalTooltip>

            <PortalTooltip show={showInsightTooltip === 'revenue'} position={tooltipPosition}>
              <div className="text-blue-300 w-64 border-blue-700">
                <div className="text-blue-400 font-medium text-xs mb-1">Revenue Split Strategy</div>
                <div className="text-gray-300 text-xs">70%+ for immediate profit, 30-50% for TVL growth mode, 50-70% balanced approach.</div>
              </div>
            </PortalTooltip>

            <PortalTooltip show={showInsightTooltip === 'tags'} position={tooltipPosition}>
              <div className="text-purple-300 w-64 border-purple-700">
                <div className="text-purple-400 font-medium text-xs mb-1">Tag Optimization</div>
                <div className="text-gray-300 text-xs">Use 3-5 tags: one primary type + descriptive modifiers (VIP/Limited/Beta).</div>
              </div>
            </PortalTooltip>

            <PortalTooltip show={showInsightTooltip === 'metrics'} position={tooltipPosition}>
              <div className="text-orange-300 w-72 border-orange-700">
                <div className="text-orange-400 font-medium text-xs mb-1">Success Metrics</div>
                <div className="text-gray-300 text-xs">
                  <span className="text-green-400">&gt;20% claim rate:</span> Strong demand<br/>
                  <span className="text-yellow-400">5-20%:</span> Normal range<br/>
                  <span className="text-red-400">&lt;5%:</span> Needs optimization
                </div>
              </div>
            </PortalTooltip>

            <PortalTooltip show={showInsightTooltip === 'strategies'} position={tooltipPosition}>
              <div className="text-cyan-300 w-64 border-cyan-700">
                <div className="text-cyan-400 font-medium text-xs mb-1">Pro Strategies</div>
                <div className="text-gray-300 text-xs">Rotate low-performers, bundle benefits, time launches with community events.</div>
              </div>
            </PortalTooltip>

            <PortalTooltip show={showInsightTooltip === 'value'} position={tooltipPosition}>
              <div className="text-pink-300 w-64 border-pink-700">
                <div className="text-pink-400 font-medium text-xs mb-1">Value Stacking</div>
                <div className="text-gray-300 text-xs">"Discord + Beta + Support" bundles often outperform individual perks.</div>
              </div>
            </PortalTooltip>
            
            <div className="space-y-3">
              {/* 2-Column Layout: Extended Input Stack | Revenue Slider + Alpha Points */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* LEFT COLUMN: Input Fields Stack */}
                <div className="space-y-3">
                  {/* Row 1: Name + Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Perk Name"
                      value={newPerkName}
                      onChange={(e) => setNewPerkName(e.target.value)}
                      disabled={isCreatingPerk}
                      className="w-full"
                      title="Enter a catchy name for your perk (e.g., 'VIP Discord Access', 'Exclusive NFT')"
                    />
                    
                    <select
                      value={newPerkType}
                      onChange={(e) => setNewPerkType(e.target.value)}
                      disabled={isCreatingPerk}
                      className="w-full h-10 bg-gray-900/50 border border-gray-600 rounded px-3 text-white cursor-pointer hover:border-gray-500"
                      title="Select the primary type/category for this perk"
                    >
                      <option value="Access">Access</option>
                      <option value="Service">Service</option>
                      <option value="Digital Asset">Digital Asset</option>
                      <option value="Physical">Physical</option>
                      <option value="Event">Event</option>
                      <option value="VIP">VIP</option>
                      <option value="Premium">Premium</option>
                      <option value="Exclusive">Exclusive</option>
                      <option value="Limited">Limited</option>
                      <option value="Beta">Beta</option>
                    </select>
                  </div>
                  
                  {/* Row 2: USDC Price + Tags */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      placeholder="USDC Price"
                      value={newPerkUsdcPrice}
                      onChange={(e) => setNewPerkUsdcPrice(e.target.value)}
                      disabled={isCreatingPerk}
                      step="0.01"
                      min="0"
                      className="w-full"
                      title="Set the price in USDC (e.g., 10.00 for $10). This determines the Alpha Points cost."
                    />
                    
                    {/* Streamlined Tag Selector */}
                    <div className="relative tag-selector" title="Select up to 5 tags to categorize your perk and make it discoverable">
                      <div 
                        className="min-h-[40px] border border-gray-600 rounded-md bg-gray-900/50 px-3 py-2 cursor-pointer"
                        onClick={() => setShowTagDropdown(!showTagDropdown)}
                      >
                        {newPerkTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {newPerkTags.map((tag, index) => (
                              <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded border border-blue-600/30">
                                {tag}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTag(tag);
                                  }}
                                  className="text-blue-400 hover:text-blue-200 text-xs"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">Select tags...</span>
                        )}
                      </div>
                      
                      {showTagDropdown && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-gray-800/95 backdrop-blur-lg border border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {/* Custom tag input */}
                          <div className="p-2 border-b border-gray-600">
                            <div className="flex gap-1">
                              <input
                                type="text"
                                placeholder="Custom tag..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleCustomTag()}
                                className="flex-1 px-2 py-1 text-xs bg-gray-900/50 border border-gray-600 rounded"
                                maxLength={20}
                              />
                              <button
                                type="button"
                                onClick={handleCustomTag}
                                disabled={!tagInput.trim() || newPerkTags.length >= 5}
                                className="btn-modern-primary text-xs px-2 py-1"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                          
                          {/* Predefined tags */}
                          <div className="p-1">
                            {(tagInput ? filteredTags : availableTags.filter(tag => !newPerkTags.includes(tag))).map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => addTag(tag)}
                                disabled={newPerkTags.length >= 5}
                                className="w-full text-left px-2 py-1 text-xs hover:bg-gray-700 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                              >
                                {tag}
                              </button>
                            ))}
                            {tagInput && filteredTags.length === 0 && (
                              <div className="px-2 py-1 text-xs text-gray-400">No matching tags</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Row 3: Expiry Settings */}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={newPerkExpiryType}
                      onChange={(e) => setNewPerkExpiryType(e.target.value as 'none' | 'days' | 'date')}
                      disabled={isCreatingPerk || !currentSettings?.allowExpiringPerks}
                      className="w-full h-10 bg-gray-900/50 border border-gray-600 rounded px-3 text-white cursor-pointer hover:border-gray-500 disabled:opacity-50"
                                              title={!currentSettings?.allowExpiringPerks ? "Enable expiring perks in settings first" : "Set when this perk expires"}
                    >
                      <option value="none">No Expiry</option>
                      <option value="days">Expires in X days</option>
                      <option value="date">Expires on date</option>
                    </select>
                    
                    {newPerkExpiryType === 'days' ? (
                      <Input
                        type="number"
                        placeholder="Days until expiry"
                        value={newPerkExpiryDays}
                        onChange={(e) => setNewPerkExpiryDays(e.target.value)}
                        disabled={isCreatingPerk}
                        min="1"
                        className="w-full"
                        title="Number of days from now until this perk expires"
                      />
                    ) : newPerkExpiryType === 'date' ? (
                      <Input
                        type="date"
                        value={newPerkExpiryDate}
                        onChange={(e) => setNewPerkExpiryDate(e.target.value)}
                        disabled={isCreatingPerk}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full"
                        title="Select the exact date when this perk expires"
                      />
                    ) : (
                      <div className="flex items-center justify-center px-3 py-2 bg-gray-800/30 border border-gray-700 rounded text-xs text-gray-400">
                        <span>⏰ Never expires</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Row 4: Consumable Settings */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded">
                      <input
                        type="checkbox"
                        id="consumable-toggle-main"
                        checked={newPerkIsConsumable}
                        onChange={(e) => setNewPerkIsConsumable(e.target.checked)}
                        disabled={isCreatingPerk || !currentSettings?.allowConsumablePerks}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label 
                        htmlFor="consumable-toggle-main" 
                        className={`text-sm ${!currentSettings?.allowConsumablePerks ? 'text-gray-500' : 'text-white cursor-pointer'}`}
                        title={!currentSettings?.allowConsumablePerks ? "Enable consumable perks in settings first" : "Make this perk consumable with limited uses"}
                      >
                        Consumable
                      </label>
                    </div>
                    
                    {newPerkIsConsumable ? (
                      <Input
                        type="number"
                        placeholder="Number of charges"
                        value={newPerkCharges}
                        onChange={(e) => setNewPerkCharges(e.target.value)}
                        disabled={isCreatingPerk}
                        min="1"
                        className="w-full"
                        title="How many times this perk can be used before it's consumed (e.g., 1 = single use, 12 = 12 uses)"
                      />
                    ) : (
                      <div className="flex items-center justify-center px-3 py-2 bg-gray-800/30 border border-gray-700 rounded text-xs text-gray-400">
                        <span>♾️ Unlimited uses</span>
                      </div>
                    )}
                  </div>
                  

                </div>
                
                {/* RIGHT COLUMN: Revenue Slider + Alpha Points + Compliance */}
                <div className="space-y-4">
                  {/* Compliance Check - Top */}
                  <div className="flex justify-center">
                    {renderComplianceCheck()}
                  </div>
                  
                  {/* Revenue Slider */}
                  <div className="flex flex-col justify-center">
                    <div className="relative px-2">
                      {/* Visual track with platform section */}
                      <div className="relative w-full h-3 bg-gray-600 rounded-lg mb-1">
                        {/* Main slider area (0-90%) */}
                        <div 
                          className="absolute left-0 top-0 h-full rounded-l-lg"
                          style={{
                            width: '90%',
                            background: `linear-gradient(to right, #10b981 0%, #10b981 ${(90 - newPerkReinvestmentPercent) / 90 * 100}%, #3b82f6 ${(90 - newPerkReinvestmentPercent) / 90 * 100}%, #3b82f6 100%)`
                          }}
                        />
                        {/* Platform section (90-100%) in red */}
                        <div 
                          className="absolute right-0 top-0 h-full bg-red-500/70 rounded-r-lg"
                          style={{ width: '10%' }}
                        />
                        {/* Platform label overlay */}
                        <div className="absolute right-1 top-0 h-full flex items-center">
                          <span className="text-xs text-white font-medium">10%</span>
                        </div>
                      </div>
                      
                      {/* Actual slider input */}
                      <input
                        type="range"
                        min="0"
                        max="90"
                        value={newPerkReinvestmentPercent}
                        onChange={(e) => setNewPerkReinvestmentPercent(parseInt(e.target.value))}
                        disabled={isCreatingPerk}
                        className="w-full h-3 bg-transparent rounded-lg appearance-none cursor-pointer slider absolute top-0"
                        style={{ width: '90%' }}
                      />
                      
                      {/* Dynamic Labels with Values */}
                      <div className="flex items-center text-xs text-gray-400 mt-1">
                        <div className="flex items-center space-x-1">
                          <span>💰</span>
                          <span className="text-green-400 font-medium">{90 - newPerkReinvestmentPercent}%</span>
                          <span>Revenue</span>
                        </div>
                        <div className="flex-1 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <span>🔄</span>
                            <span>Reinvest</span>
                            <span className="text-blue-400 font-medium">{newPerkReinvestmentPercent}%</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>🏛️</span>
                          <span className="text-red-400 font-medium">Platform 10%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Warning indicator if needed */}
                    {(() => {
                      const revenuePercent = 90 - newPerkReinvestmentPercent;
                      if (revenuePercent < 10) {
                        return (
                          <div className="text-center mt-2">
                            <div className="text-xs text-red-400">
                              ⚠️ Revenue share too low ({revenuePercent}%) - minimum recommended: 10%
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  
                  {/* Alpha Points Calculator - Compact */}
                  {newPerkUsdcPrice && parseFloat(newPerkUsdcPrice) > 0 ? (
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-600">
                      <div className="flex items-center justify-center gap-1 text-sm text-gray-400 mb-2">
                        <span>Alpha Points Cost</span>
                        <div className="group relative">
                          <svg className="w-3 h-3 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-3 bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10">
                            <p className="text-xs text-gray-300 font-medium mb-1">Conversion Rate</p>
                            <p className="text-xs text-gray-400">$1 USD = 1,000 Alpha Points</p>
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold text-green-400 mb-1 ${
                        (() => {
                          const apValue = usdToAlphaPointsDisplay(parseFloat(newPerkUsdcPrice));
                          const apString = formatAP(apValue);
                          if (apString.length > 12) return 'text-lg'; // Very long numbers
                          if (apString.length > 9) return 'text-xl'; // Long numbers  
                          if (apString.length > 6) return 'text-2xl'; // Medium numbers
                          return 'text-3xl'; // Short numbers only
                        })()
                      }`}>
                        {formatAP(usdToAlphaPointsDisplay(parseFloat(newPerkUsdcPrice)))}
                      </div>
                      <div className="text-xs text-gray-500">
                        ${newPerkUsdcPrice} USD = {usdToAlphaPointsDisplay(parseFloat(newPerkUsdcPrice)).toLocaleString()} AP
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-3 bg-background-input rounded-lg border border-gray-600 opacity-50">
                      <div className="flex items-center justify-center gap-1 text-sm text-gray-400 mb-2">
                        <span>Alpha Points Cost</span>
                        <div className="group relative">
                          <svg className="w-3 h-3 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-3 bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10">
                            <p className="text-xs text-gray-300 font-medium mb-1">Conversion Rate</p>
                            <p className="text-xs text-gray-400">$1 USD = 1,000 Alpha Points</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-500 mb-1">
                        --,--- AP
                      </div>
                      <div className="text-xs text-gray-500">
                        Enter price to see cost
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Description and Create Button Row */}
              <div className="grid grid-cols-5 gap-3 mt-4">
                <div className="col-span-3">
                  <Input
                    placeholder="Perk Description"
                    value={newPerkDescription}
                    onChange={(e) => setNewPerkDescription(e.target.value)}
                    disabled={isCreatingPerk}
                    className="w-full"
                    title="Describe what users get with this perk. Be specific about benefits and any redemption instructions."
                  />
                </div>
                <Button 
                  onClick={() => setShowMetadataModal(true)}
                  disabled={!perkSettings?.partnerSalt || isCreatingPerk}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600"
                  title={!perkSettings?.partnerSalt ? "Partner salt required - generate in settings" : "Add custom metadata fields"}
                >
                  🏷️ Metadata
                </Button>
                <Button 
                  onClick={handleCreatePerk}
                  disabled={
                    isCreatingPerk || 
                    !newPerkName.trim() || 
                    !newPerkDescription.trim() || 
                    newPerkTags.length === 0 || 
                    !newPerkUsdcPrice.trim()
                  }
                  className="w-full"
                  title="Create a new perk for your marketplace"
                >
                  {isCreatingPerk ? 'Creating...' : 'Create Perk'}
                </Button>
              </div>
              
              {/* Show added metadata fields if any exist */}
              {customMetadata.length > 0 && (
                <div className="mt-4 p-3 bg-gray-900/30 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <span>🏷️</span>
                      Custom Metadata ({customMetadata.length})
                    </h5>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">
                        {customMetadata.filter(f => f.shouldHash).length} hashed
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">
                        {customMetadata.filter(f => !f.shouldHash).length} plain
                      </span>
                    </div>
                  </div>
                  
                  {/* JSON-like view */}
                  <div className="bg-gray-800/50 rounded p-3 border border-gray-600">
                    <pre className="text-xs text-gray-300 font-mono">
{JSON.stringify(
  customMetadata.reduce((acc, field) => {
    acc[field.key] = field.shouldHash ? 
      `<hashed: ${field.value.substring(0, 8)}...>` : 
      field.value;
    return acc;
  }, {} as Record<string, string>), 
  null, 
  2
)}
                    </pre>
                  </div>
                  
                  {/* Individual field management */}
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-500 mb-2">Individual field controls:</p>
                    {customMetadata.map((field, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-800/30 rounded text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{field.key}</span>
                          {field.shouldHash && (
                            <span className="px-1 py-0.5 bg-green-600/20 text-green-300 text-xs rounded">🔒</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeMetadataField(field.key)}
                          className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-900/20"
                          title="Remove metadata field"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Enhanced Field Guide with Swiper - Takes 1 column */}
          <div className="lg:col-span-1 bg-background-card rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-white">Field Guide</h4>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">
                  {fieldGuideActiveIndex + 1} of 9
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => fieldGuideSwiperInstance?.slidePrev()}
                    disabled={!fieldGuideSwiperInstance}
                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => fieldGuideSwiperInstance?.slideNext()}
                    disabled={!fieldGuideSwiperInstance}
                    className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Perk Template Swiper */}
            <div className="mb-4">
              <Swiper
                modules={[Navigation, Pagination, A11y]}
                spaceBetween={0}
                slidesPerView={1}
                loop={true}
                onSwiper={setFieldGuideSwiperInstance}
                onSlideChange={(swiper) => setFieldGuideActiveIndex(swiper.realIndex)}
                className="field-guide-swiper"
              >
                                 {/* Page 1: DeFi Protocol Enhancement Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">⚡</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Priority Transaction Access</div>
                           <div className="text-xs text-gray-400">DeFi • Premium Service</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$45.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">80%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Skip the queue with priority transaction processing for staking and swaps</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Priority Transaction Access");
                           setNewPerkDescription("Skip the queue with priority transaction processing for staking and swaps");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("45.00");
                           setNewPerkReinvestmentPercent(10);
                           setNewPerkTags(["DeFi", "Premium", "Service"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🔒</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Insurance Coverage</div>
                           <div className="text-xs text-gray-400">DeFi • Risk Protection</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$60.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">70%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Smart contract insurance coverage for staked assets and liquidity positions</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Insurance Coverage");
                           setNewPerkDescription("Smart contract insurance coverage for staked assets and liquidity positions");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("60.00");
                           setNewPerkReinvestmentPercent(20);
                           setNewPerkTags(["Insurance", "DeFi", "Protection"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 2: Retail & E-commerce Enhancement Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎯</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Cashback Multiplier</div>
                           <div className="text-xs text-gray-400">Retail • Loyalty Enhancement</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$12.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">85%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">2x cashback rewards on all verified purchases for premium shoppers</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Cashback Multiplier");
                           setNewPerkDescription("2x cashback rewards on all verified purchases for premium shoppers");
                           setNewPerkType("Financial");
                           setNewPerkUsdcPrice("12.00");
                           setNewPerkReinvestmentPercent(5);
                           setNewPerkTags(["Cashback", "Retail", "Premium"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🛍️</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Early Access Sales</div>
                           <div className="text-xs text-gray-400">Retail • Exclusive Shopping</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$22.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">80%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">24-hour early access to sales, new releases, and limited edition items</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Early Access Sales");
                           setNewPerkDescription("24-hour early access to sales, new releases, and limited edition items");
                           setNewPerkType("Access");
                           setNewPerkUsdcPrice("22.00");
                           setNewPerkReinvestmentPercent(10);
                           setNewPerkTags(["Early Access", "Sales", "Exclusive"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 3: Logistics & Shipping Enhancement Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🚚</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Free Express Shipping</div>
                           <div className="text-xs text-gray-400">Logistics • Customer Service</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$18.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">70%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Unlimited free express shipping for 12 months on all orders</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Free Express Shipping");
                           setNewPerkDescription("Unlimited free express shipping for 12 months on all orders");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("18.00");
                           setNewPerkReinvestmentPercent(20);
                           setNewPerkTags(["Shipping", "Service", "Premium"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">📊</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Advanced Analytics Dashboard</div>
                           <div className="text-xs text-gray-400">Data • Professional Tools</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$25.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">75%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Professional-grade portfolio tracking with yield optimization insights</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Advanced Analytics Dashboard");
                           setNewPerkDescription("Professional-grade portfolio tracking with yield optimization insights");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("25.00");
                           setNewPerkReinvestmentPercent(15);
                           setNewPerkTags(["Analytics", "Professional", "Data"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 4: Event & Venue Enhancement Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎪</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">VIP Event Access</div>
                           <div className="text-xs text-gray-400">Events • Exclusive Experience</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$75.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">65%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Backstage access and meet-and-greet opportunities at partner venues</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("VIP Event Access");
                           setNewPerkDescription("Backstage access and meet-and-greet opportunities at partner venues");
                           setNewPerkType("Event");
                           setNewPerkUsdcPrice("75.00");
                           setNewPerkReinvestmentPercent(25);
                           setNewPerkTags(["VIP", "Events", "Exclusive"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎫</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Season Pass Upgrade</div>
                           <div className="text-xs text-gray-400">Events • Premium Access</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$95.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">60%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Annual season pass with premium seating and exclusive member events</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Season Pass Upgrade");
                           setNewPerkDescription("Annual season pass with premium seating and exclusive member events");
                           setNewPerkType("Event");
                           setNewPerkUsdcPrice("95.00");
                           setNewPerkReinvestmentPercent(30);
                           setNewPerkTags(["Season Pass", "Premium", "Events"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 5: Hospitality Enhancement Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🍽️</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Priority Reservations</div>
                           <div className="text-xs text-gray-400">Hospitality • Concierge Service</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$35.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">80%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Skip waitlists with guaranteed table reservations at partner restaurants</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Priority Reservations");
                           setNewPerkDescription("Skip waitlists with guaranteed table reservations at partner restaurants");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("35.00");
                           setNewPerkReinvestmentPercent(10);
                           setNewPerkTags(["Hospitality", "Priority", "Service"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🏨</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Hotel Upgrade Package</div>
                           <div className="text-xs text-gray-400">Travel • Luxury Service</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$65.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">75%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Automatic room upgrades and complimentary amenities at partner hotels</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Hotel Upgrade Package");
                           setNewPerkDescription("Automatic room upgrades and complimentary amenities at partner hotels");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("65.00");
                           setNewPerkReinvestmentPercent(15);
                           setNewPerkTags(["Travel", "Luxury", "Hospitality"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 6: Content & Creator Enhancement Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎬</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Creator Collaboration</div>
                           <div className="text-xs text-gray-400">Content • Partnership Opportunity</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$50.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">60%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Featured collaboration opportunities with verified content creators</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Creator Collaboration");
                           setNewPerkDescription("Featured collaboration opportunities with verified content creators");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("50.00");
                           setNewPerkReinvestmentPercent(30);
                           setNewPerkTags(["Creator", "Collaboration", "Content"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">📺</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Content Monetization Tools</div>
                           <div className="text-xs text-gray-400">Creator • Revenue Sharing</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$40.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">65%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Advanced monetization features with subscriber tiers and tip integration</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Content Monetization Tools");
                           setNewPerkDescription("Advanced monetization features with subscriber tiers and tip integration");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("40.00");
                           setNewPerkReinvestmentPercent(25);
                           setNewPerkTags(["Monetization", "Creator", "Tools"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 7: Health & Fitness Enhancement Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">💪</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Personal Training Sessions</div>
                           <div className="text-xs text-gray-400">Fitness • Professional Service</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$120.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">70%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Monthly 1-on-1 training sessions with certified fitness professionals</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Personal Training Sessions");
                           setNewPerkDescription("Monthly 1-on-1 training sessions with certified fitness professionals");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("120.00");
                           setNewPerkReinvestmentPercent(20);
                           setNewPerkTags(["Fitness", "Training", "Premium"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🥗</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Nutrition Coaching</div>
                           <div className="text-xs text-gray-400">Health • Wellness Program</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$80.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">75%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Personalized meal plans and nutrition guidance from certified dietitians</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Nutrition Coaching");
                           setNewPerkDescription("Personalized meal plans and nutrition guidance from certified dietitians");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("80.00");
                           setNewPerkReinvestmentPercent(15);
                           setNewPerkTags(["Nutrition", "Coaching", "Health"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 8: Education & Professional Development Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎓</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Certification Fast Track</div>
                           <div className="text-xs text-gray-400">Education • Career Development</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$85.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">65%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Accelerated certification programs with industry-recognized credentials</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Certification Fast Track");
                           setNewPerkDescription("Accelerated certification programs with industry-recognized credentials");
                           setNewPerkType("Education");
                           setNewPerkUsdcPrice("85.00");
                           setNewPerkReinvestmentPercent(25);
                           setNewPerkTags(["Education", "Certification", "Professional"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎯</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Mentorship Program</div>
                           <div className="text-xs text-gray-400">Career • 1-on-1 Guidance</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$150.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">60%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Monthly 1-on-1 mentorship sessions with industry experts and career guidance</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Mentorship Program");
                           setNewPerkDescription("Monthly 1-on-1 mentorship sessions with industry experts and career guidance");
                           setNewPerkType("Service");
                           setNewPerkUsdcPrice("150.00");
                           setNewPerkReinvestmentPercent(30);
                           setNewPerkTags(["Mentorship", "Career", "Professional"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>

                 {/* Page 9: Premium Services Templates */}
                 <SwiperSlide>
                   <div className="space-y-3">
                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎵</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Premium Content Library</div>
                           <div className="text-xs text-gray-400">Media • Exclusive Access</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$30.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">85%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Access to exclusive music, videos, and digital content library</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Premium Content Library");
                           setNewPerkDescription("Access to exclusive music, videos, and digital content library");
                           setNewPerkType("Digital");
                           setNewPerkUsdcPrice("30.00");
                           setNewPerkReinvestmentPercent(5);
                           setNewPerkTags(["Content", "Premium", "Digital"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>

                     <div className="bg-background rounded-lg p-2 border border-gray-700">
                       <div className="flex items-center space-x-2 mb-1">
                         <span className="text-lg">🎮</span>
                         <div className="flex-1">
                           <div className="font-medium text-white text-sm">Gaming Tournament Entry</div>
                           <div className="text-xs text-gray-400">Gaming • Competitive Access</div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                         <div className="flex justify-between">
                           <span className="text-gray-400">Price:</span>
                           <span className="text-green-400">$55.00</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-400">Revenue:</span>
                           <span className="text-purple-400">65%</span>
                         </div>
                       </div>
                       <p className="text-xs text-gray-500 line-clamp-2 mb-2">Guaranteed entry to exclusive gaming tournaments with prize pools</p>
                       <button
                         className="w-full px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                         onClick={() => {
                           setNewPerkName("Gaming Tournament Entry");
                           setNewPerkDescription("Guaranteed entry to exclusive gaming tournaments with prize pools");
                           setNewPerkType("Event");
                           setNewPerkUsdcPrice("55.00");
                           setNewPerkReinvestmentPercent(25);
                           setNewPerkTags(["Gaming", "Tournament", "Competition"]);
                         }}
                       >
                         Use Template
                       </button>
                     </div>
                   </div>
                 </SwiperSlide>
               </Swiper>
             </div>
          </div>
        </div>
        
        {/* Existing Perks Section */}
        <div className="bg-background-card rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-white">Your Perks</h4>
            <div className="text-xs text-gray-400">
              {partnerCap.partnerName}
            </div>
          </div>
          
          {/* Real Blockchain Data */}
          {(() => {
            // Show loading state
            if (isLoadingPerks) {
              return (
                <div className="text-center py-6">
                  <div className="text-4xl mb-4">⏳</div>
                  <div className="text-gray-400 mb-2">Loading your perks...</div>
                  <div className="text-sm text-gray-500">
                    Fetching PerkDefinition objects from the blockchain
                  </div>
                </div>
              );
            }

            // Show error state
            if (perkError) {
              return (
                <div className="text-center py-6">
                  <div className="text-4xl mb-4">❌</div>
                  <div className="text-red-400 mb-2">Error loading perks</div>
                  <div className="text-sm text-gray-500 mb-4">{perkError}</div>
                  <Button 
                    onClick={() => fetchPartnerPerks(partnerCap.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Retry
                  </Button>
                </div>
              );
            }

            // Filter perks for current partner
            const currentPartnerPerks = partnerPerks.filter(
              perk => perk.creator_partner_cap_id === partnerCap.id
            );

            // Show empty state
            if (currentPartnerPerks.length === 0) {
              return (
                <div className="text-center py-6">
                  <div className="text-6xl mb-4">🎁</div>
                  <div className="text-gray-400 mb-4">No perks created yet</div>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Create your first perk using the form above. Once created, perks will appear here 
                    with management options, claim statistics, and revenue tracking.
                  </p>
                </div>
              );
            }

            // Display perks in a Swiper carousel (3 cards on desktop, responsive)
            return (
              <div className="relative">
                <Swiper
                  modules={[Navigation, Pagination, A11y]}
                  spaceBetween={12}
                  slidesPerView={4}
                  slidesPerGroup={4}
                  loop={true} // Enable looping for continuous navigation
                  onSwiper={setPerkSwiperInstance}
                  onSlideChange={(swiper) => setPerkActiveIndex(swiper.activeIndex)}
                  pagination={false} 
                  navigation={false}
                  className="h-full"
                  breakpoints={{
                    0: {
                      slidesPerView: 1,
                      slidesPerGroup: 1,
                    },
                    640: {
                      slidesPerView: 2,
                      slidesPerGroup: 2,
                    },
                    1024: {
                      slidesPerView: 3,
                      slidesPerGroup: 3,
                    },
                    1280: {
                      slidesPerView: 4,
                      slidesPerGroup: 4,
                    },
                  }}
                >
                  {currentPartnerPerks.map((perk) => (
                    <SwiperSlide key={perk.id} className="h-auto">
                      <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700 h-full flex flex-col">
                        {/* Perk Header */}
                        <div className="flex items-start space-x-2 mb-1.5">
                          <div className="w-6 h-6 flex items-center justify-center bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-full text-sm flex-shrink-0">
                            {perk.icon || 
                             (perk.perk_type === 'Access' ? '🔑' :
                           perk.perk_type === 'Digital Asset' ? '🖼️' :
                           perk.perk_type === 'Service' ? '🎧' :
                           perk.perk_type === 'Event' ? '🎫' :
                              perk.perk_type === 'Physical' ? '📦' : '🎁')}
                        </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-white truncate text-sm">{perk.name}</div>
                            <div className="text-xs text-gray-400">{perk.perk_type}</div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          perk.is_active ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                              <span className={`text-xs font-medium ${
                                perk.is_active ? 'text-green-400' : 'text-yellow-400'
                              }`}>
                                {perk.is_active ? 'Active' : 'Paused'}
                              </span>
                        </div>
                      </div>
                    </div>
                    
                        {/* Perk Details Grid */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-1.5 flex-grow">
                          <div className="flex justify-between">
                            <span className="text-gray-400">USDC:</span>
                            <span className="text-green-400 font-medium">${perk.usdc_price.toFixed(2)}</span>
                            </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Claims:</span>
                            <span className="text-white font-medium">{perk.total_claims_count}</span>
                            </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">AP Price:</span>
                            <span className="text-blue-400 font-medium">{usdToAlphaPointsDisplay(perk.usdc_price).toLocaleString()}</span>
                            </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Revenue:</span>
                            <span className="text-purple-400 font-medium">{perk.partner_share_percentage}%</span>
                            </div>
                          </div>
                          
                        {/* Tags */}
                              {perk.tags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mb-1">
                            {perk.tags.slice(0, 2).map((tag, index) => (
                              <span key={index} className="text-xs bg-gray-600/50 text-gray-300 px-1 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                            {perk.tags.length > 2 && (
                              <span className="text-xs text-gray-400">+{perk.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                          
                        {/* Description */}
                        <div className="text-xs text-gray-500 mb-1.5 line-clamp-1">{perk.description}</div>

                        {/* Action Buttons */}
                        <div className="flex gap-1 mt-auto">
                            <button 
                            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                perk.is_active 
                                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePerkStatus(perk);
                              }}
                            >
                              {perk.is_active ? 'Pause' : 'Activate'}
                            </button>
                          
                          <button 
                            className="flex-1 btn-modern-primary text-xs px-2 py-1"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleEditPerk(perk);
                            }}
                          >
                            Edit
                          </button>
                          
                          <button 
                            className="btn-modern-secondary text-xs px-2 py-1"
                            onClick={() => {
                              const perkUrl = `https://suiscan.xyz/testnet/object/${perk.id}`;
                              window.open(perkUrl, '_blank');
                            }}
                            title="View on Suiscan"
                          >
                            🔗
                          </button>
                          </div>

                        {/* Perk ID */}
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          ID: {perk.id.substring(0, 8)}...
                        </div>
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
                
                {/* Navigation Controls - Only show when there are more than 4 perks */}
                {currentPartnerPerks.length > 4 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      className="p-2 rounded-full bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 hover:bg-gray-700 text-white transition-colors disabled:opacity-50"
                      aria-label="Previous perks"
                      onClick={() => perkSwiperInstance?.slidePrev()}
                      disabled={!perkSwiperInstance}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    
                    <div className="flex gap-1">
                      {Array.from({ length: Math.ceil(currentPartnerPerks.length / 4) }, (_, idx) => (
                        <button
                          key={idx}
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                            Math.floor(perkActiveIndex / 4) === idx 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => {
                            if (perkSwiperInstance) {
                              const targetSlide = idx * 4;
                              perkSwiperInstance.slideTo(targetSlide);
                            }
                          }}
                          aria-label={`Go to perk group ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      className="p-2 rounded-full bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 hover:bg-gray-700 text-white transition-colors disabled:opacity-50"
                      aria-label="Next perks"
                      onClick={() => perkSwiperInstance?.slideNext()}
                      disabled={!perkSwiperInstance}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        
        {/* Edit Perk Modal */}
        {editingPerk && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Edit Perk</h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Perk Name</label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Perk Name"
                      className="w-full"
                      disabled // Can't edit name after creation
                    />
                    <div className="text-xs text-gray-500 mt-1">Name cannot be changed after creation</div>
                  </div>
                  
                  {/* Icon Selector - DISABLED: Smart contract doesn't support custom icons yet */}
                  {/*
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Icon</label>
                    <select
                      value={editForm.icon}
                      onChange={(e) => setEditForm(prev => ({ ...prev, icon: e.target.value }))}
                      className="w-full h-10 bg-gray-900/50 border border-gray-600 rounded text-center text-lg cursor-pointer hover:border-gray-500"
                    >
                      <option value="🎁">🎁 Gift</option>
                      <option value="🔑">🔑 Access</option>
                      <option value="🎧">🎧 Service</option>
                      <option value="🖼️">🖼️ Digital</option>
                      <option value="📦">📦 Physical</option>
                      <option value="🎫">🎫 Event</option>
                      <option value="👑">👑 VIP</option>
                      <option value="⭐">⭐ Premium</option>
                      <option value="💎">💎 Exclusive</option>
                      <option value="🚀">🚀 Beta</option>
                      <option value="🎯">🎯 Target</option>
                      <option value="💰">💰 Value</option>
                      <option value="🔥">🔥 Hot</option>
                      <option value="⚡">⚡ Fast</option>
                      <option value="🌟">🌟 Special</option>
                      <option value="🎨">🎨 Creative</option>
                      <option value="🎵">🎵 Music</option>
                      <option value="📚">📚 Education</option>
                      <option value="🏆">🏆 Achievement</option>
                      <option value="🎮">🎮 Gaming</option>
                    </select>
                    <div className="text-xs text-gray-500 mt-1">You can change the perk icon</div>
                  </div>
                  */}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editForm.tags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded border border-blue-600/30">
                        {tag}
                        <button
                          type="button"
                          onClick={() => {
                            setEditForm(prev => ({
                              ...prev,
                              tags: prev.tags.filter((_, i) => i !== index)
                            }));
                          }}
                          className="text-blue-400 hover:text-blue-200 text-xs"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  
                  {/* Add Tags Dropdown */}
                  {editForm.tags.length < 5 && (
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const newTag = e.target.value;
                          if (newTag && !editForm.tags.includes(newTag)) {
                            setEditForm(prev => ({
                              ...prev,
                              tags: [...prev.tags, newTag]
                            }));
                          }
                          e.target.value = ''; // Reset select
                        }}
                        className="w-full px-3 py-2 bg-background-input border border-gray-600 rounded text-sm text-white"
                        defaultValue=""
                      >
                        <option value="" disabled>Add a tag...</option>
                        {availableTags.filter(tag => !editForm.tags.includes(tag)).map(tag => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-400 mt-2">
                    You can modify tags for your perk. {editForm.tags.length}/5 tags selected.
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Perk Description"
                    className="w-full"
                    disabled // Can't edit description after creation  
                  />
                  <div className="text-xs text-gray-500 mt-1">Description cannot be changed after creation</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">USDC Price</label>
                  <Input
                    value={editForm.usdcPrice}
                    onChange={(e) => setEditForm(prev => ({ ...prev, usdcPrice: e.target.value }))}
                    placeholder="USDC Price"
                    type="number"
                    step="0.01"
                    className="w-full"
                    disabled // Can't edit price after creation
                  />
                  <div className="text-xs text-gray-500 mt-1">Price cannot be changed after creation</div>
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-300">Perk is active</span>
                  </label>
                </div>

                {/* Metadata Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-300">Custom Metadata</label>
                    <Button
                      onClick={() => setShowEditMetadataModal(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded"
                      disabled={!perkSettings?.partnerSalt}
                    >
                      🏷️ Add Fields
                    </Button>
                  </div>
                  
                  {isLoadingMetadata ? (
                    <div className="text-center text-gray-400 text-sm py-4">
                      Loading metadata...
                    </div>
                  ) : Object.keys(editMetadata).length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {Object.entries(editMetadata).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <span className="text-sm font-medium text-blue-300 truncate">{key}</span>
                            <span className="text-xs text-gray-400">:</span>
                            <span className="text-sm text-gray-300 truncate flex-1">
                              {value.length > 50 ? `${value.substring(0, 50)}...` : value}
                            </span>
                          </div>
                          <button
                            onClick={() => removeEditMetadataField(key)}
                            className="text-red-400 hover:text-red-300 ml-2 text-xs"
                            title="Remove field"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 text-sm py-4 bg-gray-800/30 rounded border-2 border-dashed border-gray-600">
                      No custom metadata fields. Click "Add Fields" to add some.
                    </div>
                  )}
                  
                  {!perkSettings?.partnerSalt && (
                    <div className="text-xs text-amber-400 mt-2">
                      ⚠️ Partner salt required for metadata. Generate one in Settings.
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  onClick={handleCancelEdit}
                  className="btn-modern-secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdatePerk}
                  disabled={isUpdatingPerk}
                  className="btn-modern-primary"
                >
                  {isUpdatingPerk ? 'Updating...' : 'Update Perk'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Metadata Modal */}
        {showEditMetadataModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-900 rounded-lg max-w-6xl w-full border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Edit Metadata Fields</h3>
                  <button
                    onClick={() => {
                      setShowEditMetadataModal(false);
                      setEditMetadataField({key: '', value: '', shouldHash: true});
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-start space-x-2">
                    <span className="text-blue-400 text-sm">💡</span>
                    <div className="text-xs text-blue-300">
                      <p className="font-medium mb-1">Multiple Fields Support</p>
                      <p>Use commas to add multiple fields at once - watch the live alignment on the right!</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column - Input Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Key(s) *
                      </label>
                      <Input
                        type="text"
                        value={editMetadataField.key}
                        onChange={(e) => setEditMetadataField(prev => ({ ...prev, key: e.target.value }))}
                        placeholder="discord_id, email, username"
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Value(s) *
                      </label>
                      <Input
                        type="text"
                        value={editMetadataField.value}
                        onChange={(e) => setEditMetadataField(prev => ({ ...prev, value: e.target.value }))}
                        placeholder="12345, user@email.com, myname"
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editMetadataField.shouldHash}
                          onChange={(e) => setEditMetadataField(prev => ({ ...prev, shouldHash: e.target.checked }))}
                          className="rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-300">Hash with partner salt</span>
                      </label>
                      <p className="text-xs text-gray-400 mt-1 ml-6">
                        Protects sensitive information
                      </p>
                    </div>
                  </div>

                  {/* Right Column - Live Alignment View */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <span>👀</span>
                        Live Alignment View
                      </h4>
                      
                      {(() => {
                        const keys = editMetadataField.key.split(',').map(k => k.trim()).filter(k => k.length > 0);
                        const values = editMetadataField.value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                        const hasInput = editMetadataField.key.trim() || editMetadataField.value.trim();
                        
                        if (!hasInput) {
                          return (
                            <div className="bg-gray-800/30 rounded-lg p-4 text-center text-gray-500 text-sm">
                              Start typing to see alignment...
                            </div>
                          );
                        }

                        const maxLength = Math.max(keys.length, values.length);
                        const hasError = keys.length !== values.length;
                        
                        return (
                          <div className="bg-gray-800/50 rounded-lg border border-gray-600 overflow-hidden">
                            {/* Header */}
                            <div className="bg-gray-700/50 px-3 py-2 border-b border-gray-600">
                              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-300">
                                <div className="flex items-center gap-1">
                                  <span>Key</span>
                                  <span className="text-blue-400">({keys.length})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span>Value</span>
                                  <span className="text-green-400">({values.length})</span>
                                  {editMetadataField.shouldHash && <span className="text-orange-400">(hashed)</span>}
                                </div>
                              </div>
                            </div>
                            
                            {/* Rows */}
                            <div className="max-h-48 overflow-y-auto">
                              {Array.from({ length: maxLength }, (_, i) => {
                                const key = keys[i] || '';
                                const value = values[i] || '';
                                const keyMissing = i >= keys.length;
                                const valueMissing = i >= values.length;
                                
                                return (
                                  <div 
                                    key={i} 
                                    className={`grid grid-cols-2 gap-2 px-3 py-2 text-xs border-b border-gray-700/50 last:border-b-0 ${
                                      keyMissing || valueMissing ? 'bg-red-900/20' : 'hover:bg-gray-700/30'
                                    }`}
                                  >
                                    <div className={`font-mono ${keyMissing ? 'text-red-400' : 'text-white'}`}>
                                      {key || (keyMissing ? '❌ missing' : '⚪ empty')}
                                    </div>
                                    <div className={`font-mono ${valueMissing ? 'text-red-400' : 'text-gray-300'}`}>
                                      {value ? (
                                        editMetadataField.shouldHash ? `🔒 ${value.substring(0, 10)}...` : value
                                      ) : (
                                        valueMissing ? '❌ missing' : '⚪ empty'
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Status Footer */}
                            <div className={`px-3 py-2 text-xs ${hasError ? 'bg-red-900/20 text-red-300' : 'bg-green-900/20 text-green-300'}`}>
                              {hasError ? (
                                <span>⚠️ Mismatch: {keys.length} keys ≠ {values.length} values</span>
                              ) : (
                                <span>✅ Perfect alignment: {keys.length} pair(s) ready</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-700 flex space-x-3">
                <Button
                  onClick={() => {
                    setShowEditMetadataModal(false);
                    setEditMetadataField({key: '', value: '', shouldHash: true});
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={addEditMetadataField}
                  disabled={!editMetadataField.key.trim() || !editMetadataField.value.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {(() => {
                    const keys = editMetadataField.key.split(',').map(k => k.trim()).filter(k => k.length > 0);
                    return keys.length > 1 ? `Add ${keys.length} Fields` : 'Add Field';
                  })()}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAnalyticsTab = () => {
    const analyticsMetrics = [
      { key: 'tvlBacking', label: 'TVL Backing', color: '#10b981' },
      { key: 'dailyQuotaUsage', label: 'Daily Quota Usage', color: '#3b82f6' },
      { key: 'pointsMinted', label: 'Points Minted', color: '#f59e42' },
      { key: 'perkRevenue', label: 'Perk Revenue', color: '#a21caf' },
      { key: 'lifetimeQuota', label: 'Lifetime Quota', color: '#38bdf8' },
    ];

    const handleAnalyticsToggle = (key: string) => {
      setAnalyticsToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleTimeRangeChange = (range: '7d' | '30d' | '90d') => {
      fetchAnalyticsData(range);
    };

    return (
      <div>
        {/* Analytics Chart */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            <div className="lg:col-span-3 w-full h-64">
              <div className="h-full bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Daily Performance Trends</h3>
                  <div className="flex items-center space-x-2">
                    <div className="flex bg-gray-800 rounded-lg p-1">
                      {(['7d', '30d', '90d'] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => handleTimeRangeChange(range)}
                          className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                            analyticsTimeRange === range
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                        </button>
                      ))}
                    </div>
                    {isLoadingAnalytics && (
                      <div className="text-xs text-blue-400 flex items-center">
                        <svg className="animate-spin h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <circle className="opacity-25" cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-[200px]">
                  {(() => {
                    // Use daily analytics data instead of single point
                    const chartData = dailyData;
                     
                     const CustomTooltip = ({ active, payload, label }: any) => {
                       if (active && payload && payload.length) {
                         return (
                           <div className="bg-gray-800 bg-opacity-95 backdrop-blur-sm border border-gray-600 p-3 rounded-lg shadow-lg text-sm">
                             <p className="text-gray-300 mb-2">{label}</p>
                             {payload.map((entry: any, idx: number) => {
                               const value = entry.value;
                               let formattedValue = value.toLocaleString();
                               
                               // Format large numbers more readably
                               if (value >= 1000000) {
                                 formattedValue = (value / 1000000).toFixed(1) + 'M';
                               } else if (value >= 1000) {
                                 formattedValue = (value / 1000).toFixed(1) + 'K';
                               }
                               
                               return (
                                 <p key={idx} style={{ color: entry.stroke }}>
                                   {entry.name}: {formattedValue}
                                   {entry.dataKey === 'tvlBacking' ? ' USD' : 
                                    entry.dataKey === 'dailyQuotaUsage' ? '%' : ' AP'}
                                 </p>
                               );
                             })}
                           </div>
                         );
                       }
                       return null;
                     };
                    
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                          <XAxis 
                            dataKey="day" 
                            stroke="#9ca3af" 
                            tick={{ fontSize: 12 }} 
                            axisLine={false} 
                            tickLine={false} 
                          />
                          <YAxis 
                            stroke="#9ca3af" 
                            tick={{ fontSize: 12 }} 
                            axisLine={false} 
                            tickLine={false} 
                            width={50}
                          />
                          <RechartsTooltip content={<CustomTooltip />} />
                          
                                                     {/* Show different metrics based on analytics toggles */}
                           {analyticsToggles['tvlBacking'] && (
                             <Line
                               type="monotone"
                               dataKey="tvlBacking"
                               stroke="#10b981"
                               strokeWidth={2}
                               dot={{ r: 4 }}
                               name="TVL Backing"
                             />
                           )}
                           {analyticsToggles['pointsMinted'] && (
                             <Line
                               type="monotone"
                               dataKey="pointsMinted"
                               stroke="#f59e42"
                               strokeWidth={2}
                               dot={{ r: 4 }}
                               name="Points Minted"
                             />
                           )}
                           {analyticsToggles['dailyQuotaUsage'] && (
                             <Line
                               type="monotone"
                               dataKey="dailyQuotaUsage"
                               stroke="#3b82f6"
                               strokeWidth={2}
                               dot={{ r: 4 }}
                               name="Daily Quota Usage"
                             />
                           )}
                           {analyticsToggles['perkRevenue'] && (
                             <Line
                               type="monotone"
                               dataKey="perkRevenue"
                               stroke="#a21caf"
                               strokeWidth={2}
                               dot={{ r: 4 }}
                               name="Perk Revenue"
                             />
                           )}
                        </LineChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            {/* Analytics Controls */}
            <div className="lg:col-span-1 w-full">
              <div>
                <h4 className="text-sm font-medium text-gray-200 mb-3">Metrics</h4>
                <div className="space-y-2 mb-4">
                  {analyticsMetrics.map((metric) => (
                    <label key={metric.key} className="inline-flex items-center cursor-pointer text-xs w-full">
                      <input
                        type="checkbox"
                        checked={analyticsToggles[metric.key]}
                        onChange={() => handleAnalyticsToggle(metric.key)}
                        className="form-checkbox h-3 w-3 rounded border-gray-600 focus:ring-offset-gray-800 cursor-pointer"
                        style={{ accentColor: metric.color }}
                      />
                      <span 
                        className="ml-2 flex-1" 
                        style={{ color: analyticsToggles[metric.key] ? metric.color : '#6b7280' }}
                      >
                        {metric.label}
                      </span>
                    </label>
                  ))}
                </div>
                
                <h4 className="text-sm font-medium text-gray-200 mb-2">Data Status</h4>
                <div className="text-xs text-gray-400 bg-gray-800/50 rounded p-2">
                  <div className="flex items-center mb-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    Real-time metrics
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                    Historical data pending
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Metrics */}
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">TVL Backing</span>
                <span className="text-white font-semibold text-sm">${(partnerCap.currentEffectiveUsdcValue || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">Total Points Minted</span>
                <span className="text-white font-semibold text-sm">{(partnerCap.totalPointsMintedLifetime || 0).toLocaleString()} AP</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">Points Minted Today</span>
                <span className="text-white font-semibold text-sm">{(partnerCap.pointsMintedToday || 0).toLocaleString()} AP</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">Daily Quota Usage</span>
                <span className="text-white font-semibold text-sm">
                  {(() => {
                    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                    const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                    const dailyQuota = Math.floor(lifetimeQuota * 0.03);
                    const pointsMintedToday = partnerCap.pointsMintedToday || 0;
                    return dailyQuota > 0 ? (pointsMintedToday / dailyQuota * 100).toFixed(1) : '0.0';
                  })()}%
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">Available Daily Quota</span>
                <span className="text-white font-semibold text-sm">
                  {(() => {
                    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                    const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                    const dailyQuota = Math.floor(lifetimeQuota * 0.03);
                    const pointsMintedToday = partnerCap.pointsMintedToday || 0;
                    return Math.max(0, dailyQuota - pointsMintedToday).toLocaleString();
                  })()} AP
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">Lifetime Quota Used</span>
                <span className="text-white font-semibold text-sm">
                  {(() => {
                    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
                    const lifetimeQuota = Math.floor(tvlBackingUsd * 1000);
                    const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
                    return lifetimeQuota > 0 ? (lifetimeMinted / lifetimeQuota * 100).toFixed(1) : '0.0';
                  })()}%
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">Perks Created</span>
                <span className="text-white font-semibold text-sm">{partnerCap.totalPerksCreated || 0}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-gray-400 text-sm">Partner Status</span>
                <span className={`font-semibold text-sm ${partnerCap.isPaused ? 'text-red-400' : 'text-green-400'}`}>
                  {partnerCap.isPaused ? 'Paused' : 'Active'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Perk Performance Metrics */}
          <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-white mb-3">Perk Performance</h4>
            {(() => {
              const metrics = getPartnerPerkMetrics(partnerCap.id);
              
              if (isLoadingPerks) {
                return (
                  <div className="text-center py-4">
                    <div className="text-2xl mb-2">⏳</div>
                    <div className="text-gray-400 text-sm">Loading perk metrics...</div>
                  </div>
                );
              }

              if (metrics.totalPerks === 0) {
                return (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">🎯</div>
                    <div className="text-gray-400 mb-2">No perks created yet</div>
                    <div className="text-sm text-gray-500">
                      Create your first perk to see performance metrics
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400 text-sm">Total Perks</span>
                    <span className="text-white font-semibold text-sm">{metrics.totalPerks}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400 text-sm">Active Perks</span>
                    <span className="text-green-400 font-semibold text-sm">{metrics.activePerks}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400 text-sm">Paused Perks</span>
                    <span className="text-yellow-400 font-semibold text-sm">{metrics.pausedPerks}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400 text-sm">Total Claims</span>
                    <span className="text-blue-400 font-semibold text-sm">{metrics.totalClaims}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400 text-sm">Revenue Earned</span>
                    <span className="text-purple-400 font-semibold text-sm">{metrics.totalRevenue.toFixed(0)} AP</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400 text-sm">Avg Claims/Perk</span>
                    <span className="text-white font-semibold text-sm">{metrics.averageClaimsPerPerk.toFixed(1)}</span>
                  </div>
                  {metrics.totalRevenue > 0 && (
                    <>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-400 text-sm">Est. Revenue (USD)</span>
                        <span className="text-green-400 font-semibold text-sm">${(metrics.totalRevenue * 0.001).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-gray-400 text-sm">Success Rate</span>
                        <span className="text-white font-semibold text-sm">
                          {metrics.totalClaims > 0 ? ((metrics.totalClaims / (metrics.totalPerks * 10)) * 100).toFixed(1) : '0.0'}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsTab = () => (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Settings Display */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Current Settings</h3>
            <div className="flex items-center space-x-3">
              {isLoadingSettings && (
                <div className="flex items-center text-blue-400">
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">Loading...</span>
                </div>
              )}
              
              {/* Partner Cap ID with Copy Button */}
              <div className="flex items-center space-x-2 bg-gray-900/50 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-400">Partner Cap ID:</div>
                <div className="font-mono text-xs text-gray-300">
                  {partnerCap.id.slice(0, 8)}...{partnerCap.id.slice(-8)}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(partnerCap.id);
                      toast.success('Partner Cap ID copied to clipboard!');
                    } catch (error) {
                      toast.error('Failed to copy to clipboard');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                  title="Copy full Partner Cap ID to clipboard"
                >
                  📋
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await client.getObject({
                        id: partnerCap.id,
                        options: { showContent: true, showType: true }
                      });
                      
                      if (response.data?.content) {
                        const fields = (response.data.content as any).fields;
                        const rawUsdcValue = parseInt(fields.current_effective_usdc_value || '0');
                        
                        toast.info(
                          <div>
                            <div className="font-semibold">Raw On-Chain Values:</div>
                            <div className="text-sm mt-1">
                              <div>current_effective_usdc_value: {rawUsdcValue}</div>
                              <div>Dashboard shows: ${(partnerCap.currentEffectiveUsdcValue || 0).toLocaleString()}</div>
                            </div>
                          </div>,
                          { autoClose: 10000 }
                        );
                      }
                    } catch (error) {
                      toast.error('Failed to fetch on-chain data');
                    }
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs transition-colors"
                  title="Debug: Check raw on-chain values"
                >
                  🔍
                </button>
              </div>
            </div>
          </div>

          {settingsError ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">❌</div>
              <div className="text-red-400 mb-2">Error Loading Settings</div>
              <div className="text-sm text-gray-500 mb-4">{settingsError}</div>
              <Button onClick={() => fetchSettings(partnerCap.id)} className="bg-red-600 hover:bg-red-700">
                Retry
              </Button>
            </div>
          ) : currentSettings ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Max Cost Per Perk</div>
                  <div className="text-lg font-semibold text-green-400">${currentSettings.maxCostPerPerkUsd.toFixed(2)}</div>
            </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Max Perks Per Partner</div>
                  <div className="text-lg font-semibold text-blue-400">{currentSettings.maxPerksPerPartner}</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Max Claims Per Perk</div>
                  <div className="text-lg font-semibold text-purple-400">{currentSettings.maxClaimsPerPerk.toLocaleString()}</div>
              </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Partner Share Range</div>
                  <div className="text-lg font-semibold text-yellow-400">{currentSettings.minPartnerSharePercentage}% - {currentSettings.maxPartnerSharePercentage}%</div>
            </div>
          </div>
          
              <div className="bg-background rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-2">Permissions</div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className={`flex items-center ${currentSettings.allowConsumablePerks ? 'text-green-400' : 'text-red-400'}`}>
                    {currentSettings.allowConsumablePerks ? '✅' : '❌'} Consumable Perks
                </div>
                  <div className={`flex items-center ${currentSettings.allowExpiringPerks ? 'text-green-400' : 'text-red-400'}`}>
                    {currentSettings.allowExpiringPerks ? '✅' : '❌'} Expiring Perks
              </div>
                  <div className={`flex items-center ${currentSettings.allowUniqueMetadata ? 'text-green-400' : 'text-red-400'}`}>
                    {currentSettings.allowUniqueMetadata ? '✅' : '❌'} Unique Metadata
                </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-2">Allowed Perk Types ({currentSettings.allowedPerkTypes.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {currentSettings.allowedPerkTypes.length > 0 ? (
                      currentSettings.allowedPerkTypes.map((type, index) => (
                        <span key={`perk-type-${index}`} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded">
                          {type}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">None configured</span>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-2">Allowed Tags ({currentSettings.allowedTags.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {currentSettings.allowedTags.length > 0 ? (
                      currentSettings.allowedTags.slice(0, 8).map((tag, index) => (
                        <span key={`tag-${index}`} className="text-xs bg-green-600/20 text-green-300 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">None configured</span>
                    )}
                    {currentSettings.allowedTags.length > 8 && (
                      <span className="text-xs text-gray-400">+{currentSettings.allowedTags.length - 8} more</span>
                    )}
                  </div>
                </div>

              </div>
              
              {/* Partner Salt Button */}
              <div className="bg-background rounded-lg p-3">
                <Button
                  onClick={() => setShowPartnerSaltModal(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  🔐 Manage Partner Salt
                  <span className="text-xs bg-white/20 px-2 py-1 rounded ml-2">
                    {perkSettings.partnerSalt ? 'Generated' : 'Not Set'}
                  </span>
                </Button>
                <div className="text-xs text-gray-400 mt-2 text-center">
                  Used for privacy-preserving metadata hashing
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">⚙️</div>
              <div className="text-gray-400 mb-2">Settings not configured</div>
              <div className="text-sm text-gray-500 mb-4">
                Initialize your partner settings to start creating perks
          </div>
            </div>
          )}
        </div>

        {/* Settings Configuration Form */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Configure Settings</h3>
            <div className="flex items-center space-x-2">
              {/* REMOVED: Partner Stats Management - No longer required */}
              
              {currentSettings && (
                <Button 
                  onClick={() => resetFormToCurrentSettings()}
                  className="bg-gray-600 hover:bg-gray-700 text-sm px-3 py-1"
                >
                  Reset to Current
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Max Cost Per Perk (USD)</label>
                  <Input
                    type="number"
                  step="0.01"
                  min="0"
                  max="10000"
                  value={perkSettings.maxCostPerPerkUsd}
                  onChange={(e) => setPerkSettings(prev => ({ 
                    ...prev, 
                    maxCostPerPerkUsd: parseFloat(e.target.value) || 0 
                  }))}
                  className="w-full"
                  placeholder="100.00"
                />
                <div className="text-xs text-gray-400 mt-1">Maximum cost allowed for individual perks</div>
                </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Max Perks</label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={perkSettings.maxPerksPerPartner}
                    onChange={(e) => setPerkSettings(prev => ({ 
                      ...prev, 
                      maxPerksPerPartner: parseInt(e.target.value) || 1 
                    }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Max Claims</label>
                  <Input
                    type="number"
                    min="1"
                    max="100000"
                    value={perkSettings.maxClaimsPerPerk}
                    onChange={(e) => setPerkSettings(prev => ({ 
                      ...prev, 
                      maxClaimsPerPerk: parseInt(e.target.value) || 1 
                    }))}
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={perkSettings.allowConsumablePerks}
                    onChange={(e) => setPerkSettings(prev => ({ 
                      ...prev, 
                      allowConsumablePerks: e.target.checked 
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-300">Allow Consumable Perks</span>
                  </label>
                
                <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={perkSettings.allowExpiringPerks}
                    onChange={(e) => setPerkSettings(prev => ({ 
                      ...prev, 
                      allowExpiringPerks: e.target.checked 
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-300">Allow Expiring Perks</span>
                  </label>
                
                <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={perkSettings.allowUniqueMetadata}
                    onChange={(e) => setPerkSettings(prev => ({ 
                      ...prev, 
                      allowUniqueMetadata: e.target.checked 
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-300">Allow Unique Metadata</span>
                  </label>
            </div>
                        {/* Zero-Dev Integration Settings Button */}
            <div className="pt-4 border-t border-gray-700">
              <Button
                onClick={() => setShowZeroDevModal(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2"
              >
                🔐 Configure Zero-Dev Integration
                <span className="text-xs bg-green-600/20 text-green-300 px-2 py-1 rounded ml-2">
                  Enabled
                </span>
              </Button>
              <div className="text-xs text-gray-400 mt-2 text-center">
                Set up security, domains, events, and generate SDK code
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-700">
              <Button 
                onClick={handleUpdatePerkSettings}
                disabled={isUpdatingSettings}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                {isUpdatingSettings ? 'Updating Settings...' : 'Update Partner Settings'}
              </Button>
              <div className="text-xs text-gray-400 mt-2 text-center">
                This will update your partner settings on the blockchain. You'll need to sign 3 transactions.
            </div>
          </div>
        </div>
              </div>
      </div>
    </div>
  );

  // Handler for partner cap dropdown change
  const handlePartnerCapChange = (newPartnerCapId: string) => {
    const newPartnerCap = partnerCaps.find(cap => cap.id === newPartnerCapId);
    if (newPartnerCap) {
      console.log(`🔄 Switching partner cap from ${selectedPartnerCapId} to ${newPartnerCapId}`);
      
      setSelectedPartnerCapId(newPartnerCapId);
      
      // Reset stats state to force fresh check for new partner cap
      setHasPartnerStats(null);
      setIsCheckingStats(false);
      
      // Show immediate feedback
      toast.info(`Switched to ${newPartnerCap.partnerName}`, { autoClose: 2000 });
      
      // Clear form when switching partner caps
      if (currentTab === 'perks') {
        setNewPerkName('');
        setNewPerkDescription('');
        setNewPerkType('Access');
        setNewPerkTags([]);
        setNewPerkUsdcPrice('');
        setNewPerkReinvestmentPercent(20);
        setNewPerkIcon('🎁');
        setShowTagDropdown(false);
        setTagInput('');
        // Reset expiry fields
        setNewPerkExpiryType('none');
        setNewPerkExpiryDays('30');
        setNewPerkExpiryDate('');
        // Reset consumable fields
        setNewPerkIsConsumable(false);
        setNewPerkCharges('1');
      }
      
      // Reset stats state and immediately check for the new partner cap
      setHasPartnerStats(null);
      // Partner cap switched - checking stats for new partner
      
      // Trigger stats check for the new partner cap (pass the new ID directly)
      setTimeout(() => {
        checkPartnerStats(false, newPartnerCapId);
      }, 100); // Small delay to ensure state is updated
    }
  };

  // Collateral Management Modal Component
  const [modalCollateralType, setModalCollateralType] = useState<'USDC' | 'NFT'>('USDC');
  
  // Modal form state
  const [additionalSuiAmount, setAdditionalSuiAmount] = useState('');
  const [usdcCoinIdToAdd, setUsdcCoinIdToAdd] = useState('');
  const [nftKioskId, setNftKioskId] = useState('');
  const [nftCollectionType, setNftCollectionType] = useState('');
  const [nftFloorValue, setNftFloorValue] = useState('');
  const [isProcessingCollateral, setIsProcessingCollateral] = useState(false);
  
  // Clear modal form when closing or switching types
  const clearCollateralForm = () => {
    setAdditionalSuiAmount('');
    setUsdcCoinIdToAdd('');
    setNftKioskId('');
    setNftCollectionType('');
    setNftFloorValue('');
  };

  // Calculate withdrawable amount (TVL - backing for already minted points)
  const calculateWithdrawableAmount = () => {
    const totalUsdValue = partnerCap.currentEffectiveUsdcValue || 0;
    const pointsMinted = partnerCap.totalPointsMintedLifetime || 0;
    // Each 1000 points requires $1 USD backing
    const requiredBacking = pointsMinted / 1000;
    const withdrawable = Math.max(0, totalUsdValue - requiredBacking);
    return withdrawable;
  };

  // Get the vault ID for the selected partner cap by fetching fresh data
  const getVaultIdForPartner = async () => {
    if (!selectedPartnerCapId || !suiClient) return null;
    
    try {
      // Fetch fresh partner cap data to get vault information
      const freshPartnerCap = await suiClient.getObject({
        id: selectedPartnerCapId,
        options: { showContent: true, showType: true }
      });
      
      // Extract vault ID from the locked_sui_coin_id field
      const lockedSuiCoinId = (freshPartnerCap.data?.content as any)?.fields?.locked_sui_coin_id;
      
      if (!lockedSuiCoinId) return null;
      
      // Handle different Option<T> formats from Sui Move
      if (typeof lockedSuiCoinId === 'string' && lockedSuiCoinId.length > 0) {
        return lockedSuiCoinId; // Direct string value
      } else if (Array.isArray(lockedSuiCoinId) && lockedSuiCoinId.length > 0) {
        return lockedSuiCoinId[0]; // Array format
      } else if (lockedSuiCoinId.vec && lockedSuiCoinId.vec.length > 0) {
        return lockedSuiCoinId.vec[0]; // Object with vec format
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching vault ID:', error);
      return null;
    }
  };

  // Handle TVL withdrawal
  const handleTvlWithdrawal = async () => {
    if (!suiClient || !account?.address || !selectedPartnerCapId) {
      toast.error('Unable to process withdrawal: Missing required data');
      return;
    }

    const withdrawalAmountNum = parseFloat(withdrawalAmount);
    if (isNaN(withdrawalAmountNum) || withdrawalAmountNum <= 0) {
      toast.error('Please enter a valid withdrawal amount');
      return;
    }

    const vaultId = await getVaultIdForPartner();
    if (!vaultId) {
      toast.error('No SUI vault found for this partner');
      return;
    }

    setIsProcessingWithdrawal(true);

    try {
      // Convert USD to SUI for withdrawal
      // This is a simplified conversion - in reality, you'd want to use the oracle
      const suiPrice = 2.0; // Placeholder - should get from oracle
      const suiAmountToWithdraw = withdrawalAmountNum / suiPrice;
      const suiAmountInMist = BigInt(Math.floor(suiAmountToWithdraw * 1e9));

      const tx = buildWithdrawCollateralTransaction(
        selectedPartnerCapId,
        'SUI',
        suiAmountInMist
      );

      const result = await signAndExecuteTransaction({
        transaction: tx,
        options: {
          showObjectChanges: true,
          showEvents: true,
        },
      });

      if (result.effects?.status?.status === 'success') {
        toast.success(`Successfully withdrew ${withdrawalAmountNum.toFixed(2)} USD worth of SUI`);
        setShowWithdrawalModal(false);
        setWithdrawalAmount('');
        
        // Refresh partner data
        await checkPartnerStats(true);
      } else {
        const errorMsg = result.effects?.status?.error || 'Unknown error';
        if (errorMsg.includes('E_POINTS_TOO_YOUNG')) {
          toast.error('Your minted points are too young. Please wait a few more epochs before withdrawing.');
        } else if (errorMsg.includes('E_WITHDRAWAL_EXCEEDS_EPOCH_LIMIT')) {
          toast.error('Withdrawal exceeds your epoch limit. Try a smaller amount or wait until next epoch.');
        } else if (errorMsg.includes('E_WITHDRAWAL_WOULD_UNDERBACK_POINTS')) {
          toast.error('This withdrawal would leave insufficient backing for your minted points.');
        } else if (errorMsg.includes('E_WITHDRAWAL_PAUSED')) {
          toast.error('Withdrawals are currently paused for security reasons.');
        } else {
          toast.error(`Withdrawal failed: ${errorMsg}`);
        }
      }
    } catch (error: any) {
      console.error('TVL withdrawal error:', error);
      let errorMessage = 'Failed to withdraw TVL';
      
      if (error.message?.includes('E_POINTS_TOO_YOUNG')) {
        errorMessage = 'Your minted points are too young. Please wait a few more epochs before withdrawing.';
      } else if (error.message?.includes('E_WITHDRAWAL_EXCEEDS_EPOCH_LIMIT')) {
        errorMessage = 'Withdrawal exceeds your epoch limit. Try a smaller amount or wait until next epoch.';
      } else if (error.message?.includes('E_WITHDRAWAL_WOULD_UNDERBACK_POINTS')) {
        errorMessage = 'This withdrawal would leave insufficient backing for your minted points.';
      } else if (error.message?.includes('E_WITHDRAWAL_PAUSED')) {
        errorMessage = 'Withdrawals are currently paused for security reasons.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsProcessingWithdrawal(false);
    }
  };

  // Handle TVL withdrawal
  const handleWithdrawCapital = async () => {
    if (!partnerCap.id || !withdrawalAmount || !suiClient) {
      toast.error('Missing required information for withdrawal');
      return;
    }

    const withdrawAmountUsd = parseFloat(withdrawalAmount);
    if (isNaN(withdrawAmountUsd) || withdrawAmountUsd <= 0) {
      toast.error('Please enter a valid withdrawal amount');
      return;
    }

    const maxWithdrawable = calculateWithdrawableAmount();
    if (withdrawAmountUsd > maxWithdrawable) {
      toast.error(`Maximum withdrawable amount is $${maxWithdrawable.toFixed(2)}`);
      return;
    }

    try {
      setIsProcessingWithdrawal(true);

      // Convert USD to SUI amount (this would need current SUI price)
      // For now, using 1 SUI = $1 as placeholder
      const suiAmountToWithdraw = withdrawAmountUsd; 
      const suiAmountInMist = Math.floor(suiAmountToWithdraw * 1_000_000_000);

      // Fetch fresh partner cap data to get vault information
      const freshPartnerCap = await suiClient.getObject({
        id: partnerCap.id,
        options: { showContent: true, showType: true }
      });
      
      // Extract vault ID from the locked_sui_coin_id field
      const lockedSuiCoinId = (freshPartnerCap.data?.content as any)?.fields?.locked_sui_coin_id;
      
      let vaultId = null;
      if (lockedSuiCoinId) {
        // Handle different Option<T> formats from Sui Move
        if (typeof lockedSuiCoinId === 'string' && lockedSuiCoinId.length > 0) {
          vaultId = lockedSuiCoinId; // Direct string value
        } else if (Array.isArray(lockedSuiCoinId) && lockedSuiCoinId.length > 0) {
          vaultId = lockedSuiCoinId[0]; // Array format
        } else if (lockedSuiCoinId.vec && lockedSuiCoinId.vec.length > 0) {
          vaultId = lockedSuiCoinId.vec[0]; // Object with vec format
        }
      }
      
      if (!vaultId) {
        toast.error('No vault found for this partner');
        return;
      }

      const transaction = buildWithdrawCollateralTransaction(
        partnerCap.id,
        'SUI',
        BigInt(suiAmountInMist)
      );

      signAndExecuteTransaction(
        { transaction },
        {
          onSuccess: (result: any) => {
            console.log('✅ Capital withdrawal successful:', result);
            toast.success(`Successfully withdrew $${withdrawAmountUsd} worth of SUI`);
            
            // Clear form and close modal
            setWithdrawalAmount('');
            setShowWithdrawalModal(false);
            
            // Refresh partner data
            setTimeout(() => {
              onRefresh();
            }, 2000);
          },
          onError: (error: any) => {
            console.error('❌ Capital withdrawal failed:', error);
            toast.error(`Withdrawal failed: ${error.message || 'Unknown error'}`);
          }
        }
      );

    } catch (error: any) {
      console.error('Error in capital withdrawal:', error);
      toast.error(`Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setIsProcessingWithdrawal(false);
    }
  };
  
  // Collateral transaction handlers
  const handleTopUpSuiCollateral = async () => {
    if (!additionalSuiAmount || !partnerCap.id) {
      toast.error('Please enter a valid SUI amount');
      return;
    }

    const suiAmountNumber = parseFloat(additionalSuiAmount);
    if (isNaN(suiAmountNumber) || suiAmountNumber <= 0) {
      toast.error('Please enter a valid SUI amount');
      return;
    }

    setIsProcessingCollateral(true);

    try {
      const suiAmountMist = BigInt(Math.floor(suiAmountNumber * Math.pow(10, 9)));
      
      // Fetch fresh partner cap data to avoid caching issues
      const freshPartnerCap = await client.getObject({
        id: partnerCap.id,
        options: { showContent: true, showType: true }
      });
      
      // Check if partner already has a SUI vault using fresh data
      // In Sui Move, Option<T> appears as null for None, or {vec: [value]} for Some(value)
      const lockedSuiCoinId = (freshPartnerCap.data?.content as any)?.fields?.locked_sui_coin_id;
      const hasSuiVault = lockedSuiCoinId && (
        // Option<T> can be returned as direct string value
        (typeof lockedSuiCoinId === 'string' && lockedSuiCoinId.length > 0) ||
        // Or as array format
        (Array.isArray(lockedSuiCoinId) && lockedSuiCoinId.length > 0) || 
        // Or as object with vec format
        (typeof lockedSuiCoinId === 'object' && lockedSuiCoinId.vec && lockedSuiCoinId.vec.length > 0)
      );
      
      
      
      let tx;
      if (hasSuiVault) {
        // Partner has existing SUI vault - add to it
        // Extract vault ID from Option<T> format
        let vaultId;
        if (typeof lockedSuiCoinId === 'string') {
          vaultId = lockedSuiCoinId; // Direct string value
        } else if (Array.isArray(lockedSuiCoinId) && lockedSuiCoinId.length > 0) {
          vaultId = lockedSuiCoinId[0]; // Array format
        } else if (lockedSuiCoinId.vec && lockedSuiCoinId.vec.length > 0) {
          vaultId = lockedSuiCoinId.vec[0]; // Object with vec format
        } else {
          vaultId = lockedSuiCoinId; // Fallback
        }
        
        tx = buildAddSuiCollateralTransaction(partnerCap.id, vaultId, suiAmountMist);
      } else {
        // Partner doesn't have SUI vault yet - create initial vault
        tx = buildCreateInitialSuiVaultTransaction(partnerCap.id, suiAmountMist);
      }
      
      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      if (result?.digest) {
        toast.success(
          <div>
            <div>Successfully added {additionalSuiAmount} SUI collateral!</div>
            <div className="text-sm text-gray-300 mt-1">Quotas will update in a few seconds...</div>
            <a 
              href={`https://suiexplorer.com/txblock/${result.digest}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 underline text-sm"
            >
              View transaction
            </a>
          </div>
        );
        
        setAdditionalSuiAmount('');
        setShowCollateralModal({ type: null, isOpen: false });
        
        // Add delay to ensure blockchain state is updated before refresh
        setTimeout(() => {
          onRefresh(); // Refresh partner data including quotas
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to add SUI collateral:', error);
      toast.error(`Failed to add SUI collateral: ${error}`);
    } finally {
      setIsProcessingCollateral(false);
    }
  };

  const handleAddUsdcCollateral = async () => {
    if (!usdcCoinIdToAdd || !partnerCap.id) {
      toast.error('Please enter a valid USDC coin ID');
      return;
    }

    setIsProcessingCollateral(true);

    try {
      const tx = buildAddUsdcCollateralTransaction(partnerCap.id, usdcCoinIdToAdd);
      
      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      if (result?.digest) {
        toast.success(
          <div>
            <div>Successfully added USDC collateral!</div>
            <div className="text-sm text-gray-300 mt-1">Quotas will update in a few seconds...</div>
            <a 
              href={`https://suiexplorer.com/txblock/${result.digest}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 underline text-sm"
            >
              View transaction
            </a>
          </div>
        );
        
        setUsdcCoinIdToAdd('');
        setShowCollateralModal({ type: null, isOpen: false });
        
        // Add delay to ensure blockchain state is updated before refresh
        setTimeout(() => {
          onRefresh(); // Refresh partner data including quotas
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to add USDC collateral:', error);
      toast.error(`Failed to add USDC collateral: ${error}`);
    } finally {
      setIsProcessingCollateral(false);
    }
  };

  const handleAddNftCollateral = async () => {
    if (!nftKioskId || !nftCollectionType || !nftFloorValue || !partnerCap.id) {
      toast.error('Please fill in all NFT collateral fields');
      return;
    }

    const floorValue = parseFloat(nftFloorValue);
    if (isNaN(floorValue) || floorValue <= 0) {
      toast.error('Please enter a valid floor value');
      return;
    }

    setIsProcessingCollateral(true);

    try {
      const tx = buildAddNftCollateralTransaction(partnerCap.id, nftKioskId, nftCollectionType, floorValue);
      
      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      if (result?.digest) {
        toast.success(
          <div>
            <div>Successfully added NFT collateral!</div>
            <div className="text-sm text-gray-300 mt-1">Quotas will update in a few seconds...</div>
            <a 
              href={`https://suiexplorer.com/txblock/${result.digest}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:text-blue-200 underline text-sm"
            >
              View transaction
            </a>
          </div>
        );
        
        setNftKioskId('');
        setNftCollectionType('');
        setNftFloorValue('');
        setShowCollateralModal({ type: null, isOpen: false });
        
        // Add delay to ensure blockchain state is updated before refresh
        setTimeout(() => {
          onRefresh(); // Refresh partner data including quotas
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to add NFT collateral:', error);
      toast.error(`Failed to add NFT collateral: ${error}`);
    } finally {
      setIsProcessingCollateral(false);
    }
  };
  
  const renderCollateralModal = () => {
    if (!showCollateralModal.isOpen) return null;

    const modalType = showCollateralModal.type;
    const isTopUp = modalType === 'topup';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-background-card rounded-lg p-6 w-full max-w-2xl mx-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
              {isTopUp ? 'Top Up Current Collateral' : 'Add Different Backing'}
            </h2>
            <button
              onClick={() => {
                setShowCollateralModal({ type: null, isOpen: false });
                clearCollateralForm();
              }}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {isTopUp ? (
              // Top up current collateral form
              <div>
                <div className="mb-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <h3 className="text-blue-300 font-medium mb-2">Current Collateral</h3>
                  <div className="text-sm text-gray-300">
                    <div>Type: <span className="text-blue-400">SUI</span> (Detected from current backing)</div>
                    <div>Current Value: <span className="text-blue-400">${(partnerCap.currentEffectiveUsdcValue || 0).toLocaleString()}</span></div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Additional SUI Amount
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g., 50"
                    step="any"
                    min="1"
                    value={additionalSuiAmount}
                    onChange={(e) => setAdditionalSuiAmount(e.target.value)}
                    className="w-full text-base"
                    disabled={isProcessingCollateral}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    This will be added to your existing SUI collateral, increasing your quota.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={handleTopUpSuiCollateral}
                    disabled={isProcessingCollateral || !additionalSuiAmount}
                  >
                    {isProcessingCollateral ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding SUI...
                      </div>
                    ) : 'Add SUI Collateral'}
                  </Button>
                  <Button 
                    className="px-6 bg-gray-600 hover:bg-gray-700"
                    onClick={() => {
                      setShowCollateralModal({ type: null, isOpen: false });
                      clearCollateralForm();
                    }}
                    disabled={isProcessingCollateral}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Add different backing form
              <div>
                <div className="mb-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                  <h3 className="text-green-300 font-medium mb-2">Diversify Your Backing</h3>
                  <p className="text-sm text-gray-300">
                    Add additional collateral types to increase your quota and reduce risk.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="newCollateralType"
                      value="USDC"
                      checked={modalCollateralType === 'USDC'}
                      onChange={() => setModalCollateralType('USDC')}
                      className="sr-only"
                    />
                    <div className={`p-4 rounded-lg border text-center transition-colors ${
                      modalCollateralType === 'USDC' 
                        ? 'border-green-500 bg-green-900/20' 
                        : 'border-gray-600 hover:border-green-500 hover:bg-green-900/10'
                    }`}>
                      <div className="text-2xl mb-2">💲</div>
                      <div className={`text-sm font-medium ${modalCollateralType === 'USDC' ? 'text-green-300' : 'text-gray-300'}`}>USDC</div>
                      <div className="text-xs text-gray-400 mt-1">100% LTV</div>
                      <div className={`text-xs mt-1 ${modalCollateralType === 'USDC' ? 'text-green-400' : 'text-gray-500'}`}>Stable Value</div>
                    </div>
                  </label>
                  
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="newCollateralType"
                      value="NFT"
                      checked={modalCollateralType === 'NFT'}
                      onChange={() => setModalCollateralType('NFT')}
                      className="sr-only"
                    />
                    <div className={`p-4 rounded-lg border text-center transition-colors ${
                      modalCollateralType === 'NFT' 
                        ? 'border-purple-500 bg-purple-900/20' 
                        : 'border-gray-600 hover:border-purple-500 hover:bg-purple-900/10'
                    }`}>
                      <div className="text-2xl mb-2">🎨</div>
                      <div className={`text-sm font-medium ${modalCollateralType === 'NFT' ? 'text-purple-300' : 'text-gray-300'}`}>NFT</div>
                      <div className="text-xs text-gray-400 mt-1">70% LTV</div>
                      <div className={`text-xs mt-1 ${modalCollateralType === 'NFT' ? 'text-purple-400' : 'text-gray-500'}`}>Collection</div>
                    </div>
                  </label>
                </div>

                {modalCollateralType === 'USDC' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      USDC Coin Object ID
                    </label>
                    <Input
                      type="text"
                      placeholder="0x123...abc (USDC coin object ID)"
                      value={usdcCoinIdToAdd}
                      onChange={(e) => setUsdcCoinIdToAdd(e.target.value)}
                      className="w-full text-base"
                      disabled={isProcessingCollateral}
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      USDC provides 100% LTV ratio with stable value backing.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Kiosk Object ID
                      </label>
                      <Input
                        type="text"
                        placeholder="0x123...abc (Kiosk containing NFTs)"
                        value={nftKioskId}
                        onChange={(e) => setNftKioskId(e.target.value)}
                        className="w-full text-base"
                        disabled={isProcessingCollateral}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        NFT Collection Type
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., 0x123::nft::MyNFT"
                        value={nftCollectionType}
                        onChange={(e) => setNftCollectionType(e.target.value)}
                        className="w-full text-base"
                        disabled={isProcessingCollateral}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Estimated Floor Value (USDC)
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g., 1000"
                        step="any"
                        min="1"
                        value={nftFloorValue}
                        onChange={(e) => setNftFloorValue(e.target.value)}
                        className="w-full text-base"
                        disabled={isProcessingCollateral}
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        NFT collateral provides 70% LTV ratio with kiosk owner capabilities.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button 
                    className={`flex-1 ${modalCollateralType === 'USDC' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                    onClick={modalCollateralType === 'USDC' ? handleAddUsdcCollateral : handleAddNftCollateral}
                    disabled={isProcessingCollateral || (modalCollateralType === 'USDC' ? !usdcCoinIdToAdd : (!nftKioskId || !nftCollectionType || !nftFloorValue))}
                  >
                    {isProcessingCollateral ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding {modalCollateralType}...
                      </div>
                    ) : `Add ${modalCollateralType} Backing`}
                  </Button>
                  <Button 
                    className="px-6 bg-gray-600 hover:bg-gray-700"
                    onClick={() => {
                      setShowCollateralModal({ type: null, isOpen: false });
                      clearCollateralForm();
                    }}
                    disabled={isProcessingCollateral}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // SDK Configuration state
  const [showSDKConfigDashboard, setShowSDKConfigDashboard] = useState(false);
  const [showZeroDevModal, setShowZeroDevModal] = useState(false);
  const [showPartnerSaltModal, setShowPartnerSaltModal] = useState(false);

  return (
    <>
      <style>{`
        .metadata-schema-swiper .swiper-wrapper {
          align-items: stretch;
        }
        .metadata-schema-swiper .swiper-slide {
          height: auto;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
      
      {renderCollateralModal()}
      
      {/* TVL Withdrawal Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background-card rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Extract TVL Capital</h2>
              <button
                onClick={() => {
                  setShowWithdrawalModal(false);
                  setWithdrawalAmount('');
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Current Status */}
              <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                <h3 className="text-gray-300 font-medium mb-3">Capital Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total TVL:</span>
                    <span className="text-blue-400">${(partnerCap.currentEffectiveUsdcValue || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Points Minted:</span>
                    <span className="text-yellow-400">{(partnerCap.totalPointsMintedLifetime || 0).toLocaleString()} AP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Required Backing:</span>
                    <span className="text-red-400">${((partnerCap.totalPointsMintedLifetime || 0) / 1000).toFixed(2)}</span>
                  </div>
                  <hr className="border-gray-600" />
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-300">Available to Withdraw:</span>
                    <span className="text-green-400">${calculateWithdrawableAmount().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Withdrawal Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Withdrawal Amount (USD)
                </label>
                <Input
                  type="number"
                  placeholder={`Max: ${calculateWithdrawableAmount().toFixed(2)}`}
                  step="0.01"
                  min="0"
                  max={calculateWithdrawableAmount()}
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="w-full text-base"
                  disabled={isProcessingWithdrawal}
                />
                <p className="text-xs text-gray-400 mt-2">
                  You can only withdraw capital that isn't backing already minted Alpha Points.
                  Each 1000 AP requires $1 USD backing.
                </p>
              </div>

              {/* Warning */}
              <div className="p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-orange-400 text-sm">⚠️</span>
                  <div className="text-xs text-orange-300">
                    <strong>Important:</strong> Withdrawing capital will reduce your daily and lifetime 
                    point minting quotas proportionally. Your ability to create new perks may be affected.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                  onClick={handleWithdrawCapital}
                  disabled={
                    isProcessingWithdrawal || 
                    !withdrawalAmount || 
                    parseFloat(withdrawalAmount || '0') <= 0 ||
                    parseFloat(withdrawalAmount || '0') > calculateWithdrawableAmount()
                  }
                >
                  {isProcessingWithdrawal ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Withdrawing...
                    </div>
                  ) : 'Withdraw Capital'}
                </Button>
                <Button 
                  className="px-6 bg-gray-600 hover:bg-gray-700"
                  onClick={() => {
                    setShowWithdrawalModal(false);
                    setWithdrawalAmount('');
                  }}
                  disabled={isProcessingWithdrawal}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Metadata Field Modal */}


      {/* Enhanced Salt Regeneration Modal */}
      {saltRegenerationFlow.showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background-card rounded-lg p-6 max-w-md w-full mx-4">
            {saltRegenerationFlow.step === 1 && (
              <>
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">🚨</div>
                  <h3 className="text-xl font-bold text-red-400 mb-2">DANGER: Salt Regeneration</h3>
                  <div className="text-sm text-gray-300 text-left space-y-2">
                    <p className="text-red-300 font-medium">⚠️ This action will PERMANENTLY DESTROY all existing metadata relationships!</p>
                    <p><strong>What will break:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 ml-2">
                      <li>All user metadata collected with current salt becomes unusable</li>
                      <li>Custom frontends and bots will stop working</li>
                      <li>Existing integrations must be updated manually</li>
                      <li>Users lose access to previously verified information</li>
                    </ul>
                    <p className="text-yellow-300 font-medium mt-3">💡 Consider downloading a backup first!</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <Button 
                    onClick={cancelSaltRegeneration}
                    className="flex-1 bg-gray-600 hover:bg-gray-700"
                  >
                    Cancel (Recommended)
                  </Button>
                  <Button 
                    onClick={proceedSaltRegeneration}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    I Understand, Continue
                  </Button>
                </div>
              </>
            )}

            {saltRegenerationFlow.step === 2 && (
              <>
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">⚠️</div>
                  <h3 className="text-xl font-bold text-red-400 mb-4">Final Confirmation Required</h3>
                  <div className="text-sm text-gray-300 mb-4">
                    <p className="mb-3">To confirm you understand the consequences, please type:</p>
                    <div className="bg-gray-800 p-2 rounded font-mono text-yellow-300 text-center">
                      REGENERATE MY SALT
                    </div>
                  </div>
                  <Input
                    value={saltRegenerationFlow.confirmationText}
                    onChange={(e) => setSaltRegenerationFlow(prev => ({
                      ...prev,
                      confirmationText: e.target.value
                    }))}
                    placeholder="Type the confirmation text..."
                    className="w-full text-center"
                    autoFocus
                  />
                </div>
                <div className="flex space-x-3">
                  <Button 
                    onClick={cancelSaltRegeneration}
                    className="flex-1 bg-gray-600 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={proceedSaltRegeneration}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={saltRegenerationFlow.confirmationText.trim().toUpperCase() !== 'REGENERATE MY SALT'}
                  >
                    Regenerate Salt
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="container mx-auto p-4 text-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Partner Dashboard</h1>
          <div className="flex items-center space-x-4">
            {/* Partner Cap Selector - Always show when partner caps exist */}
            {partnerCaps.length >= 1 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Business:</span>
                <select
                  value={selectedPartnerCapId}
                  onChange={(e) => handlePartnerCapChange(e.target.value)}
                  className="bg-background text-white px-3 py-2 rounded border border-gray-600 focus:border-primary text-sm min-w-[200px]"
                  title="Select which business/partner cap to manage"
                >
                  {partnerCaps.map((cap) => (
                    <option key={cap.id} value={cap.id}>
                      {cap.partnerName} (${(cap.currentEffectiveUsdcValue || 0).toLocaleString()} TVL)
                    </option>
                  ))}
                </select>
                {partnerCaps.length > 1 && (
                  <span className="text-xs text-blue-400">
                    {partnerCaps.length} businesses
                  </span>
                )}
              </div>
            )}
            <div className={`px-3 py-1 rounded-full text-sm ${
              partnerCap.isPaused ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'
            }`}>
              {partnerCap.isPaused ? 'Paused' : 'Active'}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {currentTab === 'overview' && renderOverviewTab()}
          {currentTab === 'perks' && renderPerksTab()}
          {currentTab === 'analytics' && renderAnalyticsTab()}
          {currentTab === 'settings' && renderSettingsTab()}
          {currentTab === 'generations' && <GenerationsTab partnerCap={partnerCap} selectedPartnerCapId={selectedPartnerCapId} />}
        </div>
      </div>
      
      {/* Partner Salt Modal */}
      {showPartnerSaltModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                🔐 Partner Salt Management
                <span className="text-sm bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded">
                  {perkSettings.partnerSalt ? 'Generated' : 'Not Set'}
                </span>
              </h2>
              <button
                onClick={() => setShowPartnerSaltModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Salt Display */}
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  🔑 Current Salt
                </h3>
                <div className="bg-gray-800 rounded p-3 font-mono text-sm text-gray-300 break-all relative flex items-center">
                  <span className="flex-1">
                    {perkSettings.partnerSalt 
                      ? (showSalt ? perkSettings.partnerSalt : '*'.repeat(perkSettings.partnerSalt.length))
                      : 'No salt generated'
                    }
                  </span>
                  {perkSettings.partnerSalt && (
                    <div className="flex space-x-2 ml-3">
                      <button
                        onClick={() => setShowSalt(!showSalt)}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-sm transition-colors"
                        title={showSalt ? 'Hide salt' : 'Show salt'}
                      >
                        {showSalt ? '👁️ Hide' : '👁️‍🗨️ Show'}
                      </button>
                      <button
                        onClick={copySalt}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        title="Copy salt to clipboard"
                      >
                        📋 Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Salt Actions */}
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  ⚡ Salt Actions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={downloadSalt}
                    className="bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
                    disabled={!perkSettings.partnerSalt}
                  >
                    💾 Download Backup
                  </Button>
                  <Button
                    onClick={handleSaltRegeneration}
                    className="bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    🚨 Regenerate Salt
                  </Button>
                </div>
              </div>

              {/* Salt Information */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-300 mb-3 flex items-center gap-2">
                  ℹ️ About Partner Salt
                </h3>
                <div className="text-sm text-gray-300 space-y-2">
                  <p>
                    🔐 This salt is automatically generated and persisted for your partner account.
                  </p>
                  <p>
                    💾 <strong>Download a backup</strong> to protect against data loss.
                  </p>
                  <p>
                    🤝 Share this salt with your custom frontends and bots to verify user data.
                  </p>
                  <p>
                    ⚠️ Once set, metadata hashed with this salt will only work with the same salt value.
                  </p>
                  <p className="text-red-300 font-medium">
                    🚨 Regenerating the salt will invalidate all existing metadata hashes!
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <Button
                  onClick={() => setShowPartnerSaltModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700"
                >
                  Close
                </Button>
                {perkSettings.partnerSalt && (
                  <Button
                    onClick={() => {
                      copySalt();
                      setShowPartnerSaltModal(false);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Copy & Close
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zero-Dev Integration Modal */}
      {showZeroDevModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                🔐 Zero-Dev Integration Settings
                <span className="text-sm bg-green-600/20 text-green-300 px-2 py-1 rounded">
                  Enabled
                </span>
              </h2>
              <button
                onClick={() => setShowZeroDevModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Auto-enable integration when accessing settings */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">✅</span>
                  <h3 className="text-lg font-medium text-blue-300">Zero-Dev Integration Active</h3>
                </div>
                <p className="text-sm text-gray-300">
                  Integration is automatically enabled when configuring settings. External websites can award points via SDK with your configured security settings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Domain Whitelist */}
                    <div className="bg-gray-900/30 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                        🌐 Domain Security
                      </h3>
                      <div className="space-y-3">
                        {(perkSettings.allowedOrigins || []).map((domain, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-800/50 rounded">
                            <span className="text-sm text-gray-300 flex-1">{domain}</span>
                            <button
                              onClick={() => {
                                const newOrigins = [...(perkSettings.allowedOrigins || [])];
                                newOrigins.splice(index, 1);
                                setPerkSettings(prev => ({ ...prev, allowedOrigins: newOrigins }));
                              }}
                              className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            placeholder="yourdomain.com"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                const domain = (e.target as HTMLInputElement).value.trim();
                                if (domain && !(perkSettings.allowedOrigins || []).includes(domain)) {
                                  setPerkSettings(prev => ({ 
                                    ...prev, 
                                    allowedOrigins: [...(prev.allowedOrigins || []), domain] 
                                  }));
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                              if (input) {
                                const domain = input.value.trim();
                                if (domain && !(perkSettings.allowedOrigins || []).includes(domain)) {
                                  setPerkSettings(prev => ({ 
                                    ...prev, 
                                    allowedOrigins: [...(prev.allowedOrigins || []), domain] 
                                  }));
                                  input.value = '';
                                }
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 px-3 py-1 text-sm"
                          >
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400">Only these domains can use your integration</p>
                      </div>
                    </div>

                    {/* Rate Limiting */}
                    <div className="bg-gray-900/30 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                        ⏱️ Rate Limiting
                      </h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Requests per minute per user</label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={perkSettings.rateLimitPerMinute || 10}
                          onChange={(e) => setPerkSettings(prev => ({ 
                            ...prev, 
                            rateLimitPerMinute: parseInt(e.target.value) || 10 
                          }))}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-400 mt-2">Lower values increase security but may impact user experience</p>
                      </div>
                    </div>
                  </div>

                  {/* Security Features */}
                  <div className="bg-gray-900/30 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                      🛡️ Security Features
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center p-3 bg-gray-800/50 rounded">
                        <input
                          type="checkbox"
                          checked={perkSettings.requireUserSignature || false}
                          onChange={(e) => setPerkSettings(prev => ({ 
                            ...prev, 
                            requireUserSignature: e.target.checked 
                          }))}
                          className="mr-3 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-300">Require User Signatures</span>
                          <p className="text-xs text-gray-400">Users must sign events with their wallet</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center p-3 bg-gray-800/50 rounded">
                        <input
                          type="checkbox"
                          checked={perkSettings.signatureValidation || false}
                          onChange={(e) => setPerkSettings(prev => ({ 
                            ...prev, 
                            signatureValidation: e.target.checked 
                          }))}
                          className="mr-3 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-300">Signature Validation</span>
                          <p className="text-xs text-gray-400">Validate signatures on-chain</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center p-3 bg-gray-800/50 rounded">
                        <input
                          type="checkbox"
                          checked={perkSettings.replayProtection || false}
                          onChange={(e) => setPerkSettings(prev => ({ 
                            ...prev, 
                            replayProtection: e.target.checked 
                          }))}
                          className="mr-3 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-300">Replay Protection</span>
                          <p className="text-xs text-gray-400">Prevent duplicate event submissions</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center p-3 bg-gray-800/50 rounded">
                        <input
                          type="checkbox"
                          checked={perkSettings.enableNotifications || false}
                          onChange={(e) => setPerkSettings(prev => ({ 
                            ...prev, 
                            enableNotifications: e.target.checked 
                          }))}
                          className="mr-3 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-300">Enable Notifications</span>
                          <p className="text-xs text-gray-400">Show user feedback for events</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* SDK Configuration Button */}
                  <div className="bg-gray-900/30 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                      🔧 SDK Configuration
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => window.open('/sdk-demo', '_blank')}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2"
                      >
                        🔧 Configure Events & Generate Code
                      </Button>
                      <Button
                        onClick={() => window.open('/security-demo', '_blank')}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        🧪 Test Security Features
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Set up event types, points, generate integration code, and test security
                    </p>
                  </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <Button
                  onClick={() => setShowZeroDevModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    // Auto-enable integration when saving settings
                    setPerkSettings(prev => ({ ...prev, integrationEnabled: true }));
                    setShowZeroDevModal(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SDK Configuration Dashboard */}
      {showSDKConfigDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">SDK Configuration</h2>
              <button
                onClick={() => setShowSDKConfigDashboard(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <SDKConfigurationDashboard />
            </div>
          </div>
        </div>
      )}

      {/* Metadata Input Modal */}
      {showMetadataModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 rounded-lg max-w-6xl w-full border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Add Custom Metadata</h3>
                <button
                  onClick={() => {
                    setShowMetadataModal(false);
                    setMetadataField({key: '', value: '', shouldHash: true});
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-400 text-sm">💡</span>
                  <div className="text-xs text-blue-300">
                    <p className="font-medium mb-1">Multiple Fields Support</p>
                    <p>Use commas to add multiple fields at once - watch the live alignment on the right!</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Input Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Key(s) *
                    </label>
                    <Input
                      type="text"
                      value={metadataField.key}
                      onChange={(e) => setMetadataField(prev => ({ ...prev, key: e.target.value }))}
                      placeholder="discord_id, email, username"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Value(s) *
                    </label>
                    <Input
                      type="text"
                      value={metadataField.value}
                      onChange={(e) => setMetadataField(prev => ({ ...prev, value: e.target.value }))}
                      placeholder="12345, user@email.com, myname"
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={metadataField.shouldHash}
                        onChange={(e) => setMetadataField(prev => ({ ...prev, shouldHash: e.target.checked }))}
                        className="rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-300">Hash with partner salt</span>
                    </label>
                    <p className="text-xs text-gray-400 mt-1 ml-6">
                      Protects sensitive information
                    </p>
                  </div>
                </div>

                {/* Right Column - Live Alignment View */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <span>👀</span>
                      Live Alignment View
                    </h4>
                    
                    {(() => {
                      const keys = metadataField.key.split(',').map(k => k.trim()).filter(k => k.length > 0);
                      const values = metadataField.value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                      const hasInput = metadataField.key.trim() || metadataField.value.trim();
                      
                      if (!hasInput) {
                        return (
                          <div className="bg-gray-800/30 rounded-lg p-4 text-center text-gray-500 text-sm">
                            Start typing to see alignment...
                          </div>
                        );
                      }

                      const maxLength = Math.max(keys.length, values.length);
                      const hasError = keys.length !== values.length;
                      
                      return (
                        <div className="bg-gray-800/50 rounded-lg border border-gray-600 overflow-hidden">
                          {/* Header */}
                          <div className="bg-gray-700/50 px-3 py-2 border-b border-gray-600">
                            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-300">
                              <div className="flex items-center gap-1">
                                <span>Key</span>
                                <span className="text-blue-400">({keys.length})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span>Value</span>
                                <span className="text-green-400">({values.length})</span>
                                {metadataField.shouldHash && <span className="text-orange-400">(hashed)</span>}
                              </div>
                            </div>
                          </div>
                          
                          {/* Rows */}
                          <div className="max-h-48 overflow-y-auto">
                            {Array.from({ length: maxLength }, (_, i) => {
                              const key = keys[i] || '';
                              const value = values[i] || '';
                              const keyMissing = i >= keys.length;
                              const valueMissing = i >= values.length;
                              
                              return (
                                <div 
                                  key={i} 
                                  className={`grid grid-cols-2 gap-2 px-3 py-2 text-xs border-b border-gray-700/50 last:border-b-0 ${
                                    keyMissing || valueMissing ? 'bg-red-900/20' : 'hover:bg-gray-700/30'
                                  }`}
                                >
                                  <div className={`font-mono ${keyMissing ? 'text-red-400' : 'text-white'}`}>
                                    {key || (keyMissing ? '❌ missing' : '⚪ empty')}
                                  </div>
                                  <div className={`font-mono ${valueMissing ? 'text-red-400' : 'text-gray-300'}`}>
                                    {value ? (
                                      metadataField.shouldHash ? `🔒 ${value.substring(0, 10)}...` : value
                                    ) : (
                                      valueMissing ? '❌ missing' : '⚪ empty'
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Status Footer */}
                          <div className={`px-3 py-2 text-xs ${hasError ? 'bg-red-900/20 text-red-300' : 'bg-green-900/20 text-green-300'}`}>
                            {hasError ? (
                              <span>⚠️ Mismatch: {keys.length} keys ≠ {values.length} values</span>
                            ) : (
                              <span>✅ Perfect alignment: {keys.length} pair(s) ready</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>


            </div>
            
            <div className="p-6 border-t border-gray-700 flex space-x-3">
              <Button
                onClick={() => {
                  setShowMetadataModal(false);
                  setMetadataField({key: '', value: '', shouldHash: true});
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={addMetadataField}
                disabled={!metadataField.key.trim() || !metadataField.value.trim() || (() => {
                  const preview = generateMetadataPreview();
                  return preview?.error ? true : false;
                })()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {(() => {
                  const keys = metadataField.key.split(',').map(k => k.trim()).filter(k => k.length > 0);
                  const count = keys.length;
                  return count > 1 ? `Add ${count} Fields` : 'Add Field';
                })()}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 