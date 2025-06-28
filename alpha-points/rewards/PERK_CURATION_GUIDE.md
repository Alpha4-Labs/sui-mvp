# 🎯 Perk Curation Guide - White Label Marketplace

## Overview
This guide explains how to curate and customize the perks displayed in your white-label marketplace. You can control exactly which perks appear to your users through multiple filtering methods.

---

## 🎛️ **Curation Methods**

### **Method 1: Specific Perk IDs (Recommended)**
The most precise way to curate your marketplace - specify exactly which perks to show.

```typescript
// In src/config/brand.ts
export const brandConfig = {
  curation: {
    method: 'perk_ids',
    perkIds: [
      '0x1234...abc1', // Premium Discord Role
      '0x1234...abc2', // VIP Event Access
      '0x1234...abc3', // Exclusive NFT Mint
      '0x1234...abc4', // Early Product Access
    ],
  },
};
```

### **Method 2: Partner-Based Curation**
Show all perks from specific partner companies.

```typescript
export const brandConfig = {
  curation: {
    method: 'partner_ids',
    allowedPartnerIds: [
      '0xpartner1...', // Your Gaming Partner
      '0xpartner2...', // Your DeFi Partner
      '0xpartner3...', // Your NFT Partner
    ],
  },
};
```

### **Method 3: Tag-Based Filtering**
Filter perks by categories and tags.

```typescript
export const brandConfig = {
  curation: {
    method: 'tags',
    requiredTags: ['gaming', 'premium'], // Must have ALL these tags
    excludedTags: ['competitor', 'adult'], // Must NOT have any of these
  },
};
```

---

## 🔍 **Finding Perk IDs**

### **Method 1: Using Sui Explorer**
1. Go to [Sui Explorer](https://explorer.sui.io/)
2. Search for package ID: `{PERK_MANAGER_PACKAGE_ID}`
3. Look for `PerkDefinitionCreated` events
4. Copy the `perk_definition_id` from events

### **Method 2: Using the Debug Console**
Add this to your browser console while the marketplace is loaded:

```javascript
// Get all available perks with their IDs
console.table(
  window.__MARKETPLACE_PERKS__.map(perk => ({
    id: perk.id,
    name: perk.name,
    company: perk.company,
    tags: perk.tags?.join(', '),
    price: perk.current_alpha_points_price
  }))
);
```

### **Method 3: Using the Curation Helper Tool**
We've included a helper component for easy perk discovery:

```bash
# Enable debug mode in your environment
echo "VITE_DEBUG_MODE=true" >> .env.local

# Restart your dev server
npm run dev
```

Then visit `/debug/perks` to see all available perks with copy-paste IDs.

---

## 🎨 **Customization Examples**

### **Gaming Company Example**
```typescript
export const brandConfig = {
  company: {
    name: "GameFi Studios",
    tagline: "Level Up Your Gaming Experience",
  },
  curation: {
    method: 'tags',
    requiredTags: ['gaming'],
    excludedTags: ['defi', 'trading'],
  },
  theme: {
    colors: {
      primary: '#00ff88',
      secondary: '#ff6b00',
    }
  }
};
```

### **DeFi Platform Example**
```typescript
export const brandConfig = {
  company: {
    name: "DeFi Capital",
    tagline: "Exclusive DeFi Opportunities",
  },
  curation: {
    method: 'tags',
    requiredTags: ['defi', 'finance'],
    excludedTags: ['gaming', 'nft'],
  },
  theme: {
    colors: {
      primary: '#1e40af',
      secondary: '#059669',
    }
  }
};
```

### **NFT Marketplace Example**
```typescript
export const brandConfig = {
  company: {
    name: "ArtBlocks Pro",
    tagline: "Curated Digital Art Collections",
  },
  curation: {
    method: 'perk_ids',
    perkIds: [
      '0x...nft1', // Exclusive Artist Drop
      '0x...nft2', // Gallery VIP Access
      '0x...nft3', // Artist Meet & Greet
    ],
  },
};
```

---

## 🛠️ **Advanced Curation Features**

### **Dynamic Filtering**
Combine multiple methods for precise control:

```typescript
export const brandConfig = {
  curation: {
    method: 'hybrid',
    // Start with specific perks
    perkIds: ['0x...perk1', '0x...perk2'],
    // Add all perks from trusted partners
    allowedPartnerIds: ['0x...partner1'],
    // But exclude certain categories
    excludedTags: ['competitor', 'inappropriate'],
    // And require quality standards
    requiredTags: ['verified', 'premium'],
  },
};
```

### **User Role-Based Curation**
Show different perks based on user tier:

```typescript
// In src/hooks/usePerkCuration.ts
export const usePerkCuration = () => {
  const { userTier } = useUserData();
  
  const getCurationConfig = () => {
    switch (userTier) {
      case 'vip':
        return {
          method: 'tags',
          requiredTags: ['vip', 'premium'],
        };
      case 'premium':
        return {
          method: 'tags',
          requiredTags: ['premium'],
          excludedTags: ['basic'],
        };
      default:
        return {
          method: 'tags',
          excludedTags: ['vip', 'premium'],
        };
    }
  };
};
```

---

## 📊 **Sorting & Filtering Options**

### **Default Sorting Options**
```typescript
export const sortingOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'alphabetical', label: 'A-Z' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'claims', label: 'Most Popular' },
  { value: 'ending-soon', label: 'Ending Soon' },
];
```

### **Custom Sorting**
Add your own sorting logic:

```typescript
// In src/config/brand.ts
export const brandConfig = {
  sorting: {
    defaultSort: 'featured', // Your custom sort
    customSorts: {
      'featured': (perks) => {
        // Your featured perks first
        const featured = ['0x...perk1', '0x...perk2'];
        return perks.sort((a, b) => {
          const aFeatured = featured.includes(a.id);
          const bFeatured = featured.includes(b.id);
          if (aFeatured && !bFeatured) return -1;
          if (!aFeatured && bFeatured) return 1;
          return b.createdAt - a.createdAt; // Then by newest
        });
      },
      'value': (perks) => {
        // Sort by best value (claims per point)
        return perks.sort((a, b) => {
          const aValue = a.claimCount / a.current_alpha_points_price;
          const bValue = b.claimCount / b.current_alpha_points_price;
          return bValue - aValue;
        });
      },
    },
  },
};
```

### **Filter Categories**
Customize available filter categories:

```typescript
export const brandConfig = {
  filtering: {
    enabledFilters: ['search', 'tags', 'price', 'availability'],
    customFilters: {
      'rarity': {
        label: 'Rarity',
        options: [
          { value: 'common', label: 'Common' },
          { value: 'rare', label: 'Rare' },
          { value: 'legendary', label: 'Legendary' },
        ],
        filterFn: (perks, value) => {
          return perks.filter(perk => 
            perk.tags?.includes(value)
          );
        },
      },
    },
  },
};
```

---

## 🔄 **Real-Time Updates**

### **Auto-Refresh Configuration**
```typescript
export const brandConfig = {
  features: {
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    showLastUpdated: true,
  },
};
```

### **Manual Refresh**
Users can manually refresh the perk list with the refresh button in the header.

---

## 🎯 **Testing Your Curation**

### **1. Preview Mode**
Enable preview mode to test curation without affecting live users:

```typescript
// In .env.local
VITE_PREVIEW_MODE=true
VITE_PREVIEW_USER_EMAIL=taylorcoxdesigns@gmail.com
```

### **2. Curation Validator**
Use the built-in validator to check your configuration:

```bash
npm run validate-curation
```

### **3. A/B Testing**
Test different curation strategies:

```typescript
export const brandConfig = {
  curation: {
    method: 'ab_test',
    variants: {
      'control': { method: 'tags', requiredTags: ['premium'] },
      'experiment': { method: 'perk_ids', perkIds: ['0x...'] },
    },
    userAssignment: (userAddress) => {
      // Assign users to variants based on address
      return userAddress.endsWith('0') ? 'experiment' : 'control';
    },
  },
};
```

---

## 📝 **Best Practices**

### **✅ Do's**
- Start with a small, curated list of high-quality perks
- Test your curation with real users before going live
- Use descriptive tags for better filtering
- Regularly review and update your perk selection
- Monitor user engagement and adjust accordingly

### **❌ Don'ts**
- Don't include too many perks initially (overwhelming)
- Don't forget to test edge cases (no perks available)
- Don't use competitor perks without permission
- Don't ignore user feedback on perk relevance
- Don't forget to update expired or inactive perks

---

## 🚀 **Quick Setup Checklist**

- [ ] Choose your curation method
- [ ] Identify target perk IDs or tags
- [ ] Update `src/config/brand.ts` with curation config
- [ ] Test in preview mode
- [ ] Validate with `npm run validate-curation`
- [ ] Deploy to staging for user testing
- [ ] Monitor analytics and adjust as needed
- [ ] Deploy to production

---

## 📞 **Need Help?**

- **Documentation**: Check the full setup guide in `SETUP_GUIDE.md`
- **Examples**: See example configurations in `examples/brand-configs/`
- **Support**: Contact Alpha4 Labs support for technical assistance
- **Community**: Join our Discord for tips and best practices

---

*This curation system gives you complete control over your marketplace content while maintaining the flexibility to grow and evolve your offerings.* 