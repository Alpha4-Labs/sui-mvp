/**
 * Privacy utilities for obfuscating sensitive user data
 * Used to protect Discord IDs and other sensitive information on-chain
 */

import CryptoJS from 'crypto-js';

// Default salt fallback (should be replaced with partner-specific salt)
// Use environment variable or fallback if not configured
const DEFAULT_SALT = import.meta.env['VITE_METADATA_SALT'] || 'alpha4-default-salt-2024';

/**
 * Generic metadata hashing with custom salt
 * @param value - The value to hash
 * @param salt - Partner-specific salt
 * @returns Hashed value
 */
export function hashMetadata(value: string, salt: string): string {
  return CryptoJS.SHA256(value + salt).toString();
}

/**
 * Legacy Discord ID hashing (backward compatibility)
 * @param discordId - Discord user ID to hash
 * @returns Hashed Discord ID
 */
export function hashDiscordId(discordId: string): string {
  return hashMetadata(discordId, DEFAULT_SALT);
}

/**
 * Validate Discord ID format
 * @param discordId - Discord user ID to validate
 * @returns true if valid format
 */
export function validateDiscordId(discordId: string): boolean {
  const cleanId = discordId.trim();
  return /^\d{17,19}$/.test(cleanId);
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate username format (alphanumeric + underscores/dashes)
 * @param username - Username to validate
 * @returns true if valid format
 */
export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username.trim());
}

/**
 * Generate a secure salt for partners
 * @returns Random salt string
 */
export function generatePartnerSalt(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 15);
  const moreRandom = Math.random().toString(36).substring(2, 15);
  return CryptoJS.SHA256(`${timestamp}-${random}-${moreRandom}`).toString().substring(0, 32);
}

/**
 * Legacy claim token generation (for backward compatibility)
 * @param discordId - Discord user ID
 * @returns Claim token
 */
export function generateClaimToken(discordId: string): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8);
  return `CLAIM-${discordId.substring(0, 4)}-${timestamp.substring(-6)}-${random}`.toUpperCase();
}

/**
 * Generic metadata validation based on type
 * @param value - Value to validate
 * @param metadataType - Type of metadata ('discord_id', 'email', 'username', etc.)
 * @returns Validation result
 */
export function validateMetadataValue(value: string, metadataType: string): { 
  isValid: boolean; 
  error?: string 
} {
  const trimmedValue = value.trim();
  
  if (!trimmedValue) {
    return { isValid: false, error: 'Value cannot be empty' };
  }

  switch (metadataType.toLowerCase()) {
    case 'discord_id':
    case 'discord_id_hash':
      if (!validateDiscordId(trimmedValue)) {
        return { 
          isValid: false, 
          error: 'Discord ID should be 17-19 digits long (e.g., 123456789012345678)' 
        };
      }
      break;
    
    case 'email':
    case 'email_hash':
      if (!validateEmail(trimmedValue)) {
        return { 
          isValid: false, 
          error: 'Please enter a valid email address' 
        };
      }
      break;
    
    case 'username':
    case 'username_hash':
      if (!validateUsername(trimmedValue)) {
        return { 
          isValid: false, 
          error: 'Username should be 3-30 characters, alphanumeric with underscores/dashes only' 
        };
      }
      break;
    
    default:
      // Generic validation for other metadata types
      if (trimmedValue.length < 2 || trimmedValue.length > 200) {
        return { 
          isValid: false, 
          error: 'Value should be between 2-200 characters' 
        };
      }
      break;
  }

  return { isValid: true };
}

/**
 * Get user-friendly label for metadata type
 * @param metadataType - Metadata type key
 * @returns Human-readable label
 */
export function getMetadataLabel(metadataType: string): string {
  const labels: Record<string, string> = {
    'discord_id': 'Discord User ID',
    'discord_id_hash': 'Discord User ID',
    'email': 'Email Address',
    'email_hash': 'Email Address',
    'username': 'Username',
    'username_hash': 'Username',
    'twitter_handle': 'Twitter Handle',
    'twitter_handle_hash': 'Twitter Handle',
    'telegram_username': 'Telegram Username',
    'telegram_username_hash': 'Telegram Username',
    'wallet_address': 'Wallet Address',
    'wallet_address_hash': 'Wallet Address',
  };
  
  return labels[metadataType.toLowerCase()] || metadataType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get placeholder text for metadata input
 * @param metadataType - Metadata type key
 * @returns Placeholder text
 */
export function getMetadataPlaceholder(metadataType: string): string {
  const placeholders: Record<string, string> = {
    'discord_id': '123456789012345678',
    'discord_id_hash': '123456789012345678',
    'email': 'user@example.com',
    'email_hash': 'user@example.com',
    'username': 'my_username',
    'username_hash': 'my_username',
    'twitter_handle': '@username',
    'twitter_handle_hash': '@username',
    'telegram_username': '@username',
    'telegram_username_hash': '@username',
    'wallet_address': '0x...',
    'wallet_address_hash': '0x...',
  };
  
  return placeholders[metadataType.toLowerCase()] || `Enter ${getMetadataLabel(metadataType).toLowerCase()}`;
}

/**
 * Check if metadata type should be hashed for privacy
 * @param metadataType - Metadata type key
 * @returns true if should be hashed
 */
export function shouldHashMetadata(metadataType: string): boolean {
  const hashableTypes = [
    'discord_id', 'email', 'username', 'twitter_handle', 
    'telegram_username', 'wallet_address'
  ];
  
  return hashableTypes.includes(metadataType.toLowerCase()) || 
         metadataType.toLowerCase().endsWith('_hash');
} 