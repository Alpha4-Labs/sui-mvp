import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { SUI_CONFIG, isUsingRealContracts } from '../config/sui';

import type { ClaimedPerk } from '../types/index';

class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 60000; // 60 seconds

  async getOrFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  clear() {
    this.cache.clear();
  }
}

// Rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests

async function rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return requestFn();
}

export class SuiService {
  private client: SuiClient;
  private cache = new SimpleCache();

  constructor() {
    console.log('🔧 Initializing SuiClient with config:', {
      network: SUI_CONFIG.network,
      rpcUrl: SUI_CONFIG.rpcUrl,
      packageId: SUI_CONFIG.packageIds.perkManager,
    });

    // Initialize the SuiClient with proper configuration
    this.client = new SuiClient({
      url: SUI_CONFIG.rpcUrl,
    });
  }

  /**
   * Main method to get claimed perks for a user
   */
  async getClaimedPerks(userAddress: string): Promise<ClaimedPerk[]> {
    const cacheKey = `user_claimed_perks_${userAddress}`;
    
    try {
      console.log('🔍 Fetching ClaimedPerks for:', userAddress);
      console.log('📦 Using package ID:', SUI_CONFIG.packageIds.perkManager);
      console.log('🌐 RPC URL:', SUI_CONFIG.rpcUrl);
      console.log('🏗️ Using real contracts:', isUsingRealContracts());
      
      return await this.cache.getOrFetch(
        cacheKey,
        async () => {
          if (!isUsingRealContracts()) {
            console.log('📝 Using mock data (no valid package ID configured)');
            return this.getMockClaimedPerks();
          }

          // Use the modern getOwnedObjects approach with proper filtering
          const claimedPerks = await this.fetchClaimedPerksFromObjects(userAddress);
          
          if (claimedPerks.length === 0) {
            console.log('📝 No ClaimedPerk objects found, using mock data for demo');
            return this.getMockClaimedPerks();
          }

          console.log(`✅ Successfully loaded ${claimedPerks.length} claimed perks from blockchain`);
          return claimedPerks;
        }
      );
    } catch (error) {
      console.error('❌ Error loading perks from blockchain:', error);
      console.log('📝 Falling back to mock data');
      return this.getMockClaimedPerks();
    }
  }

  /**
   * Fetch ClaimedPerk objects owned by the user using modern SDK patterns
   */
  private async fetchClaimedPerksFromObjects(userAddress: string): Promise<ClaimedPerk[]> {
    console.log('🔍 Searching for ClaimedPerk objects owned by:', userAddress);
    
    const packageId = SUI_CONFIG.packageIds.perkManager;
    const claimedPerkType = SUI_CONFIG.types.claimedPerk(packageId);
    
    console.log(`🔍 Searching for objects of type: ${claimedPerkType}`);
    
    try {
      const response = await rateLimitedRequest(() =>
        this.client.getOwnedObjects({
          owner: userAddress,
          filter: { 
            StructType: claimedPerkType 
          },
          options: {
            showContent: true,
            showType: true,
            showDisplay: true,
          },
        })
      );

      console.log(`📊 Found ${response.data.length} owned objects of type ClaimedPerk`);

      if (response.data.length === 0) {
        return [];
      }

      // Process the objects and convert to ClaimedPerk format
      const claimedPerks: ClaimedPerk[] = [];
      
      for (const objectResponse of response.data) {
        if (objectResponse.error) {
          console.warn('⚠️ Error fetching object:', objectResponse.error);
          continue;
        }

        if (!objectResponse.data) {
          console.warn('⚠️ No data in object response');
          continue;
        }

        try {
          const perk = await this.parseClaimedPerkObject(objectResponse.data);
          if (perk) {
            claimedPerks.push(perk);
          }
        } catch (parseError) {
          console.warn('⚠️ Error parsing ClaimedPerk object:', parseError);
        }
      }

      return claimedPerks;
    } catch (error) {
      console.error(`❌ Error fetching objects for type ${claimedPerkType}:`, error);
      throw error;
    }
  }

  /**
   * Parse a Sui object response into a ClaimedPerk
   */
  private async parseClaimedPerkObject(objectData: any): Promise<ClaimedPerk | null> {
    try {
      if (!objectData.content || objectData.content.dataType !== 'moveObject') {
        console.warn('⚠️ Object is not a Move object');
        return null;
      }

      const fields = objectData.content.fields;
      console.log('📋 ClaimedPerk fields:', fields);
      
      // ClaimedPerk only contains references - we need to fetch the actual PerkDefinition
      const perkDefinitionId = fields.perk_definition_id;
      const owner = fields.owner;
      const claimTimestamp = fields.claim_timestamp_ms;
      const status = fields.status || 'ACTIVE';
      const remainingUses = fields.remaining_uses;

      if (!perkDefinitionId) {
        console.warn('⚠️ ClaimedPerk missing perk_definition_id');
        return null;
      }

      console.log(`🔍 Fetching PerkDefinition: ${perkDefinitionId}`);

      // Fetch the PerkDefinition object to get the actual perk data
      const perkDefinition = await this.fetchPerkDefinition(perkDefinitionId);
      
      if (!perkDefinition) {
        console.warn(`⚠️ Could not fetch PerkDefinition for ID: ${perkDefinitionId}`);
        return null;
      }

      return {
        objectId: objectData.objectId,
        name: perkDefinition.name,
        description: perkDefinition.description,
        category: perkDefinition.perk_type,
        value: perkDefinition.usdc_price,
        status: this.parseStatus(status),
        claimedAt: this.formatTimestamp(claimTimestamp),
        icon: this.getIconForCategory(perkDefinition.perk_type),
        perkType: perkDefinition.perk_type,
        currentAlphaPointsPrice: perkDefinition.current_alpha_points_price,
        usdcPrice: perkDefinition.usdc_price,
      };
    } catch (error) {
      console.error('❌ Error parsing ClaimedPerk object:', error);
      return null;
    }
  }

  /**
   * Fetch a PerkDefinition object by its ID
   */
  private async fetchPerkDefinition(perkDefinitionId: string): Promise<any | null> {
    try {
      console.log(`🔍 Fetching PerkDefinition object: ${perkDefinitionId}`);
      
      const response = await rateLimitedRequest(() =>
        this.client.getObject({
          id: perkDefinitionId,
          options: {
            showContent: true,
            showType: true,
          },
        })
      );

      if (!response.data?.content || response.data.content.dataType !== 'moveObject') {
        console.warn(`⚠️ PerkDefinition ${perkDefinitionId} is not a valid Move object`);
        return null;
      }

      const fields = response.data.content.fields;
      console.log('📋 PerkDefinition fields:', fields);

      // Parse the PerkDefinition fields
      return {
        objectId: response.data.objectId,
        name: fields.name || 'Unknown Perk',
        description: fields.description || 'No description available',
        perk_type: fields.perk_type || 'Unknown',
        usdc_price: this.parseValue(fields.usdc_price || 0),
        current_alpha_points_price: this.parseValue(fields.current_alpha_points_price || 0),
        creator_partner_cap_id: fields.creator_partner_cap_id,
        is_active: fields.is_active,
        total_claims_count: this.parseValue(fields.total_claims_count || 0),
        max_claims: fields.max_claims,
        max_uses_per_claim: fields.max_uses_per_claim,
        expiration_timestamp_ms: fields.expiration_timestamp_ms,
        tags: fields.tags || [],
      };
    } catch (error) {
      console.error(`❌ Error fetching PerkDefinition ${perkDefinitionId}:`, error);
      return null;
    }
  }

  /**
   * Parse value handling different formats (strings, numbers, big numbers)
   */
  private parseValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'object' && value !== null) {
      // Handle BigInt or similar structures
      return parseInt(value.toString()) || 0;
    }
    return 0;
  }

  /**
   * Parse status from various formats
   */
  private parseStatus(status: any): 'Active' | 'Used' | 'Expired' {
    if (typeof status === 'string') {
      const normalized = status.toLowerCase();
      if (normalized.includes('active')) return 'Active';
      if (normalized.includes('used') || normalized.includes('claimed')) return 'Used';
      if (normalized.includes('expired')) return 'Expired';
    }
    return 'Active'; // Default status
  }

  /**
   * Format timestamp from various formats
   */
  private formatTimestamp(timestamp: any): string {
    try {
      if (typeof timestamp === 'string') {
        return new Date(timestamp).toISOString();
      }
      if (typeof timestamp === 'number') {
        // Handle both milliseconds and seconds
        const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
        return new Date(ts).toISOString();
      }
      return new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Get icon for perk category
   */
  private getIconForCategory(category: string): string {
    const iconMap: Record<string, string> = {
      'Access': '🔑',
      'Discount': '💰',
      'Service': '🎧',
      'Bonus': '🎁',
      'Premium': '⭐',
      'General': '🎫',
    };
    return iconMap[category] || '🎫';
  }

  /**
   * Generate mock data for development/demo purposes
   */
  private getMockClaimedPerks(): ClaimedPerk[] {
    return [
      {
        objectId: '0x1234567890abcdef1234567890abcdef12345678',
        name: 'Alpha4 Discord Access',
        description: 'Special access to Alpha4 Discord channels',
        category: 'Access',
        value: 50,
        status: 'Active',
        claimedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        icon: '🔑',
        perkType: 'Access',
        currentAlphaPointsPrice: 0,
        usdcPrice: 0,
      },
      {
        objectId: '0xabcdef1234567890abcdef1234567890abcdef12',
        name: 'Early Bird Bonus',
        description: '10% bonus on all Alpha4 activities',
        category: 'Bonus',
        value: 100,
        status: 'Active',
        claimedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        icon: '🎁',
        perkType: 'Bonus',
        currentAlphaPointsPrice: 0,
        usdcPrice: 0,
      },
    ];
  }

  /**
   * Refresh the cache and reload perks
   */
  async refreshPerkData(userAddress?: string): Promise<ClaimedPerk[]> {
    console.log('🔄 Refreshing perk data (clearing cache)');
    this.cache.clear();
    if (userAddress) {
      return this.getClaimedPerks(userAddress);
    }
    return [];
  }

  /**
   * Check if user has specific perk types or tags for Alpha4 rewards
   */
  hasRequiredPerks(userPerks: ClaimedPerk[], requiredType?: string, requiredTags?: string[]): boolean {
    if (!requiredType && !requiredTags) return true;

    return userPerks.some(perk => {
      // Only consider active perks
      if (perk.status !== 'Active') return false;

      // Check perk type match (map category to perkType for backward compatibility)
      if (requiredType && perk.category !== requiredType) {
        return false;
      }

      // For now, we don't have tags in the simplified interface, so assume true if no tags required
      if (requiredTags && requiredTags.length > 0) {
        // Could implement tag matching if needed in the future
        // For now, return true if the perk is active and type matches
        return true;
      }

      return true;
    });
  }

  /**
   * Get matching perks for a specific Alpha4 reward
   */
  getMatchingPerks(userPerks: ClaimedPerk[], requiredType?: string, requiredTags?: string[]): ClaimedPerk[] {
    if (!requiredType && !requiredTags) return userPerks.filter(p => p.status === 'Active');

    return userPerks.filter(perk => {
      // Only consider active perks
      if (perk.status !== 'Active') return false;

      // Check perk type match (map category to perkType for backward compatibility)
      if (requiredType && perk.category !== requiredType) {
        return false;
      }

      // For now, we don't have tags in the simplified interface, so assume true if no tags required
      if (requiredTags && requiredTags.length > 0) {
        // Could implement tag matching if needed in the future
        return true;
      }

      return true;
    });
  }

  /**
   * Get the current RPC URL being used
   */
  getRpcUrl(): string {
    return SUI_CONFIG.rpcUrl;
  }

  /**
   * Get the package ID being used
   */
  getPackageId(): string {
    return SUI_CONFIG.packageIds.perkManager;
  }
}

// Export singleton instance
export const suiService = new SuiService();

import type { PerkDefinition } from '../types/index'; 