import { useState, useEffect, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui/client';
import { PACKAGE_ID, ALL_PACKAGE_IDS } from '../config/contract';
import { 
  convertSettingsForDisplay, 
  convertSettingsForStorage, 
  type SettingsConversion,
  alphaPointsToUSDViaOracle,
  usdToAlphaPointsForSettingsViaOracle
} from '../utils/conversionUtils';
import { generatePartnerSalt } from '../utils/privacy';

// Helper functions for persistent salt storage
const getStoredSalt = (partnerCapId: string): string | null => {
  try {
    if (!partnerCapId) return null;
    return localStorage.getItem(`alpha4_partner_salt_${partnerCapId}`);
  } catch (err) {
    console.warn('Failed to retrieve stored salt:', err);
    return null;
  }
};

const storeSalt = (partnerCapId: string, salt: string): void => {
  try {
    if (!partnerCapId || !salt) return;
    localStorage.setItem(`alpha4_partner_salt_${partnerCapId}`, salt);
  } catch (err) {
    console.warn('Failed to store partner salt:', err);
  }
};

const getOrCreateSalt = (partnerCapId: string): string => {
  try {
    // Validate partner cap ID
    if (!partnerCapId || typeof partnerCapId !== 'string' || partnerCapId.length < 10) {
      console.warn(`Invalid partner cap ID for salt generation: ${partnerCapId}`);
      return generatePartnerSalt(); // Return fallback salt without storing
    }

    let salt = getStoredSalt(partnerCapId);
    if (!salt) {
      salt = generatePartnerSalt();
      storeSalt(partnerCapId, salt);
    } else {
    }
    return salt;
  } catch (error) {
    console.error('Error in salt management:', error);
    return generatePartnerSalt(); // Return fallback salt on any error
  }
};

export interface MetadataField {
  key: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface PartnerSettings {
  maxPerksPerPartner: number;
  maxClaimsPerPerk: number;
  maxCostPerPerk: number; // Raw micro-USDC value
  maxCostPerPerkUsd: number; // Converted USD value for display
  minPartnerSharePercentage: number;
  maxPartnerSharePercentage: number;
  allowConsumablePerks: boolean;
  allowExpiringPerks: boolean;
  allowUniqueMetadata: boolean;
  allowedPerkTypes: string[];
  allowedTags: string[];
  blacklistedPerkTypes: string[];
  blacklistedTags: string[];
  // New privacy and metadata fields
  partnerSalt?: string;
  metadataSchema?: MetadataField[];
  
  // Zero-Dev Integration Settings
  integrationEnabled?: boolean;
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
  requireUserSignature?: boolean;
  enableNotifications?: boolean;
  debugMode?: boolean;
  signatureValidation?: boolean;
  replayProtection?: boolean;
  
  // Event Configuration
  eventMappings?: EventMapping[];
}

export interface EventMapping {
  eventType: string;
  displayName: string;
  description: string;
  pointsPerEvent: number;
  maxEventsPerUser: number;
  maxEventsPerDay: number;
  cooldownMinutes: number;
  isActive: boolean;
  requiresSignature: boolean;
}

export interface UsePartnerSettingsReturn {
  // Current blockchain settings
  currentSettings: PartnerSettings | null;
  
  // Form state for editing
  formSettings: PartnerSettings;
  setFormSettings: React.Dispatch<React.SetStateAction<PartnerSettings>>;
  
  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  
  // Error handling
  error: string | null;
  
  // Actions
  fetchSettings: (partnerCapId: string) => Promise<PartnerSettings | null>;
  refreshSettings: () => Promise<void>;
  resetFormToCurrentSettings: () => void;
  
  // Privacy management
  generateNewSalt: () => void;
}

const DEFAULT_SETTINGS: PartnerSettings = {
  maxPerksPerPartner: 100,
  maxClaimsPerPerk: 1000,
  maxCostPerPerk: 100000000, // $100 in micro-USDC
  maxCostPerPerkUsd: 100,
  minPartnerSharePercentage: 60,
  maxPartnerSharePercentage: 90,
  allowConsumablePerks: true,
  allowExpiringPerks: true,
  allowUniqueMetadata: true,
  allowedPerkTypes: [],
  allowedTags: [],
  blacklistedPerkTypes: [],
  blacklistedTags: [],
  partnerSalt: '', // Will be set when partner cap ID is available
  metadataSchema: [],
  
  // Zero-Dev Integration Defaults
  integrationEnabled: false,
  allowedOrigins: [],
  rateLimitPerMinute: 10,
  requireUserSignature: true,
  enableNotifications: true,
  debugMode: false,
  signatureValidation: true,
  replayProtection: true,
  eventMappings: [],
};

export function usePartnerSettings(partnerCapId?: string): UsePartnerSettingsReturn {
  const client = useSuiClient();
  
  // State management
  const [currentSettings, setCurrentSettings] = useState<PartnerSettings | null>(null);
  const [formSettings, setFormSettings] = useState<PartnerSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings from blockchain
  const fetchSettings = useCallback(async (partnerCapId: string): Promise<PartnerSettings | null> => {
    if (!client || !partnerCapId) return null;

    // Validate partner cap ID format before making expensive blockchain calls
    if (typeof partnerCapId !== 'string' || partnerCapId.length < 20 || !partnerCapId.startsWith('0x')) {
      console.warn(`Invalid partner cap ID format: ${partnerCapId}`);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {

      
      // First, get the specific PartnerCapFlex object by ID
      const partnerCapObject = await client.getObject({
        id: partnerCapId,
        options: {
          showContent: true,
          showType: true,
        },
      });



      if (partnerCapObject?.data?.content && partnerCapObject.data.content.dataType === 'moveObject') {
        const fields = (partnerCapObject.data.content as any).fields;
        const objectType = partnerCapObject.data.type;
        
        // Check if this is a PartnerCapFlex object
        const isPartnerCapFlex = ALL_PACKAGE_IDS.some(packageId => 
          objectType?.includes(`${packageId}::partner_flex::PartnerCapFlex`)
        );

        if (!isPartnerCapFlex) {
          throw new Error(`Object ${partnerCapId} is not a PartnerCapFlex object. Type: ${objectType}`);
        }

        // Look for perk_control_settings in the PartnerCapFlex fields
        let perkControlSettings = fields.perk_control_settings;
        

        
        // The perk_control_settings is a structured object of type PerkControlSettings
        // We need to access its .fields property to get the actual values
        if (perkControlSettings && perkControlSettings.fields) {
          perkControlSettings = perkControlSettings.fields;

        }

        if (perkControlSettings) {
          // FIXED: Proper conversion from stored Alpha Points to displayed USD
          // Blockchain stores: 1,000,010 Alpha Points (includes +$0.01 buffer)
          // Display shows: $1000.00 USD (buffer removed for user)
          const rawAlphaPoints = Number(perkControlSettings.max_cost_per_perk || '0');
          const conversion = convertSettingsForDisplay(rawAlphaPoints);
          
          // Check for Zero-Dev integration settings in dynamic fields
          let integrationSettings = null;
          let eventMappings: EventMapping[] = [];
          
          // Try to find integration settings and event mappings in the PartnerCapFlex
          if (fields.id && fields.id.id) {
            try {
              // Look for dynamic fields that might contain integration settings
              const dynamicFields = await client.getDynamicFields({
                parentId: fields.id.id,
              });
              
              // Parse integration settings if they exist
              for (const field of dynamicFields.data) {
                if (field.name?.value === 'IntegrationSettingsKey') {
                  const settingsObject = await client.getObject({
                    id: field.objectId,
                    options: { showContent: true }
                  });
                  
                  if (settingsObject.data?.content && settingsObject.data.content.dataType === 'moveObject') {
                    integrationSettings = (settingsObject.data.content as any).fields;
                  }
                }
                
                if (field.name?.value === 'EventMappingsKey') {
                  const mappingsObject = await client.getObject({
                    id: field.objectId,
                    options: { showContent: true }
                  });
                  
                  if (mappingsObject.data?.content && mappingsObject.data.content.dataType === 'moveObject') {
                    const mappingsData = (mappingsObject.data.content as any).fields;
                    // Parse event mappings from the table structure
                    if (mappingsData && mappingsData.contents) {
                      // Convert Move table to EventMapping array
                      eventMappings = Object.entries(mappingsData.contents).map(([eventType, config]: [string, any]) => ({
                        eventType,
                        displayName: config.display_name || eventType,
                        description: config.description || '',
                        pointsPerEvent: Number(config.points_per_event || 0),
                        maxEventsPerUser: Number(config.max_events_per_user || 0),
                        maxEventsPerDay: Number(config.max_events_per_day || 0),
                        cooldownMinutes: Number(config.cooldown_minutes || 0),
                        isActive: config.is_active || false,
                        requiresSignature: config.requires_signature || false,
                      }));
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('Could not fetch Zero-Dev integration settings:', err);
              // Continue with default values
            }
          }

          const settings: PartnerSettings = {
            maxPerksPerPartner: Number(perkControlSettings.max_perks_per_partner || '0'),
            maxClaimsPerPerk: Number(perkControlSettings.max_claims_per_perk || '0'),
            maxCostPerPerk: rawAlphaPoints, // Raw blockchain value (Alpha Points)
            maxCostPerPerkUsd: conversion.displayUSD, // Use original conversion logic
            minPartnerSharePercentage: Number(perkControlSettings.min_partner_share_percentage || '0'),
            maxPartnerSharePercentage: Number(perkControlSettings.max_partner_share_percentage || '0'),
            allowConsumablePerks: perkControlSettings.allow_consumable_perks || false,
            allowExpiringPerks: perkControlSettings.allow_expiring_perks || false,
            allowUniqueMetadata: perkControlSettings.allow_unique_metadata || false,
            allowedPerkTypes: perkControlSettings.allowed_perk_types || [],
            allowedTags: perkControlSettings.allowed_tags || [],
            blacklistedPerkTypes: perkControlSettings.blacklisted_perk_types || [],
            blacklistedTags: perkControlSettings.blacklisted_tags || [],
            // Privacy fields (stored off-chain for now, will be added to blockchain later)
            partnerSalt: getOrCreateSalt(partnerCapId), // Get or create persistent salt
            metadataSchema: [], // Default to empty schema
            
            // Zero-Dev Integration Settings
            integrationEnabled: integrationSettings?.integration_enabled || false,
            allowedOrigins: integrationSettings?.allowed_origins || [],
            rateLimitPerMinute: Number(integrationSettings?.rate_limit_per_minute || 10),
            requireUserSignature: integrationSettings?.require_user_signature || true,
            enableNotifications: integrationSettings?.enable_notifications || true,
            debugMode: integrationSettings?.debug_mode || false,
            signatureValidation: integrationSettings?.signature_validation || true,
            replayProtection: integrationSettings?.replay_protection || true,
            eventMappings,
          };
          

          
          setCurrentSettings(settings);
          
          // Auto-populate form with current values if they have been set
          if (settings.maxPerksPerPartner > 0) {
            setFormSettings(settings);
          }

          return settings;
        } else {

        }

      }

      // No valid PartnerCapFlex object or settings found
      setCurrentSettings(null);
      return null;

    } catch (err: any) {
      console.error('❌ Error fetching PartnerCapFlex settings:', err);
      const errorMessage = err.message || 'Failed to fetch settings';
      setError(errorMessage);
      
      // Don't let settings errors interfere with other systems
      // Return null gracefully and let the UI handle the error state
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Refresh current settings
  const refreshSettings = useCallback(async () => {
    if (partnerCapId) {
      await fetchSettings(partnerCapId);
    }
  }, [partnerCapId, fetchSettings]);

  // Reset form to current blockchain settings
  const resetFormToCurrentSettings = useCallback(() => {
    if (currentSettings) {
      setFormSettings(currentSettings);
    } else {
      // Initialize with default settings but use persistent salt if available
      const defaultWithSalt = {
        ...DEFAULT_SETTINGS,
        partnerSalt: partnerCapId ? getOrCreateSalt(partnerCapId) : ''
      };
      setFormSettings(defaultWithSalt);
    }
  }, [currentSettings, partnerCapId]);

  // Privacy and metadata management functions
  const generateNewSalt = useCallback(() => {
    if (!partnerCapId) {
      console.warn('Cannot generate new salt: no partner cap ID available');
      return;
    }
    
    const newSalt = generatePartnerSalt();
    storeSalt(partnerCapId, newSalt);

    
    setFormSettings(prev => ({
      ...prev,
      partnerSalt: newSalt
    }));
    
    // Also update current settings if they exist
    setCurrentSettings(prev => prev ? ({
      ...prev,
      partnerSalt: newSalt
    }) : null);
  }, [partnerCapId]);



  // Auto-fetch on mount and when partnerCapId changes
  useEffect(() => {
    if (partnerCapId) {
      fetchSettings(partnerCapId);
    }
  }, [partnerCapId, fetchSettings]);

  return {
    currentSettings,
    formSettings,
    setFormSettings,
    isLoading,
    isUpdating,
    error,
    fetchSettings,
    refreshSettings,
    resetFormToCurrentSettings,
    generateNewSalt,
  };
} 