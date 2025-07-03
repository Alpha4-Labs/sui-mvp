import { useState, useEffect, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { PACKAGE_ID } from '../config/contract';

export interface GenerationDefinition {
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

export interface UsePartnerGenerationsReturn {
  generations: GenerationDefinition[];
  isLoading: boolean;
  error: string | null;
  refreshGenerations: () => Promise<void>;
  createGeneration: (generation: Partial<GenerationDefinition>) => void;
  toggleGenerationStatus: (generationId: string) => Promise<void>;
}

export function usePartnerGenerations(partnerCapId?: string): UsePartnerGenerationsReturn {
  const client = useSuiClient();
  const [generations, setGenerations] = useState<GenerationDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGenerations = useCallback(async () => {
    if (!client || !partnerCapId) return;

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement real blockchain fetching once generation_manager module is deployed
      // The real implementation will:
      // 1. Query the GenerationRegistry to get generation IDs for this partner
      // 2. Fetch each GenerationDefinition object 
      // 3. Parse and format the data for the UI
      
      console.warn('⚠️ MOCK DATA: generation_manager module not yet deployed to blockchain');
      console.log('📝 TODO: Implement real fetching with:');
      console.log('  1. Query GenerationRegistry for partner generations');
      console.log('  2. Fetch individual GenerationDefinition objects');
      console.log('  3. Parse Move struct data to TypeScript interfaces');
      
      // Real implementation would look like:
      /*
      // Get the generation registry
      const registryId = await getGenerationRegistryId(client);
      
      // Get generation IDs for this partner
      const partnerGenerations = await client.getDynamicFieldObject({
        parentId: registryId,
        name: {
          type: 'address',
          value: partnerCapId
        }
      });
      
      // Fetch each generation object
      const generationPromises = partnerGenerations.data.value.map(async (genId: string) => {
        const genObject = await client.getObject({
          id: genId,
          options: { showContent: true }
        });
        return parseGenerationObject(genObject);
      });
      
      const fetchedGenerations = await Promise.all(generationPromises);
      setGenerations(fetchedGenerations);
      */
      
      // Mock data for development (unchanged)
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
    } catch (err: any) {
      console.error('❌ Error fetching generations:', err);
      setError(err.message || 'Failed to fetch generations');
    } finally {
      setIsLoading(false);
    }
  }, [client, partnerCapId]);

  const refreshGenerations = useCallback(async () => {
    await fetchGenerations();
  }, [fetchGenerations]);

  const createGeneration = useCallback((newGeneration: Partial<GenerationDefinition>) => {
    // Add optimistic update - in real implementation this would be called after successful blockchain transaction
    const fullGeneration: GenerationDefinition = {
      id: Date.now().toString(),
      name: newGeneration.name || '',
      description: newGeneration.description || '',
      category: newGeneration.category || 'points_campaign',
      executionType: newGeneration.executionType || 'external_url',
      quotaCostPerExecution: newGeneration.quotaCostPerExecution || 100,
      maxExecutionsPerUser: newGeneration.maxExecutionsPerUser || null,
      maxTotalExecutions: newGeneration.maxTotalExecutions || null,
      totalExecutionsCount: 0,
      isActive: false, // New generations start inactive pending approval
      approved: newGeneration.executionType !== 'embedded_code', // External URLs auto-approved
      expirationTimestamp: newGeneration.expirationTimestamp || null,
      createdTimestamp: Date.now(),
      tags: newGeneration.tags || [],
      icon: newGeneration.icon || null,
      estimatedCompletionMinutes: newGeneration.estimatedCompletionMinutes || null,
      targetUrl: newGeneration.targetUrl,
      walrusBlobId: newGeneration.walrusBlobId,
      safetyScore: newGeneration.executionType === 'embedded_code' ? Math.floor(Math.random() * 40) + 60 : null
    };

    setGenerations(prev => [...prev, fullGeneration]);
  }, []);

  const toggleGenerationStatus = useCallback(async (generationId: string) => {
    try {
      // TODO: This function is now called AFTER blockchain transaction succeeds
      // It just updates local state to reflect the blockchain change
      console.log('🔄 Updating local state after blockchain transaction');
      
      setGenerations(prev => 
        prev.map(gen => 
          gen.id === generationId 
            ? { ...gen, isActive: !gen.isActive }
            : gen
        )
      );
    } catch (err: any) {
      console.error('❌ Error updating local generation status:', err);
      setError(err.message || 'Failed to update generation status');
    }
  }, []);

  // Auto-fetch on mount and when partnerCapId changes
  useEffect(() => {
    if (partnerCapId) {
      fetchGenerations();
    }
  }, [partnerCapId, fetchGenerations]);

  return {
    generations,
    isLoading,
    error,
    refreshGenerations,
    createGeneration,
    toggleGenerationStatus
  };
} 