/**
 * Simple environment variable test
 */

// Test if basic env vars are available
const testVars = {
  'VITE_SUI_NETWORK': import.meta.env['VITE_SUI_NETWORK'],
  'VITE_SUI_RPC_URL': import.meta.env['VITE_SUI_RPC_URL'],
  'VITE_PACKAGE_ID': import.meta.env['VITE_PACKAGE_ID'],
  'VITE_LEDGER_ID': import.meta.env['VITE_LEDGER_ID'],
  'VITE_CONFIG_ID': import.meta.env['VITE_CONFIG_ID'],
  'VITE_PARTNER_CAP_ID': import.meta.env['VITE_PARTNER_CAP_ID'],
  'VITE_DISCORD_CLIENT_ID': import.meta.env['VITE_DISCORD_CLIENT_ID'],
};

console.log('🧪 ENV TEST RESULTS:');
console.log('====================');

Object.entries(testVars).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  console.log(`${status} ${key}: ${value || 'UNDEFINED'}`);
});

console.log('====================');
console.log('📊 Summary:', Object.values(testVars).filter(Boolean).length, '/', Object.keys(testVars).length, 'variables loaded');

export default testVars; 