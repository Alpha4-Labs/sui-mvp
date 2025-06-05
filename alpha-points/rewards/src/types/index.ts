export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
}

export interface ConnectionStatus {
  wallet: {
    connected: boolean;
    address?: string;
  };
  discord: {
    connected: boolean;
    user?: DiscordUser;
  };
}

// Updated to match smart contract ClaimedPerk structure
export interface ClaimedPerk {
  objectId: string; // The actual object ID on Sui
  perkDefinitionId: string; // Links to the PerkDefinition
  owner: string; // User's address
  claimTimestamp: number; // When it was claimed (ms)
  status: 'ACTIVE' | 'FULLY_CONSUMED' | 'EXPIRED'; // Current status
  claimSpecificMetadataId?: string; // Optional metadata object ID
  remainingUses?: number; // For consumable perks
  
  // Derived/fetched data from PerkDefinition
  name: string;
  description: string;
  icon: string; // We'll derive this from perk_type or metadata
  perkType: string;
  usdcPrice: number;
  currentAlphaPointsPrice: number;
  tags: string[];
}

// Structure that matches the smart contract PerkDefinition
export interface PerkDefinition {
  objectId: string;
  name: string;
  description: string;
  creatorPartnerCapId: string;
  perkType: string;
  usdcPrice: number;
  currentAlphaPointsPrice: number;
  lastPriceUpdateTimestamp: number;
  maxClaims?: number;
  totalClaimsCount: number;
  isActive: boolean;
  definitionMetadataId: string;
  generatesUniqueClaimMetadata: boolean;
  maxUsesPerClaim?: number;
  expirationTimestamp?: number;
  tags: string[];
  tagMetadataId: string;
}

// For Alpha4's own reward offerings
export interface Alpha4Perk {
  id: string;
  name: string;
  description: string;
  icon: string;
  alphaPointCost: number;
  usdcValue: number;
  isAvailable: boolean;
  isPlaceholder?: boolean;
  requiredPerkType?: string; // Match against ClaimedPerk.perkType
  requiredTags?: string[]; // Match against ClaimedPerk.tags
}

// For blockchain interactions
export interface SuiObjectResponse {
  data?: {
    objectId: string;
    type: string;
    fields: Record<string, any>;
  };
} 