# 🚀 Partner Dashboard Migration Plan

## Overview
Migration of partner functionality from `frontend/` to a separate `partners/` application for better separation of concerns and independent deployment.

## 📋 MIGRATION PHASES

### Phase 1: Infrastructure Setup ✅
- [x] Create `partners/` directory structure
- [x] Set up `package.json` with dependencies
- [x] Copy configuration files (vite, tsconfig, tailwind, etc.)
- [x] Set up environment variables and contract config
- [x] Create basic App.tsx and routing structure
- [x] Implement Dark-Light theme system (deviation from current)
- [x] Configure port 5174 for separate deployment

### Phase 2: Shared Dependencies ✅
- [x] Copy shared UI components (Button, Input, ErrorToast, Tooltip)
- [x] Copy shared utilities (sui-utils, format, retry, cn, constants)
- [x] Copy configuration files (contract.ts, network.ts)
- [x] Copy type definitions
- [x] Extract partner transaction functions (~750 lines)

### Phase 3: Partner Utilities ✅
- [x] Move partnerQuotaMonitor.ts
- [x] Move partnerPerkValidation.ts
- [x] Move debugPartnerStats.ts

### Phase 4: Partner Hooks ✅
- [x] Move usePartnerDetection.ts
- [x] Move usePartnerOnboarding.ts
- [x] Move usePartnerSettings.ts
- [x] Move usePartnerQuotas.ts
- [x] Move usePartnerSetupStatus.ts
- [x] Move usePartnerAnalytics.ts
- [x] Move usePartnerGenerations.ts

### Phase 5: Partner Pages ✅
- [x] Move PartnersPage.tsx
- [x] Move PartnerOnboardingPage.tsx
- [x] Move PartnerDashboard.tsx (legacy)
- [x] Move PartnerSetupCheck.tsx
- [x] Move GuidedPartnerOnboarding.tsx
- [x] Move ZeroDevIntegrationWizard.tsx

### Phase 6: PartnerDashboard Directory ✅
- [x] All 11 PartnerDashboard files copied (~150KB of code)

### Phase 7: Context & App Structure ✅
- [x] Copy AlphaContext.tsx
- [x] Copy MainLayout.tsx
- [x] Create main.tsx entry point
- [x] Create App.tsx with theme support
- [x] Create vite-env.d.ts for TypeScript

#### 📁 Components to Extract (11 files total) - COMPLETED

**PartnerDashboard Directory (Complete Migration):**
- [ ] `components/PartnerDashboard/index.tsx`
- [ ] `components/PartnerDashboard/PartnerDashboard.tsx`
- [ ] `components/PartnerDashboard/OverviewTab.tsx`
- [ ] `components/PartnerDashboard/PerksTab.tsx`
- [ ] `components/PartnerDashboard/AnalyticsTab.tsx`
- [ ] `components/PartnerDashboard/GenerationsTab.tsx`
- [ ] `components/PartnerDashboard/SettingsTab.tsx`
- [ ] `components/PartnerDashboard/PerkCreationForm.tsx`
- [ ] `components/PartnerDashboard/PerkEditForm.tsx`
- [ ] `components/PartnerDashboard/GenerationBuilder.tsx`
- [ ] `components/PartnerDashboard/CollateralModal.tsx`

**Partner-Specific Components:**
- [ ] `components/PartnerDashboard.tsx` (legacy version)
- [ ] `components/PartnerSetupCheck.tsx`
- [ ] `components/GuidedPartnerOnboarding.tsx`
- [ ] `components/ZeroDevIntegrationWizard.tsx`

### Phase 3: Move Partner Pages
- [ ] `pages/PartnersPage.tsx`
- [ ] `pages/PartnerOnboardingPage.tsx`

### Phase 4: Move Partner Hooks (8 files)
- [ ] `hooks/usePartnerDetection.ts`
- [ ] `hooks/usePartnerOnboarding.ts`
- [ ] `hooks/usePartnerSettings.ts`
- [ ] `hooks/usePartnerQuotas.ts`
- [ ] `hooks/usePartnerSetupStatus.ts`
- [ ] `hooks/usePartnerAnalytics.ts`
- [ ] `hooks/usePartnerGenerations.ts`

### Phase 5: Move Partner Utilities (3 files)
- [ ] `utils/partnerQuotaMonitor.ts`
- [ ] `utils/partnerPerkValidation.ts`
- [ ] `utils/debugPartnerStats.ts`

### Phase 6: Move Shared Dependencies
#### 🔗 Shared UI Components (Copy)
- [ ] `components/ui/Button.tsx`
- [ ] `components/ui/Input.tsx`
- [ ] `components/ui/ErrorToast.tsx`
- [ ] `components/Tooltip.tsx`

#### 🔗 Shared Utilities (Copy & Adapt)
- [ ] `utils/transaction.ts` (extract partner-related functions)
- [ ] `utils/sui-utils.ts`
- [ ] `utils/format.ts`
- [ ] `utils/retry.ts`
- [ ] `utils/cn.ts`
- [ ] `utils/constants.ts`

#### 🔗 Configuration Files (Copy & Adapt)
- [ ] `config/contract.ts` (partner-specific portions)
- [ ] `config/network.ts`

#### 🔗 Types (Copy & Adapt)
- [ ] `types/index.ts` (partner-related types)

### Phase 7: Create Partner Context
- [ ] Extract partner-related state from `context/AlphaContext.tsx`
- [ ] Create `context/PartnerContext.tsx` with:
  - Partner capability management
  - Partner mode state
  - Partner-specific data fetching

### Phase 8: Update Frontend App (Remove Partner Code)
#### 🗑️ Remove from frontend/src/App.tsx:
- [ ] Remove partner route imports
- [ ] Remove `/partners/*` routes
- [ ] Remove `PartnerOnboardingPage` import and route

#### 🗑️ Remove from frontend/src/layouts/MainLayout.tsx:
- [ ] Remove partner navigation logic
- [ ] Remove partner mode switching
- [ ] Remove partner detection calls

#### 🗑️ Remove from frontend/src/context/AlphaContext.tsx:
- [ ] Remove `partnerCaps` state
- [ ] Remove `setPartnerCaps` function
- [ ] Remove partner mode state
- [ ] Remove partner-related imports

#### 🗑️ Delete Partner Files from Frontend:
- [ ] Delete `components/PartnerDashboard/` directory
- [ ] Delete `pages/PartnersPage.tsx`
- [ ] Delete `pages/PartnerOnboardingPage.tsx`
- [ ] Delete partner components
- [ ] Delete partner hooks
- [ ] Delete partner utilities

### Phase 9: Environment & Deployment Setup
- [ ] Create `partners/.env.template`
- [ ] Set up separate deployment pipeline
- [ ] Configure partner-specific domain routing
- [ ] Update CORS and API configurations

### Phase 10: Testing & Validation
- [ ] Test partner app independently
- [ ] Test frontend app without partner code
- [ ] Validate all partner functionality works
- [ ] Test navigation and routing
- [ ] Verify no broken imports or references

## 🔄 DEPENDENCIES TO HANDLE

### Shared Code (Requires Copying/Adapting)
1. **Transaction Utilities**: Extract partner-specific transaction functions
2. **UI Components**: Copy shared UI components 
3. **Format Utils**: Copy formatting utilities
4. **Contract Config**: Extract partner-specific configuration
5. **Network Config**: Copy network configuration
6. **Types**: Extract partner-related type definitions

### Context Dependencies
- Extract partner state management from AlphaContext
- Create standalone PartnerContext
- Handle wallet connection and SUI client setup

### Routing Changes
- Remove all `/partners/*` routes from frontend
- Create standalone routing in partners app
- Update navigation references

## 🚨 CRITICAL CONSIDERATIONS

### 1. Shared Contract Functions
Some transaction utilities in `utils/transaction.ts` are used by both user and partner sides. We need to:
- Extract partner-specific functions to partners app
- Keep shared functions in a common utility
- Consider creating a shared package for common contract interactions

### 2. Type Definitions
Partner-related types are mixed with user types in `types/index.ts`. We need to:
- Split types appropriately
- Maintain compatibility during transition
- Update import paths

### 3. Environment Variables
Partner-specific environment variables need to be:
- Separated into partners app
- Maintained in frontend for transition period
- Updated in deployment configurations

### 4. Contract Object IDs
Partner cap IDs and contract configurations need to be:
- Available in both apps during transition
- Properly configured for each environment
- Validated in both applications

## 📍 EXECUTION ORDER

1. **Setup Infrastructure** (Phase 1)
2. **Copy Shared Dependencies** (Phase 6) - Do this early to establish foundation
3. **Create Partner Context** (Phase 7) - Set up data management
4. **Move Components** (Phases 2-5) - Move all partner-specific code
5. **Clean Frontend** (Phase 8) - Remove partner code from main app
6. **Configure Deployment** (Phase 9) - Set up separate deployment
7. **Test & Validate** (Phase 10) - Ensure everything works

## 🎯 SUCCESS CRITERIA

- [ ] Partners app runs independently on separate port/domain
- [ ] Frontend app runs without partner code
- [ ] All partner functionality preserved and working
- [ ] No broken imports or circular dependencies
- [ ] Both apps can be deployed independently
- [ ] Partner navigation completely separated from user flow

## 📝 NOTES

- This migration will take significant time due to the number of files and dependencies
- We should consider creating a shared package for common utilities
- Partner app should use a different port (e.g., 5174) during development
- Consider partner-specific branding/styling in the new app
- May need to update API endpoints if any are partner-specific

---

**Estimated Timeline**: 2-3 days for complete migration and testing
**Risk Level**: Medium (due to shared dependencies and complex state management)
**Rollback Plan**: Keep original code in feature branch until migration is validated 