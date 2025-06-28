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
  status: 'ACTIVE' | 'FULLY_CONSUMED' | 'EXPIRED' | 'Active' | 'Used' | 'Expired'; // Current status (both formats)
  claimSpecificMetadataId?: string; // Optional metadata object ID
  remainingUses?: number; // For consumable perks
  
  // Derived/fetched data from PerkDefinition
  name: string;
  description: string;
  icon?: string; // We'll derive this from perk_type or metadata
  perkType: string;
  usdcPrice: number;
  currentAlphaPointsPrice: number;
  tags: string[];
  
  // Additional fields for service compatibility
  category?: string; // Alias for perkType
  value?: number; // Alias for usdcPrice
  claimedAt?: string; // Formatted timestamp
}

// Unified PerkDefinition interface that works across the entire app
export interface PerkDefinition {
  // Core identification
  id: string; // Also available as objectId for compatibility
  objectId: string;
  
  // Basic info
  name: string;
  description: string;
  
  // Creator and type
  creator_partner_cap_id: string; // snake_case for API compatibility
  creatorPartnerCapId: string; // camelCase for UI compatibility
  perk_type: string; // snake_case for API compatibility
  perkType: string; // camelCase for UI compatibility
  
  // Pricing
  usdc_price: number; // snake_case for API compatibility
  usdcPrice: number; // camelCase for UI compatibility
  current_alpha_points_price: number; // snake_case for API compatibility
  currentAlphaPointsPrice: number; // camelCase for UI compatibility
  
  // Metadata
  last_price_update_timestamp_ms?: number; // snake_case for API compatibility
  lastPriceUpdateTimestamp?: number; // camelCase for UI compatibility
  
  // Claims and limits
  max_claims?: number; // snake_case for API compatibility
  maxClaims?: number; // camelCase for UI compatibility
  total_claims_count: number; // snake_case for API compatibility
  totalClaimsCount: number; // camelCase for UI compatibility
  
  // Status and features
  is_active: boolean; // snake_case for API compatibility
  isActive: boolean; // camelCase for UI compatibility
  generates_unique_claim_metadata?: boolean; // snake_case for API compatibility
  generatesUniqueClaimMetadata?: boolean; // camelCase for UI compatibility
  
  // Usage and expiration
  max_uses_per_claim?: number; // snake_case for API compatibility
  maxUsesPerClaim?: number; // camelCase for UI compatibility
  expiration_timestamp_ms?: number; // snake_case for API compatibility
  expirationTimestamp?: number; // camelCase for UI compatibility
  
  // Tags and metadata
  tags: string[];
  tag_metadata_id?: string; // snake_case for API compatibility
  tagMetadataId?: string; // camelCase for UI compatibility
  definition_metadata_id?: string; // snake_case for API compatibility
  definitionMetadataId?: string; // camelCase for UI compatibility
  
  // Additional fields for UI
  icon?: string;
  company?: string; // Derived from creatorPartnerCapId
  claimCount?: number; // Alias for totalClaimsCount
  packageId?: string;
  
  // Revenue sharing (optional)
  partner_share_percentage?: number;
  platform_share_percentage?: number;
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

// Brand configuration interface for white-label customization
export interface BrandConfig {
  company: {
    name: string;
    tagline?: string;
    logo?: string;
    website?: string;
    supportEmail?: string;
  };
  theme: {
    colors: {
      primary: string;
      secondary: string;
      background: string;
      backgroundCard: string;
      text: string;
      textMuted: string;
      border: string;
      success: string;
      warning: string;
      error: string;
    };
    fonts: {
      primary: string;
      secondary: string;
    };
    borderRadius: string;
  };
  curation: {
    method: 'perk_ids' | 'partner_ids' | 'tags';
    perkIds?: string[];
    allowedPartnerIds?: string[];
    requiredTags?: string[];
    excludedTags?: string[];
  };
  sorting?: {
    defaultSort?: string;
    customSorts?: Record<string, (perks: any[]) => any[]>;
    availableOptions?: Array<{ value: string; label: string }>;
  };
  filtering?: {
    enabledFilters?: string[];
    customFilters?: Record<string, {
      label: string;
      options: Array<{ value: string; label: string }>;
      filterFn: (perks: any[], value: string) => any[];
    }>;
  };
  features: {
    showDiscordIntegration: boolean;
    showUSDPricing: boolean;
    showClaimCounts: boolean;
    showPartnerNames: boolean;
    enableFiltering: boolean;
    showExpiredPerks: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    showLastUpdated: boolean;
  };
  content: {
    welcomeTitle?: string;
    welcomeMessage?: string;
    emptyStateTitle?: string;
    emptyStateMessage?: string;
    footerText?: string;
    purchaseButtonText?: string;
    connectWalletText?: string;
  };
  social?: {
    website?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
    email?: string;
  };
  analytics?: {
    enableTracking: boolean;
    trackPerkViews: boolean;
    trackPurchases: boolean;
    trackFilterUsage: boolean;
    customEvents?: Record<string, any>;
  };
  advanced?: {
    balanceBasedCuration?: {
      enabled: boolean;
      tiers: Array<{
        minBalance: number;
        maxBalance: number;
        additionalTags: string[];
      }>;
    };
    featuredPerks?: {
      enabled: boolean;
      maxCount: number;
      criteria: {
        tags: string[];
        minClaimCount: number;
      };
    };
  };
} 