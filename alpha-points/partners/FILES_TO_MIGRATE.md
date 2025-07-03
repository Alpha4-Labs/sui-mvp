# 📁 Complete File Migration List

## Partner Components to MOVE (15 files)

### PartnerDashboard Directory (11 files) - COMPLETE MIGRATION
```
frontend/src/components/PartnerDashboard/
├── index.tsx                    → partners/src/components/PartnerDashboard/index.tsx
├── PartnerDashboard.tsx        → partners/src/components/PartnerDashboard/PartnerDashboard.tsx
├── OverviewTab.tsx             → partners/src/components/PartnerDashboard/OverviewTab.tsx
├── PerksTab.tsx                → partners/src/components/PartnerDashboard/PerksTab.tsx
├── AnalyticsTab.tsx            → partners/src/components/PartnerDashboard/AnalyticsTab.tsx
├── GenerationsTab.tsx          → partners/src/components/PartnerDashboard/GenerationsTab.tsx
├── SettingsTab.tsx             → partners/src/components/PartnerDashboard/SettingsTab.tsx
├── PerkCreationForm.tsx        → partners/src/components/PerkCreationForm.tsx
├── PerkEditForm.tsx            → partners/src/components/PerkEditForm.tsx
├── GenerationBuilder.tsx       → partners/src/components/GenerationBuilder.tsx
└── CollateralModal.tsx         → partners/src/components/CollateralModal.tsx
```

### Partner-Specific Components (4 files)
```
frontend/src/components/
├── PartnerDashboard.tsx        → partners/src/components/PartnerDashboard.tsx (legacy)
├── PartnerSetupCheck.tsx       → partners/src/components/PartnerSetupCheck.tsx
├── GuidedPartnerOnboarding.tsx → partners/src/components/GuidedPartnerOnboarding.tsx
└── ZeroDevIntegrationWizard.tsx → partners/src/components/ZeroDevIntegrationWizard.tsx
```

## Partner Pages to MOVE (2 files)

```
frontend/src/pages/
├── PartnersPage.tsx            → partners/src/pages/PartnersPage.tsx
└── PartnerOnboardingPage.tsx   → partners/src/pages/PartnerOnboardingPage.tsx
```

## Partner Hooks to MOVE (7 files)

```
frontend/src/hooks/
├── usePartnerDetection.ts      → partners/src/hooks/usePartnerDetection.ts
├── usePartnerOnboarding.ts     → partners/src/hooks/usePartnerOnboarding.ts
├── usePartnerSettings.ts       → partners/src/hooks/usePartnerSettings.ts
├── usePartnerQuotas.ts         → partners/src/hooks/usePartnerQuotas.ts
├── usePartnerSetupStatus.ts    → partners/src/hooks/usePartnerSetupStatus.ts
├── usePartnerAnalytics.ts      → partners/src/hooks/usePartnerAnalytics.ts
└── usePartnerGenerations.ts    → partners/src/hooks/usePartnerGenerations.ts
```

## Partner Utilities to MOVE (3 files)

```
frontend/src/utils/
├── partnerQuotaMonitor.ts      → partners/src/utils/partnerQuotaMonitor.ts
├── partnerPerkValidation.ts    → partners/src/utils/partnerPerkValidation.ts
└── debugPartnerStats.ts        → partners/src/utils/debugPartnerStats.ts
```

## Shared Dependencies to COPY (12 files)

### UI Components (4 files)
```
frontend/src/components/ui/
├── Button.tsx                  → partners/src/components/ui/Button.tsx
├── Input.tsx                   → partners/src/components/ui/Input.tsx
└── ErrorToast.tsx              → partners/src/components/ui/ErrorToast.tsx

frontend/src/components/
└── Tooltip.tsx                 → partners/src/components/Tooltip.tsx
```

### Utilities (6 files)
```
frontend/src/utils/
├── transaction.ts              → partners/src/utils/transaction.ts (partner functions only)
├── sui-utils.ts                → partners/src/utils/sui-utils.ts
├── format.ts                   → partners/src/utils/format.ts
├── retry.ts                    → partners/src/utils/retry.ts
├── cn.ts                       → partners/src/utils/cn.ts
└── constants.ts                → partners/src/utils/constants.ts
```

### Configuration (2 files)
```
frontend/src/config/
├── contract.ts                 → partners/src/config/contract.ts (partner-specific)
└── network.ts                  → partners/src/config/network.ts
```

### Types (1 file)
```
frontend/src/types/
└── index.ts                    → partners/src/types/index.ts (partner types only)
```

## Configuration Files to COPY & MODIFY (8 files)

```
frontend/
├── vite.config.ts              → partners/vite.config.ts
├── tsconfig.json               → partners/tsconfig.json
├── tsconfig.app.json           → partners/tsconfig.app.json
├── tsconfig.node.json          → partners/tsconfig.node.json
├── tailwind.config.js          → partners/tailwind.config.js
├── postcss.config.js           → partners/postcss.config.js
├── eslint.config.js            → partners/eslint.config.js
├── env.template                → partners/env.template
└── index.html                  → partners/index.html
```

## Assets to COPY (3 files)

```
frontend/public/
├── alpha4-logo.svg             → partners/public/alpha4-logo.svg
├── favicon.ico                 → partners/public/favicon.ico

frontend/src/assets/
└── alpha4-logo.svg             → partners/src/assets/alpha4-logo.svg
```

## New Files to CREATE (5 files)

```
partners/src/
├── App.tsx                     → NEW: Main app component with partner routing
├── main.tsx                    → NEW: Entry point
├── index.css                   → NEW: Global styles (copy from frontend)
├── context/PartnerContext.tsx  → NEW: Partner-specific context
└── layouts/MainLayout.tsx      → NEW: Partner app layout
```

## Files to MODIFY in Frontend (3 files)

### Remove Partner Code From:
```
frontend/src/
├── App.tsx                     → REMOVE: Partner routes and imports
├── layouts/MainLayout.tsx      → REMOVE: Partner navigation and mode switching
└── context/AlphaContext.tsx    → REMOVE: Partner state and functions
```

## Total Migration Summary

- **Files to MOVE**: 27 files
- **Files to COPY**: 20 files  
- **Files to CREATE**: 5 files
- **Files to MODIFY**: 3 files
- **Total Files Affected**: 55 files

## Priority Order for Migration

1. **High Priority** (Core functionality):
   - Partner hooks (7 files)
   - PartnerDashboard components (11 files)
   - Partner pages (2 files)

2. **Medium Priority** (Dependencies):
   - Shared utilities (6 files)
   - UI components (4 files)
   - Configuration files (8 files)

3. **Low Priority** (Setup):
   - Assets (3 files)
   - New files (5 files)
   - Frontend cleanup (3 files)

## Critical Dependencies Map

```
PartnerDashboard Components
├── → usePartner* hooks
├── → Partner utilities
├── → Shared UI components
├── → Transaction utilities
├── → Contract configuration
└── → Type definitions

PartnersPage & PartnerOnboardingPage
├── → PartnerDashboard components
├── → usePartnerDetection
├── → PartnerSetupCheck
└── → AlphaContext (needs extraction)
```

This detailed mapping will ensure we don't miss any dependencies during the migration process. 