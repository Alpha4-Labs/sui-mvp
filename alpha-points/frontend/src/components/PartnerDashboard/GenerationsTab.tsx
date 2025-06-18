import React, { useState, useEffect } from 'react';
import { useCurrentWallet, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { GenerationBuilder } from '../GenerationBuilder';
import { ZeroDevIntegrationWizard } from '../ZeroDevIntegrationWizard';
import { Button } from '../ui/Button';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';

interface GenerationsTabProps {
  partnerCap: PartnerCapInfo;
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

export const GenerationsTab: React.FC<GenerationsTabProps> = ({ partnerCap }) => {
  const [activeTab, setActiveTab] = useState<'generations' | 'zero-dev'>('generations');
  const [showGenerationBuilder, setShowGenerationBuilder] = useState(false);
  const [showZeroDevWizard, setShowZeroDevWizard] = useState(false);
  const [generations, setGenerations] = useState<GenerationDefinition[]>([]);
  const { currentWallet } = useCurrentWallet();

  // Mock data for now - in real implementation, this would fetch from blockchain
  useEffect(() => {
    const fetchGenerations = async () => {
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
      }
    };

    fetchGenerations();
  }, []);

  const handleGenerationCreated = (newGeneration: GenerationDefinition) => {
    setGenerations(prev => [...prev, newGeneration]);
    setShowGenerationBuilder(false);
  };

  const handleZeroDevSetupComplete = () => {
    setShowZeroDevWizard(false);
    // Refresh partner data to show new integration status
  };

  if (showGenerationBuilder) {
    return (
      <GenerationBuilder
        partnerCap={partnerCap}
        onClose={() => setShowGenerationBuilder(false)}
        onSuccess={handleGenerationCreated}
      />
    );
  }

  if (showZeroDevWizard) {
    return (
      <ZeroDevIntegrationWizard
        partnerCap={partnerCap}
        onClose={() => setShowZeroDevWizard(false)}
        onComplete={handleZeroDevSetupComplete}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('generations')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'generations'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Generations
          </button>
          <button
            onClick={() => setActiveTab('zero-dev')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'zero-dev'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            Zero-Dev Integration
            <span className="ml-2 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
              NEW
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'generations' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">Generation Opportunities</h3>
              <p className="text-gray-400 mt-1">
                Create interactive experiences for users to earn Alpha Points
              </p>
            </div>
            <Button
              onClick={() => setShowGenerationBuilder(true)}
              disabled={!currentWallet}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Generation
            </Button>
          </div>

          {/* Generations List */}
          <div className="grid gap-4">
            {generations.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No generations yet</h3>
                <p className="text-gray-400 mb-4">
                  Create your first generation opportunity to start engaging users
                </p>
                <Button
                  onClick={() => setShowGenerationBuilder(true)}
                  disabled={!currentWallet}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Create Your First Generation
                </Button>
              </div>
            ) : (
              generations.map((generation) => (
                <div key={generation.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-white">{generation.name}</h4>
                      <p className="text-gray-400 mt-1">{generation.description}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-sm text-gray-500">
                          Type: {generation.executionType.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-gray-500">
                          Cost: {generation.quotaCostPerExecution} points
                        </span>
                        {generation.maxTotalExecutions && (
                          <span className="text-sm text-gray-500">
                            Max: {generation.maxTotalExecutions} executions
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        generation.isActive 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {generation.isActive ? 'Active' : 'Pending Approval'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'zero-dev' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-white">Zero-Dev Integration</h3>
              <p className="text-gray-400 mt-1">
                Integrate Alpha Points into your website with minimal development effort
              </p>
            </div>
            <Button
              onClick={() => setShowZeroDevWizard(true)}
              disabled={!currentWallet}
              className="bg-green-600 hover:bg-green-700"
            >
              Setup Integration
            </Button>
          </div>

          {/* Integration Overview */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
            <h4 className="text-lg font-medium text-white mb-4">How Zero-Dev Integration Works</h4>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-400 text-xl">1</span>
                </div>
                <h5 className="font-medium text-white mb-2">Configure Events</h5>
                <p className="text-sm text-gray-400">
                  Define what user actions on your site should award Alpha Points
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-400 text-xl">2</span>
                </div>
                <h5 className="font-medium text-white mb-2">Add Script</h5>
                <p className="text-sm text-gray-400">
                  Copy and paste a single script tag to your website
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-400 text-xl">3</span>
                </div>
                <h5 className="font-medium text-white mb-2">Start Earning</h5>
                <p className="text-sm text-gray-400">
                  Users automatically earn points for configured actions
                </p>
              </div>
            </div>
          </div>

          {/* Features List */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
            <h4 className="text-lg font-medium text-white mb-4">Integration Features</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-white">Automatic Event Detection</h5>
                  <p className="text-sm text-gray-400">Scans your site for common patterns</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-white">Rate Limiting & Security</h5>
                  <p className="text-sm text-gray-400">Built-in protection against abuse</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-white">Domain Whitelisting</h5>
                  <p className="text-sm text-gray-400">Control which domains can submit events</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-medium text-white">Real-time Analytics</h5>
                  <p className="text-sm text-gray-400">Track event submissions and point awards</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
