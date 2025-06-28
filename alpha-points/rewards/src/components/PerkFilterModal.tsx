import React from 'react';
import { BRAND_CONFIG } from '../config/brand';

interface PerkFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTags: string[];
  allCompanies: string[];
  allCategories: string[];
  activeTags: Set<string>;
  activeCompanies: Set<string>;
  activeCategories: Set<string>;
  setActiveTags: (tags: Set<string>) => void;
  setActiveCompanies: (companies: Set<string>) => void;
  setActiveCategories: (categories: Set<string>) => void;
  sortBy: 'alphabetical' | 'date' | 'price-low' | 'price-high' | 'owned' | 'claims';
  setSortBy: (sort: 'alphabetical' | 'date' | 'price-low' | 'price-high' | 'owned' | 'claims') => void;
  filterByOwned: 'all' | 'owned' | 'not-owned';
  setFilterByOwned: (filter: 'all' | 'owned' | 'not-owned') => void;
  priceRange: [number, number];
  setPriceRange: (range: [number, number]) => void;
  showExpired: boolean;
  setShowExpired: (show: boolean) => void;
  modalTitle: string;
  totalPerks: number;
  displayedPerks: number;
}

export const PerkFilterModal: React.FC<PerkFilterModalProps> = ({
  isOpen,
  onClose,
  allTags,
  allCompanies,
  allCategories,
  activeTags,
  activeCompanies,
  activeCategories,
  setActiveTags,
  setActiveCompanies,
  setActiveCategories,
  sortBy,
  setSortBy,
  filterByOwned,
  setFilterByOwned,
  priceRange,
  setPriceRange,
  showExpired,
  setShowExpired,
  modalTitle,
  totalPerks,
  displayedPerks,
}) => {
  if (!isOpen) return null;

  const handleTagToggle = (tag: string) => {
    const newTags = new Set(activeTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setActiveTags(newTags);
  };

  const handleCompanyToggle = (company: string) => {
    const newCompanies = new Set(activeCompanies);
    if (newCompanies.has(company)) {
      newCompanies.delete(company);
    } else {
      newCompanies.add(company);
    }
    setActiveCompanies(newCompanies);
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = new Set(activeCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setActiveCategories(newCategories);
  };

  const clearAllFilters = () => {
    setActiveTags(new Set());
    setActiveCompanies(new Set());
    setActiveCategories(new Set());
    setFilterByOwned('all');
    setPriceRange([0, 10000000]);
    setShowExpired(true);
    setSortBy('date');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div 
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border"
        style={{
          backgroundColor: 'var(--color-background-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              {modalTitle}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Showing {displayedPerks} of {totalPerks} perks
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-opacity-80"
            style={{ backgroundColor: 'var(--color-background)' }}
          >
            <svg className="w-6 h-6" style={{ color: 'var(--color-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Sort Options */}
          <div>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              🔀 Sort By
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { value: 'date', label: '🕒 Newest First' },
                { value: 'alphabetical', label: '🔤 A-Z' },
                { value: 'price-low', label: '💰 Price: Low to High' },
                { value: 'price-high', label: '💰 Price: High to Low' },
                { value: 'owned', label: '⭐ Owned First' },
                { value: 'claims', label: '🔥 Most Popular' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value as any)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all ${
                    sortBy === option.value ? 'ring-2 ring-opacity-50' : ''
                  }`}
                                     style={{
                     backgroundColor: sortBy === option.value 
                       ? 'var(--color-primary)' 
                       : 'var(--color-background)',
                     color: sortBy === option.value 
                       ? 'var(--color-text)' 
                       : 'var(--color-text-muted)',
                     borderColor: 'var(--color-border)',
                   } as React.CSSProperties}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ownership Filter */}
          <div>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              👤 Ownership Status
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'all', label: 'All Perks' },
                { value: 'owned', label: '✅ Owned' },
                { value: 'not-owned', label: '🆕 Not Owned' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilterByOwned(option.value as any)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all ${
                    filterByOwned === option.value ? 'ring-2 ring-opacity-50' : ''
                  }`}
                  style={{
                    backgroundColor: filterByOwned === option.value 
                      ? 'var(--color-primary)' 
                      : 'var(--color-background)',
                    color: filterByOwned === option.value 
                      ? 'var(--color-text)' 
                      : 'var(--color-text-muted)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              💰 Price Range (Alpha Points)
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Min Price
                  </label>
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                    className="w-full p-2 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Max Price
                  </label>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 10000000])}
                    className="w-full p-2 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                    placeholder="10000000"
                  />
                </div>
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Current range: {priceRange[0].toLocaleString()} - {priceRange[1].toLocaleString()} αP
              </div>
            </div>
          </div>

          {/* Categories Filter */}
          {allCategories.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                📁 Categories ({activeCategories.size} selected)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryToggle(category)}
                    className={`p-2 rounded-lg text-sm transition-all ${
                      activeCategories.has(category) ? 'ring-2 ring-opacity-50' : ''
                    }`}
                    style={{
                      backgroundColor: activeCategories.has(category) 
                        ? 'var(--color-secondary)' 
                        : 'var(--color-background)',
                      color: activeCategories.has(category) 
                        ? 'var(--color-text)' 
                        : 'var(--color-text-muted)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                🏷️ Tags ({activeTags.size} selected)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`p-2 rounded-lg text-sm transition-all ${
                      activeTags.has(tag) ? 'ring-2 ring-opacity-50' : ''
                    }`}
                    style={{
                      backgroundColor: activeTags.has(tag) 
                        ? 'var(--color-primary)' 
                        : 'var(--color-background)',
                      color: activeTags.has(tag) 
                        ? 'var(--color-text)' 
                        : 'var(--color-text-muted)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Companies Filter */}
          {BRAND_CONFIG.features.showPartnerNames && allCompanies.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                🏢 Companies ({activeCompanies.size} selected)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allCompanies.map((company) => (
                  <button
                    key={company}
                    onClick={() => handleCompanyToggle(company)}
                    className={`p-2 rounded-lg text-sm transition-all ${
                      activeCompanies.has(company) ? 'ring-2 ring-opacity-50' : ''
                    }`}
                    style={{
                      backgroundColor: activeCompanies.has(company) 
                        ? 'var(--color-success)' 
                        : 'var(--color-background)',
                      color: activeCompanies.has(company) 
                        ? 'var(--color-text)' 
                        : 'var(--color-text-muted)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    {company}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Additional Options */}
          <div>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              ⚙️ Additional Options
            </h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={showExpired}
                  onChange={(e) => setShowExpired(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span style={{ color: 'var(--color-text)' }}>
                  Show expired perks
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between p-6 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {displayedPerks} of {totalPerks} perks shown
          </div>
          <div className="flex space-x-3">
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 rounded-lg font-medium transition-colors border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text)',
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 