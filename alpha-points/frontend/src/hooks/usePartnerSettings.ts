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
          };
          
          setCurrentSettings(settings);
          
          // Auto-populate form with current values if they have been set
          if (settings.maxPerksPerPartner > 0) {
            setFormSettings(settings);
          }

          return settings;
        }

        // No valid PartnerCapFlex object or settings found
        setCurrentSettings(null);
        return null;

      }

      // No valid PartnerCapFlex object or settings found
      setCurrentSettings(null);
      return null;

    } catch (err: any) {
      console.error('❌ Error fetching PartnerCapFlex settings:', err);
      setError(err.message || 'Failed to fetch settings');
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
      setFormSettings(DEFAULT_SETTINGS);
    }
  }, [currentSettings]);

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
  };
} 