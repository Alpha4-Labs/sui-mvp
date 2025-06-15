import { useCallback } from 'react';
import { DiscordAuthService } from '../services/discord';
import type { Alpha4Perk } from '../types/index';

export function useDiscordValidation() {
  const discordAuth = DiscordAuthService.getInstance();

  const validateDiscordRequirement = useCallback((perk: Alpha4Perk): {
    isValid: boolean;
    reason?: string;
  } => {
    // Check if this perk requires Discord
    const requiresDiscord = perk.name.toLowerCase().includes('discord') || 
                           perk.description.toLowerCase().includes('discord');

    if (!requiresDiscord) {
      return { isValid: true };
    }

    // For Discord perks, check if user is authenticated
    if (!discordAuth.isAuthenticated()) {
      return {
        isValid: false,
        reason: 'Discord account must be connected to claim this perk'
      };
    }

    // Additional validations for specific perks
    if (perk.name === 'Discord Alpha OG' && perk.alphaPointCost >= 2000000) {
      // High-value perk requires verified Discord connection
      const user = discordAuth.getCurrentUser();
      if (!user?.email) {
        return {
          isValid: false,
          reason: 'Email verification required for high-value Discord perks'
        };
      }
    }

    return { isValid: true };
  }, [discordAuth]);

  const getDiscordPerkRequirements = useCallback((perk: Alpha4Perk): string[] => {
    const requirements: string[] = [];

    if (perk.name.toLowerCase().includes('discord')) {
      requirements.push('Connected Discord account');
      
      if (perk.alphaPointCost >= 2000000) {
        requirements.push('Email-verified Discord account');
        requirements.push('Must be a member of Alpha4 Discord server');
      }
    }

    return requirements;
  }, []);

  const isDiscordPerk = useCallback((perk: Alpha4Perk): boolean => {
    return perk.name.toLowerCase().includes('discord') || 
           perk.description.toLowerCase().includes('discord');
  }, []);

  return {
    validateDiscordRequirement,
    getDiscordPerkRequirements,
    isDiscordPerk,
    isDiscordConnected: discordAuth.isAuthenticated(),
    discordUser: discordAuth.getCurrentUser()
  };
} 