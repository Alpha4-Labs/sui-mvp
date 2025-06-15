/**
 * Debug utility to check environment variable loading
 */

console.log('🔍 Environment Variable Debug Report:');
console.log('=====================================');

// Check all VITE_ environment variables
const envVars = {
  VITE_SUI_NETWORK: import.meta.env['VITE_SUI_NETWORK'],
  VITE_SUI_RPC_URL: import.meta.env['VITE_SUI_RPC_URL'],
  VITE_PACKAGE_ID: import.meta.env['VITE_PACKAGE_ID'],
  VITE_PERK_MANAGER_PACKAGE_ID: import.meta.env['VITE_PERK_MANAGER_PACKAGE_ID'],
  VITE_LEDGER_ID: import.meta.env['VITE_LEDGER_ID'],
  VITE_CONFIG_ID: import.meta.env['VITE_CONFIG_ID'],
  VITE_ORACLE_ID: import.meta.env['VITE_ORACLE_ID'],
  VITE_PARTNER_CAP_ID: import.meta.env['VITE_PARTNER_CAP_ID'],
  VITE_DISCORD_BOT_TOKEN: import.meta.env['VITE_DISCORD_BOT_TOKEN'],
  VITE_DISCORD_GUILD_ID: import.meta.env['VITE_DISCORD_GUILD_ID'],
  VITE_DISCORD_CLIENT_ID: import.meta.env['VITE_DISCORD_CLIENT_ID'],
  VITE_DISCORD_REDIRECT_URI: import.meta.env['VITE_DISCORD_REDIRECT_URI'],
};

Object.entries(envVars).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  const displayValue = value ? 
    (value.length > 20 ? `${value.substring(0, 10)}...${value.substring(value.length - 10)}` : value) : 
    'UNDEFINED';
  console.log(`${status} ${key}: ${displayValue}`);
});

console.log('=====================================');

// Check if .env file exists (client-side check)
const hasEnvFile = typeof window !== 'undefined' ? 'Unknown (client-side)' : 'Check server logs';
console.log(`📁 .env file status: ${hasEnvFile}`);

// Export the vars for use in other modules
export const debugEnvVars = envVars;

export const getEnvStatus = () => {
  const defined = Object.values(envVars).filter(Boolean).length;
  const total = Object.keys(envVars).length;
  return `${defined}/${total} environment variables defined`;
};

export default envVars; 