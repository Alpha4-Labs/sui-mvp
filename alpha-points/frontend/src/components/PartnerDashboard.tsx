import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PartnerCapInfo } from '../hooks/usePartnerDetection';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ErrorToast, SuccessToast } from './ui/ErrorToast';
import { toast } from 'react-toastify';
import { useAlphaContext } from '../context/AlphaContext';
import { usePerkData, PerkDefinition } from '../hooks/usePerkData';
import { usePartnerSettings, type MetadataField } from '../hooks/usePartnerSettings';
import { usePartnerAnalytics } from '../hooks/usePartnerAnalytics';
import { MetadataFieldModal } from './MetadataFieldModal';
import { usePartnerDetection } from '../hooks/usePartnerDetection';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentWallet } from '@mysten/dapp-kit';
import { 
  buildCreatePerkDefinitionTransaction, 
  buildSetPerkActiveStatusTransaction, 
  buildUpdatePerkControlSettingsTransaction, 
  buildUpdatePerkTypeListsTransaction, 
  buildUpdatePerkTagListsTransaction,
  buildAddSuiCollateralTransaction,
  buildCreateInitialSuiVaultTransaction,
  buildAddUsdcCollateralTransaction,
  buildAddNftCollateralTransaction,
  buildCreatePartnerPerkStatsTransaction,
  findPartnerStatsId,
} from '../utils/transaction';
// import { SPONSOR_CONFIG } from '../config/contract'; // Commented out - will re-enable for sponsored transactions later
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { PACKAGE_ID, SHARED_OBJECTS } from '../config/contract';
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
import { formatSui } from '../utils/format';
import suiLogo from '../assets/sui-logo.jpg';

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
  currentTab?: 'overview' | 'perks' | 'analytics' | 'settings';
  onPartnerCreated?: () => void;
}

export function PartnerDashboard({ partnerCap: initialPartnerCap, onRefresh, currentTab = 'overview', onPartnerCreated }: PartnerDashboardProps) {
  const { partnerCaps, refreshData, setPartnerCaps, suiBalance, loading } = useAlphaContext();
  const { currentWallet } = useCurrentWallet();
  const { detectPartnerCaps } = usePartnerDetection();
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransactionMain } = useSignAndExecuteTransaction();
  
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
  
  // Tooltip state
  const [showBlueTooltip, setShowBlueTooltip] = useState(false);
  const [showYellowTooltip, setShowYellowTooltip] = useState(false);
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
    addMetadataField,
    removeMetadataField,
    updateMetadataField
  } = usePartnerSettings(selectedPartnerCapId);
  
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  
  // Partner stats state
  const [hasPartnerStats, setHasPartnerStats] = useState<boolean | null>(null);
  const [isCheckingStats, setIsCheckingStats] = useState(false);
  const [isCreatingStats, setIsCreatingStats] = useState(false);

  // Check if partner has stats object
  const checkPartnerStats = useCallback(async (forceRefresh: boolean = false) => {
    if (!selectedPartnerCapId || !suiClient) return;
    
    // Get the current partner name for better logging
    const currentPartner = partnerCaps.find(cap => cap.id === selectedPartnerCapId);
    const partnerName = currentPartner?.partnerName || 'Unknown Partner';
    
    try {
      setIsCheckingStats(true);
      
      console.log(`🔍 Checking PartnerPerkStatsV2 for: "${partnerName}"`);
      console.log(`🔍 Partner Cap ID: ${selectedPartnerCapId}`);
      
      if (forceRefresh) {
        console.log('🔄 Force refresh requested');
      }
      
      // Add a small delay to ensure client is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      const statsId = await findPartnerStatsId(suiClient, selectedPartnerCapId);
      
      console.log(`✅ PartnerPerkStatsV2 found for "${partnerName}":`, statsId);
      setHasPartnerStats(true);
    } catch (error) {
      console.log(`❌ No PartnerPerkStatsV2 found for "${partnerName}" (${selectedPartnerCapId})`);
      console.log('❌ Error details:', error);
      setHasPartnerStats(false);
    } finally {
      setIsCheckingStats(false);
    }
  }, [suiClient, selectedPartnerCapId, partnerCaps]);

  // Create partner stats object
  const createPartnerStats = async () => {
    if (!selectedPartnerCapId || !suiClient) {
      toast.error('Client not ready. Please try again in a moment.');
      return;
    }
    
    try {
      setIsCreatingStats(true);
      
      const dailyQuotaLimit = 10000; // Default quota limit
      const transaction = buildCreatePartnerPerkStatsTransaction(selectedPartnerCapId, dailyQuotaLimit);
      
              signAndExecuteTransactionMain(
          { transaction },
          {
            onSuccess: (result: any) => {
              console.log('✅ Partner stats created successfully:', result.digest);
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
  };

  // Check partner stats on component mount and when partner cap changes
  useEffect(() => {
    if (selectedPartnerCapId && suiClient) {
      // Check immediately if we're on settings tab, otherwise debounce
      const delay = currentTab === 'settings' ? 100 : 300;
      
      const timeoutId = setTimeout(() => {
        checkPartnerStats();
      }, delay);
      
      return () => clearTimeout(timeoutId);
    } else {
      // Reset state when no partner cap is selected or client is not ready
      setHasPartnerStats(null);
    }
  }, [selectedPartnerCapId, suiClient, currentTab, checkPartnerStats]);

  // Tooltip helper functions
  const handleTooltipEnter = (event: React.MouseEvent, tooltipType: 'blue' | 'yellow') => {
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY
    });
    
    if (tooltipType === 'blue') {
      setShowBlueTooltip(true);
    } else {
      setShowYellowTooltip(true);
    }
  };

  const handleTooltipMove = (event: React.MouseEvent) => {
    setTooltipPosition({
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleTooltipLeave = (tooltipType: 'blue' | 'yellow') => {
    if (tooltipType === 'blue') {
      setShowBlueTooltip(false);
    } else {
      setShowYellowTooltip(false);
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
    'Access', 'Service', 'Digital Asset', 'Physical', 'Event',
    'VIP', 'Premium', 'Exclusive', 'Limited', 'Beta',
    'NFT', 'Discord', 'Support', 'Merch', 'Ticket'
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

  // Collateral management modal state
  const [showCollateralModal, setShowCollateralModal] = useState<{
    type: 'topup' | 'add' | null;
    isOpen: boolean;
  }>({ type: null, isOpen: false });

  // Metadata field modal state
  const [showMetadataFieldModal, setShowMetadataFieldModal] = useState(false);
  const [editingMetadataField, setEditingMetadataField] = useState<MetadataField | null>(null);
  
  // Salt visibility state
  const [showSalt, setShowSalt] = useState(false);
  
  // Enhanced salt regeneration state
  const [saltRegenerationFlow, setSaltRegenerationFlow] = useState({
    step: 0, // 0: closed, 1: warning, 2: confirmation, 3: typing verification
    confirmationText: '',
    showModal: false
  });

  // Metadata schema swiper state
  const [metadataSwiperInstance, setMetadataSwiperInstance] = useState<any>(null);
  const [metadataActiveIndex, setMetadataActiveIndex] = useState(0);

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
    const partnerPoolPercent = 90; // 90% goes to partner pool (10% platform)
    const defaultRevenue = 70; // Default 70% revenue
    const defaultReinvestment = 20; // Default 20% reinvestment
    
    // Calculate how much to shift from revenue to reinvestment
    const reinvestmentShift = (reinvestmentPercent - defaultReinvestment);
    const directRevenue = Math.max(0, defaultRevenue - reinvestmentShift);
    
    return Math.floor(directRevenue);
  };

  const newPerkPartnerShare = calculatePartnerShare(newPerkReinvestmentPercent).toString();

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

    // Safety check: Ensure we have a valid partner cap
    if (!partnerCap || !partnerCap.id) {
      toast.error('❌ No partner cap selected. Please refresh the page and select a business.');
      console.error('❌ partnerCap is undefined:', { partnerCap, selectedPartnerCapId, partnerCapsCount: partnerCaps.length });
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
      
      const transaction = buildCreatePerkDefinitionTransaction(
        partnerCap.id,
        {
          name: newPerkName.trim(),
          description: newPerkDescription.trim(),
          perkType: newPerkType,
          usdcPrice: usdcPrice,
          partnerSharePercentage: parseInt(newPerkPartnerShare),
          maxUsesPerClaim: undefined,
          expirationTimestampMs: undefined,
          generatesUniqueClaimMetadata: false,
          tags: newPerkTags,
          maxClaims: undefined,
          initialDefinitionMetadataKeys: [], // TODO: Add 'icon' key when smart contract supports it
          initialDefinitionMetadataValues: [], // TODO: Add newPerkIcon value when smart contract supports it
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

  const handleEditPerk = (perk: PerkDefinition) => {
    setEditingPerk(perk);
    setEditForm({
      name: perk.name,
      description: perk.description,
      tags: [...perk.tags],
      usdcPrice: perk.usdc_price.toString(),
      isActive: perk.is_active,
      icon: perk.icon || '🎁',
    });
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
  };

  const handleUpdatePerk = async () => {
    if (!editingPerk) return;

    setIsUpdatingPerk(true);
    try {
      // For now, we'll implement the basic settings update
      // Note: The smart contract has separate functions for different updates
      
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
      // Define allowed arrays
      const allowedPerkTypes = ['Access', 'Service', 'Digital Asset', 'Physical', 'Event', 'VIP', 'Premium', 'Exclusive', 'Limited', 'Beta'];
      const allowedTags = ['Access', 'Service', 'Digital Asset', 'Physical', 'Event', 'VIP', 'Premium', 'Exclusive', 'Limited', 'Beta', 'NFT', 'Discord', 'Support', 'Merch', 'Ticket'];

      // 1. Update perk control settings first
      toast.info('Step 1/3: Updating perk control settings...');
      
      const settingsTx = buildUpdatePerkControlSettingsTransaction(
        partnerCap.id,
        perkSettings.maxPerksPerPartner,
        perkSettings.maxClaimsPerPerk,
        perkSettings.maxCostPerPerkUsd, // FIXED: Pass USD directly, not micro-USDC
        perkSettings.minPartnerSharePercentage,
        perkSettings.maxPartnerSharePercentage,
        perkSettings.allowConsumablePerks,
        perkSettings.allowExpiringPerks,
        perkSettings.allowUniqueMetadata
        // Note: No sponsorAddress - user pays their own gas for testing
      );

      const settingsResult = await signAndExecuteTransaction({
        transaction: settingsTx,
        chain: 'sui:testnet',
      });

      if (settingsResult?.digest) {
        toast.success(
          <SuccessToast
            title="✅ Step 1/3: Control settings updated!"
            txHash={settingsResult.digest}
          />
        );
      }

      // Wait between transactions to avoid object conflicts (reduced delays to prevent 429 errors)
      toast.info('⏳ Waiting for blockchain state to settle (reduced timing to prevent rate limits)...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 4 seconds

      // 2. Update perk types allowlist
      toast.info('Step 2/3: Updating perk types allowlist...');
      
      const typesTx = buildUpdatePerkTypeListsTransaction(
        partnerCap.id,
        allowedPerkTypes,
        [] // No blacklisted types
        // Note: No sponsorAddress - user pays their own gas for testing
      );

      const typesResult = await signAndExecuteTransaction({
        transaction: typesTx,
        chain: 'sui:testnet',
      });

      if (typesResult?.digest) {
        toast.success(
          <SuccessToast
            title="✅ Step 2/3: Perk types updated!"
            txHash={typesResult.digest}
          />
        );
      }

      // Wait between transactions (reduced timing)
      toast.info('⏳ Preparing final update (reduced timing)...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 5 seconds

      // 3. Update perk tags allowlist
      toast.info('Step 3/3: Updating perk tags allowlist...');
      
      const tagsTx = buildUpdatePerkTagListsTransaction(
        partnerCap.id,
        allowedTags,
        [] // No blacklisted tags
        // Note: No sponsorAddress - user pays their own gas for testing
      );

      const tagsResult = await signAndExecuteTransaction({
        transaction: tagsTx,
        chain: 'sui:testnet',
      });

      if (tagsResult?.digest) {
        toast.success(
          <SuccessToast
            title="🎉 All done! Perk creation now enabled!"
            message="✅ Settings • ✅ Types • ✅ Tags"
            txHash={tagsResult.digest}
          />
        );
      }
        
      // Comprehensive refresh after all transactions complete
      toast.info('🔄 Refreshing partner data (reduced timing to prevent rate limits)...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced from 3 seconds
      
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

  const renderQuotaDisplay = () => {
    // Use actual chain data with correct conversions
    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0; // Already in USD
    
    // Correct calculations based on the rules:
    // $1 = 1,000 Alpha Points
    // Lifetime quota = locked USD value * 1000
    // Daily quota = lifetime quota * 0.03
    const lifetimeQuota = Math.floor(tvlBackingUsd * 1000); // USD * 1000 = Alpha Points
    const dailyQuota = Math.floor(lifetimeQuota * 0.03); // 3% of lifetime quota
    
    const pointsMintedToday = partnerCap.pointsMintedToday || 0;
    const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
    
    // Calculate actual remaining quotas
    const availableDaily = Math.max(0, dailyQuota - pointsMintedToday);
    const remainingLifetime = Math.max(0, lifetimeQuota - lifetimeMinted);
    
    // Calculate usage percentages
    const dailyUsedPercent = dailyQuota > 0 ? (pointsMintedToday / dailyQuota) * 100 : 0;
    const lifetimeUsedPercent = lifetimeQuota > 0 ? (lifetimeMinted / lifetimeQuota) * 100 : 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* TVL Backing Card */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">TVL Backing</h3>
          <div className="text-3xl font-bold text-blue-400 mb-1">
            ${tvlBackingUsd.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">Current Effective USD Value</div>
          <div className="text-xs text-gray-500 mt-2">
            Rate: $1 USD = 1,000 Alpha Points lifetime quota
          </div>
          
          {/* Collateral Management Actions */}
          <div className="mt-4 pt-3 border-t border-gray-700">
            <div className="space-y-2">
              <Button 
                className="w-full text-sm btn-modern-primary"
                onClick={() => setShowCollateralModal({ type: 'topup', isOpen: true })}
              >
                <span className="mr-2">⬆️</span>
                Top Up Current Collateral
              </Button>
              <Button 
                className="w-full text-sm bg-green-600 hover:bg-green-700"
                onClick={() => setShowCollateralModal({ type: 'add', isOpen: true })}
              >
                <span className="mr-2">➕</span>
                Add Different Backing
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Increase your quota by adding more collateral
            </p>
          </div>
        </div>
        
        {/* Daily Quota Card */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Daily Quota</h3>
          <div className="text-2xl font-bold text-white mb-1">
            {availableDaily.toLocaleString()} / {dailyQuota.toLocaleString()}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-400 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(dailyUsedPercent, 100)}%` }}
            ></div>
          </div>
          <div className="text-sm text-gray-400">{dailyUsedPercent.toFixed(1)}% used today</div>
          <div className="text-xs text-gray-500 mt-1">
            3% of lifetime quota ({pointsMintedToday.toLocaleString()} minted)
          </div>
        </div>
        
        {/* Lifetime Quota Card */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Lifetime Quota</h3>
          <div className="text-2xl font-bold text-white mb-1">
            {remainingLifetime.toLocaleString()} / {lifetimeQuota.toLocaleString()}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-400 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(lifetimeUsedPercent, 100)}%` }}
            ></div>
          </div>
          <div className="text-sm text-gray-400">{lifetimeUsedPercent.toFixed(1)}% used total</div>
          <div className="text-xs text-gray-500 mt-1">
            Total minted: {lifetimeMinted.toLocaleString()} AP
          </div>
        </div>
      </div>
    );
  };

  const renderOverviewTab = () => (
    <div>
      {renderQuotaDisplay()}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Partner Status Card */}
        <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Partner Status</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
              <div>
                <div className="text-white font-medium">Perks Created</div>
                <div className="text-sm text-gray-400">Total marketplace perks</div>
              </div>
              <div className="text-primary font-semibold">
                {(() => {
                  const metrics = getPartnerPerkMetrics(partnerCap.id);
                  return metrics.totalPerks || partnerCap.totalPerksCreated || 0;
                })()}
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-background rounded-lg">
              <div>
                <div className="text-white font-medium">Revenue Split</div>
                <div className="text-sm text-gray-400">70% direct, 20% TVL reinvest, 10% platform</div>
              </div>
              <div className="text-green-400 font-semibold">
                Enhanced
              </div>
            </div>

            <div className="flex justify-between items-center p-3 bg-background rounded-lg">
              <div>
                <div className="text-white font-medium">Your SUI Balance</div>
                <div className="text-sm text-gray-400">Available wallet balance</div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center text-primary font-semibold">
                  {loading.suiBalance ? (
                    <div className="w-6 h-6 bg-gray-700 rounded animate-pulse mr-2"></div>
                  ) : (
                    <>
                      {formatSui(suiBalance)}
                      <img src={suiLogo} alt="Sui Logo" className="w-5 h-5 rounded-full object-cover ml-2" />
                    </>
                  )}
                </div>
                <a
                  href="https://faucet.testnet.sui.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white py-1.5 px-3 rounded-md transition-colors text-xs font-medium"
                >
                  Get Testnet SUI
                </a>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Actions Card */}
        <div className="bg-background-card rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link to="/partners/perks" className="block">
              <Button className="w-full">
                Create & Manage Perks
              </Button>
            </Link>
            <Link to="/partners/analytics" className="block">
              <Button className="w-full btn-modern-secondary">
                View Analytics
              </Button>
            </Link>
            <Button 
                              className="w-full btn-modern-secondary"
              onClick={onRefresh}
            >
              Refresh Data
            </Button>
            
            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400 mb-2">Need additional capabilities?</p>
              <Link to="/partners/create" className="block">
                <Button className="w-full bg-green-700 hover:bg-green-600 text-sm">
                  Create Additional Partner Cap
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
      // CRITICAL: Detect fresh partner caps without settings 
      // If currentSettings is null, this partner cap has NEVER been configured
      if (!currentSettings && !isLoadingSettings) {
        return (
          <div className="bg-orange-600/10 border border-orange-600/30 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <div className="flex-1">
                <div className="text-orange-400 font-medium text-sm">Fresh Partner Cap Detected</div>
                <div className="text-orange-300 text-xs mt-1">
                  "{partnerCap.partnerName}" has no blockchain settings configured. Configure settings first to enable perk creation.
                </div>
              </div>
              <button
                onClick={() => navigate('/partners/settings')}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded font-medium transition-colors"
              >
                Configure Now
              </button>
            </div>
          </div>
        );
      }
      
      // Show loading state while fetching settings
      if (isLoadingSettings) {
        return (
          <div className="bg-gray-600/10 border border-gray-600/30 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-gray-500 animate-pulse"></div>
              <div className="flex-1">
                <div className="text-gray-400 font-medium text-sm">Loading On-Chain Settings...</div>
                <div className="text-gray-500 text-xs mt-1">
                  Fetching validation rules from blockchain for "{partnerCap.partnerName}"
                </div>
              </div>
            </div>
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
          <div className="card-modern p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="text-blue-400 font-medium text-sm">Settings Need Configuration</div>
                <div className="text-blue-300 text-xs mt-1">
                  Settings exist for "{partnerCap.partnerName}" but contain invalid values. Please update them.
                </div>
              </div>
              <button
                onClick={() => navigate('/partners/settings')}
                className="btn-modern-primary text-xs px-3 py-1"
              >
                Fix Settings
              </button>
            </div>
          </div>
        );
      }
      
      // Enhanced check: settings are unconfigured if they're zero OR if this specific partner cap hasn't been set up
      const isUnconfigured = maxCost === 0 || (minShare === 0 && maxShare === 0) || !currentSettings;
      
      // Show loading state while fetching settings
      if (isLoadingSettings) {
        return (
          <div className="bg-gray-600/10 border border-gray-600/30 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-gray-500 animate-pulse"></div>
              <div className="flex-1">
                <div className="text-gray-400 font-medium text-sm">Loading On-Chain Settings...</div>
                <div className="text-gray-500 text-xs mt-1">
                  Fetching validation rules from blockchain for "{partnerCap.partnerName}"
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      if (isUnconfigured) {
        return (
          <div className="card-modern p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="text-blue-400 font-medium text-sm">Settings Configuration Required</div>
                <div className="text-blue-300 text-xs mt-1">
                  Configure settings for "{partnerCap.partnerName}" to enable perk creation validation.
                </div>
              </div>
              <button
                onClick={() => navigate('/partners/settings')}
                className="btn-modern-primary text-xs px-3 py-1"
              >
                Go to Settings
              </button>
            </div>
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
        
        const isReady = hasName && hasDescription && hasValidPrice && hasValidSplit && hasTags && allTagsAllowed && isTypeAllowed;
        
        if (isReady) {
          return (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-green-400 font-medium">Ready to Create ✓</span>
            </>
          );
        } else {
          const missing = [];
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
      
      // Normal validation when settings are configured
      return (
        <div className="grid grid-cols-2 gap-3 text-xs">
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
            
            {/* Overall Readiness */}
            <div className="flex items-center space-x-2">
              {renderReadinessValidation()}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div>
        {/* Create New Perk Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
          {/* Perk Creation Form */}
          <div className="bg-background-card rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-white">Create New Perk</h4>
              <div className="flex items-center space-x-1">
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
                Revenue splits: {newPerkPartnerShare || 70}% revenue to you, {newPerkReinvestmentPercent}% reinvested in your TVL, 10% to platform.
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
              {/* 3-Column Layout: Input Stack | Revenue Slider | Alpha Points */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT COLUMN: Input Fields Stack */}
                <div className="space-y-3">
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
                
                {/* MIDDLE COLUMN: Revenue Slider */}
                <div className="flex flex-col justify-center" title="Control revenue split: Direct payment vs. TVL reinvestment">
                  <div className="text-center mb-4">
                    <div className="text-sm font-medium text-gray-300 mb-2">Revenue Split</div>
                    <div className="text-xs text-gray-400 mb-3">
                      Adjust the balance between direct revenue and TVL reinvestment
                    </div>
                  </div>
                  
                  <div className="relative px-2">
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={newPerkReinvestmentPercent}
                      onChange={(e) => setNewPerkReinvestmentPercent(parseInt(e.target.value))}
                      disabled={isCreatingPerk}
                      className={`w-full h-3 bg-gray-600 rounded-lg appearance-none cursor-pointer slider ${
                        (() => {
                          const partnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
                          return (partnerShare < 10 || partnerShare > 90) ? 'border-2 border-red-500' : '';
                        })()
                      }`}
                      style={{
                        background: `linear-gradient(to right, #10b981 0%, #10b981 ${((70 - newPerkReinvestmentPercent) / 70) * 100}%, #3b82f6 ${((70 - newPerkReinvestmentPercent) / 70) * 100}%, #3b82f6 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      <span>💰 Revenue</span>
                      <span>🔄 Reinvest</span>
                    </div>
                  </div>
                  
                  <div className="text-center mt-4">
                    <div className={`text-lg font-bold mb-1 ${
                      (() => {
                        const partnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
                        return (partnerShare < 10 || partnerShare > 90) ? 'text-red-400' : 'text-white';
                      })()
                    }`}>
                      {calculatePartnerShare(newPerkReinvestmentPercent)}% / {newPerkReinvestmentPercent}% / 10%
                      {(() => {
                        const partnerShare = calculatePartnerShare(newPerkReinvestmentPercent);
                        return (partnerShare < 10 || partnerShare > 90) ? ' ⚠️' : '';
                      })()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Revenue / Reinvest / Platform
                    </div>
                  </div>
                </div>
                
                {/* RIGHT COLUMN: Alpha Points Display */}
                <div className="flex flex-col justify-center">
                  {newPerkUsdcPrice && parseFloat(newPerkUsdcPrice) > 0 ? (
                    <div className="text-center p-4 bg-gray-900/50 rounded-lg border border-gray-600">
                      <div className="text-sm text-gray-400 mb-2">Alpha Points Cost</div>
                      <div className={`font-bold text-green-400 mb-2 ${
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
                      <div className="text-sm text-gray-500 mb-4">
                        ${newPerkUsdcPrice} USD = {usdToAlphaPointsDisplay(parseFloat(newPerkUsdcPrice)).toLocaleString()} Alpha Points
                      </div>
                      <div className="text-xs text-gray-400 pt-2">
                        Rate: $1 USD = 1,000 Alpha Points
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-background-input rounded-lg border border-gray-600 opacity-50">
                      <div className="text-sm text-gray-400 mb-2">Alpha Points Cost</div>
                      <div className="text-3xl font-bold text-gray-500 mb-2">
                        --,--- AP
                      </div>
                      <div className="text-sm text-gray-500 mb-4">
                        Enter price to see cost
                      </div>
                      <div className="text-xs text-gray-400 pt-2">
                        Rate: $1 USD = 1,000 Alpha Points
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Description and Create Button Row */}
              <div className="grid grid-cols-4 gap-3 mt-4">
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
                  onClick={handleCreatePerk}
                  disabled={isCreatingPerk || !newPerkName.trim() || !newPerkDescription.trim() || newPerkTags.length === 0 || !newPerkUsdcPrice.trim()}
                  className="w-full"
                >
                  {isCreatingPerk ? 'Creating...' : 'Create Perk'}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Field Guide & Examples - 2x2 Grid with Swiper */}
          <div className="bg-background-card rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-white">Field Guide & Examples</h4>
              <div className="flex items-center space-x-1 group relative">
                <h5 className="text-sm font-medium text-blue-400">{exampleSets[currentExampleSet]?.title || 'Examples'}</h5>
                <svg className="w-3 h-3 text-blue-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 border border-blue-700 rounded-lg shadow-lg z-10">
                  <p className="text-blue-300 text-xs">{exampleSets[currentExampleSet]?.tooltip || 'Example tooltip'}</p>
                </div>
              </div>
              <div className="flex space-x-1">
                {exampleSets.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentExampleSet(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentExampleSet ? 'bg-blue-400' : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center space-x-1 group relative">
                <svg className="w-4 h-4 text-green-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-80 p-3 bg-gray-900 border border-green-700 rounded-lg shadow-lg z-10">
                  <p className="text-green-300 text-sm">
                    <strong>💡 Pro Tip:</strong> The slider controls your revenue split. More reinvestment grows your TVL (increasing future quotas), while more direct revenue gives immediate profit. Default: 70% revenue, 20% reinvestment, 10% platform.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Example Perk Templates */}
            <div className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {exampleSets[currentExampleSet]?.cards.map((card, index) => (
                  <div key={index} className="bg-background rounded-lg p-2 border border-gray-700">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">
                        {card.type === 'Access' ? '🔑' :
                         card.type === 'Service' ? '🎧' :
                         card.type === 'Digital Asset' ? '🖼️' :
                         card.type === 'Physical' ? '📦' :
                         card.type === 'Event' ? '🎫' : '🎁'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{card.title}</div>
                        <div className="text-xs text-gray-400">{card.type}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price:</span>
                        <span className="text-green-400">${card.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Revenue:</span>
                        <span className="text-purple-400">{card.share}%</span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 line-clamp-2">{card.description}</p>
                    
                    <button
                      className="w-full mt-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded transition-colors"
                      onClick={() => {
                        // Auto-fill form with example data
                        setNewPerkName(card.title);
                        setNewPerkDescription(card.description);
                        setNewPerkType(card.type);
                        setNewPerkUsdcPrice(card.price);
                        const reinvestmentPercent = 90 - parseInt(card.share);
                        setNewPerkReinvestmentPercent(reinvestmentPercent);
                        setNewPerkTags([card.type]);
                      }}
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Best Practices & Key Insights */}
            <div className="mt-4">
              <h5 className="text-sm font-semibold text-white flex items-center mb-2">
                <span className="text-purple-400 mr-2">💡</span>
                Best Practices & Key Insights
              </h5>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {/* Pricing Strategy */}
                  <span 
                    className="text-xl cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'pricing')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    💰
                  </span>
                  
                  {/* Revenue Split Strategy */}
                  <span 
                    className="text-xl cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'revenue')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    ⚖️
                  </span>
                  
                  {/* Tag Optimization */}
                  <span 
                    className="text-xl cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'tags')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    🏷️
                  </span>
                  
                  {/* Success Metrics */}
                  <span 
                    className="text-xl cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'metrics')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    📊
                  </span>
                  
                  {/* Pro Strategies */}
                  <span 
                    className="text-xl cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'strategies')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    🔄
                  </span>
                  
                  {/* Value Stacking */}
                  <span 
                    className="text-xl cursor-help"
                    onMouseEnter={(e) => handleInsightTooltipEnter(e, 'value')}
                    onMouseMove={handleTooltipMove}
                    onMouseLeave={handleInsightTooltipLeave}
                  >
                    💎
                  </span>
                </div>
                
                {/* Live Compliance Checking - Inline */}
                <div className="flex-1 max-w-md ml-4">
                  {renderComplianceCheck()}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Existing Perks Section */}
        <div className="bg-background-card rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-white">Your Perks</h4>
            <div className="flex items-center space-x-2">
              {/* Show current partner info */}
              <div className="text-xs text-gray-400">
                {partnerCap.partnerName}
              </div>
              
              <Button 
                onClick={() => {
                  // Clear cache and refresh all perk data
                  refreshPerkData();
                  fetchPartnerPerks(partnerCap.id);
                }}
                disabled={isLoadingPerks}
                className="bg-gray-600 hover:bg-gray-500 text-sm px-3 py-1"
                title={`Refresh perks for ${partnerCap.partnerName}`}
              >
                {isLoadingPerks ? '⏳' : '🔄'} Refresh
              </Button>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPerk(perk);
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
            {isLoadingSettings && (
              <div className="flex items-center text-blue-400">
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Loading...</span>
              </div>
            )}
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
              
              {/* Partner Salt Section */}
              <div className="bg-background rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm text-gray-400 font-medium">Partner Salt</div>
                    <div className="text-xs text-gray-500">Used for privacy-preserving metadata hashing</div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={downloadSalt}
                      className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1"
                      title="Download salt backup file"
                    >
                      💾 Download
                    </Button>
                    <Button 
                      onClick={handleSaltRegeneration}
                      className="bg-red-600 hover:bg-red-700 text-xs px-2 py-1"
                      title="⚠️ DANGER: This will invalidate all existing metadata"
                    >
                      🚨 Regenerate
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-800 rounded p-2 font-mono text-xs text-gray-300 break-all relative flex items-center">
                  <span className="flex-1">
                    {perkSettings.partnerSalt 
                      ? (showSalt ? perkSettings.partnerSalt : '*'.repeat(perkSettings.partnerSalt.length))
                      : 'No salt generated'
                    }
                  </span>
                  {perkSettings.partnerSalt && (
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={() => setShowSalt(!showSalt)}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs transition-colors"
                        title={showSalt ? 'Hide salt' : 'Show salt'}
                      >
                        {showSalt ? '👁️' : '👁️‍🗨️'}
                      </button>
                      <button
                        onClick={copySalt}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                        title="Copy salt to clipboard"
                      >
                        📋
                      </button>
                      <button
                        onClick={downloadSalt}
                        className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
                        title="Download salt backup file"
                      >
                        💾
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  🔐 This salt is automatically generated and persisted for your partner account. <strong>Download a backup</strong> to protect against data loss. Share this salt with your custom frontends and bots to verify user data. Once set, metadata hashed with this salt will only work with the same salt value.
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
              {/* Partner Stats Management - Only show button if stats are missing */}
              {isCheckingStats && (
                <div className="flex items-center space-x-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin"></div>
                  <span>Checking stats...</span>
                </div>
              )}
              
              {hasPartnerStats === false && (
                <div className="flex items-center space-x-2">
                  <Button 
                    className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-3 py-1"
                    onClick={createPartnerStats}
                    disabled={isCreatingStats}
                    title={`Create PartnerPerkStatsV2 for ${partnerCaps.find(cap => cap.id === selectedPartnerCapId)?.partnerName || 'this partner'}`}
                  >
                    {isCreatingStats ? 'Creating...' : 'Create Stats Object'}
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-2 py-1"
                    onClick={() => checkPartnerStats(true)}
                    disabled={isCheckingStats}
                    title={`Refresh detection for ${partnerCaps.find(cap => cap.id === selectedPartnerCapId)?.partnerName || 'this partner'}`}
                  >
                    🔄
                  </Button>
                </div>
              )}
              
              {hasPartnerStats === null && !isCheckingStats && (
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-2 py-1"
                  onClick={() => checkPartnerStats(true)}
                  title="Check for stats object"
                >
                  Check Stats
                </Button>
              )}
              
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
            
            <div className="space-y-3">
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="text-sm text-gray-300 font-medium">Metadata Schema</div>
                    <div className="text-xs text-gray-500">Define what information your perks collect</div>
                  </div>
                  <Button 
                    onClick={() => {
                      setEditingMetadataField(null);
                      setShowMetadataFieldModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1"
                  >
                    Add Field
                  </Button>
                </div>
                
                {perkSettings.metadataSchema && perkSettings.metadataSchema.length > 0 ? (
                  <div className="relative">
                    {/* Navigation arrows for metadata fields */}
                    {perkSettings.metadataSchema.length > 3 && (
                      <>
                        <button
                          onClick={() => metadataSwiperInstance?.slidePrev()}
                          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gray-700 hover:bg-gray-600 text-white p-1 rounded-full transition-colors"
                          style={{ marginLeft: '-12px' }}
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => metadataSwiperInstance?.slideNext()}
                          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gray-700 hover:bg-gray-600 text-white p-1 rounded-full transition-colors"
                          style={{ marginRight: '-12px' }}
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </>
                    )}
                    
                    <Swiper
                      modules={[Navigation, A11y]}
                      spaceBetween={12}
                      slidesPerView={Math.min(3, perkSettings.metadataSchema.length)}
                      slidesPerGroup={3}
                      onSwiper={setMetadataSwiperInstance}
                      onSlideChange={(swiper) => setMetadataActiveIndex(swiper.activeIndex)}
                      className="metadata-schema-swiper"
                    >
                      {perkSettings.metadataSchema.map((field, index) => (
                        <SwiperSlide key={field.key}>
                          <div className="bg-gray-800 rounded p-3 h-24 flex flex-col justify-between">
                            <div className="flex-1 min-h-0">
                              <div className="text-sm text-white font-medium flex items-center gap-2 truncate">
                                <span className="flex-shrink-0">{field.key}</span>
                                {field.required && (
                                  <span className="text-yellow-400 text-xs flex-shrink-0">Required</span>
                                )}
                                {field.description && (
                                  <span className="text-gray-400 text-xs truncate">
                                    - {field.description}
                                  </span>
                                )}
                                {!field.description && (
                                  <span className="text-gray-500 text-xs flex-shrink-0">No description</span>
                                )}
                              </div>
                            </div>
                            <div className="flex space-x-1 mt-2">
                              <Button 
                                onClick={() => {
                                  setEditingMetadataField(field);
                                  setShowMetadataFieldModal(true);
                                }}
                                className="bg-gray-600 hover:bg-gray-700 text-xs px-2 py-1 flex-1"
                              >
                                Edit
                              </Button>
                              <Button 
                                onClick={() => removeMetadataField(field.key)}
                                className="bg-red-600 hover:bg-red-700 text-xs px-2 py-1 flex-1"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                    
                    {/* Pagination dots for metadata fields */}
                    {perkSettings.metadataSchema.length > 3 && (
                      <div className="flex justify-center mt-3 space-x-1">
                        {Array.from({ length: Math.ceil(perkSettings.metadataSchema.length / 3) }).map((_, pageIndex) => (
                          <button
                            key={pageIndex}
                            onClick={() => metadataSwiperInstance?.slideTo(pageIndex * 3)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              Math.floor(metadataActiveIndex / 3) === pageIndex 
                                ? 'bg-blue-500' 
                                : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 text-center py-4">
                    No metadata fields configured. Add fields to collect user information with your perks.
                  </div>
                )}
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
      }
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
        onRefresh(); // Refresh partner data
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
        onRefresh();
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
        onRefresh();
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
      
      {/* Metadata Field Modal */}
      <MetadataFieldModal
        isOpen={showMetadataFieldModal}
        onClose={() => {
          setShowMetadataFieldModal(false);
          setEditingMetadataField(null);
        }}
        onSubmit={(field) => {
          if (editingMetadataField) {
            updateMetadataField(editingMetadataField.key, field);
          } else {
            addMetadataField(field);
          }
        }}
        editingField={editingMetadataField}
        existingKeys={perkSettings.metadataSchema?.map(f => f.key) || []}
      />

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
        </div>
      </div>
    </>
  );
} 