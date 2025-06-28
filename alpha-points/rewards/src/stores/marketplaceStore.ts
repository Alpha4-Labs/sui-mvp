import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface FilterState {
  search: string;
  tags: Set<string>;
  priceRange: [number, number];
  sortBy: 'alphabetical' | 'price-low' | 'price-high' | 'claims' | 'newest';
  showExpired: boolean;
}

import type { PerkDefinition } from '../types/index';

export interface PerkData extends PerkDefinition {
  // Additional store-specific fields
  imageUrl?: string;
  expiresAt?: Date;
  requiresMetadata?: boolean;
  createdAt?: Date;
  price?: number; // Alias for currentAlphaPointsPrice
  company?: string; // Derived from creator info
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  currency: 'alphaPoints' | 'usd';
  notifications: boolean;
  autoRefresh: boolean;
  gridView: 'compact' | 'comfortable' | 'spacious';
}

interface MarketplaceState {
  // Data
  perks: PerkData[];
  favoritePerks: Set<string>;
  claimedPerks: Set<string>;
  userBalance: number;
  
  // UI State
  filters: FilterState;
  isFilterModalOpen: boolean;
  selectedPerk: string | null;
  userPreferences: UserPreferences;
  
  // Loading States
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // Cache
  lastFetchTime: number;
  cacheExpiryTime: number;
  
  // Actions
  setPerks: (perks: PerkData[]) => void;
  addFavorite: (perkId: string) => void;
  removeFavorite: (perkId: string) => void;
  toggleFavorite: (perkId: string) => void;
  
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  
  setFilterModalOpen: (open: boolean) => void;
  setSelectedPerk: (perkId: string | null) => void;
  
  setUserBalance: (balance: number) => void;
  addClaimedPerk: (perkId: string) => void;
  
  setUserPreferences: (preferences: Partial<UserPreferences>) => void;
  
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed
  getFilteredPerks: () => PerkData[];
  getAvailableTags: () => string[];
  getFavoritePerks: () => PerkData[];
  canAffordPerk: (perkId: string) => boolean;
  
  // Cache Management
  shouldRefreshData: () => boolean;
  updateCacheTime: () => void;
  
  // Bulk Actions
  importPerks: (perks: PerkData[]) => void;
  clearCache: () => void;
}

const defaultFilters: FilterState = {
  search: '',
  tags: new Set(),
  priceRange: [0, 1000000],
  sortBy: 'newest',
  showExpired: true,
};

const defaultPreferences: UserPreferences = {
  theme: 'system',
  currency: 'alphaPoints',
  notifications: true,
  autoRefresh: true,
  gridView: 'comfortable',
};

export const useMarketplaceStore = create<MarketplaceState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial State
        perks: [],
        favoritePerks: new Set(),
        claimedPerks: new Set(),
        userBalance: 0,
        
        filters: defaultFilters,
        isFilterModalOpen: false,
        selectedPerk: null,
        userPreferences: defaultPreferences,
        
        isLoading: false,
        isRefreshing: false,
        error: null,
        
        lastFetchTime: 0,
        cacheExpiryTime: 5 * 60 * 1000, // 5 minutes
        
        // Actions
        setPerks: (perks) => set((state) => {
          state.perks = perks;
          state.lastFetchTime = Date.now();
        }),
        
        addFavorite: (perkId) => set((state) => {
          state.favoritePerks.add(perkId);
        }),
        
        removeFavorite: (perkId) => set((state) => {
          state.favoritePerks.delete(perkId);
        }),
        
        toggleFavorite: (perkId) => set((state) => {
          if (state.favoritePerks.has(perkId)) {
            state.favoritePerks.delete(perkId);
          } else {
            state.favoritePerks.add(perkId);
          }
        }),
        
        setFilters: (newFilters) => set((state) => {
          state.filters = { ...state.filters, ...newFilters };
        }),
        
        resetFilters: () => set((state) => {
          state.filters = { ...defaultFilters, tags: new Set() };
        }),
        
        setFilterModalOpen: (open) => set((state) => {
          state.isFilterModalOpen = open;
        }),
        
        setSelectedPerk: (perkId) => set((state) => {
          state.selectedPerk = perkId;
        }),
        
        setUserBalance: (balance) => set((state) => {
          state.userBalance = balance;
        }),
        
        addClaimedPerk: (perkId) => set((state) => {
          state.claimedPerks.add(perkId);
        }),
        
        setUserPreferences: (preferences) => set((state) => {
          state.userPreferences = { ...state.userPreferences, ...preferences };
        }),
        
        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),
        
        setRefreshing: (refreshing) => set((state) => {
          state.isRefreshing = refreshing;
        }),
        
        setError: (error) => set((state) => {
          state.error = error;
        }),
        
        // Computed
        getFilteredPerks: () => {
          const state = get();
          let filtered = [...state.perks];
          
          // Search filter
          if (state.filters.search) {
            const search = state.filters.search.toLowerCase();
            filtered = filtered.filter(perk => 
              perk.name.toLowerCase().includes(search) ||
              perk.description.toLowerCase().includes(search) ||
              perk.company.toLowerCase().includes(search)
            );
          }
          
          // Tags filter
          if (state.filters.tags.size > 0) {
            filtered = filtered.filter(perk =>
              perk.tags.some(tag => state.filters.tags.has(tag))
            );
          }
          
          // Price range filter
          filtered = filtered.filter(perk =>
            perk.price >= state.filters.priceRange[0] &&
            perk.price <= state.filters.priceRange[1]
          );
          
          // Expired filter
          if (!state.filters.showExpired) {
            const now = new Date();
            filtered = filtered.filter(perk => 
              !perk.expiresAt || perk.expiresAt > now
            );
          }
          
          // Sort
          filtered.sort((a, b) => {
            switch (state.filters.sortBy) {
              case 'alphabetical':
                return a.name.localeCompare(b.name);
              case 'price-low':
                return a.price - b.price;
              case 'price-high':
                return b.price - a.price;
              case 'claims':
                return b.claimCount - a.claimCount;
              case 'newest':
              default:
                return b.createdAt.getTime() - a.createdAt.getTime();
            }
          });
          
          return filtered;
        },
        
        getAvailableTags: () => {
          const state = get();
          const tags = new Set<string>();
          state.perks.forEach(perk => {
            perk.tags.forEach(tag => tags.add(tag));
          });
          return Array.from(tags).sort();
        },
        
        getFavoritePerks: () => {
          const state = get();
          return state.perks.filter(perk => state.favoritePerks.has(perk.id));
        },
        
        canAffordPerk: (perkId) => {
          const state = get();
          const perk = state.perks.find(p => p.id === perkId);
          return perk ? state.userBalance >= perk.price : false;
        },
        
        // Cache Management
        shouldRefreshData: () => {
          const state = get();
          const now = Date.now();
          return now - state.lastFetchTime > state.cacheExpiryTime;
        },
        
        updateCacheTime: () => set((state) => {
          state.lastFetchTime = Date.now();
        }),
        
        // Bulk Actions
        importPerks: (perks) => set((state) => {
          // Merge with existing perks, avoiding duplicates
          const existingIds = new Set(state.perks.map(p => p.id));
          const newPerks = perks.filter(p => !existingIds.has(p.id));
          state.perks = [...state.perks, ...newPerks];
          state.lastFetchTime = Date.now();
        }),
        
        clearCache: () => set((state) => {
          state.perks = [];
          state.lastFetchTime = 0;
          state.error = null;
        }),
      })),
      {
        name: 'marketplace-store',
        partialize: (state) => ({
          favoritePerks: Array.from(state.favoritePerks),
          claimedPerks: Array.from(state.claimedPerks),
          userPreferences: state.userPreferences,
          filters: {
            ...state.filters,
            tags: Array.from(state.filters.tags),
          },
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Convert arrays back to Sets
            state.favoritePerks = new Set(state.favoritePerks || []);
            state.claimedPerks = new Set(state.claimedPerks || []);
            state.filters.tags = new Set(state.filters.tags || []);
          }
        },
      }
    ),
    {
      name: 'marketplace-store',
    }
  )
);

// Selectors for optimized re-renders
export const useFilteredPerks = () => useMarketplaceStore(state => state.getFilteredPerks());
export const useAvailableTags = () => useMarketplaceStore(state => state.getAvailableTags());
export const useFavoritePerks = () => useMarketplaceStore(state => state.getFavoritePerks());
export const useUserBalance = () => useMarketplaceStore(state => state.userBalance);
export const useFilters = () => useMarketplaceStore(state => state.filters);
export const useUserPreferences = () => useMarketplaceStore(state => state.userPreferences); 