# Alpha Points: Sui Integration Plan

## Overview

This document outlines the migration plan from the existing Ethereum Sepolia-based implementation to the newly deployed Sui Move package. This plan provides a high-level roadmap for adapting the current React frontend to interact with the Sui blockchain.

## Current Architecture (Sepolia)

The current application uses:
- Ethereum Sepolia testnet contracts
- ethers.js for blockchain interaction
- React frontend with Web3Context provider pattern
- Wallet connection via browser extensions and mobile wallets

## Target Architecture (Sui)

The new architecture will:
- Use Sui network and the deployed Move package
- Replace ethers.js with Sui's JavaScript SDK
- Maintain the same UI/UX and component structure
- Adapt wallet connection to support Sui wallets

## Integration Phases

### Phase 1: Environment & Dependencies Setup

1. **Fork the current frontend repository**
   - Create a new branch for Sui integration

2. **Update dependencies**
   - Add Sui SDK packages:
     ```
     npm install @mysten/sui.js @mysten/wallet-kit
     ```
   - Keep ethers.js temporarily for reference but phase out gradually

3. **Configure network settings**
   - Update network configuration from Sepolia to Sui testnet/mainnet
   - Update Move package addresses in config.js

### Phase 2: Wallet Connection Adaptation

1. **Modify the useWallet hook**
   - Replace ethers.js provider with Sui wallet provider
   - Adapt to Sui wallet connection patterns
   - Update wallet detection logic for Sui wallets (e.g., Sui Wallet, Ethos, etc.)

2. **Update WalletConnectorModal**
   - Modify wallet options to display Sui-compatible wallets
   - Update connection flows for Sui wallet types
   - Implement Sui's wallet-kit for seamless wallet connection

3. **Refactor connection state management**
   - Adapt network switching for Sui networks
   - Modify address display format for Sui addresses
   - Update error handling for Sui-specific connection errors

### Phase 3: Core Contract Interaction

1. **Create Move Package Interface**
   - Create a new `useSuiContract.js` hook that:
     - Connects to the deployed Alpha Points package
     - Provides methods to call key functions (stake, claim, etc.)
   - Define transaction builders for each contract action

2. **Update Web3Context**
   - Replace Ethereum contract instances with Sui equivalent
   - Adapt state variables to match Sui data structures
   - Modify event listeners for Sui transaction events

3. **Implement data fetching for Sui**
   - Update balance and points fetching methods
   - Modify stake/unstake transaction logic
   - Adapt faucet and redemption functions
   - Implement proper Sui transaction building, signing, and execution

### Phase 4: Transaction Handling & UI Updates

1. **Adapt transaction execution**
   - Modify transaction sending to use Sui patterns
   - Update transaction status tracking
   - Implement gas estimation and fee handling for Sui

2. **Refine error handling**
   - Update error message formatting for Sui errors
   - Adapt transaction debugging helpers
   - Create Sui-specific error recovery flows

3. **Update UI components**
   - Modify any UI elements that display chain-specific data
   - Update network indicator to show Sui network
   - Adapt transaction history display if applicable

### Phase 5: Testing & Optimization

1. **Create test environment**
   - Set up test wallets with Sui tokens
   - Create testing scripts for key user flows
   - Document test cases for manual verification

2. **Performance optimization**
   - Optimize data fetching patterns for Sui RPC
   - Implement caching where appropriate
   - Review and optimize transaction building

3. **Security review**
   - Review permission handling
   - Audit transaction signing flow
   - Validate error recovery mechanisms

## Key Technical Challenges & Solutions

### 1. Wallet Connection Differences

**Challenge**: Sui wallets use different connection patterns than Ethereum wallets.

**Solution**: 
- Use @mysten/wallet-kit to handle wallet connections
- Create adapter functions to maintain similar API surface
- Update the useWallet hook to abstract these differences

### 2. Address & Balance Format Differences

**Challenge**: Sui uses different address formats and object model.

**Solution**:
- Create formatter utilities for Sui addresses
- Update balance display logic to handle Sui's object-centric model
- Modify UI components to correctly display Sui identifiers

### 3. Transaction Building & Signing

**Challenge**: Sui transaction construction differs significantly from Ethereum.

**Solution**:
- Create a transaction building service that:
  - Constructs proper programmable transactions
  - Manages object references
  - Handles gas budgeting
- Abstract transaction complexity behind similar method signatures

### 4. State Management Differences

**Challenge**: Sui's object-centric model requires different state tracking.

**Solution**:
- Adapt useAppData hook to track object references
- Implement proper object ownership verification
- Update state refresh logic to account for Sui's finality model

## Core Function Mappings

| Ethereum Function | Sui Equivalent |
|-------------------|----------------|
| `stake(amount)`   | `alpha_points::integration::route_stake<T>` |
| `unstake(amount)` | `alpha_points::integration::redeem_stake<T>` |
| `claimPoints()`   | `alpha_points::integration::claim_points` |
| `getPoints(user)` | `alpha_points::ledger::get_points` |
| `getStakedAmount(user)` | `alpha_points::ledger::get_staked_amount` |
| `redeemPointsForEth(points)` | `alpha_points::integration::redeem_points<T>` |

## Implementation Timeline

1. **Days 1-3: Setup & Initial Research**
   - Fork repository
   - Setup development environment
   - Study Sui SDK documentation
   - Create initial wallet connection prototype

2. **Days 4-7: Core Wallet Integration**
   - Implement wallet connection
   - Setup network configuration
   - Test basic connectivity

3. **Days 8-14: Contract Interaction**
   - Build Move package interface
   - Implement staking functions
   - Implement claiming and redemption
   - Test basic transaction flows

4. **Days 15-21: UI Adaptation & Testing**
   - Update UI components
   - Implement proper error handling
   - Conduct end-to-end testing
   - Document integration points

5. **Days 22-28: Optimization & Launch Prep**
   - Performance optimization
   - Fix identified issues
   - Prepare documentation
   - Launch planning

## Additional Resources

- [Sui TypeScript SDK Documentation](https://sdk.mystenlabs.com/typescript)
- [Sui Wallet Kit Docs](https://kit.suiet.app/docs/introduction)
- [Sui Move Package References](https://docs.sui.io/build/move)
- [Alpha Points Package Deployment](https://testnet.suivision.xyz/package/0x8a9f4a2782b503191a6f6687a43c14daccbe435165480a2cd40229b63dc9b59a?tab=Code)
