// src/utils/bcs-helpers.js
import { bcs } from '@mysten/sui.js/bcs';

/**
 * Parses a BCS value from a transaction result
 * @param {object} result - Transaction result from devInspectTransaction
 * @param {number} resultIndex - Index of the return value to parse (default: 0)
 * @param {number} valueIndex - Index within the return value tuple (default: 0)
 * @returns {any} - Parsed BCS value
 */
export function parseBcsFromTxResult(result, resultIndex = 0, valueIndex = 0) {
  if (!result || !result.result || !result.result.returnValues) {
    console.error('Invalid transaction result format', result);
    return null;
  }
  
  try {
    const returnValues = result.result.returnValues;
    if (!returnValues[resultIndex] || !returnValues[resultIndex][valueIndex]) {
      console.error('Return value not found at specified indices', resultIndex, valueIndex);
      return null;
    }
    
    return returnValues[resultIndex][valueIndex];
  } catch (error) {
    console.error('Error parsing BCS from transaction result:', error);
    return null;
  }
}

/**
 * Formats a BCS numeric value to a human-readable string
 * @param {string|bigint} value - The BCS value
 * @param {number} decimals - Number of decimal places (default: 9 for Sui)
 * @returns {string} - Formatted string
 */
export function formatBcsValue(value, decimals = 9) {
  if (!value) return '0';
  
  try {
    // Handle different input types
    let numValue;
    if (typeof value === 'bigint') {
      numValue = value;
    } else if (typeof value === 'string') {
      numValue = BigInt(value);
    } else {
      numValue = BigInt(value.toString());
    }
    
    // Format with proper decimal precision
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = numValue / divisor;
    const fractionalPart = numValue % divisor;
    
    // Format the fractional part with leading zeros
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    // Trim trailing zeros
    fractionalStr = fractionalStr.replace(/0+$/, '');
    
    if (fractionalStr.length > 0) {
      return `${integerPart.toString()}.${fractionalStr}`;
    } else {
      return integerPart.toString();
    }
  } catch (error) {
    console.error('Error formatting BCS value:', error);
    return '0';
  }
}

/**
 * Parses a BCS encoded struct from transaction result
 * @param {object} result - Transaction result from devInspectTransaction
 * @param {object} schema - BCS schema for the struct
 * @param {string} typeName - Type name in the schema
 * @param {number} resultIndex - Index of the return value to parse
 * @param {number} valueIndex - Index within the return value tuple
 * @returns {object|null} - Parsed struct object
 */
export function parseBcsStruct(result, schema, typeName, resultIndex = 0, valueIndex = 0) {
  const bcsValue = parseBcsFromTxResult(result, resultIndex, valueIndex);
  if (!bcsValue) return null;
  
  try {
    // Register the schema with BCS
    const parser = bcs.registerStructType(typeName, schema);
    
    // Deserialize the bytes
    const bytes = Buffer.from(bcsValue, 'base64');
    return parser.parse(bytes);
  } catch (error) {
    console.error('Error parsing BCS struct:', error);
    return null;
  }
}

/**
 * Deserializes multiple values from a single transaction result
 * @param {object} result - Transaction result from devInspectTransaction
 * @param {Array<object>} types - Array of type info objects with schema, typeName, resultIndex, valueIndex
 * @returns {object} - Object with parsed values
 */
export function parseMultipleBcsValues(result, types) {
  const parsed = {};
  
  if (!result || !types || !Array.isArray(types)) {
    return parsed;
  }
  
  try {
    for (const type of types) {
      const { name, schema, typeName, resultIndex = 0, valueIndex = 0 } = type;
      
      if (!name) continue;
      
      if (schema && typeName) {
        parsed[name] = parseBcsStruct(result, schema, typeName, resultIndex, valueIndex);
      } else {
        parsed[name] = parseBcsFromTxResult(result, resultIndex, valueIndex);
      }
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing multiple BCS values:', error);
    return parsed;
  }
}

/**
 * Converts a string or number to a BCS-compatible format
 * @param {string|number} value - Value to convert
 * @param {number} decimals - Number of decimal places
 * @returns {bigint} - BCS-compatible value
 */
export function toBcsCompatible(value, decimals = 9) {
  if (!value) return BigInt(0);
  
  try {
    const floatValue = parseFloat(value.toString().replace(/,/g, ''));
    if (isNaN(floatValue)) return BigInt(0);
    
    const multiplier = BigInt(10) ** BigInt(decimals);
    return BigInt(Math.floor(floatValue * Number(multiplier)));
  } catch (error) {
    console.error('Error converting to BCS compatible format:', error);
    return BigInt(0);
  }
}

/**
 * Parse BCS array type
 * @param {object} result - Transaction result
 * @param {object} elementSchema - Schema for array elements
 * @param {string} typeName - Type name in the schema
 * @param {number} resultIndex - Result index
 * @param {number} valueIndex - Value index
 * @returns {Array|null} - Parsed array
 */
export function parseBcsArray(result, elementSchema, typeName, resultIndex = 0, valueIndex = 0) {
  const bcsValue = parseBcsFromTxResult(result, resultIndex, valueIndex);
  if (!bcsValue) return null;
  
  try {
    // Register the element type with BCS
    bcs.registerStructType(typeName, elementSchema);
    
    // Register the array type
    const arrayType = `vector<${typeName}>`;
    
    // Deserialize the bytes
    const bytes = Buffer.from(bcsValue, 'base64');
    return bcs.de(arrayType, bytes);
  } catch (error) {
    console.error('Error parsing BCS array:', error);
    return null;
  }
}

/**
 * Creates a schema for common Sui types
 * Helper to create BCS schemas more easily
 */
export const SuiTypeSchemas = {
  // Common scalar types
  u8: { kind: 'scalar', type: 'u8' },
  u16: { kind: 'scalar', type: 'u16' },
  u32: { kind: 'scalar', type: 'u32' },
  u64: { kind: 'scalar', type: 'u64' },
  u128: { kind: 'scalar', type: 'u128' },
  u256: { kind: 'scalar', type: 'u256' },
  bool: { kind: 'scalar', type: 'bool' },
  address: { kind: 'scalar', type: 'address' },
  
  // Helper for vector types
  vector: (type) => ({ kind: 'vector', type }),
  
  // Common struct types
  UID: { 
    id: { kind: 'scalar', type: 'address' }
  },
  
  ID: { kind: 'scalar', type: 'address' },
  
  // Common Move structs
  Balance: {
    value: { kind: 'scalar', type: 'u64' }
  },
  
  StakePosition: {
    id: { kind: 'struct', type: 'UID' },
    owner: { kind: 'scalar', type: 'address' },
    principal: { kind: 'scalar', type: 'u64' },
    start_epoch: { kind: 'scalar', type: 'u64' },
    unlock_epoch: { kind: 'scalar', type: 'u64' },
    duration_epochs: { kind: 'scalar', type: 'u64' },
    encumbered: { kind: 'scalar', type: 'bool' }
  },
  
  PointBalance: {
    available: { kind: 'scalar', type: 'u64' },
    locked: { kind: 'scalar', type: 'u64' }
  },
  
  // Helper to create a custom schema
  createSchema: (fields) => fields
};