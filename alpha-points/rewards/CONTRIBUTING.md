# Contributing to Alpha4 White Label Perk Marketplace

Thank you for your interest in contributing to the Alpha4 White Label Perk Marketplace! This guide will help you get started.

## 🚀 Quick Start for Contributors

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/whitelabel-perk-store.git
   cd whitelabel-perk-store
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Set up environment**
   ```bash
   npm run setup
   # Edit .env with your test configuration
   ```
5. **Start development**
   ```bash
   npm run dev
   ```

## 🏗️ Project Structure

```
src/
├── components/
│   ├── WhiteLabelApp.tsx        # Main app component
│   ├── CuratedPerkMarketplace.tsx # Core marketplace
│   └── RewardPlatform.tsx       # Legacy component
├── config/
│   ├── brand.ts                 # Brand configuration system
│   └── sui.ts                   # Sui network config
├── hooks/
│   └── usePerkMarketplace.ts    # Perk data management
├── utils/
│   └── transactions.ts          # Blockchain transaction utilities
└── types/
    └── index.ts                 # TypeScript definitions
```

## 🛠️ Development Guidelines

### Code Style
- **TypeScript**: Always use TypeScript with proper type definitions
- **React**: Use functional components with hooks
- **CSS**: Use Tailwind CSS with custom properties for theming
- **Comments**: Add JSDoc comments for exported functions and components

### Naming Conventions
- **Components**: PascalCase (e.g., `CuratedPerkMarketplace`)
- **Files**: PascalCase for components, camelCase for utilities
- **Functions**: camelCase (e.g., `fetchMarketplacePerks`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `BRAND_CONFIG`)

### Testing Your Changes
1. **Test with different brand configurations**
   ```typescript
   // Try different color schemes, company names, etc.
   export const BRAND_CONFIG = {
     company: { name: "Test Company" },
     theme: { colors: { primary: "#FF0000" } },
     // ...
   };
   ```

2. **Test perk curation**
   ```typescript
   // Test different curation methods
   perks: {
     curatedPerkIds: ["test-perk-id"],
     requiredTags: ["test"],
     // ...
   }
   ```

3. **Test responsive design**
   - Mobile (320px+)
   - Tablet (768px+)
   - Desktop (1024px+)

## 🎯 Types of Contributions Welcome

### 🐛 Bug Fixes
- UI/UX issues
- Performance problems
- Configuration edge cases
- Mobile responsiveness issues

### ✨ Feature Enhancements
- New branding options
- Additional perk filtering methods
- UI/UX improvements
- Performance optimizations

### 📚 Documentation
- Setup guide improvements
- Code examples
- Industry-specific templates
- Troubleshooting guides

### 🎨 Design & UX
- Better default themes
- Accessibility improvements
- Animation enhancements
- Mobile experience improvements

## 📝 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the coding guidelines
   - Add/update documentation as needed
   - Test thoroughly

3. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new branding option for border radius"
   git commit -m "fix: resolve mobile layout issue in marketplace"
   git commit -m "docs: update setup guide with Discord integration"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Create a pull request on GitHub
   - Use the PR template
   - Link any related issues

## 🏷️ Commit Message Convention

We use conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code changes that neither fix bugs nor add features
- `test:` Adding or updating tests
- `chore:` Changes to build process or auxiliary tools

## 🧪 Testing Guidelines

### Manual Testing Checklist
- [ ] Wallet connection works
- [ ] Perks load and display correctly
- [ ] Brand configuration applies properly
- [ ] Mobile responsive design works
- [ ] Error states display appropriately
- [ ] Loading states work smoothly

### Brand Configuration Testing
Test with various configurations:

```typescript
// Minimal config
export const MINIMAL_CONFIG = {
  company: { name: "Test Co" },
  theme: { colors: { primary: "#000000" } },
  perks: { curatedPerkIds: [] },
  features: {},
  content: { title: "Test Store" },
};

// Maximal config
export const MAXIMAL_CONFIG = {
  // ... full configuration with all options
};
```

## 🌟 Feature Request Process

1. **Check existing issues** to avoid duplicates
2. **Create an issue** with:
   - Clear description of the feature
   - Use case/business justification
   - Implementation suggestions (if any)
   - Screenshots/mockups (if applicable)

## 🐛 Bug Report Template

When reporting bugs, please include:

```markdown
**Description**: Brief description of the bug

**Steps to Reproduce**:
1. Configure brand with X settings
2. Navigate to Y page
3. Click on Z button
4. See error

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Node.js: [e.g., 18.17.0]

**Brand Configuration**:
```typescript
// Share relevant parts of your BRAND_CONFIG
```

**Console Errors**: Any console errors or network issues
```

## 🔧 Development Environment Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git
- Sui Wallet browser extension (for testing)

### Environment Variables
Create a `.env` file:

```env
VITE_SUI_NETWORK=testnet
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io
VITE_PERK_MANAGER_PACKAGE_ID=0xf933e69aeeeebb9d1fc50b6324070d8f2bdc2595162b0616142a509c90e3cd16
```

### VS Code Extensions (Recommended)
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint

## 📞 Getting Help

- **Discord**: Join our [Alpha4 community](https://discord.gg/alpha4)
- **Email**: Contact [support@alpha4.ai](mailto:support@alpha4.ai)
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to make perk marketplaces accessible to everyone!** 🎉 