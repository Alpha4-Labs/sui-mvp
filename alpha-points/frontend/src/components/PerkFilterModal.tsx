import React from 'react';

interface PerkFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTags: string[];
  activeTags: Set<string>;
  setActiveTags: (tags: Set<string>) => void;
  modalTitle: string;
}

export const PerkFilterModal: React.FC<PerkFilterModalProps> = ({
  isOpen,
  onClose,
  allTags,
  activeTags,
  setActiveTags,
  modalTitle,
}) => {
  if (!isOpen) return null;

  const handleTagToggle = (tag: string) => {
    const newActiveTags = new Set(activeTags);
    if (newActiveTags.has(tag)) {
      newActiveTags.delete(tag);
    } else {
      newActiveTags.add(tag);
    }
    setActiveTags(newActiveTags);
  };

  const handleClearAll = () => {
    setActiveTags(new Set());
  };

  const handleSelectAll = () => {
    setActiveTags(new Set(allTags));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-background-card rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">{modalTitle}</h2>
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

        <div className="flex items-center space-x-3 mb-5 border-b border-gray-700 pb-4">
          <button
            onClick={handleSelectAll}
            className="flex-1 text-xs bg-primary hover:bg-primary-dark text-white py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
            disabled={activeTags.size === allTags.length}
          >
            Select All Tags
          </button>
          <button
            onClick={handleClearAll}
            className="flex-1 text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 py-1.5 px-3 rounded-md transition-colors disabled:opacity-60"
            disabled={activeTags.size === 0}
          >
            Clear All Filters
          </button>
        </div>

        <div className="overflow-y-auto flex-grow pr-2 -mr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50 scrollbar-thumb-rounded-full">
          {allTags.length === 0 ? (
            <p className='text-gray-400 text-center py-4'>No tags available to filter.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`w-full py-1.5 px-2 rounded-md text-xs transition-all duration-150 border 
                    ${activeTags.has(tag)
                      ? 'bg-secondary border-secondary-dark text-white shadow-md scale-105' 
                      : 'bg-background-input border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end">
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