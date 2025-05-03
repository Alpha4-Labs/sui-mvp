// === useAlphaPoints.ts (Manual u64 Deserialization Workaround) ===

import { useCallback, useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
// No BCS imports needed for this workaround

import { PointBalance } from '../types'; // Your custom type for points
import { SHARED_OBJECTS, PACKAGE_ID } from '../config/contract'; // Your contract constants

/**
 * WORKAROUND: Manually decodes an 8-byte Uint8Array into a JavaScript number,
 * assuming little-endian u64 encoding. Use this because standard BCS imports
 * are failing in the current environment.
 * Handles potential precision loss for numbers > Number.MAX_SAFE_INTEGER.
 * @param bytes - The 8-byte Uint8Array.
 * @returns The decoded number.
 */
function decodeU64(bytes: Uint8Array): number {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 8) {
        // Provide more context in the error
        const typeInfo = bytes ? bytes.constructor.name : typeof bytes;
        const lengthInfo = bytes ? bytes.length : 'N/A';
        throw new Error(`Invalid input for u64 decoding: expected 8-byte Uint8Array, got ${typeInfo} length ${lengthInfo}`);
    }
    // Use DataView to read the bytes as a 64-bit unsigned integer (little-endian)
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const valueBigInt = dataView.getBigUint64(0, true); // true for little-endian

    // Convert to Number for use in state. Warn if precision might be lost.
    const valueNumber = Number(valueBigInt);
    if (valueBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        console.warn(
            `Potential precision loss converting u64 value ${valueBigInt} to JavaScript number. ` +
            `Max safe integer is ${Number.MAX_SAFE_INTEGER}. Consider using BigInt in your state if precision is critical.`
        );
    }
    return valueNumber;
}


// Helper type for the PTB structure passed to devInspect
// (Can be refined based on actual SDK types if needed)
type ProgrammableTransactionInput = { kind: string; value: any; type?: string };
type MoveCallTransaction = {
    kind: 'MoveCall';
    target: string;
    typeArguments: string[];
    arguments: { kind: string; index: number }[];
};
type ProgrammableTransactionBlockJson = {
    kind: 'programmable';
    inputs: ProgrammableTransactionInput[];
    transactions: MoveCallTransaction[];
};


export const useAlphaPoints = () => {
    const currentAccount = useCurrentAccount();
    const client = useSuiClient();

    const [loading, setLoading] = useState(true);
    const [points, setPoints] = useState<PointBalance>({ available: 0, locked: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);

    const fetchPoints = useCallback(async () => {
        // Ensure account address is available
        if (!currentAccount?.address) {
            // Reset state if account is lost? Or keep stale data?
            // setPoints({ available: 0, locked: 0, total: 0 }); // Option: Reset
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Construct the Programmable Transaction Block JSON manually
            // This avoids using the Transaction builder class (`new Transaction()`, `.pure()`, etc.)
            const ptb: ProgrammableTransactionBlockJson = {
                kind: 'programmable',
                inputs: [
                    // Input 0: Shared Ledger Object
                    { kind: 'object', value: SHARED_OBJECTS.ledger, type: 'object' },
                    // Input 1: User Address (as a pure value)
                    { kind: 'pure', value: currentAccount.address, type: 'address' },
                ],
                transactions: [
                    // Transaction 0: Call get_available_balance
                    {
                        kind: 'MoveCall',
                        target: `${PACKAGE_ID}::ledger::get_available_balance`,
                        typeArguments: [], // Assuming no type arguments needed
                        arguments: [
                            { kind: 'Input', index: 0 }, // Reference Input 0 (ledger)
                            { kind: 'Input', index: 1 }, // Reference Input 1 (address)
                        ],
                    },
                    // Transaction 1: Call get_locked_balance
                    {
                        kind: 'MoveCall',
                        target: `${PACKAGE_ID}::ledger::get_locked_balance`,
                        typeArguments: [], // Assuming no type arguments needed
                        arguments: [
                            { kind: 'Input', index: 0 }, // Reference Input 0 (ledger)
                            { kind: 'Input', index: 1 }, // Reference Input 1 (address)
                        ],
                    },
                ],
            };

            // 2. Execute devInspect with the raw PTB JSON
            // Pass sender address and the constructed PTB
            const inspectResult = await client.devInspectTransactionBlock({
                sender: currentAccount.address,
                // Cast PTB to 'any' if TypeScript complains about the exact type match for TransactionBlock input
                // The SDK should internally handle this JSON structure.
                transactionBlock: ptb as any,
            });

            // 3. Check transaction status from effects
            const status = inspectResult?.effects?.status?.status;
            if (status !== 'success') {
                const errorMsg = inspectResult?.effects?.status?.error || 'Unknown devInspect error';
                console.error('DevInspect execution failed:', errorMsg, inspectResult);
                throw new Error(`Failed to fetch points: ${errorMsg}`);
            }

            // 4. Validate results structure
            if (!inspectResult.results || inspectResult.results.length < 2) {
                console.error('DevInspect results missing or incomplete:', inspectResult);
                throw new Error('Could not retrieve point balances: Invalid response structure.');
            }

            let available = 0;
            let locked = 0;

            // --- 5. Parse Available Balance (Result Index 0) ---
            const availableResult = inspectResult.results[0];
            if (availableResult?.returnValues?.[0]) {
                const [bytes, type] = availableResult.returnValues[0];
                // Ensure we got the expected type and raw bytes
                if (type === 'u64' && bytes instanceof Uint8Array) {
                    try {
                        // Use manual decode function as BCS workaround
                        available = decodeU64(bytes);
                    } catch (e: any) {
                        console.error("Manual u64 decoding failed for available balance:", e);
                        throw new Error(`Failed to parse available balance: ${e.message}`);
                    }
                } else {
                    throw new Error(`Unexpected format for available balance. Expected u64, got Type: ${type}`);
                }
            } else {
                throw new Error("Could not find available balance return value.");
            }

            // --- 6. Parse Locked Balance (Result Index 1) ---
            const lockedResult = inspectResult.results[1];
            if (lockedResult?.returnValues?.[0]) {
                const [bytes, type] = lockedResult.returnValues[0];
                // Ensure we got the expected type and raw bytes
                 if (type === 'u64' && bytes instanceof Uint8Array) {
                     try {
                         // Use manual decode function as BCS workaround
                         locked = decodeU64(bytes);
                     } catch (e: any) {
                        console.error("Manual u64 decoding failed for locked balance:", e);
                        throw new Error(`Failed to parse locked balance: ${e.message}`);
                    }
                 } else {
                    throw new Error(`Unexpected format for locked balance. Expected u64, got Type: ${type}`);
                 }
             } else {
                throw new Error("Could not find locked balance return value.");
             }

            // 7. Update state
            setPoints({
                available,
                locked,
                total: available + locked,
            });

        } catch (error: any) {
            console.error('Error fetching Alpha Points:', error);
            setError(error.message || 'An unknown error occurred while fetching points.');
        } finally {
            setLoading(false);
        }
    }, [client, currentAccount?.address]); // Dependencies for useCallback

    // Effect for initial fetch and polling
    useEffect(() => {
        fetchPoints(); // Initial fetch
        const intervalId = setInterval(fetchPoints, 10000); // Poll every 10 seconds
        return () => clearInterval(intervalId); // Cleanup interval
    }, [fetchPoints]); // Rerun effect if fetchPoints changes

    // Return hook state and refetch function
    return { points, loading, error, refetch: fetchPoints };
};