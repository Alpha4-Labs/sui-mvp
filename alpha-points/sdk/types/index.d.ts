/**
 * Sui Points Adapter - TypeScript Definitions
 * Universal Zero-Dev Integration SDK
 */

export interface EventMapping {
  points: number;
  cooldown: number;
}

export interface EventMappings {
  user_signup: EventMapping;
  purchase_completed: EventMapping;
  newsletter_signup: EventMapping;
  social_share: EventMapping;
  profile_completed: EventMapping;
  referral_successful: EventMapping;
  [key: string]: EventMapping;
}

export interface SuiPointsAdapterConfig {
  // Required
  packageId: string;
  partnerCapId: string;
  
  // Network
  rpcUrl?: string;
  
  // Security
  allowedOrigins?: string[];
  maxEventsPerHour?: number;
  
  // Event Configuration
  eventMappings?: Partial<EventMappings>;
  
  // Features
  enableAutoDetection?: boolean;
  showNotifications?: boolean;
  enableDebugMode?: boolean;
  
  // UI
  notificationDuration?: number;
  customStyles?: Record<string, any>;
}

export interface AdapterStatus {
  isInitialized: boolean;
  hasWallet: boolean;
  queuedEvents: number;
  version: string;
}

export interface EventDetail {
  eventType: string;
  points: number;
  userId: string;
  metadata: Record<string, any>;
}

export interface SuiPointsReadyEvent extends CustomEvent {
  detail: {
    adapter: SuiPointsAdapter;
  };
}

export interface SuiPointsEarnedEvent extends CustomEvent {
  detail: EventDetail;
}

export declare class SuiPointsAdapter {
  constructor(config: SuiPointsAdapterConfig);
  
  // Public API Methods
  trackEvent(eventType: string, metadata?: Record<string, any>): Promise<boolean>;
  connectWallet(): Promise<boolean>;
  getConfig(): SuiPointsAdapterConfig;
  updateConfig(newConfig: Partial<SuiPointsAdapterConfig>): void;
  getStatus(): AdapterStatus;
  
  // Internal Methods (exposed for advanced usage)
  getUserId(): string;
  validateConfig(): void;
  init(): Promise<void>;
}

// Global Window Interface Extension
declare global {
  interface Window {
    SuiPointsAdapter: typeof SuiPointsAdapter;
    suiPointsAdapter?: SuiPointsAdapter;
  }
  
  interface WindowEventMap {
    'suiPointsReady': SuiPointsReadyEvent;
    'suiPointsEarned': SuiPointsEarnedEvent;
    'suiPointsEvent': CustomEvent<{
      eventType: string;
      userId: string;
      metadata: Record<string, any>;
    }>;
    'referralCompleted': CustomEvent<{
      userId: string;
      referralData: Record<string, any>;
    }>;
  }
}

// Event Type Constants
export const EVENT_TYPES = {
  USER_SIGNUP: 'user_signup',
  PURCHASE_COMPLETED: 'purchase_completed',
  NEWSLETTER_SIGNUP: 'newsletter_signup',
  SOCIAL_SHARE: 'social_share',
  PROFILE_COMPLETED: 'profile_completed',
  REFERRAL_SUCCESSFUL: 'referral_successful'
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// Default Configuration
export const DEFAULT_CONFIG: Required<Omit<SuiPointsAdapterConfig, 'packageId' | 'partnerCapId'>> = {
  rpcUrl: 'https://fullnode.mainnet.sui.io:443',
  allowedOrigins: [],
  maxEventsPerHour: 10,
  eventMappings: {
    user_signup: { points: 50, cooldown: 86400000 },
    purchase_completed: { points: 100, cooldown: 0 },
    newsletter_signup: { points: 25, cooldown: 604800000 },
    social_share: { points: 15, cooldown: 3600000 },
    profile_completed: { points: 75, cooldown: 86400000 },
    referral_successful: { points: 200, cooldown: 0 }
  },
  enableAutoDetection: true,
  showNotifications: true,
  enableDebugMode: false,
  notificationDuration: 3000,
  customStyles: {}
};

export default SuiPointsAdapter; 