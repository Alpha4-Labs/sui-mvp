import React, { useState } from 'react';
import { PartnerCapInfo } from '../../hooks/usePartnerDetection';
import { useAlphaContext } from '../../context/AlphaContext';
import { useSignAndExecuteTransaction, useCurrentWallet } from '@mysten/dapp-kit';
import { toast } from 'react-toastify';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ErrorToast } from '../ui/ErrorToast';
import { formatSui } from '../../utils/format';
import { formatUSD } from '../../utils/conversionUtils';
import { formatErrorForToast } from '../../utils/errorCodes';
import { executeWithSimulation } from '../../utils/transactionSimulation';
import {
  buildAddSuiCollateralTransaction,
  buildCreateInitialSuiVaultTransaction,
  buildAddUsdcCollateralTransaction,
  buildAddNftCollateralTransaction,
  buildWithdrawCollateralTransaction,
} from '../../utils/transaction';
import suiLogo from '../../assets/sui-logo.jpg';

interface CollateralModalProps {
  partnerCap: PartnerCapInfo;
  modalType: string; // 'topup', 'add', 'withdraw'
  onClose: () => void;
  onRefresh: () => void;
}

export const CollateralModal: React.FC<CollateralModalProps> = ({
  partnerCap,
  modalType,
  onClose,
  onRefresh
}) => {
  const { suiBalance, refreshData } = useAlphaContext();
  const { currentWallet } = useCurrentWallet();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  // Collateral form state
  const [suiAmount, setSuiAmount] = useState('');
  const [usdcAmount, setUsdcAmount] = useState('');
  const [nftObjectId, setNftObjectId] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Clear form when modal closes
  const clearCollateralForm = () => {
    setSuiAmount('');
    setUsdcAmount('');
    setNftObjectId('');
    setWithdrawalAmount('');
  };

  const calculateWithdrawableAmount = () => {
    const tvlBackingUsd = partnerCap.currentEffectiveUsdcValue || 0;
    const lifetimeMinted = partnerCap.totalPointsMintedLifetime || 0;
    const requiredBacking = lifetimeMinted / 1000; // Each 1000 AP requires $1 backing
    return Math.max(0, tvlBackingUsd - requiredBacking);
  };

  const handleClose = () => {
    clearCollateralForm();
    onClose();
  };

  // Enhanced SUI collateral top-up
  const handleTopUpSuiCollateral = async () => {
    if (!suiAmount || parseFloat(suiAmount) <= 0) {
      toast.error('Please enter a valid SUI amount');
      return;
    }

    if (!currentWallet?.accounts?.[0]?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    
    try {
      toast.info('🔄 Adding SUI collateral...');
      
      const transaction = await buildAddSuiCollateralTransaction(
        partnerCap.id,
        parseFloat(suiAmount),
        currentWallet.accounts[0].address
      );

      await executeWithSimulation(
        transaction,
        signAndExecuteTransaction,
        `Successfully added ${suiAmount} SUI collateral!`,
        'Failed to add SUI collateral'
      );

      clearCollateralForm();
      handleClose();
      
      // Refresh data
      setTimeout(() => {
        refreshData();
        onRefresh();
      }, 2000);

    } catch (error: any) {
      console.error('Failed to add SUI collateral:', error);
      const { title, message } = formatErrorForToast(error);
      toast.error(<ErrorToast title={title} message={message} />);
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced USDC collateral addition
  const handleAddUsdcCollateral = async () => {
    if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
      toast.error('Please enter a valid USDC amount');
      return;
    }

    if (!currentWallet?.accounts?.[0]?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    
    try {
      toast.info('🔄 Adding USDC collateral...');
      
      const transaction = await buildAddUsdcCollateralTransaction(
        partnerCap.id,
        parseFloat(usdcAmount),
        currentWallet.accounts[0].address
      );

      await executeWithSimulation(
        transaction,
        signAndExecuteTransaction,
        `Successfully added ${usdcAmount} USDC collateral!`,
        'Failed to add USDC collateral'
      );

      clearCollateralForm();
      handleClose();
      
      // Refresh data
      setTimeout(() => {
        refreshData();
        onRefresh();
      }, 2000);

    } catch (error: any) {
      console.error('Failed to add USDC collateral:', error);
      const { title, message } = formatErrorForToast(error);
      toast.error(<ErrorToast title={title} message={message} />);
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced NFT collateral addition
  const handleAddNftCollateral = async () => {
    if (!nftObjectId.trim()) {
      toast.error('Please enter a valid NFT Object ID');
      return;
    }

    if (!currentWallet?.accounts?.[0]?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    
    try {
      toast.info('🔄 Adding NFT collateral...');
      
      const transaction = await buildAddNftCollateralTransaction(
        partnerCap.id,
        nftObjectId.trim(),
        currentWallet.accounts[0].address
      );

      await executeWithSimulation(
        transaction,
        signAndExecuteTransaction,
        'Successfully added NFT collateral!',
        'Failed to add NFT collateral'
      );

      clearCollateralForm();
      handleClose();
      
      // Refresh data
      setTimeout(() => {
        refreshData();
        onRefresh();
      }, 2000);

    } catch (error: any) {
      console.error('Failed to add NFT collateral:', error);
      const { title, message } = formatErrorForToast(error);
      toast.error(<ErrorToast title={title} message={message} />);
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced capital withdrawal
  const handleWithdrawCapital = async () => {
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      toast.error('Please enter a valid withdrawal amount');
      return;
    }

    const amount = parseFloat(withdrawalAmount);
    const maxWithdrawable = calculateWithdrawableAmount();
    
    if (amount > maxWithdrawable) {
      toast.error(`Maximum withdrawable amount is $${maxWithdrawable.toFixed(2)}`);
      return;
    }

    if (!currentWallet?.accounts?.[0]?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    
    try {
      toast.info('🔄 Processing withdrawal...');
      
      const transaction = await buildWithdrawCollateralTransaction(
        partnerCap.id,
        amount,
        currentWallet.accounts[0].address
      );

      await executeWithSimulation(
        transaction,
        signAndExecuteTransaction,
        `Successfully withdrew $${amount.toFixed(2)}!`,
        'Failed to withdraw capital'
      );

      clearCollateralForm();
      handleClose();
      
      // Refresh data
      setTimeout(() => {
        refreshData();
        onRefresh();
      }, 2000);

    } catch (error: any) {
      console.error('Failed to withdraw capital:', error);
      const { title, message } = formatErrorForToast(error);
      toast.error(<ErrorToast title={title} message={message} />);
    } finally {
      setIsProcessing(false);
    }
  };

  const getModalTitle = () => {
    switch (modalType) {
      case 'topup': return 'Increase Collateral';
      case 'add': return 'Add New Collateral';
      case 'withdraw': return 'Withdraw Capital';
      default: return 'Collateral Management';
    }
  };

  const getModalIcon = () => {
    switch (modalType) {
      case 'topup': return '⬆️';
      case 'add': return '➕';
      case 'withdraw': return '⬇️';
      default: return '💰';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getModalIcon()}</span>
            <h3 className="text-xl font-semibold text-white">{getModalTitle()}</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isProcessing}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Status Overview */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
          <h4 className="text-lg font-medium text-white mb-3 flex items-center">
            <span className="mr-2">📊</span>
            Current Status
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-3">
              <p className="text-sm text-gray-400">TVL Backing</p>
              <p className="text-lg font-semibold text-white">{formatUSD(partnerCap.currentEffectiveUsdcValue || 0)}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3">
              <p className="text-sm text-gray-400">Your SUI Balance</p>
              <div className="flex items-center space-x-2">
                <p className="text-lg font-semibold text-white">{formatSui(suiBalance)}</p>
                <img src={suiLogo} alt="SUI" className="w-4 h-4 rounded-full" />
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3">
              <p className="text-sm text-gray-400">Withdrawable</p>
              <p className="text-lg font-semibold text-white">{formatUSD(calculateWithdrawableAmount())}</p>
            </div>
          </div>
        </div>

        {/* Modal Content Based on Type */}
        {modalType === 'withdraw' ? (
          /* Withdrawal Section */
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h5 className="text-white font-medium mb-3 flex items-center">
                <span className="mr-2">💸</span>
                Withdraw Capital
              </h5>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Withdrawal Amount (USD)
                  </label>
                  <Input
                    type="number"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder={`Max: ${calculateWithdrawableAmount().toFixed(2)}`}
                    min="0"
                    step="0.01"
                    max={calculateWithdrawableAmount()}
                    className="w-full"
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    You can only withdraw capital that isn't backing already minted Alpha Points.
                    Each 1000 AP requires $1 USD backing.
                  </p>
                </div>

                <div className="p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <span className="text-orange-400 text-sm">⚠️</span>
                    <div className="text-xs text-orange-300">
                      <strong>Important:</strong> Withdrawing capital will reduce your daily and lifetime 
                      point minting quotas proportionally. Your ability to create new perks may be affected.
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  onClick={handleWithdrawCapital}
                  disabled={
                    isProcessing || 
                    !withdrawalAmount || 
                    parseFloat(withdrawalAmount || '0') <= 0 ||
                    parseFloat(withdrawalAmount || '0') > calculateWithdrawableAmount()
                  }
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : 'Withdraw Capital'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Add Collateral Section */
          <div className="space-y-6">
            <h4 className="text-lg font-medium text-white flex items-center">
              <span className="mr-2">💰</span>
              Add Collateral
            </h4>

            {/* SUI Collateral */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <img src={suiLogo} alt="SUI" className="w-8 h-8 rounded-full" />
                <h5 className="text-white font-medium">Add SUI Collateral</h5>
              </div>
              <div className="space-y-3">
                <Input
                  type="number"
                  value={suiAmount}
                  onChange={(e) => setSuiAmount(e.target.value)}
                  placeholder="Amount in SUI"
                  min="0"
                  step="0.1"
                  className="w-full"
                  disabled={isProcessing}
                />
                <Button
                  onClick={handleTopUpSuiCollateral}
                  disabled={!suiAmount || parseFloat(suiAmount) <= 0 || isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? 'Processing...' : 'Add SUI Collateral'}
                </Button>
              </div>
            </div>

            {/* USDC Collateral */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  $
                </div>
                <h5 className="text-white font-medium">Add USDC Collateral</h5>
              </div>
              <div className="space-y-3">
                <Input
                  type="number"
                  value={usdcAmount}
                  onChange={(e) => setUsdcAmount(e.target.value)}
                  placeholder="Amount in USDC"
                  min="0"
                  step="0.01"
                  className="w-full"
                  disabled={isProcessing}
                />
                <Button
                  onClick={handleAddUsdcCollateral}
                  disabled={!usdcAmount || parseFloat(usdcAmount) <= 0 || isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? 'Processing...' : 'Add USDC Collateral'}
                </Button>
              </div>
            </div>

            {/* NFT Collateral */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  N
                </div>
                <h5 className="text-white font-medium">Add NFT Collateral</h5>
              </div>
              <div className="space-y-3">
                <Input
                  type="text"
                  value={nftObjectId}
                  onChange={(e) => setNftObjectId(e.target.value)}
                  placeholder="NFT Object ID (0x...)"
                  className="w-full font-mono text-sm"
                  disabled={isProcessing}
                />
                <p className="text-xs text-gray-400">
                  Enter the Object ID of the NFT you want to use as collateral. The NFT will be held in escrow.
                </p>
                <Button
                  onClick={handleAddNftCollateral}
                  disabled={!nftObjectId.trim() || isProcessing}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isProcessing ? 'Processing...' : 'Add NFT Collateral'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-6 mt-6 border-t border-gray-700">
          <Button 
            className="flex-1 bg-gray-600 hover:bg-gray-700"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}; 