import React, { useState, useEffect } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { Button } from '../ui/Button';
import { GenerationBuilder } from './GenerationBuilder';

interface GenerationsTabProps {
  partnerCap: PartnerCapInfo;
  selectedPartnerCapId: string;
}

interface GenerationDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  executionType: 'embedded_code' | 'external_url' | 'hybrid';
  quotaCostPerExecution: number;
  maxExecutionsPerUser: number | null;
  maxTotalExecutions: number | null;
  totalExecutionsCount: number;
  isActive: boolean;
  approved: boolean;
  expirationTimestamp: number | null;
  createdTimestamp: number;
  tags: string[];
  icon: string | null;
  estimatedCompletionMinutes: number | null;
  targetUrl?: string;
  walrusBlobId?: string;
  safetyScore?: number;
}

export const GenerationsTab: React.FC<GenerationsTabProps> = ({
  partnerCap,
  selectedPartnerCapId
}) => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [generations, setGenerations] = useState<GenerationDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for now - in real implementation, this would fetch from blockchain
  useEffect(() => {
    const fetchGenerations = async () => {
      setLoading(true);
      try {
        // Mock generations data
        const mockGenerations: GenerationDefinition[] = [
          {
            id: '0x123...',
            name: 'Daily Check-in Rewards',
            description: 'Users earn points for daily check-ins on our platform',
            category: 'points_campaign',
            executionType: 'external_url',
            quotaCostPerExecution: 100,
            maxExecutionsPerUser: 1,
            maxTotalExecutions: null,
            totalExecutionsCount: 1247,
            isActive: true,
            approved: true,
            expirationTimestamp: null,
            createdTimestamp: Date.now() - 86400000 * 7, // 7 days ago
            tags: ['daily', 'rewards', 'engagement'],
            icon: '🎯',
            estimatedCompletionMinutes: 2,
            targetUrl: 'https://partner-site.com/checkin'
          },
          {
            id: '0x456...',
            name: 'NFT Collection Quiz',
            description: 'Interactive quiz about our NFT collection with bonus points',
            category: 'learn_to_earn',
            executionType: 'embedded_code',
            quotaCostPerExecution: 250,
            maxExecutionsPerUser: 1,
            maxTotalExecutions: 1000,
            totalExecutionsCount: 342,
            isActive: false,
            approved: false,
            expirationTimestamp: Date.now() + 86400000 * 30, // 30 days from now
            createdTimestamp: Date.now() - 86400000 * 2, // 2 days ago
            tags: ['quiz', 'nft', 'education'],
            icon: '🧠',
            estimatedCompletionMinutes: 10,
            walrusBlobId: 'blob_123',
            safetyScore: 85
          },
          {
            id: '0x789...',
            name: 'Social Share Challenge',
            description: 'Share our latest announcement and earn bonus points',
            category: 'social_share',
            executionType: 'external_url',
            quotaCostPerExecution: 150,
            maxExecutionsPerUser: 3,
            maxTotalExecutions: 5000,
            totalExecutionsCount: 2891,
            isActive: true,
            approved: true,
            expirationTimestamp: Date.now() + 86400000 * 14, // 14 days from now
            createdTimestamp: Date.now() - 86400000 * 5, // 5 days ago
            tags: ['social', 'viral', 'marketing'],
            icon: '📱',
            estimatedCompletionMinutes: 3,
            targetUrl: 'https://partner-site.com/share'
          }
        ];
        
        setGenerations(mockGenerations);
      } catch (error) {
        console.error('Failed to fetch generations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGenerations();
  }, [selectedPartnerCapId]);

  const filteredGenerations = generations.filter(gen => {
    // Apply status filter
    if (filter === 'active' && !gen.isActive) return false;
    if (filter === 'pending' && gen.approved) return false;
    if (filter === 'inactive' && gen.isActive) return false;
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        gen.name.toLowerCase().includes(searchLower) ||
        gen.description.toLowerCase().includes(searchLower) ||
        gen.category.toLowerCase().includes(searchLower) ||
        gen.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });

  const handleGenerationCreated = () => {
    // Refresh generations list
    setGenerations(prev => [...prev]); // Trigger re-fetch in real implementation
    setShowBuilder(false);
  };

  const handleToggleActive = async (generationId: string) => {
    // Mock toggle - in real implementation, this would call the blockchain
    setGenerations(prev => 
      prev.map(gen => 
        gen.id === generationId 
          ? { ...gen, isActive: !gen.isActive }
          : gen
      )
    );
  };

  const getStatusBadge = (generation: GenerationDefinition) => {
    if (!generation.approved) {
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">Pending Approval</span>;
    }
    if (!generation.isActive) {
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-300">Inactive</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-300">Active</span>;
  };

  const getExecutionTypeIcon = (type: string) => {
    switch (type) {
      case 'embedded_code': return '💻';
      case 'external_url': return '🔗';
      case 'hybrid': return '🔄';
      default: return '❓';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading generations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Generation Management</h3>
          <p className="text-gray-400 text-sm">Create and manage generation objects that bind PartnerCapFlex authority</p>
        </div>
        <Button
          onClick={() => setShowBuilder(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <span className="mr-2">➕</span>
          Create Generation
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {(['all', 'active', 'pending', 'inactive'] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                filter === filterOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search generations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{generations.length}</div>
          <div className="text-gray-400 text-sm">Total Generations</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">
            {generations.filter(g => g.isActive && g.approved).length}
          </div>
          <div className="text-gray-400 text-sm">Active</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {generations.filter(g => !g.approved).length}
          </div>
          <div className="text-gray-400 text-sm">Pending Approval</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">
            {generations.reduce((sum, g) => sum + g.totalExecutionsCount, 0).toLocaleString()}
          </div>
          <div className="text-gray-400 text-sm">Total Executions</div>
        </div>
      </div>

      {/* Generations List */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        {filteredGenerations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚀</div>
            <h4 className="text-xl font-semibold text-white mb-2">No Generations Yet</h4>
            <p className="text-gray-400 mb-6">Create your first generation to start binding PartnerCapFlex authority to execution objects.</p>
            <Button
              onClick={() => setShowBuilder(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Your First Generation
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGenerations.map((generation, index) => (
              <div key={index} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <h5 className="font-semibold text-white mb-2">{generation.name}</h5>
                <p className="text-gray-400 text-sm mb-3">{generation.description}</p>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs ${
                    generation.isActive ? 'bg-green-900 text-green-300' :
                    !generation.approved ? 'bg-yellow-900 text-yellow-300' :
                    'bg-red-900 text-red-300'
                  }`}>
                    {generation.isActive ? 'Active' : !generation.approved ? 'Pending Approval' : 'Inactive'}
                  </span>
                  <Button className="text-xs px-3 py-1">
                    Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generation Builder Modal */}
      {showBuilder && (
        <GenerationBuilder
          partnerCap={partnerCap}
          onClose={() => setShowBuilder(false)}
          onSuccess={(newGeneration) => {
            setGenerations(prev => [...prev, newGeneration]);
            setShowBuilder(false);
          }}
        />
      )}
    </div>
  );
};
