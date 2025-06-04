/**
 * Smart Contract Error Code Mappings
 * Maps Move abort error codes to user-friendly messages
 */

export interface ErrorMapping {
  code: number;
  title: string;
  message: string;
  action?: string;
  context?: string; // Additional context for debugging
}

// Perk Manager Error Codes
export const PERK_MANAGER_ERRORS: Record<number, ErrorMapping> = {
  100: {
    code: 100,
    title: "Permission Denied",
    message: "You don't have permission to perform this action. Make sure you're using the correct partner capability.",
    action: "Check your partner account and try again",
    context: "Usually occurs when using wrong partner capability or expired session"
  },
  101: {
    code: 101,
    title: "Invalid Perk Type",
    message: "The selected perk type is not allowed for your partner account.",
    action: "Choose a different perk type from the allowed list",
    context: "Partner account settings restrict which perk types can be created"
  },
  102: {
    code: 102,
    title: "Price Too High",
    message: "The perk price exceeds the maximum allowed cost per perk for your account.",
    action: "Lower the price or contact support to increase your limits",
    context: "Each partner has configurable maximum cost limits"
  },
  103: {
    code: 103,
    title: "Too Many Perks",
    message: "You've reached the maximum number of perks allowed for your partner account.",
    action: "Delete unused perks or upgrade your partner tier",
    context: "Partner accounts have configurable maximum perk limits"
  },
  104: {
    code: 104,
    title: "Invalid Tag",
    message: "One or more tags are not in the allowed list for your partner account.",
    action: "Use only tags from the available selection",
    context: "Partner account settings define allowed and blacklisted tag lists"
  },
  105: {
    code: 105,
    title: "Partner Account Paused",
    message: "Your partner account is currently paused and cannot create new perks.",
    action: "Contact support to reactivate your account",
    context: "Partner accounts can be paused administratively"
  },
  106: {
    code: 106,
    title: "Insufficient Quota",
    message: "You don't have enough Alpha Points quota to create this perk.",
    action: "Increase your TVL backing or wait for quota renewal",
    context: "Alpha Points quota is based on TVL backing and daily limits"
  },
  107: {
    code: 107,
    title: "Invalid Revenue Split",
    message: "The revenue split configuration is outside the allowed range. Partner share must be between the minimum and maximum percentages configured for your account.",
    action: "Use the slider to set a valid revenue split percentage between the allowed min/max values",
    context: "Revenue split validation failed. Check your partner settings for min/max partner share percentage limits. The slider should prevent invalid values, but blockchain validation is stricter."
  },
  108: {
    code: 108,
    title: "Settings Not Configured",
    message: "Your partner account settings haven't been configured yet.",
    action: "Go to Settings tab and configure your perk limits first",
    context: "New partner accounts need initial configuration before creating perks"
  },
  109: {
    code: 109,
    title: "Invalid Price Range",
    message: "The perk price must be greater than 0 and within allowed limits.",
    action: "Enter a valid price between $0.01 and your maximum allowed amount",
    context: "Price validation occurs on both frontend and smart contract level"
  },
  110: {
    code: 110,
    title: "Name Too Long",
    message: "The perk name is too long. Maximum allowed length exceeded.",
    action: "Shorten the perk name to under 100 characters",
    context: "Smart contract enforces maximum string lengths to prevent abuse"
  },
  111: {
    code: 111,
    title: "Description Too Long", 
    message: "The perk description is too long. Maximum allowed length exceeded.",
    action: "Shorten the description to under 500 characters",
    context: "Smart contract enforces maximum string lengths to prevent abuse"
  },
  112: {
    code: 112,
    title: "Perk Type Not Allowed",
    message: "The selected perk type is not allowed by your current partner settings. You can only create perks using the allowed perk types configured in your Settings.",
    action: "1) Go to Settings tab and check your allowed perk types\n2) Select a different perk type from the dropdown\n3) Or update your settings to allow the desired perk type",
    context: "Error 112 occurs when trying to create a perk with a type that isn't in your partner's allowed perk types list. This is controlled by your perk control settings on the blockchain."
  },
  113: {
    code: 113,
    title: "Perk Type Blacklisted",
    message: "The selected perk type has been blacklisted and cannot be used. Choose a different perk type that is not on the blacklist.",
    action: "1) Select a different perk type from the dropdown\n2) Check with platform administrators if you believe this is an error\n3) Review your Settings tab for blacklisted types",
    context: "Error 113 occurs when trying to use a perk type that has been explicitly blacklisted in your partner settings."
  },
  114: {
    code: 114,
    title: "Cost Limit Exceeded",
    message: "The perk cost exceeds your configured maximum cost per perk limit. This is the most common error when creating perks. Lower the price OR go to Settings tab and increase your 'Max Cost Per Perk' limit first.",
    action: "🔧 Your perk costs 20,000 AP but limit allows 1,000,010 AP\n\n💰 In USD: $20.00 vs $1000.00 limit\n\n💡 WORKAROUND: Try $19.99 instead (smart contract off-by-one bug)",
    context: "Error 114 occurs when the Oracle-calculated Alpha Points cost of your perk exceeds the max_cost_per_perk setting stored on the blockchain. The smart contract uses an oracle to convert your USD price to Alpha Points, then compares against your settings limit."
  },
  115: {
    code: 115,
    title: "Validation Failed",
    message: "A validation check failed during transaction processing. This is most commonly caused by revenue split settings that don't align with your partner account configuration.",
    action: "1) Your revenue/investment ratio may be misaligned with your current settings - try adjusting the slider to a different split\n2) Check your account settings are properly configured in the Settings tab\n3) Verify input values are within valid ranges\n4) Refresh the page to reload current data\n5) Contact support if the issue persists",
    context: "Error 115 occurs when smart contract validation fails. Most common cause: revenue split percentage outside your partner account's configured min/max limits. The blockchain validation may be stricter than the frontend slider allows."
  },
  117: {
    code: 117,
    title: "Expiring Perks Disabled", 
    message: "Your partner settings don't allow perks with expiration dates. You're trying to create a perk with an expiration timestamp, but your current settings have 'Allow Expiring Perks' disabled.",
    action: "1) Go to Settings tab\\n2) Check the 'Allow Expiring Perks' checkbox\\n3) Click 'Update Partner Settings'\\n4) Wait for transaction confirmation\\n5) Try creating your perk again",
    context: "Error 117 occurs when the smart contract detects an expiration timestamp in your perk creation request, but your partner settings have allow_expiring_perks set to false. This is a security feature to prevent accidental creation of time-limited perks."
  },
  118: {
    code: 118,
    title: "Unknown Error",
    message: "An unknown error occurred. Please try again or contact support for assistance.",
    action: "Please try again or contact support"
  }
};

// Generic error mappings for other contracts
export const GENERIC_ERRORS: Record<number, ErrorMapping> = {
  0: {
    code: 0,
    title: "Transaction Failed",
    message: "The transaction failed due to an unknown error.",
    action: "Please try again or contact support"
  },
  1: {
    code: 1,
    title: "Insufficient Funds",
    message: "You don't have enough SUI to pay for this transaction.",
    action: "Add more SUI to your wallet"
  }
};

/**
 * Parse Move abort error and return user-friendly message
 */
export function parseErrorCode(errorMessage: string): ErrorMapping | null {
  // Extract error code from Move abort error
  const moveAbortMatch = errorMessage.match(/MoveAbort.*?(\d+)\)/);
  if (!moveAbortMatch) return null;
  
  const errorCode = parseInt(moveAbortMatch[1]);
  
  // Check perk manager errors first
  if (PERK_MANAGER_ERRORS[errorCode]) {
    return PERK_MANAGER_ERRORS[errorCode];
  }
  
  // Fall back to generic errors
  if (GENERIC_ERRORS[errorCode]) {
    return GENERIC_ERRORS[errorCode];
  }
  
  // Unknown error code
  return {
    code: errorCode,
    title: "Smart Contract Error",
    message: `An error occurred with code ${errorCode}. This may be a contract-specific issue.`,
    action: "Please try again or contact support if the problem persists"
  };
}

/**
 * Create user-friendly error message for toast display
 */
export function formatErrorForToast(error: any): { title: string; message: string } {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Try to parse as Move abort error
  const parsedError = parseErrorCode(errorMessage);
  if (parsedError) {
    return {
      title: parsedError.title,
      message: `${parsedError.message}${parsedError.action ? ` ${parsedError.action}` : ''}`
    };
  }
  
  // Handle other common error types
  if (errorMessage.includes('Transaction validator signing failed')) {
    return {
      title: "Transaction Rejected",
      message: "The transaction was rejected. Please try again."
    };
  }
  
  if (errorMessage.includes('Insufficient SUI')) {
    return {
      title: "Insufficient Funds",
      message: "You don't have enough SUI to pay for this transaction. Please add funds to your wallet."
    };
  }
  
  if (errorMessage.includes('User rejected')) {
    return {
      title: "Transaction Cancelled",
      message: "You cancelled the transaction."
    };
  }
  
  // Default fallback
  return {
    title: "Transaction Failed",
    message: "An unexpected error occurred. Please try again."
  };
}

import { 
  predictSmartContractValidation,
  formatUSD,
  formatAlphaPoints,
  convertSettingsForDisplay 
} from './conversionUtils';

/**
 * Debug function to help diagnose error 114 (Cost Limit Exceeded)
 */
export function debugError114(perkPrice: number, partnerSettings: any) {
  console.log('🔍 Debugging Error 114 (Cost Limit Exceeded):');
  console.log(`   Perk Price: ${formatUSD(perkPrice)}`);
  
  if (partnerSettings) {
    console.log(`   Current Max Cost Setting: ${formatUSD(partnerSettings.maxCostPerPerkUsd || 0)}`);
    
    // Use centralized prediction to understand what went wrong
    const prediction = predictSmartContractValidation(
      perkPrice,
      partnerSettings.maxCostPerPerkUsd || 0,
      partnerSettings.maxCostPerPerk
    );
    
    console.log('🔍 Smart Contract Validation Prediction:', prediction);
    
    // Detailed analysis
    console.log('📊 Conversion Analysis:');
    Object.entries(prediction.conversionHypotheses).forEach(([key, hypothesis]) => {
      console.log(`   ${key}: ${formatAlphaPoints(hypothesis.value)} - ${hypothesis.passes ? '✅ PASS' : '❌ FAIL'} - ${hypothesis.description}`);
    });
    
    return {
      recommendation: prediction.shouldPass 
        ? `Oracle conversion rate may differ from expected 1000:1 ratio. Contact support.`
        : `Increase max cost limit to at least ${formatUSD(perkPrice + 0.01)}`
    };
  }
  
  return {
    recommendation: 'Configure your perk control settings first'
  };
} 