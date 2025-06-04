import React, { useState, useMemo } from 'react';

interface PerkFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTags: string[];
  allCompanies: string[];
  activeTags: Set<string>;
  activeCompanies: Set<string>;
  setActiveTags: (tags: Set<string>) => void;
  setActiveCompanies: (companies: Set<string>) => void;
  modalTitle: string;
}

export const PerkFilterModal: React.FC<PerkFilterModalProps> = ({
  isOpen,
  onClose,
  allTags,
  allCompanies,
  activeTags,
  activeCompanies,
  setActiveTags,
  setActiveCompanies,
  modalTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'tags' | 'companies'>('tags');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

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

  const handleClearAll = () => {
    if (activeTab === 'tags') {
      setActiveTags(new Set());
    } else {
      setActiveCompanies(new Set());
    }
  };

  const handleSelectAll = () => {
    if (activeTab === 'tags') {
      setActiveTags(new Set(filteredTags));
    } else {
      setActiveCompanies(new Set(filteredCompanies));
    }
  };

  const handleClearAllFilters = () => {
    setActiveTags(new Set());
    setActiveCompanies(new Set());
    setSearchQuery('');
  };

  const currentItems = activeTab === 'tags' ? filteredTags : filteredCompanies;
  const currentActiveItems = activeTab === 'tags' ? activeTags : activeCompanies;
  const handleItemToggle = activeTab === 'tags' ? handleTagToggle : handleCompanyToggle;

  const totalActiveFilters = activeTags.size + activeCompanies.size;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-background-card rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{modalTitle}</h2>
            {totalActiveFilters > 0 && (
              <div className="text-sm text-gray-400 mt-1">
                {totalActiveFilters} filter{totalActiveFilters !== 1 ? 's' : ''} active
              </div>
            )}
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

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${activeTab === 'tags' ? 'tags' : 'companies'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background-input border border-gray-600 rounded-md px-4 py-2 pl-10 text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary"
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

        {/* Tabs */}
        <div className="flex space-x-1 mb-4 bg-background rounded-md p-1">
          <button
            onClick={() => setActiveTab('tags')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'tags'
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Tags
            {activeTags.size > 0 && (
              <span className="ml-2 bg-secondary text-white text-xs px-2 py-0.5 rounded-full">
                {activeTags.size}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'companies'
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            Companies
            {activeCompanies.size > 0 && (
              <span className="ml-2 bg-secondary text-white text-xs px-2 py-0.5 rounded-full">
                {activeCompanies.size}
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 mb-5 border-b border-gray-700 pb-4">
          <button
            onClick={handleSelectAll}
            className="flex-1 text-xs bg-primary hover:bg-primary-dark text-white py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
            disabled={currentActiveItems.size === currentItems.length}
          >
            Select All {activeTab === 'tags' ? 'Tags' : 'Companies'}
          </button>
          <button
            onClick={handleClearAll}
            className="flex-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
            disabled={currentActiveItems.size === 0}
          >
            Clear {activeTab === 'tags' ? 'Tags' : 'Companies'}
          </button>
          <button
            onClick={handleClearAllFilters}
            className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
            disabled={totalActiveFilters === 0}
          >
            Clear All Filters
          </button>
        </div>

        {/* Items Grid */}
        <div className="overflow-y-auto flex-grow pr-2 -mr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50 scrollbar-thumb-rounded-full">
          {currentItems.length === 0 ? (
            <div className="text-center py-8">
              {searchQuery ? (
                <div>
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-400 mb-2">
                    No {activeTab === 'tags' ? 'tags' : 'companies'} found for "{searchQuery}"
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-primary hover:text-primary-light"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <p className="text-gray-400">
                  No {activeTab === 'tags' ? 'tags' : 'companies'} available to filter.
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
                      ? 'bg-secondary border-secondary-dark text-white shadow-md' 
                      : 'bg-background-input border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                    }`}
                >
                  <div className="flex items-center">
                    {activeTab === 'companies' && (
                      <span className="mr-2 text-blue-400">🏢</span>
                    )}
                    <span className="truncate">{item}</span>
                    {currentActiveItems.has(item) && (
                      <span className="ml-auto text-secondary">✓</span>
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
            className="bg-primary hover:bg-primary-dark text-white py-2 px-6 rounded-md transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}; 