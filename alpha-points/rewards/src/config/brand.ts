// Brand Configuration for White Label Perk Marketplace
// 🎨 Customize this file to match your company's branding

export interface BrandConfig {
  // Company Information
  company: {
    name: string;
    tagline?: string;
    logo?: string;
    website?: string;
    supportEmail?: string;
  };
  
  // Visual Theming
  theme: {
    colors: {
      primary: string;
      primaryDark: string;
      secondary: string;
      accent: string;
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
      mono?: string;
    };
    borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  };
  
  // Perk Curation
  perks: {
    // Show only specific perk IDs (empty array = show all)
    curatedPerkIds: string[];
    // Show only perks from specific partners
    allowedPartnerIds: string[];
    // Hide perks with these tags
    excludedTags: string[];
    // Only show perks with these tags
    requiredTags: string[];
    // Custom sorting
    defaultSort: 'alphabetical' | 'date' | 'price-low' | 'price-high' | 'claims';
  };
  
  // Feature Toggles
  features: {
    showDiscordIntegration: boolean;
    showPriceInUSD: boolean;
    showClaimCount: boolean;
    showPartnerNames: boolean;
    allowFiltering: boolean;
    showExpiredPerks: boolean;
  };
  
  // Content Customization
  content: {
    title: string;
    subtitle?: string;
    welcomeMessage?: string;
    footerText?: string;
    connectWalletText: string;
    noPerksMessage: string;
  };
}

// 🏢 CUSTOMIZE THIS FOR YOUR COMPANY
export const BRAND_CONFIG: BrandConfig = {
  company: {
    name: "Alpha4",
    tagline: "Premium DeFi Perks & Rewards",
    logo: "/alpha4-logo.svg", // Place your logo in the public folder
    website: "https://alpha4.ai",
    supportEmail: "support@alpha4.ai",
  },
  
  theme: {
    colors: {
      primary: "#9333EA",      // Purple - Change to your brand color
      primaryDark: "#7C3AED",  // Darker purple
      secondary: "#06B6D4",    // Cyan
      accent: "#F59E0B",       // Amber
      background: "#0F172A",   // Dark slate
      backgroundCard: "#1E293B", // Slate 800
      text: "#F8FAFC",         // Nearly white
      textMuted: "#94A3B8",    // Slate 400
      border: "#374151",       // Gray 700
      success: "#10B981",      // Emerald
      warning: "#F59E0B",      // Amber
      error: "#EF4444",        // Red
    },
    fonts: {
      primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace",
    },
    borderRadius: "lg", // Options: none, sm, md, lg, xl
  },
  
  perks: {
    // 🎯 CURATE YOUR PERKS HERE
    // Option 1: Show specific perks only (recommended for white label)
    curatedPerkIds: [
      // Add your specific perk IDs here
      // "0x1234567890abcdef...",
      // "0xabcdef1234567890...",
    ],
    
    // Option 2: Show perks from specific partners only
    allowedPartnerIds: [
      // Add partner IDs you want to show
      // "0xpartner1...",
      // "0xpartner2...",
    ],
    
    // Option 3: Filter by tags
    excludedTags: [], // Hide perks with these tags
    requiredTags: [], // Only show perks with these tags
    
    defaultSort: "date", // How to sort perks by default
  },
  
  features: {
    showDiscordIntegration: true,   // Show Discord connection features
    showPriceInUSD: true,          // Display USD equivalent prices
    showClaimCount: true,          // Show how many people claimed each perk
    showPartnerNames: true,        // Show who created each perk
    allowFiltering: true,          // Allow users to filter/sort perks
    showExpiredPerks: false,       // Hide expired perks by default
  },
  
  content: {
    title: "Exclusive Perks & Rewards",
    subtitle: "Redeem your Alpha Points for premium benefits",
    welcomeMessage: "Welcome to our exclusive perks marketplace! Connect your wallet to get started.",
    footerText: "Powered by Alpha4 Perk Infrastructure",
    connectWalletText: "Connect Wallet to View Perks",
    noPerksMessage: "No perks available at this time. Check back soon!",
  },
};

// CSS Custom Properties Generator
export const generateCSSVars = (config: BrandConfig) => {
  const { colors } = config.theme;
  return `
    :root {
      --color-primary: ${colors.primary};
      --color-primary-dark: ${colors.primaryDark};
      --color-secondary: ${colors.secondary};
      --color-accent: ${colors.accent};
      --color-background: ${colors.background};
      --color-background-card: ${colors.backgroundCard};
      --color-text: ${colors.text};
      --color-text-muted: ${colors.textMuted};
      --color-border: ${colors.border};
      --color-success: ${colors.success};
      --color-warning: ${colors.warning};
      --color-error: ${colors.error};
      --font-primary: ${config.theme.fonts.primary};
      --font-mono: ${config.theme.fonts.mono || config.theme.fonts.primary};
      --border-radius: ${
        config.theme.borderRadius === 'none' ? '0' :
        config.theme.borderRadius === 'sm' ? '0.125rem' :
        config.theme.borderRadius === 'md' ? '0.375rem' :
        config.theme.borderRadius === 'lg' ? '0.5rem' :
        '0.75rem'
      };
    }
  `;
};

// Helper function to check if a perk should be displayed based on curation rules
export const shouldDisplayPerk = (perk: any, config: BrandConfig): boolean => {
  const { curatedPerkIds, allowedPartnerIds, excludedTags, requiredTags } = config.perks;
  
  // If specific perk IDs are configured, only show those
  if (curatedPerkIds.length > 0) {
    return curatedPerkIds.includes(perk.id);
  }
  
  // If specific partner IDs are configured, only show those
  if (allowedPartnerIds.length > 0) {
    return allowedPartnerIds.includes(perk.creator_partner_cap_id);
  }
  
  // Check excluded tags
  if (excludedTags.length > 0 && perk.tags) {
    const hasExcludedTag = perk.tags.some((tag: string) => excludedTags.includes(tag));
    if (hasExcludedTag) return false;
  }
  
  // Check required tags
  if (requiredTags.length > 0 && perk.tags) {
    const hasRequiredTag = perk.tags.some((tag: string) => requiredTags.includes(tag));
    if (!hasRequiredTag) return false;
  }
  
  return true;
}; 