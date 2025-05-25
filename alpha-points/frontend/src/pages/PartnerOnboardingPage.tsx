import React, { useState, useEffect } from 'react';
import { useCurrentWallet } from '@mysten/dapp-kit';
import { usePartnerOnboarding } from '../hooks/usePartnerOnboarding';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toast } from 'react-toastify';

const SUI_INPUT_DECIMALS = 9; // Standard SUI decimals

export function PartnerOnboardingPage() {
  const { currentWallet } = useCurrentWallet();
  const { createPartnerCap, isLoading, error, transactionDigest } = usePartnerOnboarding();

  const [partnerName, setPartnerName] = useState('');
  const [suiAmount, setSuiAmount] = useState('');

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
    if (transactionDigest) {
      toast.success(`Partner Cap creation successful! Digest: ${transactionDigest}`);
      setPartnerName('');
      setSuiAmount('');
    }
  }, [error, transactionDigest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWallet) {
      toast.error('Please connect your wallet.');
      return;
    }
    const suiAmountNumber = parseFloat(suiAmount);
    if (isNaN(suiAmountNumber) || suiAmountNumber <= 0) {
      toast.error('Please enter a valid SUI collateral amount.');
      return;
    }
    if (!partnerName.trim()) {
      toast.error('Please enter a partner name.');
      return;
    }
    const suiAmountMist = BigInt(Math.floor(suiAmountNumber * Math.pow(10, SUI_INPUT_DECIMALS)));
    await createPartnerCap(partnerName.trim(), suiAmountMist);
  };

  return (
    <div className="container mx-auto p-4 text-white">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Become an Alpha Points Partner</h1>
        <p className="text-gray-400">
          Activate your Partner Capability to mint and distribute Alpha Points to your users.
        </p>
      </div>

      {/* Instructional Cards */}
      <div className="bg-background-card rounded-lg shadow-lg mb-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-background p-4 rounded-lg">
            <div className="text-4xl text-primary mb-3 text-center">①</div>
            <h3 className="font-medium text-center mb-2">Provide Collateral</h3>
            <p className="text-gray-400 text-sm text-center">
              Lock SUI as collateral. The value of this SUI (determined by oracle) dictates your daily Alpha Point minting quota.
              {/* TODO: Confirm if SUI is burned or just locked. Update text accordingly. */}
            </p>
          </div>
          
          <div className="bg-background p-4 rounded-lg">
            <div className="text-4xl text-primary mb-3 text-center">②</div>
            <h3 className="font-medium text-center mb-2">Define Your Quota</h3>
            <p className="text-gray-400 text-sm text-center">
              For example, each 1 USDC of SUI collateral value might grant a 1000 daily Alpha Points minting quota.
              {/* TODO: Clarify quota calculation details. */}
            </p>
          </div>
          
          <div className="bg-background p-4 rounded-lg">
            <div className="text-4xl text-primary mb-3 text-center">③</div>
            <h3 className="font-medium text-center mb-2">Receive PartnerCap</h3>
            <p className="text-gray-400 text-sm text-center">
              Upon successful collateralization, you'll receive a PartnerCap NFT, enabling you to mint points via our dashboard or API.
            </p>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-4 text-center text-gray-400 text-sm">
          Note: Ensure you understand the terms of collateralization. 
          {/* TODO: Add specific terms here once clarified (e.g., burned, locked indefinitely, specific unlock conditions). */}
        </div>
      </div>

      {/* Onboarding Form */}
      <div className="bg-background-card rounded-lg shadow-lg p-6 md:p-8 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-6 text-center">Create Your Partner Capability</h2>
        {!currentWallet && (
          <p className="text-red-500 mb-4 text-center">Please connect your wallet to proceed.</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="partnerName" className="block text-sm font-medium text-gray-300 mb-1">
              Partner Name
            </label>
            <Input
              type="text"
              id="partnerName"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Your Company / Project Name"
              disabled={isLoading || !currentWallet}
              className="w-full" // Assuming Input component handles dark mode styling internally
            />
          </div>
          <div>
            <label htmlFor="suiAmount" className="block text-sm font-medium text-gray-300 mb-1">
              SUI Collateral Amount
            </label>
            <Input
              type="number"
              id="suiAmount"
              value={suiAmount}
              onChange={(e) => setSuiAmount(e.target.value)}
              placeholder="e.g., 100"
              step="any"
              disabled={isLoading || !currentWallet}
              className="w-full"
            />
          </div>
          <Button type="submit" disabled={isLoading || !currentWallet} className="w-full py-2.5">
            {isLoading ? 'Processing...' : 'Create Partner Cap'}
          </Button>
        </form>
      </div>
    </div>
  );
} 