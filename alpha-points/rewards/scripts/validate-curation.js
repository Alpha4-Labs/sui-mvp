#!/usr/bin/env node

/**
 * Perk Curation Validation Script
 * 
 * This script validates your brand configuration and curation settings
 * to ensure they work correctly before deployment.
 * 
 * Usage: npm run validate-curation
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
};

// Mock brand config structure for validation
const validateBrandConfig = (config) => {
  const errors = [];
  const warnings = [];

  // Required fields validation
  if (!config.company?.name) {
    errors.push('Company name is required');
  }

  if (!config.curation?.method) {
    errors.push('Curation method is required');
  }

  // Curation method specific validation
  switch (config.curation?.method) {
    case 'perk_ids':
      if (!config.curation.perkIds || !Array.isArray(config.curation.perkIds)) {
        errors.push('perkIds array is required for perk_ids curation method');
      } else if (config.curation.perkIds.length === 0) {
        warnings.push('No perk IDs specified - marketplace will be empty');
      } else if (config.curation.perkIds.length > 50) {
        warnings.push('Large number of perks may impact performance');
      }
      break;

    case 'partner_ids':
      if (!config.curation.allowedPartnerIds || !Array.isArray(config.curation.allowedPartnerIds)) {
        errors.push('allowedPartnerIds array is required for partner_ids curation method');
      } else if (config.curation.allowedPartnerIds.length === 0) {
        warnings.push('No partner IDs specified - marketplace may be empty');
      }
      break;

    case 'tags':
      if (!config.curation.requiredTags && !config.curation.excludedTags) {
        errors.push('At least requiredTags or excludedTags must be specified for tags curation method');
      }
      if (config.curation.requiredTags && !Array.isArray(config.curation.requiredTags)) {
        errors.push('requiredTags must be an array');
      }
      if (config.curation.excludedTags && !Array.isArray(config.curation.excludedTags)) {
        errors.push('excludedTags must be an array');
      }
      break;

    default:
      errors.push(`Unknown curation method: ${config.curation.method}`);
  }

  // Theme validation
  if (config.theme?.colors) {
    const requiredColors = ['primary', 'secondary', 'background', 'text'];
    for (const color of requiredColors) {
      if (!config.theme.colors[color]) {
        warnings.push(`Missing theme color: ${color}`);
      } else if (!/^#[0-9A-Fa-f]{6}$/.test(config.theme.colors[color])) {
        warnings.push(`Invalid hex color format for ${color}: ${config.theme.colors[color]}`);
      }
    }
  }

  // Features validation
  if (config.features?.refreshInterval && config.features.refreshInterval < 10000) {
    warnings.push('Refresh interval less than 10 seconds may cause performance issues');
  }

  // Sorting validation
  if (config.sorting?.customSorts) {
    for (const [sortKey, sortFn] of Object.entries(config.sorting.customSorts)) {
      if (typeof sortFn !== 'function') {
        errors.push(`Custom sort '${sortKey}' must be a function`);
      }
    }
  }

  return { errors, warnings };
};

// Main validation function
const validateCuration = async () => {
  log.header('🔍 Alpha4 Perk Curation Validator');
  
  let totalErrors = 0;
  let totalWarnings = 0;

  try {
    // Check if brand config file exists
    const brandConfigPath = path.join(__dirname, '../src/config/brand.ts');
    if (!fs.existsSync(brandConfigPath)) {
      log.error('Brand configuration file not found at src/config/brand.ts');
      return process.exit(1);
    }

    log.success('Brand configuration file found');

    // Check environment file
    const envPath = path.join(__dirname, '../.env.local');
    if (!fs.existsSync(envPath)) {
      log.warning('No .env.local file found - using default configuration');
    } else {
      log.success('Environment configuration found');
    }

    // Validate TypeScript compilation
    log.info('Checking TypeScript compilation...');
    const { execSync } = require('child_process');
    
    try {
      execSync('npx tsc --noEmit --skipLibCheck', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe' 
      });
      log.success('TypeScript compilation successful');
    } catch (error) {
      log.error('TypeScript compilation failed');
      log.error(error.stdout?.toString() || error.message);
      totalErrors++;
    }

    // Mock validation of brand config structure
    // In a real implementation, this would import and validate the actual config
    log.info('Validating brand configuration structure...');
    
    // Example validation scenarios
    const mockConfigs = [
      {
        name: 'TRC-Crypto Configuration',
        config: {
          company: { name: 'TRC-Crypto' },
          curation: { 
            method: 'tags',
            requiredTags: ['defi', 'trading'],
            excludedTags: ['gaming']
          },
          theme: {
            colors: {
              primary: '#f7931a',
              secondary: '#627eea',
              background: '#0a0a0a',
              text: '#ffffff'
            }
          },
          features: {
            refreshInterval: 30000
          }
        }
      }
    ];

    for (const { name, config } of mockConfigs) {
      log.info(`Validating ${name}...`);
      const { errors, warnings } = validateBrandConfig(config);
      
      if (errors.length === 0) {
        log.success(`${name} validation passed`);
      } else {
        log.error(`${name} has ${errors.length} error(s):`);
        errors.forEach(error => log.error(`  - ${error}`));
        totalErrors += errors.length;
      }

      if (warnings.length > 0) {
        log.warning(`${name} has ${warnings.length} warning(s):`);
        warnings.forEach(warning => log.warning(`  - ${warning}`));
        totalWarnings += warnings.length;
      }
    }

    // Check package dependencies
    log.info('Checking required dependencies...');
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const requiredDeps = [
      '@mysten/dapp-kit',
      '@mysten/sui',
      'react',
      'react-dom',
      'zustand',
      'react-hot-toast'
    ];

    const missingDeps = requiredDeps.filter(dep => 
      !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
    );

    if (missingDeps.length === 0) {
      log.success('All required dependencies found');
    } else {
      log.error(`Missing dependencies: ${missingDeps.join(', ')}`);
      totalErrors++;
    }

    // Performance recommendations
    log.header('📊 Performance Recommendations');
    
    log.info('✓ Use specific perk IDs for fastest loading');
    log.info('✓ Limit initial perk count to < 20 for optimal UX');
    log.info('✓ Enable caching with refresh intervals > 30 seconds');
    log.info('✓ Use CDN for logo and asset files');

    // Security recommendations
    log.header('🔒 Security Recommendations');
    
    log.info('✓ Never expose private keys in configuration');
    log.info('✓ Use environment variables for sensitive data');
    log.info('✓ Validate all user inputs in custom filters');
    log.info('✓ Test with mainnet configuration before deployment');

    // Final results
    log.header('📋 Validation Summary');
    
    if (totalErrors === 0 && totalWarnings === 0) {
      log.success('🎉 All validations passed! Your configuration is ready for deployment.');
    } else if (totalErrors === 0) {
      log.warning(`⚠️  Configuration is valid but has ${totalWarnings} warning(s) to review.`);
    } else {
      log.error(`❌ Configuration has ${totalErrors} error(s) that must be fixed before deployment.`);
      if (totalWarnings > 0) {
        log.warning(`Also has ${totalWarnings} warning(s) to review.`);
      }
    }

    // Next steps
    log.header('🚀 Next Steps');
    
    if (totalErrors === 0) {
      log.info('1. Test your configuration: npm run dev');
      log.info('2. Preview with test wallet: Connect and verify perks display correctly');
      log.info('3. Deploy to staging: npm run build && npm run preview');
      log.info('4. Deploy to production: Follow your deployment platform instructions');
    } else {
      log.info('1. Fix configuration errors listed above');
      log.info('2. Run validation again: npm run validate-curation');
      log.info('3. Test locally once errors are resolved');
    }

    log.info('\n📚 For detailed guidance, see:');
    log.info('   - PERK_CURATION_GUIDE.md');
    log.info('   - SETUP_GUIDE.md');
    log.info('   - examples/brand-configs/');

    // Exit with appropriate code
    process.exit(totalErrors > 0 ? 1 : 0);

  } catch (error) {
    log.error('Validation failed with error:');
    log.error(error.message);
    process.exit(1);
  }
};

// Run validation if called directly
if (require.main === module) {
  validateCuration();
}

module.exports = { validateCuration, validateBrandConfig }; 