# Alpha Points Frontend

This is the frontend dApp for the Alpha Points protocol, built with React, TypeScript, and Vite. It allows users and partners to interact with the Alpha Points Move smart contracts on Sui, including onboarding as a partner, minting points, and more.

## Features
- Partner onboarding with SUI collateral
- Alpha Points minting and management
- Integration with Sui Move modules and Mysten Sui SDK
- Wallet connection via @mysten/dapp-kit

## Getting Started

### 1. Clone the Repository
```bash
git clone <repo-url>
cd alpha-points/frontend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the `frontend/` directory with the following variables (replace with your deployed object IDs):

```
VITE_CONFIG_ID=0x...
VITE_LEDGER_ID=0x...
VITE_STAKING_MANAGER_ID=0x...
VITE_ESCROW_VAULT_ID=0x...
VITE_LOAN_CONFIG_ID=0x...
VITE_ORACLE_ID=0x...
VITE_MINT_STATS_ID=0x...
VITE_SUPPLY_ORACLE_ID=0x...
VITE_PARTNER_REGISTRY_ID=0x...
```

### 4. Run the App
```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default.

## Partner Onboarding Flow
- Navigate to the **Partner Onboarding** page.
- Connect your Sui wallet.
- Enter your partner name and the amount of SUI to lock as collateral.
- Submit the form to create your PartnerCap NFT and receive your daily Alpha Points minting quota.

## Integration
- Uses the [Mysten Sui SDK](https://sdk.mystenlabs.com/typescript/bcs) for transaction building and BCS serialization.
- Interacts with Move modules in the `/sources` directory of this repo.

## Development
- Built with React, TypeScript, Vite, and Tailwind CSS.
- Uses [@mysten/dapp-kit](https://github.com/MystenLabs/sui/tree/main/sdk/dapp-kit) for wallet and transaction management.

---
For backend/Move contract details, see the `/sources/README.md`.
