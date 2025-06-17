import React, { useState, useMemo } from 'react';

interface PerkFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTags: string[];
  allCompanies?: string[];
  allCategories?: string[];
  activeTags: Set<string>;
  activeCompanies?: Set<string>;
  activeCategories?: Set<string>;
  setActiveTags: (tags: Set<string>) => void;
  setActiveCompanies?: (companies: Set<string>) => void;
  setActiveCategories?: (categories: Set<string>) => void;
  sortBy?: 'alphabetical' | 'date' | 'price-low' | 'price-high' | 'owned' | 'claims';
  setSortBy?: (sortBy: 'alphabetical' | 'date' | 'price-low' | 'price-high' | 'owned' | 'claims') => void;
  filterByOwned?: 'all' | 'owned' | 'not-owned';
  setFilterByOwned?: (filterBy: 'all' | 'owned' | 'not-owned') => void;
  priceRange?: [number, number];
  setPriceRange?: (range: [number, number]) => void;
  showExpired?: boolean;
  setShowExpired?: (show: boolean) => void;
  modalTitle: string;
  totalPerks?: number;
  displayedPerks?: number;
}

export const PerkFilterModal: React.FC<PerkFilterModalProps> = ({
  isOpen,
  onClose,
  allTags,
  allCompanies = [],
  allCategories = [],
  activeTags,
  activeCompanies = new Set(),
  activeCategories = new Set(),
  setActiveTags,
  setActiveCompanies = () => {},
  setActiveCategories = () => {},
  sortBy = 'date',
  setSortBy = () => {},
  filterByOwned = 'all',
  setFilterByOwned = () => {},
  priceRange = [0, 10000000],
  setPriceRange = () => {},
  showExpired = true,
  setShowExpired = () => {},
  modalTitle,
  totalPerks = 0,
  displayedPerks = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'tags' | 'companies' | 'categories' | 'advanced'>('tags');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Tab visibility logic
  const showCompaniesTab = allCompanies.length > 0;
  const showCategoriesTab = allCategories.length > 0;

  // Filter items based on search query
  const filteredTags = useMemo(() => {
    if (!searchQuery) return allTags;
    return allTags.filter(tag => 
      tag.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allTags, searchQuery]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return allCompanies;
    return allCompanies.filter(company => 
      company.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allCompanies, searchQuery]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return allCategories;
    return allCategories.filter(category => 
      category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allCategories, searchQuery]);

  const handleTagToggle = (tag: string) => {
    const newActiveTags = new Set(activeTags);
    if (newActiveTags.has(tag)) {
      newActiveTags.delete(tag);
    } else {
      newActiveTags.add(tag);
    }
    setActiveTags(newActiveTags);
  };

  const handleCompanyToggle = (company: string) => {
    const newActiveCompanies = new Set(activeCompanies);
    if (newActiveCompanies.has(company)) {
      newActiveCompanies.delete(company);
    } else {
      newActiveCompanies.add(company);
    }
    setActiveCompanies(newActiveCompanies);
  };

  const handleCategoryToggle = (category: string) => {
    const newActiveCategories = new Set(activeCategories);
    if (newActiveCategories.has(category)) {
      newActiveCategories.delete(category);
    } else {
      newActiveCategories.add(category);
    }
    setActiveCategories(newActiveCategories);
  };

  const handleClearAll = () => {
    if (activeTab === 'tags') {
      setActiveTags(new Set());
    } else if (activeTab === 'companies') {
      setActiveCompanies(new Set());
    } else if (activeTab === 'categories') {
      setActiveCategories(new Set());
    }
  };

  const handleSelectAll = () => {
    if (activeTab === 'tags') {
      setActiveTags(new Set(filteredTags));
    } else if (activeTab === 'companies') {
      setActiveCompanies(new Set(filteredCompanies));
    } else if (activeTab === 'categories') {
      setActiveCategories(new Set(filteredCategories));
    }
  };

  const handleClearAllFilters = () => {
    setActiveTags(new Set());
    setActiveCompanies(new Set());
    setActiveCategories(new Set());
    setFilterByOwned('all');
    setPriceRange([0, 10000000]);
    setShowExpired(true);
    setSearchQuery('');
  };

  const currentItems = activeTab === 'tags' ? filteredTags : 
                       activeTab === 'companies' ? filteredCompanies : 
                       activeTab === 'categories' ? filteredCategories : [];
  const currentActiveItems = activeTab === 'tags' ? activeTags : 
                             activeTab === 'companies' ? activeCompanies : 
                             activeTab === 'categories' ? activeCategories : new Set();
  const handleItemToggle = activeTab === 'tags' ? handleTagToggle : 
                           activeTab === 'companies' ? handleCompanyToggle :
                           activeTab === 'categories' ? handleCategoryToggle : () => {};

  const totalActiveFilters = activeTags.size + activeCompanies.size + activeCategories.size + 
                             (filterByOwned !== 'all' ? 1 : 0) + 
                             (priceRange[0] > 0 || priceRange[1] < 10000000 ? 1 : 0) + 
                             (!showExpired ? 1 : 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{modalTitle}</h2>
            <div className="text-sm text-gray-400 mt-1">
              Showing {displayedPerks} of {totalPerks} perks
              {totalActiveFilters > 0 && (
                <span className="ml-2 text-purple-400">
                  • {totalActiveFilters} filter{totalActiveFilters !== 1 ? 's' : ''} active
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar - Only show for non-advanced tabs */}
        {activeTab !== 'advanced' && (
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md px-4 py-2 pl-10 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <svg 
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 mb-4 bg-gray-900/50 rounded-md p-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex-shrink-0 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tags'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            🏷️ Tags
            {activeTags.size > 0 && (
              <span className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeTags.size}
              </span>
            )}
          </button>
          
          {showCompaniesTab && (
            <button
              onClick={() => setActiveTab('companies')}
              className={`flex-shrink-0 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'companies'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              🏢 Companies
              {activeCompanies.size > 0 && (
                <span className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeCompanies.size}
                </span>
              )}
            </button>
          )}
          
          {showCategoriesTab && (
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex-shrink-0 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'categories'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              📁 Categories
              {activeCategories.size > 0 && (
                <span className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {activeCategories.size}
                </span>
              )}
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex-shrink-0 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'advanced'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            ⚙️ Advanced
            {(filterByOwned !== 'all' || priceRange[0] > 0 || priceRange[1] < 10000000 || !showExpired) && (
              <span className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                •
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons - Only show for non-advanced tabs */}
        {activeTab !== 'advanced' && (
          <div className="flex items-center space-x-3 mb-5 border-b border-gray-700 pb-4">
            <button
              onClick={handleSelectAll}
              className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
              disabled={currentActiveItems.size === currentItems.length}
            >
              Select All {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
            <button
              onClick={handleClearAll}
              className="flex-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
              disabled={currentActiveItems.size === 0}
            >
              Clear {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
            <button
              onClick={handleClearAllFilters}
              className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
              disabled={totalActiveFilters === 0}
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Advanced Controls */}
        {activeTab === 'advanced' && (
          <div className="space-y-6 mb-4 border-b border-gray-700 pb-4">
            {/* Sorting */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🔄 Sort By
              </label>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="date">🕒 Newest First</option>
                <option value="alphabetical">🔤 Alphabetical (A-Z)</option>
                <option value="price-low">💰 Price: Low to High</option>
                <option value="price-high">💰 Price: High to Low</option>
                <option value="owned">⭐ Owned First</option>
                <option value="claims">🔥 Most Popular</option>
              </select>
            </div>

            {/* Ownership Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                👤 Ownership Status
              </label>
              <select 
                value={filterByOwned}
                onChange={(e) => setFilterByOwned(e.target.value as any)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Perks</option>
                <option value="owned">✅ Owned Only</option>
                <option value="not-owned">🆕 Not Owned Only</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                💰 Price Range (Alpha Points)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                  className="flex-1 bg-gray-900/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 10000000])}
                  className="flex-1 bg-gray-900/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Range: {priceRange[0].toLocaleString()} - {priceRange[1].toLocaleString()} αP
              </div>
            </div>

            {/* Show Expired */}
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={showExpired}
                  onChange={(e) => setShowExpired(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-300">⏰ Show Expired Perks</span>
              </label>
            </div>

            {/* Clear All Advanced Filters */}
            <button
              onClick={handleClearAllFilters}
              className="w-full text-sm bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-60"
              disabled={totalActiveFilters === 0}
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Items Grid */}
        <div className="overflow-y-auto flex-grow pr-2 -mr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50 scrollbar-thumb-rounded-full">
          {activeTab === 'advanced' ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">⚙️</div>
              <div className="text-gray-300 mb-2">Advanced filtering controls are above</div>
              <div className="text-sm text-gray-500">
                Use the controls above to customize your filtering preferences
              </div>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="text-center py-8">
              {searchQuery ? (
                <div>
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-400 mb-2">
                    No {activeTab} found for "{searchQuery}"
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <p className="text-gray-400">
                  No {activeTab} available to filter.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentItems.map((item) => (
                <button
                  key={item}
                  onClick={() => handleItemToggle(item)}
                  className={`w-full py-2 px-3 rounded-md text-sm transition-all duration-150 border text-left
                    ${currentActiveItems.has(item)
                      ? 'bg-purple-500/20 border-purple-500/50 text-white shadow-md' 
                      : 'bg-gray-900/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                    }`}
                >
                  <div className="flex items-center">
                    {activeTab === 'companies' && (
                      <span className="mr-2 text-blue-400">🏢</span>
                    )}
                    {activeTab === 'categories' && (
                      <span className="mr-2 text-purple-400">📁</span>
                    )}
                    <span className="truncate">{item}</span>
                    {currentActiveItems.has(item) && (
                      <span className="ml-auto text-purple-400">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {searchQuery && (
              <span>
                {currentItems.length} of {activeTab === 'tags' ? allTags.length : allCompanies.length} {activeTab} shown
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-md transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}; 