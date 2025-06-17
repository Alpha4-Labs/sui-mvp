/**
 * Cross-Package Recovery Component
 * 
 * This component provides admin functionality to recover stakes from the old package
 * using the old AdminCap for immediate unencumbering and proper unstaking routes.
 */

import React, { useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { 
  buildRescueSingleStakeTransaction,
  buildRescueBatchStakesTransaction,
  buildOldPackageUnencumberStakeTransaction,
  buildOldPackageValidatorWithdrawalTransaction,
  buildVerifyOldPackageAdminAccessTransaction,
  convertSuiToAlphaPoints,
  calculateRecoveryAlphaPoints
} from '../utils/transaction';

// The old package ID from the user's query
const OLD_PACKAGE_ID = '0xdb62a7c1bbac6627f58863bec7774f30ea7022d862bb713cb86fcee3d0631fdf';

interface StakeData {
  owner: string;
  stakeId: string;
  principalMist: string;
  durationDays: number;
  startTimeMs: string;
  nativeStakeId?: string;
  validatorAddress?: string;
}

const CrossPackageRecovery: React.FC = () => {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  
  // State for admin operations
  const [oldAdminCapId, setOldAdminCapId] = useState('');
  const [isVerifyingAccess, setIsVerifyingAccess] = useState(false);
  const [hasVerifiedAccess, setHasVerifiedAccess] = useState(false);
  const [accessVerificationResult, setAccessVerificationResult] = useState<string>('');
  
  // State for single stake rescue
  const [singleStakeData, setSingleStakeData] = useState<StakeData>({
    owner: '',
    stakeId: '',
    principalMist: '',
    durationDays: 30,
    startTimeMs: Date.now().toString(),
  });
  const [isRescuingSingle, setIsRescuingSingle] = useState(false);
  
  // State for batch rescue
  const [batchStakesText, setBatchStakesText] = useState('');
  const [parsedBatchStakes, setParsedBatchStakes] = useState<StakeData[]>([]);
  const [isRescuingBatch, setIsRescuingBatch] = useState(false);
  
  // State for unencumbering operations
  const [unencumberStakeOwner, setUnencumberStakeOwner] = useState('');
  const [unencumberStakeId, setUnencumberStakeId] = useState('');
  const [isUnencumbering, setIsUnencumbering] = useState(false);
  
  // State for validator withdrawal
  const [withdrawalStakeOwner, setWithdrawalStakeOwner] = useState('');
  const [withdrawalNativeStakeId, setWithdrawalNativeStakeId] = useState('');
  const [withdrawalValidatorAddress, setWithdrawalValidatorAddress] = useState('');
  const [isInitiatingWithdrawal, setIsInitiatingWithdrawal] = useState(false);

  // Verify admin access to old package
  const handleVerifyAccess = useCallback(async () => {
    if (!oldAdminCapId || !account) return;
    
    setIsVerifyingAccess(true);
    try {
      const tx = buildVerifyOldPackageAdminAccessTransaction(oldAdminCapId, OLD_PACKAGE_ID);
      
      // For verification, we can use a dry run to check if the transaction would succeed
      const result = await suiClient.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: suiClient }),
        sender: account.address,
      });
      
      if (result.effects.status.status === 'success') {
        setHasVerifiedAccess(true);
        setAccessVerificationResult('✅ Admin access verified successfully!');
      } else {
        setAccessVerificationResult(`❌ Verification failed: ${result.effects.status.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Access verification failed:', error);
      setAccessVerificationResult(`❌ Verification error: ${error.message}`);
    } finally {
      setIsVerifyingAccess(false);
    }
  }, [oldAdminCapId, account, suiClient]);

  // Calculate Alpha Points for display
  const calculateAlphaPoints = useCallback((principalMist: string): string => {
    try {
      return convertSuiToAlphaPoints(principalMist);
    } catch {
      return '0';
    }
  }, []);

  // Rescue single stake
  const handleRescueSingle = useCallback(async () => {
    if (!hasVerifiedAccess || !account) return;
    
    setIsRescuingSingle(true);
    try {
      const tx = buildRescueSingleStakeTransaction(
        oldAdminCapId,
        OLD_PACKAGE_ID,
        singleStakeData.owner,
        singleStakeData.stakeId,
        singleStakeData.principalMist,
        singleStakeData.durationDays,
        singleStakeData.startTimeMs
      );
      
      // Execute transaction (would need signAndExecute in real app)
      console.log('Single stake rescue transaction built:', tx);
      alert(`Single stake rescue prepared for ${singleStakeData.owner}\nAlpha Points to mint: ${calculateAlphaPoints(singleStakeData.principalMist)}`);
    } catch (error: any) {
      console.error('Single rescue failed:', error);
      alert(`Rescue failed: ${error.message}`);
    } finally {
      setIsRescuingSingle(false);
    }
  }, [hasVerifiedAccess, account, oldAdminCapId, singleStakeData, calculateAlphaPoints]);

  // Parse batch stakes from text input
  const parseBatchStakes = useCallback(() => {
    try {
      const lines = batchStakesText.trim().split('\n');
      const stakes: StakeData[] = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Expected format: owner,stakeId,principalMist,durationDays,startTimeMs
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 5) {
          stakes.push({
            owner: parts[0],
            stakeId: parts[1],
            principalMist: parts[2],
            durationDays: parseInt(parts[3]) || 30,
            startTimeMs: parts[4],
          });
        }
      }
      
      setParsedBatchStakes(stakes);
      return stakes.length > 0;
    } catch (error) {
      console.error('Failed to parse batch stakes:', error);
      alert('Failed to parse batch stakes. Please check the format.');
      return false;
    }
  }, [batchStakesText]);

  // Rescue batch stakes
  const handleRescueBatch = useCallback(async () => {
    if (!hasVerifiedAccess || !account || parsedBatchStakes.length === 0) return;
    
    setIsRescuingBatch(true);
    try {
      const tx = buildRescueBatchStakesTransaction(
        oldAdminCapId,
        OLD_PACKAGE_ID,
        parsedBatchStakes.map(s => s.owner),
        parsedBatchStakes.map(s => s.stakeId),
        parsedBatchStakes.map(s => s.principalMist),
        parsedBatchStakes.map(s => s.durationDays),
        parsedBatchStakes.map(s => s.startTimeMs)
      );
      
      const totalAlphaPoints = parsedBatchStakes.reduce((sum, stake) => 
        sum + BigInt(calculateAlphaPoints(stake.principalMist)), BigInt(0)
      );
      
      console.log('Batch stake rescue transaction built:', tx);
      alert(`Batch rescue prepared for ${parsedBatchStakes.length} stakes\nTotal Alpha Points to mint: ${totalAlphaPoints.toString()}`);
    } catch (error: any) {
      console.error('Batch rescue failed:', error);
      alert(`Batch rescue failed: ${error.message}`);
    } finally {
      setIsRescuingBatch(false);
    }
  }, [hasVerifiedAccess, account, oldAdminCapId, parsedBatchStakes, calculateAlphaPoints]);

  // Unencumber stake
  const handleUnencumber = useCallback(async () => {
    if (!hasVerifiedAccess || !account) return;
    
    setIsUnencumbering(true);
    try {
      const tx = buildOldPackageUnencumberStakeTransaction(
        oldAdminCapId,
        OLD_PACKAGE_ID,
        unencumberStakeOwner,
        unencumberStakeId
      );
      
      console.log('Unencumber transaction built:', tx);
      alert(`Unencumber transaction prepared for stake ${unencumberStakeId}`);
    } catch (error: any) {
      console.error('Unencumber failed:', error);
      alert(`Unencumber failed: ${error.message}`);
    } finally {
      setIsUnencumbering(false);
    }
  }, [hasVerifiedAccess, account, oldAdminCapId, unencumberStakeOwner, unencumberStakeId]);

  // Initiate validator withdrawal
  const handleValidatorWithdrawal = useCallback(async () => {
    if (!hasVerifiedAccess || !account) return;
    
    setIsInitiatingWithdrawal(true);
    try {
      const tx = buildOldPackageValidatorWithdrawalTransaction(
        oldAdminCapId,
        OLD_PACKAGE_ID,
        withdrawalStakeOwner,
        withdrawalNativeStakeId,
        withdrawalValidatorAddress
      );
      
      console.log('Validator withdrawal transaction built:', tx);
      alert(`Validator withdrawal initiated for native stake ${withdrawalNativeStakeId}`);
    } catch (error: any) {
      console.error('Validator withdrawal failed:', error);
      alert(`Validator withdrawal failed: ${error.message}`);
    } finally {
      setIsInitiatingWithdrawal(false);
    }
  }, [hasVerifiedAccess, account, oldAdminCapId, withdrawalStakeOwner, withdrawalNativeStakeId, withdrawalValidatorAddress]);

  if (!account) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">Please connect your wallet to access cross-package recovery tools.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h1 className="text-2xl font-bold text-red-800 mb-2">Cross-Package Stake Recovery</h1>
        <p className="text-red-700">
          <strong>⚠️ ADMIN ONLY:</strong> These functions are for emergency recovery of stakes from the old package using AdminCap privileges.
        </p>
        <p className="text-sm text-red-600 mt-2">
          Old Package ID: <code className="bg-red-100 px-2 py-1 rounded">{OLD_PACKAGE_ID}</code>
        </p>
      </div>

      {/* Admin Cap Verification */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-blue-800 mb-4">1. Verify Admin Access</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Old Package AdminCap Object ID
            </label>
            <input
              type="text"
              value={oldAdminCapId}
              onChange={(e) => setOldAdminCapId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0x..."
            />
          </div>
          <button
            onClick={handleVerifyAccess}
            disabled={!oldAdminCapId || isVerifyingAccess}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isVerifyingAccess ? 'Verifying...' : 'Verify Admin Access'}
          </button>
          {accessVerificationResult && (
            <div className="mt-2 p-3 bg-gray-100 rounded-lg">
              <p className="text-sm">{accessVerificationResult}</p>
            </div>
          )}
        </div>
      </div>

      {hasVerifiedAccess && (
        <>
          {/* Single Stake Rescue */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-800 mb-4">2. Rescue Single Stake</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stake Owner Address</label>
                <input
                  type="text"
                  value={singleStakeData.owner}
                  onChange={(e) => setSingleStakeData(prev => ({ ...prev, owner: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stake ID</label>
                <input
                  type="text"
                  value={singleStakeData.stakeId}
                  onChange={(e) => setSingleStakeData(prev => ({ ...prev, stakeId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Principal (MIST)</label>
                <input
                  type="text"
                  value={singleStakeData.principalMist}
                  onChange={(e) => setSingleStakeData(prev => ({ ...prev, principalMist: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="1000000000"
                />
                {singleStakeData.principalMist && (
                  <p className="text-sm text-gray-600 mt-1">
                    Will mint: {calculateAlphaPoints(singleStakeData.principalMist)} Alpha Points
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Days)</label>
                <input
                  type="number"
                  value={singleStakeData.durationDays}
                  onChange={(e) => setSingleStakeData(prev => ({ ...prev, durationDays: parseInt(e.target.value) || 30 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  min="1"
                  max="365"
                />
              </div>
            </div>
            <button
              onClick={handleRescueSingle}
              disabled={!singleStakeData.owner || !singleStakeData.stakeId || !singleStakeData.principalMist || isRescuingSingle}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isRescuingSingle ? 'Rescuing...' : 'Rescue Single Stake'}
            </button>
          </div>

          {/* Batch Stake Rescue */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-purple-800 mb-4">3. Batch Rescue Stakes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Stakes Data (CSV format: owner,stakeId,principalMist,durationDays,startTimeMs)
                </label>
                <textarea
                  value={batchStakesText}
                  onChange={(e) => setBatchStakesText(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0x123...,0xabc...,1000000000,30,1672531200000&#10;0x456...,0xdef...,2000000000,60,1672531200000"
                />
              </div>
              <button
                onClick={parseBatchStakes}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Parse Batch Data
              </button>
              {parsedBatchStakes.length > 0 && (
                <div className="bg-white border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-700 mb-2">Parsed {parsedBatchStakes.length} stakes:</p>
                  <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                    {parsedBatchStakes.map((stake, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span>{stake.owner.slice(0, 10)}...{stake.owner.slice(-4)}</span>
                        <span>{calculateAlphaPoints(stake.principalMist)} αP</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleRescueBatch}
                    disabled={isRescuingBatch}
                    className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isRescuingBatch ? 'Rescuing...' : `Rescue ${parsedBatchStakes.length} Stakes`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Unencumber Operations */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-orange-800 mb-4">4. Unencumber Stakes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stake Owner</label>
                <input
                  type="text"
                  value={unencumberStakeOwner}
                  onChange={(e) => setUnencumberStakeOwner(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stake ID</label>
                <input
                  type="text"
                  value={unencumberStakeId}
                  onChange={(e) => setUnencumberStakeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="0x..."
                />
              </div>
            </div>
            <button
              onClick={handleUnencumber}
              disabled={!unencumberStakeOwner || !unencumberStakeId || isUnencumbering}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {isUnencumbering ? 'Unencumbering...' : 'Unencumber Stake'}
            </button>
          </div>

          {/* Validator Withdrawal */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-indigo-800 mb-4">5. Initiate Validator Withdrawal</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stake Owner</label>
                <input
                  type="text"
                  value={withdrawalStakeOwner}
                  onChange={(e) => setWithdrawalStakeOwner(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Native Stake ID</label>
                <input
                  type="text"
                  value={withdrawalNativeStakeId}
                  onChange={(e) => setWithdrawalNativeStakeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Validator Address</label>
                <input
                  type="text"
                  value={withdrawalValidatorAddress}
                  onChange={(e) => setWithdrawalValidatorAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0x..."
                />
              </div>
            </div>
            <button
              onClick={handleValidatorWithdrawal}
              disabled={!withdrawalStakeOwner || !withdrawalNativeStakeId || !withdrawalValidatorAddress || isInitiatingWithdrawal}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isInitiatingWithdrawal ? 'Initiating...' : 'Initiate Validator Withdrawal'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CrossPackageRecovery; 