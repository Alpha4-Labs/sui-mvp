import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { formatPoints } from '../utils/format';
import { SUI_CONFIG } from '../config/sui';
import { BRAND_CONFIG } from '../config/brand';

// Helper to format points consistently
const formatAlphaPoints = (points: bigint | string | number): string => {
  const pointsNum = typeof points === 'bigint' ? Number(points) : Number(points);
  return new Intl.NumberFormat().format(pointsNum);
};

/**
 * Improved decoder for u64 values from Sui Move call results
 * Handles various edge cases and provides better error reporting
 * Now accepts standard Array<number> as input and converts internally.
 */
function decodeU64(bytesInput: Array<number> | Uint8Array | unknown): number {
  let bytes: Uint8Array;

  // Convert standard array to Uint8Array if necessary
  if (Array.isArray(bytesInput) && bytesInput.every(n => typeof n === 'number')) {
    bytes = new Uint8Array(bytesInput);
  } else if (bytesInput instanceof Uint8Array) {
    bytes = bytesInput;
  } else {
    console.error('Invalid input type for u64 decoding:', typeof bytesInput);
    return 0;
  }

  // Original validation and decoding logic using the ensured Uint8Array
  if (!bytes) {
    console.error('No data provided for decoding u64 value');
    return 0;
  }
  
  // Length check still applies
  if (bytes.length !== 8) {
    console.error(`Invalid byte length for u64: expected 8, got ${bytes.length}`);
    return 0;
  }
  
  try {
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const valueBigInt = dataView.getBigUint64(0, true); // true for little-endian
    
    const valueNumber = Number(valueBigInt);
    
    if (valueBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      console.warn(
        `Potential precision loss converting u64 value ${valueBigInt} to JavaScript number. ` +
        `Consider using BigInt for large values.`
      );
    }
    
    return valueNumber;
  } catch (err) {
    console.error('Error decoding u64 value:', err);
    return 0;
  }
}

export const AlphaPointsBalance: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [lockedBalance, setLockedBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Alpha Points balance from the chain
  const fetchBalance = async () => {
    if (!currentAccount?.address || !suiClient) {
      setAvailableBalance(0);
      setLockedBalance(0);
      return;
    }

    // Check if shared object IDs are configured
    if (!SUI_CONFIG.sharedObjects.ledger || SUI_CONFIG.sharedObjects.ledger.includes('0x000') || SUI_CONFIG.sharedObjects.ledger === '0x...') {
      setError('Shared object IDs not configured. Please update your .env.local file with actual deployed contract object IDs.');
      setAvailableBalance(0);
      setLockedBalance(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching Alpha Points balance for:', currentAccount.address);
      console.log('🔧 Using package:', SUI_CONFIG.packageIds.perkManager);
      console.log('🔧 Using ledger:', SUI_CONFIG.sharedObjects.ledger);
      
      // Try a simpler approach - just get the total balance first
      const txb = new Transaction();

      // Try the integration module function that might be simpler
      txb.moveCall({
        target: `${SUI_CONFIG.packageIds.perkManager}::integration::get_user_points_balance`,
        arguments: [
          txb.object(SUI_CONFIG.sharedObjects.ledger),
          txb.pure.address(currentAccount.address),
        ],
      });

      const inspectResult = await suiClient.devInspectTransactionBlock({
        sender: currentAccount.address,
        transactionBlock: txb, 
      });
      
      const status = inspectResult?.effects?.status?.status;
      if (status !== 'success') {
        const errorMsg = inspectResult?.effects?.status?.error || 'Unknown devInspect error';
        console.error('DevInspect execution failed:', errorMsg, inspectResult);
        throw new Error(`Failed to fetch points: ${errorMsg}`);
      }

      console.log('📊 DevInspect result:', inspectResult);
      
      if (!inspectResult.results || inspectResult.results.length < 1) {
        console.error('DevInspect results missing or incomplete:', inspectResult);
        throw new Error('Could not retrieve point balance: Invalid response structure.');
      }
      
      const balanceResult = inspectResult.results[0];
      if (balanceResult?.returnValues?.[0]) {
        const [bytes, type] = balanceResult.returnValues[0];
        if (type === 'u64' && Array.isArray(bytes)) {
          const totalBalance = decodeU64(bytes);
          console.log('💰 Found total balance:', totalBalance);
          setAvailableBalance(totalBalance);
          setLockedBalance(0); // For now, treat all as available
        } else {
          throw new Error(`Unexpected format for balance. Expected type 'u64' and Array bytes.`);
        }
      } else {
        throw new Error("Could not find balance return value.");
      }
      
    } catch (error: any) {
      console.error('❌ Failed to fetch Alpha Points balance:', error);
      setError(error.message || 'Failed to fetch balance');
      setAvailableBalance(0);
      setLockedBalance(0);
    } finally {
      setLoading(false);
    }
  };

  // Fetch balance when account changes
  useEffect(() => {
    fetchBalance();
  }, [currentAccount?.address, suiClient]);

  // Auto-refresh balance every 30 seconds
  useEffect(() => {
    if (!currentAccount?.address) return;

    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [currentAccount?.address]);

  if (!currentAccount) {
    return null;
  }

  return (
    <div className="bg-[var(--color-background-card)]/80 backdrop-blur-lg border border-[var(--color-border)] rounded-2xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))`
            }}
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">Alpha Points</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Available Balance</p>
          </div>
        </div>
        
        {/* Refresh Button */}
        <button
          onClick={fetchBalance}
          disabled={loading}
          className="p-2 rounded-lg bg-[var(--color-background)]/50 border border-[var(--color-border)] hover:bg-[var(--color-background)]/80 transition-colors disabled:opacity-50"
          title="Refresh balance"
        >
          <svg 
            className={`w-4 h-4 text-[var(--color-text-muted)] ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Balance Display */}
      <div className="bg-[var(--color-background)]/30 backdrop-blur-sm border border-[var(--color-border)] rounded-xl p-4">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--color-border)] rounded-lg w-1/2 mb-2"></div>
            <div className="h-4 bg-[var(--color-border)] rounded w-1/3"></div>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="text-red-400 text-sm mb-2">⚠️ {error}</div>
            <button
              onClick={fetchBalance}
              className="text-xs text-[var(--color-primary)] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div>
            <div className="text-3xl font-bold text-[var(--color-text)] mb-2">
              {formatAlphaPoints(availableBalance)}
              <span className="text-lg font-normal text-[var(--color-text-muted)] ml-2">αP</span>
            </div>
            
            {lockedBalance > 0 && (
              <div className="text-sm text-[var(--color-text-muted)] mb-2">
                ({formatAlphaPoints(lockedBalance)} αP locked)
              </div>
            )}
            
            {BRAND_CONFIG.features.showPriceInUSD && (
              <div className="text-sm text-[var(--color-success)]">
                ≈ ${(availableBalance / 1000).toLocaleString(undefined, { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })} USD
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connected Account Info */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Connected Account:</span>
          <span className="font-mono text-[var(--color-text)] bg-[var(--color-background)]/50 px-2 py-1 rounded">
            {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
          </span>
        </div>
      </div>
    </div>
  );
}; 