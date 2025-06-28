# 🏷️ White Label Perk Marketplace Setup Guide

Welcome to the Alpha4 White Label Perk Marketplace! This template allows you to quickly deploy a branded perk marketplace for your company, showing only the perks you want to offer to your users.

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone <this-repo>
   cd rewards
   npm install
   ```

2. **Configure Your Brand** (see [Brand Configuration](#brand-configuration))
   - Edit `src/config/brand.ts`
   - Add your logo to `public/`
   - Customize colors, content, and perk curation

3. **Set Environment Variables**
   - Copy `env.template` to `.env.local`
   - ⚠️ **CRITICAL**: Replace shared object IDs with actual deployed contract IDs
   - Configure your Sui network and contract details

4. **Run Development Server**
   ```bash
   npm run dev
   ```

Your branded perk marketplace will be available at `http://localhost:5173`

## 🎨 Brand Configuration

### Basic Company Information

Edit `src/config/brand.ts` to customize your marketplace:

```typescript
export const BRAND_CONFIG: BrandConfig = {
  company: {
    name: "Your Company Name",           // 🏢 Your company name
    tagline: "Your Company Tagline",     // 📝 Optional tagline
    logo: "/your-logo.svg",              // 🖼️  Logo file (place in public/)
    website: "https://yourcompany.com",  // 🌐 Your website URL
    supportEmail: "support@yourcompany.com", // 📧 Support contact
  },
  
  theme: {
    colors: {
      primary: "#your-brand-color",      // 🎨 Your primary brand color
      // ... other colors
    },
    // ... other theme settings
  },
  
  // ... other configuration
};
```

### 🎯 Perk Curation (Most Important!)

You have several options for curating which perks to show:

#### Option 1: Show Specific Perks Only (Recommended)
```typescript
perks: {
  curatedPerkIds: [
    "0x1234567890abcdef...", // Your specific perk IDs
    "0xabcdef1234567890...", // Add as many as you want
  ],
  // ... other settings
}
```

#### Option 2: Show Perks from Specific Partners
```typescript
perks: {
  allowedPartnerIds: [
    "0xpartner1...", // Partner capability IDs
    "0xpartner2...", // Only show perks from these partners
  ],
  // ... other settings
}
```

#### Option 3: Filter by Tags
```typescript
perks: {
  requiredTags: ["vip", "premium"],    // Only show perks with these tags
  excludedTags: ["deprecated", "test"], // Hide perks with these tags
  // ... other settings
}
```

### 🎨 Visual Theming

Customize colors to match your brand:

```typescript
theme: {
  colors: {
    primary: "#9333EA",      // Main brand color (buttons, links)
    primaryDark: "#7C3AED",  // Darker shade for hover states
    secondary: "#06B6D4",    // Secondary accent color
    accent: "#F59E0B",       // Highlight color
    background: "#0F172A",   // Main background
    backgroundCard: "#1E293B", // Card backgrounds
    text: "#F8FAFC",         // Main text color
    textMuted: "#94A3B8",    // Muted text color
    border: "#374151",       // Border color
    success: "#10B981",      // Success messages
    warning: "#F59E0B",      // Warning messages
    error: "#EF4444",        // Error messages
  },
  fonts: {
    primary: "'Inter', sans-serif", // Main font family
  },
  borderRadius: "lg", // Border radius: none, sm, md, lg, xl
}
```

### 🔧 Feature Toggles

Control which features to show:

```typescript
features: {
  showDiscordIntegration: true,   // Show Discord connection features
  showPriceInUSD: true,          // Display USD equivalent prices
  showClaimCount: true,          // Show how many people claimed each perk
  showPartnerNames: true,        // Show who created each perk
  allowFiltering: true,          // Allow users to filter/sort perks
  showExpiredPerks: false,       // Hide expired perks by default
}
```

### 📝 Content Customization

Customize all text content:

```typescript
content: {
  title: "Your Marketplace Title",
  subtitle: "Your marketplace description",
  welcomeMessage: "Welcome message for new users",
  footerText: "Powered by Your Company",
  connectWalletText: "Connect Wallet",
  noPerksMessage: "No perks available message",
}
```

## 🏗️ Advanced Customization

### Adding Your Logo

1. Place your logo file in the `public/` directory
2. Update the logo path in `brand.ts`:
   ```typescript
   company: {
     logo: "/your-logo.svg", // or .png, .jpg, etc.
   }
   ```

### Custom Styling

The marketplace uses CSS custom properties for theming. You can also add custom CSS in `src/index.css` for additional styling:

```css
/* Custom styles */
.your-custom-class {
  /* Your custom styles */
}

/* Override theme colors if needed */
:root {
  --color-primary: #your-color;
}
```

### Environment Configuration

Create a `.env` file with your Sui network configuration:

```env
# Sui Network Configuration
VITE_SUI_NETWORK=testnet
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io
VITE_PERK_MANAGER_PACKAGE_ID=0xf933e69aeeeebb9d1fc50b6324070d8f2bdc2595162b0616142a509c90e3cd16

# ⚠️ CRITICAL: Shared Object IDs (Required for Alpha Points Balance)
# These MUST be replaced with actual deployed contract object IDs
# Contact Alpha4 support for testnet/mainnet object IDs
VITE_CONFIG_ID=0x... # Replace with actual Config object ID
VITE_LEDGER_ID=0x... # Replace with actual Ledger object ID  
VITE_STAKING_MANAGER_ID=0x... # Replace with actual StakingManager object ID
VITE_ORACLE_ID=0x... # Replace with actual Oracle object ID

# Optional: Discord Integration
VITE_DISCORD_CLIENT_ID=your_discord_client_id
VITE_DISCORD_REDIRECT_URI=http://localhost:5173
```

## 📋 Example Configurations

### Example 1: Gaming Company
```typescript
export const BRAND_CONFIG: BrandConfig = {
  company: {
    name: "GameForce Studios",
    tagline: "Exclusive Gaming Rewards",
    logo: "/gameforce-logo.png",
    website: "https://gameforce.com",
  },
  theme: {
    colors: {
      primary: "#FF6B35",      // Orange gaming theme
      secondary: "#00D4FF",    // Electric blue
      background: "#0A0A0A",   // Dark gaming aesthetic
      // ...
    },
  },
  perks: {
    requiredTags: ["gaming", "exclusive"],
    defaultSort: "claims", // Show most popular first
  },
  content: {
    title: "GameForce Exclusive Rewards",
    subtitle: "Redeem your points for premium gaming perks",
    welcomeMessage: "Welcome to GameForce Rewards! Connect your wallet to access exclusive gaming perks and in-game items.",
  },
};
```

### Example 2: DeFi Protocol
```typescript
export const BRAND_CONFIG: BrandConfig = {
  company: {
    name: "YieldMax Protocol",
    tagline: "Premium DeFi Benefits",
    logo: "/yieldmax-logo.svg",
  },
  theme: {
    colors: {
      primary: "#00D2FF",      // DeFi blue
      secondary: "#3A416F",    // Professional dark blue
      accent: "#FFD700",       // Gold highlights
      // ...
    },
  },
  perks: {
    curatedPerkIds: [
      "0x123...", // Specific high-value DeFi perks only
      "0x456...",
    ],
  },
  features: {
    showPriceInUSD: true,
    showClaimCount: false, // Keep exclusivity by hiding claim counts
  },
  content: {
    title: "YieldMax Premium Benefits",
    subtitle: "Exclusive perks for our valued DeFi community",
  },
};
```

### Example 3: NFT Marketplace
```typescript
export const BRAND_CONFIG: BrandConfig = {
  company: {
    name: "ArtVault",
    tagline: "Curated NFT Experiences",
    logo: "/artvault-logo.png",
  },
  theme: {
    colors: {
      primary: "#8B5CF6",      // Purple for creativity
      secondary: "#EC4899",    // Pink accent
      background: "#1A1A1A",   // Gallery black
      // ...
    },
  },
  perks: {
    requiredTags: ["nft", "art", "exclusive"],
    excludedTags: ["deprecated"],
  },
  content: {
    title: "ArtVault Collector Perks",
    subtitle: "Exclusive benefits for our NFT community",
    welcomeMessage: "Welcome to ArtVault Collector Perks! Redeem your points for exclusive NFT drops, gallery access, and artist meetups.",
  },
};
```

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview  # Test the build locally
```

### Deploy to Vercel
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy!

### Deploy to Netlify
1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify
3. Set environment variables in Netlify dashboard

## 🔧 Troubleshooting

### Common Issues

1. **"No perks showing"**
   - Check your `curatedPerkIds` configuration
   - Verify your Sui network configuration
   - Check browser console for errors

2. **"Wallet won't connect"**
   - Make sure you have Sui Wallet installed
   - Check network configuration matches your wallet
   - Try refreshing the page

3. **"Alpha Points balance shows 0 or error"**
   - Make sure all shared object IDs are configured (VITE_CONFIG_ID, VITE_LEDGER_ID, etc.)
   - Verify the package ID matches your deployed contracts
   - Check that your wallet is connected to the same network

4. **"Styling looks wrong"**
   - Check that your CSS custom properties are valid
   - Verify brand configuration is properly exported
   - Clear browser cache

### Getting Help

- Check the console for error messages
- Review the configuration examples above
- Contact support at your configured support email

## 📚 Technical Details

### Architecture
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling with custom properties
- **@mysten/dapp-kit** for Sui wallet integration
- **React Hot Toast** for notifications

### File Structure
```
src/
├── components/
│   ├── WhiteLabelApp.tsx        # Main app component
│   ├── CuratedPerkMarketplace.tsx # Perk marketplace
│   └── RewardPlatform.tsx       # Legacy component
├── config/
│   ├── brand.ts                 # 🎨 CUSTOMIZE THIS
│   └── sui.ts                   # Sui network config
├── hooks/
│   └── usePerkMarketplace.ts    # Perk data logic
└── types/
    └── index.ts                 # TypeScript definitions
```

---

**Made with ❤️ by Alpha4**

Questions? Contact us at [support@alpha4.ai](mailto:support@alpha4.ai) 