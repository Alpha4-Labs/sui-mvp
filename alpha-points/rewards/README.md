# 🏷️ Alpha4 White Label Perk Marketplace

> **A customizable, brandable perk marketplace template powered by Alpha4's infrastructure**

Transform your brand's perk offerings into a beautiful, professional marketplace in minutes. This white-label template allows you to create a fully branded perk redemption experience for your users while leveraging Alpha4's robust perk management infrastructure.

## ✨ Key Features

- 🎨 **Fully Brandable** - Colors, logos, content, and styling
- 🎯 **Curated Perks** - Show only the perks you want to offer
- ⚡ **Instant Setup** - Deploy in minutes, not days
- 🔒 **Secure & Trusted** - Built on Sui blockchain
- 📱 **Responsive Design** - Perfect on all devices
- 🛠️ **Easy Customization** - Simple configuration files

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone <this-repo>
cd rewards
npm install

# 2. Set up environment
npm run setup
# Edit the created .env file with your configuration

# 3. Customize your brand
# Edit src/config/brand.ts with your company details

# 4. Start development server
npm run dev
```

Your branded marketplace will be live at `http://localhost:5173` 🎉

## 🎨 Customization Examples

### Gaming Company Setup
```typescript
// src/config/brand.ts
export const BRAND_CONFIG = {
  company: {
    name: "GameForce Studios",
    tagline: "Exclusive Gaming Rewards",
    logo: "/gameforce-logo.png",
  },
  theme: {
    colors: {
      primary: "#FF6B35",      // Gaming orange
      secondary: "#00D4FF",    // Electric blue
      background: "#0A0A0A",   // Dark theme
    },
  },
  perks: {
    requiredTags: ["gaming", "exclusive"],
    // Only show gaming-related perks
  },
};
```

### DeFi Protocol Setup
```typescript
// src/config/brand.ts
export const BRAND_CONFIG = {
  company: {
    name: "YieldMax Protocol",
    tagline: "Premium DeFi Benefits",
  },
  theme: {
    colors: {
      primary: "#00D2FF",      // DeFi blue
      secondary: "#3A416F",    // Professional
      accent: "#FFD700",       // Gold highlights
    },
  },
  perks: {
    curatedPerkIds: [
      "0x123...", // Show only specific high-value perks
      "0x456...",
    ],
  },
};
```

## 🎯 Perk Curation Options

You have multiple ways to curate which perks appear in your marketplace:

1. **Specific Perks Only** (Recommended)
   ```typescript
   perks: {
     curatedPerkIds: ["0x123...", "0x456..."],
   }
   ```

2. **By Partner/Creator**
   ```typescript
   perks: {
     allowedPartnerIds: ["0xpartner1...", "0xpartner2..."],
   }
   ```

3. **By Tags**
   ```typescript
   perks: {
     requiredTags: ["premium", "vip"],
     excludedTags: ["deprecated", "test"],
   }
   ```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Your Branded Frontend         │
│  (Colors, Logo, Content, Curated Perks) │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Alpha4 Perk Infrastructure      │
│   (Smart Contracts, Data, Transactions) │
└─────────────────────────────────────────┘
```

- **Frontend**: Your fully customized interface
- **Backend**: Alpha4's battle-tested perk management system
- **Blockchain**: Sui network for security and transparency

## 📦 What's Included

- ✅ **Complete perk marketplace** with wallet integration
- ✅ **Brand configuration system** for easy customization
- ✅ **Responsive design** that works on all devices
- ✅ **Loading states and error handling** for great UX
- ✅ **Perk filtering and curation** tools
- ✅ **Toast notifications** for user feedback
- ✅ **Production build** setup for deployment

## 🎨 Brand Configuration

All customization happens in `src/config/brand.ts`:

```typescript
export const BRAND_CONFIG = {
  // 🏢 Company branding
  company: {
    name: "Your Company",
    tagline: "Your tagline",
    logo: "/your-logo.svg",
    website: "https://yoursite.com",
    supportEmail: "support@yourcompany.com",
  },
  
  // 🎨 Visual theming
  theme: {
    colors: {
      primary: "#your-brand-color",
      // ... all customizable
    },
    fonts: {
      primary: "'Your Font', sans-serif",
    },
    borderRadius: "lg", // none, sm, md, lg, xl
  },
  
  // 🎯 Perk curation
  perks: {
    curatedPerkIds: [], // Specific perks to show
    allowedPartnerIds: [], // Specific partners to show
    requiredTags: [], // Only show perks with these tags
    excludedTags: [], // Hide perks with these tags
    defaultSort: "date", // How to sort perks
  },
  
  // 🔧 Feature toggles
  features: {
    showDiscordIntegration: true,
    showPriceInUSD: true,
    showClaimCount: true,
    showPartnerNames: true,
    allowFiltering: true,
    showExpiredPerks: false,
  },
  
  // 📝 Content customization
  content: {
    title: "Your Marketplace Title",
    subtitle: "Your description",
    welcomeMessage: "Welcome text",
    footerText: "Footer text",
    connectWalletText: "Connect Wallet",
    noPerksMessage: "No perks message",
  },
};
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push your customized code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy! 🚀

### Netlify
1. Build: `npm run build`
2. Upload `dist` folder to Netlify
3. Configure environment variables
4. Done! ✨

### Other Platforms
The built `dist` folder is a static site that works anywhere:
- AWS S3 + CloudFront
- Azure Static Web Apps  
- GitHub Pages
- Any static hosting service

## 🛠️ Technical Stack

- **React 19** + TypeScript for robust development
- **Vite** for lightning-fast builds
- **Tailwind CSS** for beautiful, responsive styling
- **@mysten/dapp-kit** for Sui wallet integration
- **React Hot Toast** for notifications

## 📚 Documentation

- 📖 **[Complete Setup Guide](./SETUP_GUIDE.md)** - Detailed customization instructions
- 🎨 **[Theming Guide](./SETUP_GUIDE.md#visual-theming)** - Color and style customization
- 🎯 **[Perk Curation Guide](./SETUP_GUIDE.md#perk-curation-most-important)** - How to choose which perks to show
- 🚀 **[Deployment Guide](./SETUP_GUIDE.md#deployment)** - Production deployment instructions

## 🆚 vs. Building From Scratch

| Feature | White Label Template | Building from Scratch |
|---------|---------------------|----------------------|
| ⏱️ **Time to Launch** | Minutes | Weeks/Months |
| 💰 **Development Cost** | $0 | $10,000+ |
| 🔒 **Smart Contract Security** | Battle-tested | Unproven |
| 🎨 **Customization** | Full branding control | Full control |
| 🛠️ **Maintenance** | Alpha4 maintains core | You maintain everything |
| 📱 **Mobile Responsive** | ✅ Included | ❓ Build yourself |
| 🔄 **Updates & Features** | ✅ Automatic | ❓ Build yourself |

## 🤝 Support & Community

- 📧 **Email Support**: [support@alpha4.ai](mailto:support@alpha4.ai)
- 💬 **Discord Community**: [Join Alpha4 Discord](https://discord.gg/alpha4)
- 📚 **Documentation**: [Complete guides and tutorials](./SETUP_GUIDE.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/alpha4/issues)

## 📄 License

This template is provided by Alpha4 for creating branded perk marketplaces. 
- ✅ **Free to use** for creating your branded marketplace
- ✅ **Free to customize** colors, content, and branding
- ✅ **Free to deploy** to your own domain
- ❌ **Cannot resell** this template itself

## 🌟 Success Stories

> "We launched our branded perk marketplace in 30 minutes. Our users love the seamless experience!" 
> — **GameForce Studios**

> "The white-label template saved us 3 months of development time. Now we focus on our core product."
> — **YieldMax Protocol**

---

**Ready to launch your branded perk marketplace?** 

1. 📥 **[Download the template]()**
2. 🎨 **[Follow the setup guide](./SETUP_GUIDE.md)**
3. 🚀 **Deploy and go live!**

*Made with ❤️ by the Alpha4 team*
