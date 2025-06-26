import React, { useState } from 'react';
import { usePerkMarketplace } from '../hooks/usePerkMarketplace';
import type { PerkDefinition } from '../types/index';
import { formatPoints } from '../utils/format';

/**
 * Debug Helper Component for Perk Curation
 * 
 * This component helps companies discover available perks and their IDs
 * for easy curation configuration. Only shows when VITE_DEBUG_MODE=true
 */
export const PerkDebugHelper: React.FC = () => {
  const { perks, loading, error } = usePerkMarketplace();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Only show in debug mode
  if (import.meta.env.VITE_DEBUG_MODE !== 'true') {
    return null;
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const copyAllIds = async () => {
    const filteredPerks = getFilteredPerks();
    const ids = filteredPerks.map(perk => `'${perk.objectId}'`).join(',\n      ');
    const configSnippet = `// Generated perk IDs for brand configuration
export const brandConfig = {
  curation: {
    method: 'perk_ids',
    perkIds: [
      ${ids}
    ],
  },
};`;
    
    await copyToClipboard(configSnippet);
  };

  const getFilteredPerks = (): PerkDefinition[] => {
    if (!perks) return [];
    
    return perks.filter(perk => {
      const matchesSearch = !searchTerm || 
        perk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perk.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perk.creatorPartnerCapId?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => perk.tags?.includes(tag));
      
      return matchesSearch && matchesTags;
    });
  };

  const getAllTags = (): string[] => {
    if (!perks) return [];
    
    const tagSet = new Set<string>();
    perks.forEach(perk => {
      perk.tags?.forEach(tag => tagSet.add(tag));
    });
    
    return Array.from(tagSet).sort();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  if (loading) {
    return (
      <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-lg border border-yellow-500 z-50">
        <div className="text-yellow-400 font-bold mb-2">🔧 Debug Mode: Loading Perks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-4 right-4 bg-black/90 text-white p-4 rounded-lg border border-red-500 z-50">
        <div className="text-red-400 font-bold mb-2">🔧 Debug Mode: Error Loading Perks</div>
        <div className="text-sm text-red-300">{error}</div>
      </div>
    );
  }

  const filteredPerks = getFilteredPerks();
  const allTags = getAllTags();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-auto">
      <div className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto bg-gray-900 rounded-xl border border-yellow-500 shadow-2xl">
          {/* Header */}
          <div className="bg-yellow-500 text-black p-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">🔧 Perk Curation Debug Helper</h2>
                <p className="text-sm opacity-80">Discover and copy perk IDs for your brand configuration</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-black text-yellow-500 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Close Debug
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 border-b border-gray-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Search */}
              <div>
                <label className="block text-white font-medium mb-2">Search Perks</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, description, or company..."
                  className="w-full px-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-lg focus:border-yellow-500 focus:outline-none"
                />
              </div>

              {/* Tag Filter */}
              <div>
                <label className="block text-white font-medium mb-2">Filter by Tags</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-yellow-500 text-black'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-gray-400">
                Showing {filteredPerks.length} of {perks?.length || 0} perks
              </div>
              
              <div className="space-x-3">
                <button
                  onClick={() => copyAllIds()}
                  className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
                >
                  📋 Copy All IDs as Config
                </button>
                
                <button
                  onClick={() => {
                    const data = filteredPerks.map(perk => ({
                      id: perk.objectId,
                      name: perk.name,
                      company: perk.creatorPartnerCapId,
                      tags: perk.tags,
                      price: perk.currentAlphaPointsPrice
                    }));
                    console.table(data);
                    alert('Perk data logged to console! Open DevTools to see the table.');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                >
                  📊 Log to Console
                </button>
              </div>
            </div>
          </div>

          {/* Perks List */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredPerks.map(perk => (
                <div
                  key={perk.objectId}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-yellow-500 transition-colors"
                >
                  {/* Perk Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg mb-1">{perk.name}</h3>
                      {perk.creatorPartnerCapId && (
                        <p className="text-gray-400 text-sm">by {perk.creatorPartnerCapId.slice(0, 8)}...</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400 font-bold">
                        {formatPoints(perk.currentAlphaPointsPrice)} αP
                      </div>
                      {perk.totalClaimsCount && (
                        <div className="text-gray-400 text-xs">
                          {perk.totalClaimsCount} claims
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {perk.description && (
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                      {perk.description}
                    </p>
                  )}

                  {/* Tags */}
                  {perk.tags && perk.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {perk.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Perk ID */}
                  <div className="bg-gray-900 border border-gray-600 rounded p-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Perk ID:</div>
                        <code className="text-green-400 text-sm font-mono break-all">
                          {perk.objectId}
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(perk.objectId)}
                        className={`ml-3 px-3 py-1 rounded text-sm transition-colors ${
                          copiedId === perk.objectId
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {copiedId === perk.objectId ? '✓ Copied!' : '📋 Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredPerks.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg mb-2">No perks match your filters</div>
                <p className="text-gray-500">Try adjusting your search term or selected tags</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-800 p-4 rounded-b-xl border-t border-gray-700">
            <div className="text-center text-gray-400 text-sm">
              <p className="mb-2">
                <strong>💡 Usage Tips:</strong>
              </p>
              <ul className="text-xs space-y-1">
                <li>• Use "Copy All IDs as Config" to generate ready-to-use brand configuration</li>
                <li>• Filter by tags to find perks relevant to your industry</li>
                <li>• Check the console for detailed perk data tables</li>
                <li>• Set VITE_DEBUG_MODE=false to hide this helper in production</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 