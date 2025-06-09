/**
 * Test file for perk pricing workaround
 * 
 * This tests that our pre-transformation produces the correct Alpha Points
 * when the smart contract applies its buggy oracle conversion.
 * 
 * Run with: npm run test or node -e "require('./src/utils/test-perk-pricing-workaround.ts')"
 */

import { transformUsdcForBuggyContract, CONVERSION_RATES } from './conversionUtils';

/**
 * Simulates what the smart contract does (the buggy logic)
 */
function simulateContractBuggyConversion(usdcValue: number): number {
  const rate = CONVERSION_RATES.ORACLE_RATE; // 328,000,000
  const decimals = CONVERSION_RATES.ORACLE_DECIMALS; // 8
  const powerOfDecimals = Math.pow(10, decimals); // 10^8
  
  // This is the buggy contract logic: oracle::convert_asset_to_points()
  const result = (usdcValue * powerOfDecimals) / rate;
  return Math.floor(result);
}

/**
 * Test cases for the workaround
 */
const testCases = [
  { userUsdcPrice: 10, expectedAlphaPoints: 10000 },
  { userUsdcPrice: 100, expectedAlphaPoints: 100000 },
  { userUsdcPrice: 2000, expectedAlphaPoints: 2000000 },
  { userUsdcPrice: 5000, expectedAlphaPoints: 5000000 },
];

console.log('🧪 Testing Perk Pricing Workaround...\n');

testCases.forEach(({ userUsdcPrice, expectedAlphaPoints }, index) => {
  console.log(`Test ${index + 1}: $${userUsdcPrice} USDC should cost ${expectedAlphaPoints.toLocaleString()} Alpha Points`);
  
  // Step 1: Transform the USDC value for the buggy contract
  const transformedUsdc = transformUsdcForBuggyContract(userUsdcPrice);
  
  // Step 2: Simulate what the contract will do with our transformed value
  const contractResult = simulateContractBuggyConversion(transformedUsdc);
  
  // Step 3: Check if we get the expected result
  const isCorrect = contractResult === expectedAlphaPoints;
  const status = isCorrect ? '✅ PASS' : '❌ FAIL';
  
  console.log(`   Transformed USDC sent: ${transformedUsdc.toLocaleString()}`);
  console.log(`   Contract calculates: ${contractResult.toLocaleString()} Alpha Points`);
  console.log(`   Expected: ${expectedAlphaPoints.toLocaleString()} Alpha Points`);
  console.log(`   Result: ${status}\n`);
  
  if (!isCorrect) {
    const error = contractResult - expectedAlphaPoints;
    console.log(`   ⚠️  Error: ${error} Alpha Points difference\n`);
  }
});

// Test the example from your transaction
console.log('🔍 Real-world example test:');
console.log('Your perk: $2000 USDC should cost 2,000,000 Alpha Points\n');

const realTransformed = transformUsdcForBuggyContract(2000);
const realResult = simulateContractBuggyConversion(realTransformed);

console.log(`Before fix (what happened): ${6097} Alpha Points (99.7% discount!)`);
console.log(`After workaround: ${realResult.toLocaleString()} Alpha Points`);
console.log(`Expected: 2,000,000 Alpha Points`);
console.log(`Workaround success: ${realResult === 2000000 ? '✅ YES' : '❌ NO'}`);

console.log('\n🚨 IMPORTANT: Remove this workaround when contract is fixed!');
console.log('TODO: Update contract to use: usdc_price * 1000 instead of oracle conversion');

export { simulateContractBuggyConversion }; 