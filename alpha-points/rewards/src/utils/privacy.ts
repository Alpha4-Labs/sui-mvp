/**
 * Privacy utilities for Alpha4 Rewards - must match frontend and Discord bot implementation
 * Used to verify hashed Discord IDs and other metadata from blockchain
 */

import { SUI_CONFIG } from '../config/sui';

// Shared salt for metadata hashing - MUST match frontend and Discord bot salt
const METADATA_SALT = SUI_CONFIG.privacy.metadataSalt;

/**
 * Creates a deterministic hash of a Discord ID using the shared salt
 * MUST match the frontend and Discord bot hashDiscordId function exactly
 * 
 * @param {string} discordId The raw Discord User ID (17-19 digits)
 * @returns {string} A deterministic hash that matches frontend/bot output
 */
export function hashDiscordId(discordId: string): string {
  if (!discordId || !/^\d{17,19}$/.test(discordId)) {
    throw new Error('Invalid Discord ID format');
  }
  
  // Create deterministic hash: SHA256(salt + discordId + salt)
  // MUST match frontend and Discord bot implementation exactly
  const data = `${METADATA_SALT}${discordId}${METADATA_SALT}`;
  
  // Use crypto.subtle for browser environment
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
    .then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 16); // Return first 16 characters to match other implementations
    })
    .then(hash => hash)
    .catch(() => {
      throw new Error('Failed to hash Discord ID');
    });
}

/**
 * Validates Discord ID format
 * 
 * @param {string} discordId The Discord ID to validate
 * @returns {boolean} True if valid format
 */
export function validateDiscordId(discordId: string): boolean {
  return /^\d{17,19}$/.test(discordId.trim());
}

/**
 * Verifies if a user's Discord ID matches a hash from the blockchain
 * 
 * @param {string} userDiscordId The user's raw Discord ID
 * @param {string} blockchainHash The hash stored on blockchain
 * @returns {Promise<boolean>} True if the Discord ID produces the same hash
 */
export async function verifyDiscordIdHash(userDiscordId: string, blockchainHash: string): Promise<boolean> {
  try {
    const computedHash = await hashDiscordId(userDiscordId);
    return computedHash === blockchainHash;
  } catch (error) {
    console.error('❌ Error verifying Discord ID hash:', error);
    return false;
  }
}

/**
 * Get the metadata salt being used
 * Useful for debugging and verification
 */
export function getMetadataSalt(): string {
  return METADATA_SALT;
}

/**
 * Hash any metadata value using the shared salt
 * Generic function for hashing various types of metadata
 * 
 * @param {string} value The value to hash
 * @param {string} type Optional type identifier for logging
 * @returns {Promise<string>} The hashed value
 */
export async function hashMetadata(value: string, type: string = 'unknown'): Promise<string> {
  if (!value) {
    throw new Error(`Cannot hash empty ${type}`);
  }
  
  const data = `${METADATA_SALT}${value}${METADATA_SALT}`;
  
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 16); // Consistent 16-character output
  } catch (error) {
    throw new Error(`Failed to hash ${type}: ${error}`);
  }
}

export {
  METADATA_SALT
}; 