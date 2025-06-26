import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG } from '../config/sui';

/**
 * Build a transaction to claim a perk (quota-free version)
 * This is the simplified version that bypasses partner quota validation
 */
export const buildClaimPerkQuotaFreeTransaction = (perkDefinitionId: string): Transaction => {
  const transaction = new Transaction();
  const packageId = SUI_CONFIG.packageIds.perkManager;

  // Call the quota-free claim function
  transaction.moveCall({
    target: `${packageId}::perk_manager::claim_perk_quota_free`,
    arguments: [
      transaction.object(perkDefinitionId), // perk_definition: &mut PerkDefinition
    ],
  });

  return transaction;
};

/**
 * Build a transaction to claim a perk with metadata (quota-free version)
 * Used for perks that require additional user data (like Discord ID)
 */
export const buildClaimPerkWithMetadataQuotaFreeTransaction = (
  perkDefinitionId: string,
  metadataKey: string,
  metadataValue: string
): Transaction => {
  const transaction = new Transaction();
  const packageId = SUI_CONFIG.packageIds.perkManager;

  // Call the quota-free claim function with metadata
  transaction.moveCall({
    target: `${packageId}::perk_manager::claim_perk_with_metadata_quota_free`,
    arguments: [
      transaction.object(perkDefinitionId), // perk_definition: &mut PerkDefinition
      transaction.pure.string(metadataKey), // metadata_key: String
      transaction.pure.string(metadataValue), // metadata_value: String
    ],
  });

  return transaction;
};

/**
 * Build a transaction to claim a perk with hashed metadata (for privacy)
 * Used for sensitive data like Discord IDs that should be hashed
 */
export const buildClaimPerkWithHashedMetadataTransaction = (
  perkDefinitionId: string,
  metadataKey: string,
  hashedValue: string
): Transaction => {
  return buildClaimPerkWithMetadataQuotaFreeTransaction(
    perkDefinitionId,
    metadataKey,
    hashedValue
  );
};

/**
 * Simple hash function for metadata privacy
 * Note: This is a basic implementation. In production, consider using
 * a more robust hashing method or server-side hashing.
 */
export const hashMetadata = (value: string, salt: string): string => {
  // Simple hash implementation - in production you might want to use crypto.subtle
  let hash = 0;
  const combined = value + salt;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
};

/**
 * Get the appropriate transaction builder based on perk requirements
 */
export const getPerkClaimTransaction = (
  perkDefinitionId: string,
  perk?: any,
  metadata?: { key: string; value: string; shouldHash?: boolean; salt?: string }
): Transaction => {
  // If metadata is provided
  if (metadata) {
    if (metadata.shouldHash && metadata.salt) {
      // Hash the metadata value for privacy
      const hashedValue = hashMetadata(metadata.value, metadata.salt);
      return buildClaimPerkWithHashedMetadataTransaction(
        perkDefinitionId,
        metadata.key,
        hashedValue
      );
    } else {
      // Use metadata as-is
      return buildClaimPerkWithMetadataQuotaFreeTransaction(
        perkDefinitionId,
        metadata.key,
        metadata.value
      );
    }
  }
  
  // Standard perk claim without metadata
  return buildClaimPerkQuotaFreeTransaction(perkDefinitionId);
};

/**
 * Check if a perk requires metadata collection
 */
export const perkRequiresMetadata = (perk: any): boolean => {
  // Check if perk generates unique claim metadata
  if (perk.generates_unique_claim_metadata) {
    return true;
  }
  
  // Check for Discord-related perks
  if (perk.tags?.some((tag: string) => tag.toLowerCase().includes('discord'))) {
    return true;
  }
  
  // Check for role-related perks
  if (perk.name?.toLowerCase().includes('role')) {
    return true;
  }
  
  return false;
};

/**
 * Check if a perk specifically requires Discord metadata
 */
export const perkRequiresDiscordMetadata = (perk: any): boolean => {
  return (
    perk.tags?.some((tag: string) => tag.toLowerCase().includes('discord')) ||
    perk.name?.toLowerCase().includes('discord')
  );
}; 